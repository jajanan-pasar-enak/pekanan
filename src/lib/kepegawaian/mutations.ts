import { and, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { karyawan, laporanAnggota, laporanPekan, pekan, user } from "@/db/schema";
import { auth } from "@/lib/auth/server";
import {
  kunciSupervisi,
  periksaSupervisor,
  sqlSupervisorMembentukSiklus,
  type Level,
  type Tx,
} from "@/lib/auth/otorisasi";
import { AppError } from "@/lib/http";
import { siapkanDrafPekanBerjalan } from "@/lib/pekan/bootstrap";
import { pekanWIB } from "@/lib/waktu";
import { alasanNonaktifDitolak, karyawanBaruSchema, ubahKaryawanSchema } from "./aturan";

export type Posisi = {
  id: string;
  userId: string;
  nama: string;
  level: Level;
  supervisorId: string | null;
  aktif: boolean;
};

async function posisiKaryawan(tx: Tx, id: string): Promise<Posisi> {
  const [row] = await tx
    .select({
      id: karyawan.id,
      userId: karyawan.userId,
      nama: karyawan.nama,
      level: karyawan.level,
      supervisorId: karyawan.supervisorId,
      aktif: karyawan.aktif,
    })
    .from(karyawan)
    .where(eq(karyawan.id, id))
    .limit(1);
  if (!row) throw new AppError("NOT_FOUND", "Karyawan tidak ditemukan.");
  return { ...row, level: row.level as Level };
}

async function hitungBeban(tx: Tx, id: string) {
  const [row] = await tx
    .select({
      anggota: sql<number>`(SELECT count(*)::int FROM karyawan a WHERE a.supervisor_id = ${id}::uuid)`,
      klien: sql<number>`(SELECT count(*)::int FROM klien c WHERE c.karyawan_id = ${id}::uuid)`,
    })
    .from(karyawan)
    .where(eq(karyawan.id, id))
    .limit(1);
  return row ?? { anggota: 0, klien: 0 };
}

async function pastikanSupervisor(tx: Tx, pemilik: Posisi, supervisorId: string) {
  const [siklus] = await tx
    .select({ ada: sql<boolean>`${sqlSupervisorMembentukSiklus(pemilik.id, supervisorId)}` })
    .from(karyawan)
    .where(eq(karyawan.id, pemilik.id))
    .limit(1);
  if (siklus?.ada) {
    throw new AppError(
      "VALIDATION",
      "Supervisor yang dipilih adalah turunan karyawan ini; relasi akan membentuk siklus.",
    );
  }
}

// Baris Draf pekan berjalan pindah ke Draf supervisor baru. Baris yang sudah
// berisi nilai tetap di laporan lama (CONTEXT: data yang sudah tercatat tidak
// hilang); Draf lama yang tersisa kosong dihapus.
async function pindahkanBarisDraf(tx: Tx, anggotaId: string, lama: string, baru: string) {
  await siapkanDrafPekanBerjalan(baru);
  const mulai = pekanWIB().mulai;

  const [laporanBaru] = await tx
    .select({ id: laporanPekan.id })
    .from(laporanPekan)
    .innerJoin(pekan, eq(pekan.id, laporanPekan.pekanId))
    .where(
      and(
        eq(laporanPekan.supervisorId, baru),
        eq(laporanPekan.status, "Draf"),
        eq(pekan.mulai, mulai),
        isNull(laporanPekan.deletedAt),
      ),
    )
    .limit(1);
  if (!laporanBaru) return;

  // UPDATE tidak mendukung ON CONFLICT; lewati bila baris kosong untuk
  // anggota ini sudah ada di Draf baru (Draf baru pasti sudah diisi barisnya).
  await tx.execute(sql`
    UPDATE laporan_anggota la SET laporan_id = ${laporanBaru.id}::uuid
    WHERE la.anggota_id = ${anggotaId}::uuid
      AND la.laporan_id IN (
        SELECT lp.id FROM laporan_pekan lp JOIN pekan p ON p.id = lp.pekan_id
        WHERE lp.supervisor_id = ${lama}::uuid AND lp.status = 'Draf'
          AND lp.deleted_at IS NULL AND p.mulai = ${mulai}::date
      )
      AND la.kehadiran IS NULL
      AND la.media_online IS NULL
      AND la.media_offline IS NULL
      AND la.one_on_one IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM laporan_anggota x
        WHERE x.laporan_id = ${laporanBaru.id}::uuid AND x.anggota_id = la.anggota_id
      )
  `);

  await tx.execute(sql`
    DELETE FROM laporan_pekan lp
    WHERE lp.supervisor_id = ${lama}::uuid AND lp.status = 'Draf' AND lp.deleted_at IS NULL
      AND lp.pekan_id IN (SELECT id FROM pekan WHERE mulai = ${mulai}::date)
      AND NOT EXISTS (SELECT 1 FROM laporan_anggota la WHERE la.laporan_id = lp.id)
  `);
}

export type HasilUbahKaryawan = {
  sesudah: Posisi;
  perluCabutSesi: boolean;
  userId: string;
};

export async function ubahKaryawan(
  id: string,
  input: unknown,
  headers: Headers,
): Promise<HasilUbahKaryawan> {
  const body = ubahKaryawanSchema.parse(input);

  const hasil = await db.transaction(async (tx) => {
    // Serialisasi semua perubahan supervisi: guard siklus membaca & menulis
    // relasi yang sama.
    await kunciSupervisi(tx);
    const sekarang = await posisiKaryawan(tx, id);
    const levelBaru = body.level ?? sekarang.level;
    const supervisorBaru =
      body.supervisorId === undefined ? sekarang.supervisorId : body.supervisorId;
    const berubahSupervisor = supervisorBaru !== sekarang.supervisorId;

    if (berubahSupervisor) {
      if (supervisorBaru !== null) await pastikanSupervisor(tx, sekarang, supervisorBaru);
    }

    // Supervisor harus aktif; Magang wajib dibimbing Karyawan Tetap.
    const masalahLevel = await periksaSupervisor(levelBaru, supervisorBaru);
    if (masalahLevel) throw new AppError("VALIDATION", masalahLevel);

    // Demote ditolak bila karyawan ini membimbing Magang, karena seorang
    // Magang tidak boleh membimbing Magang. Magang yang masih punya
    // supervisor juga ditolak (struktur harus dilepas eksplisit dulu).
    if (sekarang.level === "Tetap" && levelBaru === "Magang") {
      const [bimbing] = await tx
        .select({ n: sql<number>`count(*)::int` })
        .from(karyawan)
        .where(and(eq(karyawan.supervisorId, id), eq(karyawan.level, "Magang")));
      const turunanBermasalah = (bimbing?.n ?? 0) > 0 || supervisorBaru !== null;
      if (turunanBermasalah) {
        throw new AppError(
          "VALIDATION",
          (bimbing?.n ?? 0) > 0
            ? "Karyawan ini masih membimbing Magang dan tidak bisa dijadikan Magang."
            : "Karyawan yang punya supervisor tidak bisa dijadikan Magang; lepaskan supervisornya dulu.",
        );
      }
    }

    if (body.aktif === false && sekarang.aktif) {
      const beban = await hitungBeban(tx, id);
      const masalah = alasanNonaktifDitolak({
        ...beban,
        anggotaBerkasAtasan: sekarang.supervisorId !== null,
        denganSupervisorBaru: supervisorBaru !== null && berubahSupervisor,
      });
      if (masalah) throw new AppError("VALIDATION", masalah, beban);
    }

    // Drizzle menolak `.set({})`; bila tidak ada kolom yang berubah, lewati.
    const perubahan = {
      ...(body.nama !== undefined ? { nama: body.nama } : {}),
      ...(body.level !== undefined ? { level: body.level } : {}),
      ...(berubahSupervisor ? { supervisorId: supervisorBaru } : {}),
      ...(body.aktif !== undefined ? { aktif: body.aktif } : {}),
    };
    if (Object.keys(perubahan).length > 0) {
      await tx.update(karyawan).set(perubahan).where(eq(karyawan.id, id));
    }

    if (body.nama !== undefined) {
      await tx.update(user).set({ name: body.nama }).where(eq(user.id, sekarang.userId));
    }

    if (berubahSupervisor && supervisorBaru !== null) {
      await pindahkanBarisDraf(tx, id, sekarang.supervisorId ?? "", supervisorBaru);
    }

    return {
      sesudah: await posisiKaryawan(tx, id),
      perluCabutSesi: body.aktif === false && sekarang.aktif,
      userId: sekarang.userId,
    };
  });

  // Pencabutan sesi tidak boleh di dalam transaksi: revokeUserSessions
  // memakai koneksi pool sendiri. Endpoint admin mewajibkan sesi admin.
  if (hasil.perluCabutSesi) {
    await auth.api.revokeUserSessions({
      body: { userId: hasil.userId },
      headers,
    });
  }
  return hasil;
}

// Pembuatan karyawan: validasi dulu agar pesan error konsisten, lalu
// auth.api.createUser (databaseHooks menulis profil karyawan).
export async function buatKaryawan(input: unknown, headers: Headers) {
  const { admin, ...baru } = karyawanBaruSchema.parse(input);
  const hasil = await auth.api.createUser({
    body: {
      name: baru.nama,
      email: baru.email.toLowerCase(),
      password: baru.password,
      role: admin ? "admin" : "user",
      data: { level: baru.level, supervisorId: baru.supervisorId },
    },
    headers,
  });
  if (!hasil?.user) throw new AppError("INTERNAL", "Karyawan gagal dibuat.");
  return {
    userId: hasil.user.id,
    email: hasil.user.email,
    nama: hasil.user.name,
    level: baru.level,
    supervisorId: baru.supervisorId,
    harusGantiPassword: true,
  };
}
