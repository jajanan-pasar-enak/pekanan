import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { followup, hasilFollowup, karyawan, klien } from "@/db/schema";
import { AppError } from "@/lib/http";
import { tanggalHariIni } from "@/lib/waktu";
import {
  alihKlienSchema,
  followupSchema,
  hasilFollowupSchema,
  klienSchema,
  tanggalFollowupSah,
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

export async function catatFollowup(klienId: string, viewerId: string, input: unknown) {
  const body = followupSchema.parse(input);
  const hariIni = tanggalHariIni();
  if (!tanggalFollowupSah(body.tanggal, hariIni)) {
    throw new AppError("VALIDATION", "Tanggal follow-up tidak boleh di masa depan.");
  }

  const [milik] = await db
    .select({ id: klien.id })
    .from(klien)
    .where(and(eq(klien.id, klienId), eq(klien.karyawanId, viewerId)))
    .limit(1);
  if (!milik) throw new AppError("NOT_FOUND", "Klien tidak ditemukan.");

  const [hasil] = await db
    .select({ id: hasilFollowup.id })
    .from(hasilFollowup)
    .where(and(eq(hasilFollowup.id, body.hasilFollowupId), eq(hasilFollowup.aktif, true)))
    .limit(1);
  if (!hasil) throw new AppError("VALIDATION", "Hasil follow-up tidak tersedia.");

  const [baru] = await db
    .insert(followup)
    .values({
      klienId,
      tanggal: body.tanggal,
      hasilFollowupId: hasil.id,
      deskripsi: body.deskripsi,
      createdBy: viewerId,
    })
    .returning({ id: followup.id, tanggal: followup.tanggal });
  return baru!;
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
