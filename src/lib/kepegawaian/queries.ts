import { and, asc, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { followup, karyawan, klien, laporanAnggota, laporanPekan, pekan, user } from "@/db/schema";
import { AppError } from "@/lib/http";

export type KaryawanRingkas = {
  id: string;
  userId: string;
  nama: string;
  email: string;
  level: string;
  supervisorId: string | null;
  supervisorNama: string | null;
  aktif: boolean;
  harusGantiPassword: boolean;
  peran: string;
  anggotaLangsung: number;
  klien: number;
};

export async function daftarKaryawan(): Promise<KaryawanRingkas[]> {
  const rows = await db
    .select({
      id: karyawan.id,
      userId: karyawan.userId,
      nama: karyawan.nama,
      email: user.email,
      level: karyawan.level,
      supervisorId: karyawan.supervisorId,
      supervisorNama: sql<
        string | null
      >`(SELECT nama FROM karyawan s WHERE s.id = ${karyawan.supervisorId})`,
      aktif: karyawan.aktif,
      harusGantiPassword: karyawan.harusGantiPassword,
      peran: user.role,
      anggotaLangsung: sql<number>`(SELECT count(*)::int FROM karyawan a WHERE a.supervisor_id = ${karyawan.id})`,
      klien: sql<number>`(SELECT count(*)::int FROM klien c WHERE c.karyawan_id = ${karyawan.id})`,
    })
    .from(karyawan)
    .innerJoin(user, eq(user.id, karyawan.userId))
    .orderBy(asc(karyawan.aktif), asc(karyawan.nama));
  return rows.map((r) => ({ ...r, peran: r.peran ?? "user" }));
}

export type RekapBaris = {
  anggotaId: string;
  nama: string;
  kehadiran: string | null;
  mediaOnline: number | null;
  mediaOffline: number | null;
  oneOnOne: string | null;
  followup: number;
};

export type RekapPekan = {
  pekan: { id: string; mulai: string; selesai: string };
  baris: RekapBaris[];
  total: {
    anggota: number;
    lengkap: number;
    mediaOnline: number;
    mediaOffline: number;
    followup: number;
  };
};

// Rekap boleh dilihat Supervisor pemilik, Atasan Supervisor langsung pemilik,
// atau Admin. `bolehLihatRekapPemilik` dipakai Atasan/Admin yang tidak
// terhubung langsung; pemilik selalu boleh melihat laporannya sendiri.
function bolehLihat(
  laporan: { supervisorId: string; supervisorSupervisorId: string | null },
  penonton: { karyawanId: string; admin: boolean },
): boolean {
  return (
    penonton.admin ||
    laporan.supervisorId === penonton.karyawanId ||
    laporan.supervisorSupervisorId === penonton.karyawanId
  );
}

// Jumlah follow-up dihitung dari kejadian bertanggal di dalam pekan (WIB),
// bukan angka manual.
export async function getRekapPekan(
  pekanId: string,
  penonton: { karyawanId: string; admin: boolean },
): Promise<RekapPekan> {
  const [p] = await db
    .select({ id: pekan.id, mulai: pekan.mulai, selesai: pekan.selesai })
    .from(pekan)
    .where(eq(pekan.id, pekanId))
    .limit(1);
  if (!p) throw new AppError("NOT_FOUND", "Pekan tidak ditemukan.");

  const laporan = await db
    .select({
      id: laporanPekan.id,
      supervisorId: laporanPekan.supervisorId,
      supervisorSupervisorId: karyawan.supervisorId,
    })
    .from(laporanPekan)
    .innerJoin(karyawan, eq(karyawan.id, laporanPekan.supervisorId))
    .where(and(eq(laporanPekan.pekanId, p.id), isNull(laporanPekan.deletedAt)));

  const terlihat = laporan.filter((l) => bolehLihat(l, penonton));
  if (!penonton.admin && terlihat.length === 0) {
    throw new AppError("NOT_FOUND", "Rekap tidak ditemukan.");
  }
  if (terlihat.length === 0) return kosong(p);

  const baris = await db
    .select({
      anggotaId: laporanAnggota.anggotaId,
      nama: karyawan.nama,
      kehadiran: laporanAnggota.kehadiran,
      mediaOnline: laporanAnggota.mediaOnline,
      mediaOffline: laporanAnggota.mediaOffline,
      oneOnOne: laporanAnggota.oneOnOne,
      followup: sql<number>`(
        SELECT count(*)::int FROM followup f
        WHERE f.created_by = ${laporanAnggota.anggotaId}
          AND f.tanggal BETWEEN ${p.mulai} AND ${p.selesai}
          AND f.deleted_at IS NULL
      )`,
    })
    .from(laporanAnggota)
    .innerJoin(karyawan, eq(karyawan.id, laporanAnggota.anggotaId))
    .where(
      inArray(
        laporanAnggota.laporanId,
        terlihat.map((l) => l.id),
      ),
    )
    .orderBy(asc(karyawan.nama));

  const total = {
    anggota: baris.length,
    lengkap: baris.filter(
      (b) =>
        b.kehadiran !== null &&
        b.mediaOnline !== null &&
        b.mediaOffline !== null &&
        b.oneOnOne !== null,
    ).length,
    mediaOnline: baris.reduce((n, b) => n + (b.mediaOnline ?? 0), 0),
    mediaOffline: baris.reduce((n, b) => n + (b.mediaOffline ?? 0), 0),
    followup: baris.reduce((n, b) => n + b.followup, 0),
  };
  return { pekan: p, baris, total };
}

function kosong(p: { id: string; mulai: string; selesai: string }): RekapPekan {
  return {
    pekan: p,
    baris: [],
    total: { anggota: 0, lengkap: 0, mediaOnline: 0, mediaOffline: 0, followup: 0 },
  };
}

export type RekapRingkas = {
  id: string;
  supervisor: string;
  pekanId: string;
  mulai: string;
  selesai: string;
  status: string;
  diisi: number;
  total: number;
};

// Laporan milik Anggota Langsung viewer, terbaru dulu. Dipakai Atasan untuk
// memilih pekan yang ingin dilihat rekapitulasinya.
export async function daftarRekapAnggota(viewerId: string): Promise<RekapRingkas[]> {
  const rows = await db
    .select({
      id: laporanPekan.id,
      pekanId: pekan.id,
      mulai: pekan.mulai,
      selesai: pekan.selesai,
      status: laporanPekan.status,
      supervisor: karyawan.nama,
    })
    .from(laporanPekan)
    .innerJoin(pekan, eq(pekan.id, laporanPekan.pekanId))
    .innerJoin(karyawan, eq(karyawan.id, laporanPekan.supervisorId))
    .where(and(eq(karyawan.supervisorId, viewerId), isNull(laporanPekan.deletedAt)))
    .orderBy(desc(pekan.mulai), asc(karyawan.nama));

  if (rows.length === 0) return [];

  const barisSemua = await db
    .select({
      laporanId: laporanAnggota.laporanId,
      kehadiran: laporanAnggota.kehadiran,
      mediaOnline: laporanAnggota.mediaOnline,
      mediaOffline: laporanAnggota.mediaOffline,
      oneOnOne: laporanAnggota.oneOnOne,
    })
    .from(laporanAnggota)
    .where(
      inArray(
        laporanAnggota.laporanId,
        rows.map((r) => r.id),
      ),
    );

  const isi = new Map<string, { diisi: number; total: number }>();
  for (const b of barisSemua) {
    const stat = isi.get(b.laporanId) ?? { diisi: 0, total: 0 };
    stat.total += 1;
    if (
      b.kehadiran !== null &&
      b.mediaOnline !== null &&
      b.mediaOffline !== null &&
      b.oneOnOne !== null
    ) {
      stat.diisi += 1;
    }
    isi.set(b.laporanId, stat);
  }

  return rows.map((r) => ({
    id: r.id,
    supervisor: r.supervisor,
    pekanId: r.pekanId,
    mulai: r.mulai,
    selesai: r.selesai,
    status: r.status,
    diisi: isi.get(r.id)?.diisi ?? 0,
    total: isi.get(r.id)?.total ?? 0,
  }));
}
