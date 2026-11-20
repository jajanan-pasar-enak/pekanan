import { z } from "zod";

export const STATUS_KEHADIRAN = [
  "Tepat Waktu",
  "Terlambat < 15 Menit",
  "Terlambat > 15 Menit",
  "Sakit",
  "Tanpa Keterangan",
] as const;

export const CARA_ONE_ON_ONE = ["Pribadi", "Sebelum Meeting Pekanan", "Alpa"] as const;

export const KOLOM_WAJIB = ["kehadiran", "mediaOnline", "mediaOffline", "oneOnOne"] as const;

export type KolomWajib = (typeof KOLOM_WAJIB)[number];

export type BarisNilai = {
  kehadiran: string | null;
  keteranganHadir: string | null;
  mediaOnline: number | null;
  mediaOffline: number | null;
  oneOnOne: string | null;
  keteranganOneOnOne: string | null;
};

// Kosong = null; string kosong dari form diperlakukan sebagai kosong.
export const patchBarisSchema = z.object({
  kehadiran: z.enum(STATUS_KEHADIRAN).nullable().optional(),
  keteranganHadir: z.string().trim().max(2000).nullable().optional(),
  mediaOnline: z.number().int().min(0).nullable().optional(),
  mediaOffline: z.number().int().min(0).nullable().optional(),
  oneOnOne: z.enum(CARA_ONE_ON_ONE).nullable().optional(),
  keteranganOneOnOne: z.string().trim().max(2000).nullable().optional(),
});

export type PatchBaris = z.infer<typeof patchBarisSchema>;

export function nilaiBarisKosong(): BarisNilai {
  return {
    kehadiran: null,
    keteranganHadir: null,
    mediaOnline: null,
    mediaOffline: null,
    oneOnOne: null,
    keteranganOneOnOne: null,
  };
}

// "Mengisi Sendiri": semua kolom wajib terisi sebelum kirim. Keterangan boleh kosong.
export function kolomKosong(baris: BarisNilai): (typeof KOLOM_WAJIB)[number][] {
  return KOLOM_WAJIB.filter((kolom) => baris[kolom] === null || baris[kolom] === undefined);
}

export function barisLengkap(baris: BarisNilai): boolean {
  return kolomKosong(baris).length === 0;
}

export function normalisasiPatch(patch: PatchBaris): Partial<BarisNilai> {
  const hasil: Partial<BarisNilai> = {};
  for (const [kolom, nilai] of Object.entries(patch) as [keyof BarisNilai, unknown][]) {
    if (nilai === undefined) continue;
    hasil[kolom] = (typeof nilai === "string" && nilai.trim() === "" ? null : nilai) as never;
  }
  return hasil;
}
