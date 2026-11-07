import { and, asc, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { followup, hasilFollowup, karyawan, klien } from "@/db/schema";
import { AppError } from "@/lib/http";

export type KlienRingkas = {
  id: string;
  nama: string;
  kontak: string | null;
  pemilik: { id: string; nama: string };
  jumlahFollowup: number;
  followupTerakhir: string | null;
};

export type FollowupRingkas = {
  id: string;
  tanggal: string;
  hasil: { id: string; nama: string };
  deskripsi: string | null;
  pencatat: { id: string; nama: string };
  createdAt: Date;
};

export type KlienDetail = {
  id: string;
  nama: string;
  kontak: string | null;
  pemilik: { id: string; nama: string };
  bolehCatat: boolean;
  followup: FollowupRingkas[];
};

export async function daftarKlienSaya(karyawanId: string): Promise<KlienRingkas[]> {
  return db
    .select({
      id: klien.id,
      nama: klien.nama,
      kontak: klien.kontak,
      pemilik: { id: karyawan.id, nama: karyawan.nama },
      jumlahFollowup: sql<number>`(SELECT count(*)::int FROM followup f WHERE f.klien_id = ${klien.id})`,
      followupTerakhir: sql<string | null>`(SELECT max(f.tanggal)::text FROM followup f WHERE f.klien_id = ${klien.id})`,
    })
    .from(klien)
    .innerJoin(karyawan, eq(karyawan.id, klien.karyawanId))
    .where(eq(klien.karyawanId, karyawanId))
    .orderBy(asc(klien.nama));
}

// Riwayat follow-up: pemilik klien atau Atasan Supervisor langsung pemilik
// (bukan Admin — Admin hanya mengalihkan kepemilikan).
export async function getKlien(id: string, viewerId: string): Promise<KlienDetail> {
  const [row] = await db
    .select({
      id: klien.id,
      nama: klien.nama,
      kontak: klien.kontak,
      pemilikId: klien.karyawanId,
      pemilikNama: karyawan.nama,
      pemilikSupervisorId: karyawan.supervisorId,
    })
    .from(klien)
    .innerJoin(karyawan, eq(karyawan.id, klien.karyawanId))
    .where(eq(klien.id, id))
    .limit(1);

  const bolehBaca =
    row && (row.pemilikId === viewerId || row.pemilikSupervisorId === viewerId);
  if (!row || !bolehBaca) throw new AppError("NOT_FOUND", "Klien tidak ditemukan.");

  const riwayat = await db
    .select({
      id: followup.id,
      tanggal: followup.tanggal,
      hasil: { id: hasilFollowup.id, nama: hasilFollowup.nama },
      deskripsi: followup.deskripsi,
      pencatat: { id: karyawan.id, nama: karyawan.nama },
      createdAt: followup.createdAt,
    })
    .from(followup)
    .innerJoin(hasilFollowup, eq(hasilFollowup.id, followup.hasilFollowupId))
    .innerJoin(karyawan, eq(karyawan.id, followup.createdBy))
    .where(eq(followup.klienId, id))
    .orderBy(desc(followup.tanggal), desc(followup.createdAt));

  return {
    id: row.id,
    nama: row.nama,
    kontak: row.kontak,
    pemilik: { id: row.pemilikId, nama: row.pemilikNama },
    bolehCatat: row.pemilikId === viewerId,
    followup: riwayat,
  };
}

export async function daftarHasilFollowup(hanyaAktif = false) {
  return db
    .select({
      id: hasilFollowup.id,
      nama: hasilFollowup.nama,
      urutan: hasilFollowup.urutan,
      aktif: hasilFollowup.aktif,
    })
    .from(hasilFollowup)
    .where(hanyaAktif ? eq(hasilFollowup.aktif, true) : undefined)
    .orderBy(asc(hasilFollowup.urutan), asc(hasilFollowup.nama));
}

export async function klienMilik(id: string, karyawanId: string) {
  const [row] = await db
    .select({ id: klien.id, pemilikId: klien.karyawanId, nama: klien.nama })
    .from(klien)
    .where(and(eq(klien.id, id), eq(klien.karyawanId, karyawanId)))
    .limit(1);
  return row ?? null;
}
