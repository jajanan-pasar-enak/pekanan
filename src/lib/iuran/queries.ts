import { and, asc, desc, eq, or } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/db";
import { karyawan, nominalIuran, pembayaranIuran } from "@/db/schema";
import { AppError } from "@/lib/http";

const pencatat = alias(karyawan, "pencatat");

export type PembayaranRingkas = {
  id: string;
  bulan: string;
  tanggalBayar: string;
  nominal: { id: string; nama: string; nominal: number };
  karyawan: { id: string; nama: string };
  pencatat: { id: string; nama: string };
  olehSupervisor: boolean;
};

export async function daftarNominalIuran(hanyaAktif = false) {
  return db
    .select({
      id: nominalIuran.id,
      nama: nominalIuran.nama,
      nominal: nominalIuran.nominal,
      aktif: nominalIuran.aktif,
    })
    .from(nominalIuran)
    .where(hanyaAktif ? eq(nominalIuran.aktif, true) : undefined)
    .orderBy(desc(nominalIuran.aktif), asc(nominalIuran.nominal));
}

// GET: tanpa `karyawanId` → semua pembayaran saya dan Anggota Langsung saya.
// Dengan `karyawanId` → hanya itu, bila itu saya atau Anggota Langsung saya.
export async function daftarPembayaran(
  viewerId: string,
  karyawanId?: string,
): Promise<PembayaranRingkas[]> {
  const semua = or(eq(pembayaranIuran.karyawanId, viewerId), eq(karyawan.supervisorId, viewerId));

  if (karyawanId && karyawanId !== viewerId) {
    const [anggota] = await db
      .select({ id: karyawan.id })
      .from(karyawan)
      .where(and(eq(karyawan.id, karyawanId), eq(karyawan.supervisorId, viewerId)))
      .limit(1);
    if (!anggota) throw new AppError("NOT_FOUND", "Karyawan tidak ditemukan.");
  }

  const rows = await db
    .select({
      id: pembayaranIuran.id,
      bulan: pembayaranIuran.bulan,
      tanggalBayar: pembayaranIuran.tanggalBayar,
      nominal: {
        id: nominalIuran.id,
        nama: nominalIuran.nama,
        nominal: nominalIuran.nominal,
      },
      karyawan: { id: karyawan.id, nama: karyawan.nama },
      pencatat: { id: pencatat.id, nama: pencatat.nama },
    })
    .from(pembayaranIuran)
    .innerJoin(karyawan, eq(karyawan.id, pembayaranIuran.karyawanId))
    .innerJoin(nominalIuran, eq(nominalIuran.id, pembayaranIuran.nominalIuranId))
    .innerJoin(pencatat, eq(pencatat.id, pembayaranIuran.pencatatId))
    .where(karyawanId ? eq(pembayaranIuran.karyawanId, karyawanId) : semua)
    .orderBy(desc(pembayaranIuran.bulan));

  return rows.map((r) => ({ ...r, olehSupervisor: r.pencatat.id !== r.karyawan.id }));
}

export type RekapIuranBulan = {
  bulan: string;
  karyawanId: string;
  nama: string;
  nominal: number | null;
  lunas: boolean;
};

// Tampilan 12 bulan untuk satu karyawan (biasa dipakai halaman /iuran).
export async function rekapIuranKaryawan(
  karyawanId: string,
  dariBulan: string,
  sampaiBulan: string,
): Promise<RekapIuranBulan[]> {
  const [k] = await db
    .select({ nama: karyawan.nama })
    .from(karyawan)
    .where(eq(karyawan.id, karyawanId))
    .limit(1);
  if (!k) throw new AppError("NOT_FOUND", "Karyawan tidak ditemukan.");

  const bayar = await db
    .select({ bulan: pembayaranIuran.bulan, nominal: nominalIuran.nominal })
    .from(pembayaranIuran)
    .innerJoin(nominalIuran, eq(nominalIuran.id, pembayaranIuran.nominalIuranId))
    .where(eq(pembayaranIuran.karyawanId, karyawanId));
  const perBulan = new Map(bayar.map((b) => [b.bulan, b.nominal]));

  const hasil: RekapIuranBulan[] = [];
  let [tahun, bulan] = dariBulan.split("-").map(Number);
  while (true) {
    const iso = `${tahun}-${String(bulan).padStart(2, "0")}-01`;
    if (iso > sampaiBulan) break;
    hasil.push({
      bulan: iso,
      karyawanId,
      nama: k.nama,
      nominal: perBulan.get(iso) ?? null,
      lunas: perBulan.has(iso),
    });
    bulan! += 1;
    if (bulan! > 12) {
      bulan = 1;
      tahun! += 1;
    }
  }
  return hasil;
}
