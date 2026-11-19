import { and, asc, desc, eq, inArray, or } from "drizzle-orm";
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

// Tampilan 12 bulan untuk sekumpulan karyawan dalam dua query, bukan dua per orang.
export async function rekapIuranBanyak(
  karyawanIds: string[],
  dariBulan: string,
  sampaiBulan: string,
): Promise<Map<string, RekapIuranBulan[]>> {
  const ids = [...new Set(karyawanIds)];

  const [orang, bayar] = await Promise.all([
    db
      .select({ id: karyawan.id, nama: karyawan.nama })
      .from(karyawan)
      .where(inArray(karyawan.id, ids)),
    db
      .select({
        karyawanId: pembayaranIuran.karyawanId,
        bulan: pembayaranIuran.bulan,
        nominal: nominalIuran.nominal,
      })
      .from(pembayaranIuran)
      .innerJoin(nominalIuran, eq(nominalIuran.id, pembayaranIuran.nominalIuranId))
      .where(inArray(pembayaranIuran.karyawanId, ids)),
  ]);

  if (orang.length !== ids.length) {
    throw new AppError("NOT_FOUND", "Karyawan tidak ditemukan.");
  }

  const nama = new Map(orang.map((o) => [o.id, o.nama]));
  const perOrang = new Map<string, Map<string, number>>();
  for (const b of bayar) {
    const peta = perOrang.get(b.karyawanId) ?? new Map<string, number>();
    peta.set(b.bulan, b.nominal);
    perOrang.set(b.karyawanId, peta);
  }

  const daftarBulan: string[] = [];
  let [tahun, bulan] = dariBulan.split("-").map(Number) as [number, number];
  while (true) {
    const iso = `${tahun}-${String(bulan).padStart(2, "0")}-01`;
    if (iso > sampaiBulan) break;
    daftarBulan.push(iso);
    bulan += 1;
    if (bulan > 12) {
      bulan = 1;
      tahun += 1;
    }
  }

  const hasil = new Map<string, RekapIuranBulan[]>();
  for (const id of ids) {
    const peta = perOrang.get(id);
    hasil.set(
      id,
      daftarBulan.map((b) => ({
        bulan: b,
        karyawanId: id,
        nama: nama.get(id)!,
        nominal: peta?.get(b) ?? null,
        lunas: peta?.has(b) ?? false,
      })),
    );
  }
  return hasil;
}
