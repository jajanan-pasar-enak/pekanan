import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { followup, followupEdit, hasilFollowup, karyawan, klien } from "@/db/schema";
import { AppError } from "@/lib/http";
import { tanggalHariIni } from "@/lib/waktu";
import {
  alihKlienSchema,
  bolehKelolaFollowup,
  diffFollowup,
  followupSchema,
  hasilFollowupSchema,
  klienSchema,
  tanggalFollowupSah,
  ubahFollowupSchema,
} from "./aturan";

export async function buatKlien(viewerId: string, input: unknown) {
  const body = klienSchema.parse(input);
  const [baru] = await db
    .insert(klien)
    .values({ karyawanId: viewerId, nama: body.nama, kontak: body.kontak })
    .returning({ id: klien.id, nama: klien.nama, kontak: klien.kontak });
  return baru!;
}

// Pengambilalihan Klien (Admin). Target harus Karyawan aktif. Tidak ada
// riwayat pemegangan: klien hanya berpindah pemilik.
export async function alihKlien(klienId: string, input: unknown) {
  const { keKaryawanId } = alihKlienSchema.parse(input);

  const [row] = await db
    .select({ id: klien.id, pemilikId: klien.karyawanId })
    .from(klien)
    .where(eq(klien.id, klienId))
    .limit(1);
  if (!row) throw new AppError("NOT_FOUND", "Klien tidak ditemukan.");

  const [tujuan] = await db
    .select({ id: karyawan.id, nama: karyawan.nama, aktif: karyawan.aktif })
    .from(karyawan)
    .where(eq(karyawan.id, keKaryawanId))
    .limit(1);
  if (!tujuan) throw new AppError("VALIDATION", "Karyawan tujuan tidak ditemukan.");
  if (!tujuan.aktif) throw new AppError("VALIDATION", "Karyawan tujuan sudah nonaktif.");
  if (tujuan.id === row.pemilikId) {
    throw new AppError("VALIDATION", "Karyawan tujuan sudah menjadi pemilik klien ini.");
  }

  await db.update(klien).set({ karyawanId: tujuan.id }).where(eq(klien.id, row.id));
  return { id: row.id, pemilik: { id: tujuan.id, nama: tujuan.nama } };
}

// Admin hanya mengalihkan kepemilikan; orang tanpa hak mendapat 404 agar
// keberadaan klien tidak bocor.
async function klienUntukKelola(klienId: string, viewerId: string) {
  const [row] = await db
    .select({
      id: klien.id,
      pemilik: { id: klien.karyawanId, supervisorId: karyawan.supervisorId },
    })
    .from(klien)
    .innerJoin(karyawan, eq(karyawan.id, klien.karyawanId))
    .where(eq(klien.id, klienId))
    .limit(1);
  if (!row || !bolehKelolaFollowup(viewerId, row.pemilik)) {
    throw new AppError("NOT_FOUND", "Klien tidak ditemukan.");
  }
  return row;
}

async function pastikanHasilAktif(hasilFollowupId: string) {
  const [hasil] = await db
    .select({ id: hasilFollowup.id })
    .from(hasilFollowup)
    .where(and(eq(hasilFollowup.id, hasilFollowupId), eq(hasilFollowup.aktif, true)))
    .limit(1);
  if (!hasil) throw new AppError("VALIDATION", "Hasil follow-up tidak tersedia.");
  return hasil;
}

// created_by selalu pemilik klien: jumlah follow-up per pekan dihitung dari
// kolom itu, jadi catatan atasan tetap terhitung sebagai kerja pemilik.
export async function catatFollowup(klienId: string, viewerId: string, input: unknown) {
  const body = followupSchema.parse(input);
  if (!tanggalFollowupSah(body.tanggal, tanggalHariIni())) {
    throw new AppError("VALIDATION", "Tanggal follow-up tidak boleh di masa depan.");
  }
  const milik = await klienUntukKelola(klienId, viewerId);
  const hasil = await pastikanHasilAktif(body.hasilFollowupId);

  const [baru] = await db
    .insert(followup)
    .values({
      klienId,
      tanggal: body.tanggal,
      hasilFollowupId: hasil.id,
      deskripsi: body.deskripsi,
      createdBy: milik.pemilik.id,
      pencatatSupervisorId: milik.pemilik.id === viewerId ? null : viewerId,
    })
    .returning({ id: followup.id, tanggal: followup.tanggal });
  return baru!;
}

// Edit riwayat: nilai lama + alasan disimpan per perubahan; tanpa diff = 400
// (server menolak perubahan kosong tanpa merusak riwayat).
export async function ubahFollowup(
  followupId: string,
  viewerId: string,
  input: unknown,
) {
  const body = ubahFollowupSchema.parse(input);
  if (!tanggalFollowupSah(body.tanggal, tanggalHariIni())) {
    throw new AppError("VALIDATION", "Tanggal follow-up tidak boleh di masa depan.");
  }

  const [row] = await db
    .select({
      id: followup.id,
      klienId: followup.klienId,
      tanggal: followup.tanggal,
      hasilFollowupId: followup.hasilFollowupId,
      deskripsi: followup.deskripsi,
      pemilik: { id: klien.karyawanId, supervisorId: karyawan.supervisorId },
    })
    .from(followup)
    .innerJoin(klien, eq(klien.id, followup.klienId))
    .innerJoin(karyawan, eq(karyawan.id, klien.karyawanId))
    .where(eq(followup.id, followupId))
    .limit(1);
  if (!row || !bolehKelolaFollowup(viewerId, row.pemilik)) {
    throw new AppError("NOT_FOUND", "Follow-up tidak ditemukan.");
  }
  await pastikanHasilAktif(body.hasilFollowupId);

  const sesudah = {
    tanggal: body.tanggal,
    hasilFollowupId: body.hasilFollowupId,
    deskripsi: body.deskripsi,
  };
  const perubahan = diffFollowup(row, sesudah);
  if (Object.keys(perubahan).length === 0) {
    throw new AppError("VALIDATION", "Tidak ada perubahan yang dikirim.");
  }

  await db.transaction(async (tx) => {
    await tx.insert(followupEdit).values({
      followupId: row.id,
      editorId: viewerId,
      alasan: body.alasan,
      sebelum: {
        tanggal: row.tanggal,
        hasilFollowupId: row.hasilFollowupId,
        deskripsi: row.deskripsi,
      },
      sesudah: {
        tanggal: sesudah.tanggal,
        hasilFollowupId: sesudah.hasilFollowupId,
        deskripsi: sesudah.deskripsi,
      },
    });
    await tx
      .update(followup)
      .set({
        ...perubahan,
        pencatatSupervisorId: viewerId === row.pemilik.id ? undefined : viewerId,
      })
      .where(eq(followup.id, row.id));
  });
  return { id: row.id, ...sesudah };
}

// Master Hasil Follow-up dikelola Admin (tabel master, bukan enum).
export async function tambahHasilFollowup(input: unknown) {
  const body = hasilFollowupSchema.parse(input);
  const [baru] = await db
    .insert(hasilFollowup)
    .values(body)
    .returning({
      id: hasilFollowup.id,
      nama: hasilFollowup.nama,
      urutan: hasilFollowup.urutan,
      aktif: hasilFollowup.aktif,
    });
  return baru!;
}
