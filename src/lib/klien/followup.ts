import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { followup, followupEdit, hasilFollowup, karyawan, klien } from "@/db/schema";
import { AppError } from "@/lib/http";
import { daftarAnggotaLangsung } from "@/lib/pekan/bootstrap";
import { bolehKelolaFollowup } from "./aturan";

export type KlienAnggotaLangsung = {
  id: string;
  nama: string;
  klien: { id: string; nama: string }[];
};

export type EditFollowup = {
  id: string;
  editor: { id: string; nama: string };
  alasan: string;
  sebelum: Record<string, unknown>;
  sesudah: Record<string, unknown>;
  createdAt: Date;
};

export type FollowupPekan = {
  id: string;
  klien: { id: string; nama: string };
  tanggal: string;
  hasil: { id: string; nama: string };
  deskripsi: string | null;
  pencatat: { id: string; nama: string };
  // Atasan yang mencatat/mengubah atas nama pemilik; null bila pemilik sendiri.
  olehSupervisor: { id: string; nama: string } | null;
  bolehUbah: boolean;
  edit: EditFollowup[];
};

export type KonteksFollowupPekan = {
  pekan: { mulai: string; selesai: string };
  penyimpan: string;
  bolehTambah: boolean;
  anggota: (KlienAnggotaLangsung & { followup: FollowupPekan[] })[];
};

// Daftar Anggota Langsung beserta klien yang mereka pegang — sumber form tambah
// follow-up dari layar Laporan Pekan.
export async function daftarKlienAnggotaLangsung(
  supervisorId: string,
): Promise<KlienAnggotaLangsung[]> {
  const anggota = await daftarAnggotaLangsung(supervisorId);
  if (anggota.length === 0) return [];
  const daftarKlien = await db
    .select({ id: klien.id, nama: klien.nama, pemilikId: klien.karyawanId })
    .from(klien)
    .where(
      inArray(
        klien.karyawanId,
        anggota.map((a) => a.id),
      ),
    )
    .orderBy(asc(klien.nama));

  return anggota.map((a) => ({
    id: a.id,
    nama: a.nama,
    klien: daftarKlien
      .filter((k) => k.pemilikId === a.id)
      .map((k) => ({ id: k.id, nama: k.nama })),
  }));
}

// Follow-up bertanggal di pekan ini milik Anggota Langsung laporan ini,
// ditambah kliennya (untuk form tambah). Penyimpan = pemilik laporan; yang
// boleh menambah/mengubah: penyimpan atau Atasan Supervisor langsungnya.
export async function daftarFollowupPekan(
  supervisorId: string,
  pekan: { mulai: string; selesai: string },
  viewerId: string,
): Promise<KonteksFollowupPekan> {
  const [penyimpan] = await db
    .select({ id: karyawan.id, nama: karyawan.nama, supervisorId: karyawan.supervisorId })
    .from(karyawan)
    .where(eq(karyawan.id, supervisorId))
    .limit(1);
  if (!penyimpan) throw new AppError("NOT_FOUND", "Laporan tidak ditemukan.");

  const bolehKelola = bolehKelolaFollowup(viewerId, penyimpan);
  const anggota = await daftarKlienAnggotaLangsung(supervisorId);
  const ids = anggota.map((a) => a.id);
  if (ids.length === 0) {
    return { pekan, penyimpan: penyimpan.nama, bolehTambah: false, anggota: [] };
  }

  const baris = await db
    .select({
      id: followup.id,
      klienId: klien.id,
      klienNama: klien.nama,
      pemilikId: klien.karyawanId,
      pemilikSupervisorId: karyawan.supervisorId,
      tanggal: followup.tanggal,
      hasilId: hasilFollowup.id,
      hasilNama: hasilFollowup.nama,
      deskripsi: followup.deskripsi,
      pencatatId: karyawan.id,
      pencatatNama: karyawan.nama,
    })
    .from(followup)
    .innerJoin(klien, eq(klien.id, followup.klienId))
    .innerJoin(hasilFollowup, eq(hasilFollowup.id, followup.hasilFollowupId))
    .innerJoin(karyawan, eq(karyawan.id, followup.createdBy))
    .where(
      and(
        inArray(followup.createdBy, ids),
        sql`${followup.tanggal} BETWEEN ${pekan.mulai} AND ${pekan.selesai}`,
      ),
    )
    .orderBy(desc(followup.tanggal), desc(followup.createdAt));

  const [riwayat, supervisor] = await Promise.all([
    baris.length === 0
      ? Promise.resolve([])
      : db
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
          .where(
            inArray(
              followupEdit.followupId,
              baris.map((b) => b.id),
            ),
          )
          .orderBy(asc(followupEdit.createdAt)),
    db
      .select({ id: karyawan.id, nama: karyawan.nama, supervisorId: karyawan.supervisorId })
      .from(karyawan)
      .where(inArray(karyawan.id, ids)),
  ]);

  const followupPer = new Map<string, FollowupPekan[]>();
  for (const b of baris) {
    const pemilik = supervisor.find((s) => s.id === b.pemilikId)!;
    const daftar = followupPer.get(b.pemilikId) ?? [];
    daftar.push({
      id: b.id,
      klien: { id: b.klienId, nama: b.klienNama },
      tanggal: b.tanggal,
      hasil: { id: b.hasilId, nama: b.hasilNama },
      deskripsi: b.deskripsi,
      pencatat: { id: b.pemilikId, nama: b.pencatatNama },
      // created_by selalu pemilik, jadi pencatat yang berbeda = atasan.
      olehSupervisor:
        b.pencatatId === b.pemilikId
          ? null
          : { id: b.pencatatId, nama: b.pencatatNama },
      bolehUbah: bolehKelolaFollowup(viewerId, pemilik),
      edit: riwayat
        .filter((r) => r.followupId === b.id)
        .map((r) => ({
          id: r.id,
          editor: { id: r.editorId, nama: r.editorNama },
          alasan: r.alasan,
          sebelum: r.sebelum,
          sesudah: r.sesudah,
          createdAt: r.createdAt,
        })),
    });
    followupPer.set(b.pemilikId, daftar);
  }

  return {
    pekan,
    penyimpan: penyimpan.nama,
    bolehTambah: bolehKelola,
    anggota: anggota.map((a) => ({ ...a, followup: followupPer.get(a.id) ?? [] })),
  };
}
