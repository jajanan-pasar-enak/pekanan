import { labelKolom, URUTAN_ISIAN } from "./label";

function objek(v: unknown): Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : {};
}

export function teksNilai(v: unknown): string {
  if (v === null || v === undefined || v === "") return "belum diisi";
  return String(v);
}

export type PerubahanKolom = {
  kolom: string;
  label: string;
  sebelum: string;
  sesudah: string;
};

export type PerubahanAnggota = {
  anggotaId: string;
  nama: string;
  perubahan: PerubahanKolom[];
};

// Memetakan snapshot JSON koreksi menjadi kalimat yang bisa dibaca atasan:
// label kolom Bahasa Indonesia, nilai kosong yang jelas, urutan kolom tetap.
export function ringkasPerubahan(
  sebelum: unknown,
  sesudah: unknown,
  namaAnggota: Map<string, string>,
): PerubahanAnggota[] {
  const a = objek(sebelum);
  const b = objek(sesudah);
  const hasil: PerubahanAnggota[] = [];

  for (const anggotaId of new Set([...Object.keys(b), ...Object.keys(a)])) {
    const aa = objek(a[anggotaId]);
    const bb = objek(b[anggotaId]);
    const perubahan = [...new Set([...URUTAN_ISIAN, ...Object.keys(aa), ...Object.keys(bb)])]
      .filter((kolom) => JSON.stringify(aa[kolom]) !== JSON.stringify(bb[kolom]))
      .map((kolom) => ({
        kolom,
        label: labelKolom(kolom),
        sebelum: teksNilai(aa[kolom]),
        sesudah: teksNilai(bb[kolom]),
      }));

    if (perubahan.length > 0) {
      hasil.push({
        anggotaId,
        nama: namaAnggota.get(anggotaId) ?? anggotaId,
        perubahan,
      });
    }
  }

  return hasil.sort((x, y) => x.nama.localeCompare(y.nama, "id"));
}
