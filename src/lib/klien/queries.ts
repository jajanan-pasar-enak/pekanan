import { and, asc, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { followup, followupEdit, hasilFollowup, karyawan, klien } from "@/db/schema";
import { AppError } from "@/lib/http";
import { bolehKelolaFollowup } from "./aturan";

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
  // Atasan yang mencatat/mengedit atas nama pemilik; null bila pemilik sendiri.
  olehSupervisor: { id: string; nama: string } | null;
  bolehUbah: boolean;
  edit: {
    id: string;
    editor: { id: string; nama: string };
    alasan: string;
    sebelum: Record<string, unknown>;
    sesudah: Record<string, unknown>;
    createdAt: Date;
  }[];
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
      jumlahFollowup: sql<number>`(SELECT count(*)::int FROM followup f WHERE f.klien_id = ${klien.id} AND f.deleted_at IS NULL)`,
      followupTerakhir: sql<
        string | null
      >`(SELECT max(f.tanggal)::text FROM followup f WHERE f.klien_id = ${klien.id} AND f.deleted_at IS NULL)`,
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

  const bolehBaca = row && (row.pemilikId === viewerId || row.pemilikSupervisorId === viewerId);
  if (!row || !bolehBaca) throw new AppError("NOT_FOUND", "Klien tidak ditemukan.");

  const riwayat = await db
    .select({
      id: followup.id,
      tanggal: followup.tanggal,
      hasil: { id: hasilFollowup.id, nama: hasilFollowup.nama },
      deskripsi: followup.deskripsi,
      pencatat: { id: karyawan.id, nama: karyawan.nama },
      pencatatSupervisorId: followup.pencatatSupervisorId,
      createdAt: followup.createdAt,
    })
    .from(followup)
    .innerJoin(hasilFollowup, eq(hasilFollowup.id, followup.hasilFollowupId))
    .innerJoin(karyawan, eq(karyawan.id, followup.createdBy))
    .where(and(eq(followup.klienId, id), isNull(followup.deletedAt)))
    .orderBy(desc(followup.tanggal), desc(followup.createdAt));

  const editan = await db
    .select({
      id: followupEdit.id,
      followupId: followupEdit.followupId,
      editorId: karyawan.id,
      editorNama: karyawan.nama,
      alasan: followupEdit.alasan,
      sebelum: followupEdit.sebelum,
      sesudah: followupEdit.sesudah,
      createdAt: followupEdit.createdAt,
    })
    .from(followupEdit)
    .innerJoin(karyawan, eq(karyawan.id, followupEdit.editorId))
    .innerJoin(followup, eq(followup.id, followupEdit.followupId))
    .where(eq(followup.klienId, id))
    .orderBy(asc(followupEdit.createdAt));

  const idAtasan = riwayat
    .map((r) => r.pencatatSupervisorId)
    .filter((v): v is string => v !== null);
  const atasan =
    idAtasan.length === 0
      ? []
      : await db
          .select({ id: karyawan.id, nama: karyawan.nama })
          .from(karyawan)
          .where(inArray(karyawan.id, idAtasan));
  const pemilik = { id: row.pemilikId, supervisorId: row.pemilikSupervisorId };
  const bolehKelola = bolehKelolaFollowup(viewerId, pemilik);

  return {
    id: row.id,
    nama: row.nama,
    kontak: row.kontak,
    pemilik: { id: row.pemilikId, nama: row.pemilikNama },
    bolehCatat: bolehKelola,
    followup: riwayat.map((f) => ({
      id: f.id,
      tanggal: f.tanggal,
      hasil: f.hasil,
      deskripsi: f.deskripsi,
      pencatat: f.pencatat,
      olehSupervisor:
        f.pencatatSupervisorId === null
          ? null
          : {
              id: f.pencatatSupervisorId,
              nama: atasan.find((a) => a.id === f.pencatatSupervisorId)?.nama ?? "Atasan",
            },
      bolehUbah: bolehKelola,
      edit: editan
        .filter((e) => e.followupId === f.id)
        .map((e) => ({
          id: e.id,
          editor: { id: e.editorId, nama: e.editorNama },
          alasan: e.alasan,
          sebelum: e.sebelum,
          sesudah: e.sesudah,
          createdAt: e.createdAt,
        })),
      createdAt: f.createdAt,
    })),
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
