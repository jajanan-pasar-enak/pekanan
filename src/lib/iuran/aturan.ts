import { z } from "zod";

// `bulan` disimpan sebagai tanggal hari pertama bulan itu (YYYY-MM-01).
export function bulanSah(bulan: string): boolean {
  if (!/^\d{4}-\d{2}-01$/.test(bulan)) return false;
  const [tahun, urutanBulan] = bulan.split("-").map(Number);
  return bulan === new Date(Date.UTC(tahun!, urutanBulan! - 1, 1)).toISOString().slice(0, 10);
}

// Hanya bulan berjalan atau bulan lampau; CHECK DB menegakkan hal yang sama.
export function alasanBulanDitolak(bulan: string, bulanBerjalan: string): string | null {
  if (!bulanSah(bulan)) {
    return "Bulan harus berupa tanggal 1 di awal bulan (YYYY-MM-01).";
  }
  if (bulan > bulanBerjalan) return "Iuran bulan mendatang tidak bisa dicatat.";
  return null;
}

export const pembayaranIuranSchema = z.object({
  nominalIuranId: z.uuid("Nominal iuran tidak valid."),
  bulan: z.iso.date("Bulan tidak valid."),
  tanggalBayar: z.iso.date("Tanggal bayar tidak valid.").optional(),
});

export const nominalIuranSchema = z.object({
  nama: z.string().trim().min(1, "Nama nominal wajib diisi.").max(100),
  nominal: z.number().int("Nominal harus bilangan bulat.").min(0, "Nominal tidak boleh negatif."),
  aktif: z.boolean().default(true),
});
