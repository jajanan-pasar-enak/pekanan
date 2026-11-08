import { z } from "zod";

const kosongJadiNull = (v: unknown) => (typeof v === "string" && v.trim() === "" ? null : v);

// Tanggal follow-up tidak boleh di masa depan (hari ini WIB masih sah; CHECK DB juga).
export function tanggalFollowupSah(tanggal: string, hariIni: string): boolean {
  return tanggal <= hariIni;
}

export const klienSchema = z.object({
  nama: z.string().trim().min(1, "Nama klien wajib diisi.").max(200),
  kontak: z.preprocess(kosongJadiNull, z.string().trim().max(200).nullable()).default(null),
});

export const followupSchema = z.object({
  tanggal: z.iso.date("Tanggal follow-up tidak valid."),
  hasilFollowupId: z.uuid("Hasil follow-up tidak valid."),
  deskripsi: z.preprocess(kosongJadiNull, z.string().trim().max(2000).nullable()).default(null),
});

export const ubahFollowupSchema = z.object({
  tanggal: z.iso.date("Tanggal follow-up tidak valid."),
  hasilFollowupId: z.uuid("Hasil follow-up tidak valid."),
  deskripsi: z.preprocess(kosongJadiNull, z.string().trim().max(2000).nullable()).default(null),
  alasan: z.string().trim().min(1, "Alasan perubahan wajib diisi.").max(2000),
});

// Hapus follow-up juga wajib alasan: jejaknya disimpan di riwayat perubahan.
export const hapusFollowupSchema = z.object({
  alasan: z.string().trim().min(1, "Alasan penghapusan wajib diisi.").max(2000),
});

export type NilaiFollowup = {
  tanggal: string;
  hasilFollowupId: string;
  deskripsi: string | null;
};

// Hanya kolom yang benar-benar berubah; kosong = tidak ada yang perlu disimpan.
export function diffFollowup(
  sebelum: NilaiFollowup,
  sesudah: NilaiFollowup,
): Partial<NilaiFollowup> {
  const hasil: Partial<NilaiFollowup> = {};
  if (sebelum.tanggal !== sesudah.tanggal) hasil.tanggal = sesudah.tanggal;
  if (sebelum.hasilFollowupId !== sesudah.hasilFollowupId) {
    hasil.hasilFollowupId = sesudah.hasilFollowupId;
  }
  if ((sebelum.deskripsi ?? null) !== (sesudah.deskripsi ?? null)) {
    hasil.deskripsi = sesudah.deskripsi;
  }
  return hasil;
}

// Pemilik klien, atau Atasan Supervisor langsung pemilik. Admin tidak (sama
// seperti riwayat follow-up: Admin hanya mengalihkan kepemilikan).
export function bolehKelolaFollowup(
  viewerId: string,
  pemilik: { id: string; supervisorId: string | null },
): boolean {
  return viewerId === pemilik.id || pemilik.supervisorId === viewerId;
}

export const alihKlienSchema = z.object({
  keKaryawanId: z.uuid("Karyawan tujuan tidak valid."),
});

export const hasilFollowupSchema = z.object({
  nama: z.string().trim().min(1, "Nama hasil follow-up wajib diisi.").max(100),
  urutan: z.number().int().min(0).default(0),
  aktif: z.boolean().default(true),
});

export type KlienInput = z.infer<typeof klienSchema>;
export type FollowupInput = z.infer<typeof followupSchema>;
export type UbahFollowupInput = z.infer<typeof ubahFollowupSchema>;
export type HapusFollowupInput = z.infer<typeof hapusFollowupSchema>;
