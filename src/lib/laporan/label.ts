import { kolomKosong, type BarisNilai, type KolomWajib } from "./aturan";

// Urutan isian mengikuti urutan tampil di editor: data utama dulu,
// keterangan bebas di akhir.
export const URUTAN_ISIAN = [
  "kehadiran",
  "mediaOnline",
  "mediaOffline",
  "oneOnOne",
  "keteranganHadir",
  "keteranganOneOnOne",
] as const;

export type KolomIsian = (typeof URUTAN_ISIAN)[number];

export const LABEL_KOLOM: Record<KolomIsian, string> = {
  kehadiran: "Kehadiran",
  mediaOnline: "Media online",
  mediaOffline: "Media offline",
  oneOnOne: "One-on-one",
  keteranganHadir: "Keterangan kehadiran",
  keteranganOneOnOne: "Keterangan one-on-one",
};

export function labelKolom(kolom: string): string {
  return LABEL_KOLOM[kolom as KolomIsian] ?? kolom;
}

export type BarisRingkas = {
  anggotaId: string;
  nama: string;
  nilai: BarisNilai;
};

export type GapAnggota = {
  anggotaId: string;
  nama: string;
  kolom: KolomWajib[];
  label: string;
};

export function ringkasGap(baris: readonly BarisRingkas[]): GapAnggota[] {
  return baris.flatMap((b) => {
    const kolom = kolomKosong(b.nilai);
    if (kolom.length === 0) return [];
    return [
      {
        anggotaId: b.anggotaId,
        nama: b.nama,
        kolom,
        label: kolom.map((k) => LABEL_KOLOM[k]).join(", "),
      },
    ];
  });
}

export function kolomAwal(nilai: BarisNilai): KolomIsian {
  return kolomKosong(nilai)[0] ?? URUTAN_ISIAN[0];
}

export function kolomAkhir(nilai: BarisNilai): KolomIsian {
  const kosong = kolomKosong(nilai);
  return kosong.length > 0 ? kosong[kosong.length - 1]! : URUTAN_ISIAN[URUTAN_ISIAN.length - 1]!;
}
