import { z } from "zod";

export const ubahKaryawanSchema = z
  .object({
    nama: z.string().trim().min(1, "Nama wajib diisi.").max(200).optional(),
    level: z.enum(["Magang", "Tetap"]).optional(),
    supervisorId: z.uuid("Supervisor tidak valid.").nullable().optional(),
    aktif: z.boolean().optional(),
  })
  .refine(
    (v) =>
      v.nama !== undefined ||
      v.level !== undefined ||
      v.supervisorId !== undefined ||
      v.aktif !== undefined,
    { message: "Tidak ada perubahan yang dikirim." },
  );

export type UbahKaryawanInput = z.infer<typeof ubahKaryawanSchema>;

export const karyawanBaruSchema = z.object({
  nama: z.string().trim().min(1, "Nama wajib diisi.").max(200),
  email: z.email("Email tidak valid."),
  password: z.string().min(8, "Password awal minimal 8 karakter."),
  level: z.enum(["Magang", "Tetap"]),
  supervisorId: z.uuid("Supervisor tidak valid.").nullable().default(null),
  admin: z.boolean().default(false),
});

// Nonaktif hanya boleh bila tidak ada yang bergantung pada karyawan itu.
// Anggota boleh ditinggal bila ada atasan di atasnya (drafnya naik ke atasan);
// penggantian supervisor eksplisit di transaksi yang sama menggantikan Anggota.
export function alasanNonaktifDitolak({
  anggota,
  klien,
  anggotaBerkasAtasan = false,
  denganSupervisorBaru = false,
}: {
  anggota: number;
  klien: number;
  anggotaBerkasAtasan?: boolean;
  denganSupervisorBaru?: boolean;
}): string | null {
  const bagian: string[] = [];
  if (anggota > 0 && !anggotaBerkasAtasan && !denganSupervisorBaru) {
    bagian.push(`${anggota} Anggota Langsung (pindahkan supervisornya dulu)`);
  }
  if (klien > 0) {
    bagian.push(`${klien} Klien (alihkan dulu lewat Pengambilalihan Klien)`);
  }
  if (bagian.length === 0) return null;
  return `Karyawan masih punya ${bagian.join(" dan ")}.`;
}

// Pengambilalihan Klien: tujuan harus ada, aktif, dan bukan pemilik sekarang.
export function alasanAlihDitolak(
  tujuan: { aktif: boolean } | null,
  pemilikSekarang: string,
  keKaryawanId: string,
): string | null {
  if (!tujuan) return "Karyawan tujuan tidak ditemukan.";
  if (!tujuan.aktif) return "Karyawan tujuan sudah nonaktif.";
  if (keKaryawanId === pemilikSekarang) return "Karyawan tujuan sudah menjadi pemilik klien ini.";
  return null;
}
