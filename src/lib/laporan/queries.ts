import { and, asc, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  followup,
  karyawan,
  koreksiLaporan,
  laporanAnggota,
  laporanPekan,
  pekan,
} from "@/db/schema";
import { AppError } from "@/lib/http";
import { pekanWIB, tanggalHariIni } from "@/lib/waktu";
import { barisLengkap } from "./aturan";

export type BarisLaporan = {
  anggotaId: string;
  nama: string;
  kehadiran: string | null;
  keteranganHadir: string | null;
  mediaOnline: number | null;
  mediaOffline: number | null;
  oneOnOne: string | null;
  keteranganOneOnOne: string | null;
  followup: number;
};

export type LaporanDetail = {
  id: string;
  pekan: { id: string; mulai: string; selesai: string };
  pekanBerjalan: boolean;
  supervisor: { id: string; nama: string };
  status: string;
  submittedAt: Date | null;
  bolehUbah: boolean;
  bolehKoreksi: boolean;
  baris: BarisLaporan[];
  koreksi: {
    id: string;
    korektor: string;
    alasan: string;
    sebelum: unknown;
    sesudah: unknown;
    createdAt: Date;
  }[];
};

export type LaporanRingkas = {
  id: string;
  pekanId: string;
  mulai: string;
  selesai: string;
  status: string;
  pekanBerjalan: boolean;
  diisi: number;
  total: number;
};

export type PenandaKaryawan = { id: string; supervisorId: string | null };

export function pekanSedangBerjalan(mulai: string): boolean {
  return mulai === pekanWIB().mulai;
}

export function pekanSudahBerakhir(selesai: string): boolean {
  return selesai < tanggalHariIni();
}

// Pemilik boleh ubah selama Draf di pekan berjalan; Atasan Supervisor langsung
// boleh koreksi laporan pekan yang sudah berakhir.
export function bolehUbahLaporan(
  laporan: { status: string; pekanMulai: string },
  viewerId: string,
  pemilikId: string,
): boolean {
  return (
    viewerId === pemilikId &&
    laporan.status === "Draf" &&
    pekanSedangBerjalan(laporan.pekanMulai)
  );
}

export function bolehKoreksiLaporan(
  laporan: { pekanSelesai: string },
  viewerId: string,
  pemilikId: string,
  pengirim: PenandaKaryawan,
): boolean {
  return (
    pengirim.id === pemilikId &&
    pengirim.supervisorId !== null &&
    pengirim.supervisorId === viewerId &&
    pekanSudahBerakhir(laporan.pekanSelesai)
  );
}

async function cariLaporanHidup(id: string) {
  const [row] = await db
    .select({
      id: laporanPekan.id,
      status: laporanPekan.status,
      submittedAt: laporanPekan.submittedAt,
      supervisorId: laporanPekan.supervisorId,
      supervisorNama: karyawan.nama,
      supervisorSupervisorId: karyawan.supervisorId,
      pekanId: pekan.id,
      pekanMulai: pekan.mulai,
      pekanSelesai: pekan.selesai,
    })
    .from(laporanPekan)
    .innerJoin(pekan, eq(pekan.id, laporanPekan.pekanId))
    .innerJoin(karyawan, eq(karyawan.id, laporanPekan.supervisorId))
    .where(and(eq(laporanPekan.id, id), isNull(laporanPekan.deletedAt)))
    .limit(1);
  return row ?? null;
}

export async function getLaporan(id: string, viewerId: string): Promise<LaporanDetail> {
  const laporan = await cariLaporanHidup(id);
  const bolehBaca =
    laporan &&
    (laporan.supervisorId === viewerId ||
      (laporan.supervisorSupervisorId !== null && laporan.supervisorSupervisorId === viewerId));
  if (!laporan || !bolehBaca) {
    throw new AppError("NOT_FOUND", "Laporan tidak ditemukan.");
  }

  const baris = await db
    .select({
      anggotaId: laporanAnggota.anggotaId,
      nama: karyawan.nama,
      kehadiran: laporanAnggota.kehadiran,
      keteranganHadir: laporanAnggota.keteranganHadir,
      mediaOnline: laporanAnggota.mediaOnline,
      mediaOffline: laporanAnggota.mediaOffline,
      oneOnOne: laporanAnggota.oneOnOne,
      keteranganOneOnOne: laporanAnggota.keteranganOneOnOne,
      // Sama dengan rekap: kejadian bertanggal di pekan ini, bukan angka manual.
      followup: sql<number>`(
        SELECT count(*)::int FROM followup f
        WHERE f.created_by = ${laporanAnggota.anggotaId}
          AND f.tanggal BETWEEN ${laporan.pekanMulai} AND ${laporan.pekanSelesai}
      )`,
    })
    .from(laporanAnggota)
    .innerJoin(karyawan, eq(karyawan.id, laporanAnggota.anggotaId))
    .where(eq(laporanAnggota.laporanId, laporan.id))
    .orderBy(asc(karyawan.nama));

  const koreksi = await db
    .select({
      id: koreksiLaporan.id,
      korektor: karyawan.nama,
      alasan: koreksiLaporan.alasan,
      sebelum: koreksiLaporan.sebelum,
      sesudah: koreksiLaporan.sesudah,
      createdAt: koreksiLaporan.createdAt,
    })
    .from(koreksiLaporan)
    .innerJoin(karyawan, eq(karyawan.id, koreksiLaporan.korektorId))
    .where(eq(koreksiLaporan.laporanId, laporan.id))
    .orderBy(desc(koreksiLaporan.createdAt));

  const pengirim = { id: laporan.supervisorId, supervisorId: laporan.supervisorSupervisorId };
  return {
    id: laporan.id,
    pekan: { id: laporan.pekanId, mulai: laporan.pekanMulai, selesai: laporan.pekanSelesai },
    pekanBerjalan: pekanSedangBerjalan(laporan.pekanMulai),
    supervisor: { id: laporan.supervisorId, nama: laporan.supervisorNama },
    status: laporan.status,
    submittedAt: laporan.submittedAt,
    bolehUbah: bolehUbahLaporan(laporan, viewerId, laporan.supervisorId),
    bolehKoreksi: bolehKoreksiLaporan(laporan, viewerId, laporan.supervisorId, pengirim),
    baris,
    koreksi,
  };
}

// Laporan milik viewer (untuk daftar di dashboard).
export async function daftarLaporanSaya(supervisorId: string): Promise<LaporanRingkas[]> {
  const rows = await db
    .select({
      id: laporanPekan.id,
      pekanId: pekan.id,
      mulai: pekan.mulai,
      selesai: pekan.selesai,
      status: laporanPekan.status,
    })
    .from(laporanPekan)
    .innerJoin(pekan, eq(pekan.id, laporanPekan.pekanId))
    .where(and(eq(laporanPekan.supervisorId, supervisorId), isNull(laporanPekan.deletedAt)))
    .orderBy(desc(pekan.mulai));

  const isi = new Map<string, { diisi: number; total: number }>();
  if (rows.length > 0) {
    const barisSemua = await db
      .select({
        laporanId: laporanAnggota.laporanId,
        nilai: {
          kehadiran: laporanAnggota.kehadiran,
          keteranganHadir: laporanAnggota.keteranganHadir,
          mediaOnline: laporanAnggota.mediaOnline,
          mediaOffline: laporanAnggota.mediaOffline,
          oneOnOne: laporanAnggota.oneOnOne,
          keteranganOneOnOne: laporanAnggota.keteranganOneOnOne,
        },
      })
      .from(laporanAnggota)
      .where(inArray(laporanAnggota.laporanId, rows.map((r) => r.id)));
    for (const b of barisSemua) {
      const stat = isi.get(b.laporanId) ?? { diisi: 0, total: 0 };
      stat.total += 1;
      if (barisLengkap(b.nilai)) stat.diisi += 1;
      isi.set(b.laporanId, stat);
    }
  }

  return rows.map((r) => ({
    id: r.id,
    pekanId: r.pekanId,
    mulai: r.mulai,
    selesai: r.selesai,
    status: r.status,
    pekanBerjalan: pekanSedangBerjalan(r.mulai),
    diisi: isi.get(r.id)?.diisi ?? 0,
    total: isi.get(r.id)?.total ?? 0,
  }));
}
