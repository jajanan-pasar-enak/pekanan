// Semua perhitungan tanggal pekan/bulan memakai WIB (Asia/Jakarta, UTC+7 tanpa DST).
// Tanggal direpresentasikan sebagai string ISO `YYYY-MM-DD` agar cocok dengan kolom `date`.

const ZONA = "Asia/Jakarta";

export type PekanWIB = { mulai: string; selesai: string };

function format(instant: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: ZONA,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(instant);
}

function geserHari(iso: string, hari: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y!, m! - 1, d! + hari)).toISOString().slice(0, 10);
}

function hariMinggu(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y!, m! - 1, d!)).getUTCDay();
}

export function tanggalHariIni(now: Date = new Date()): string {
  return format(now);
}

export function pekanWIB(now: Date = new Date()): PekanWIB {
  const hariIni = format(now);
  const mulai = geserHari(hariIni, -hariMinggu(hariIni));
  return { mulai, selesai: geserHari(mulai, 6) };
}

export function awalPekan(tanggal: string): string {
  return geserHari(tanggal, -hariMinggu(tanggal));
}

export function bulanBerjalan(now: Date = new Date()): string {
  const hariIni = format(now);
  return `${hariIni.slice(0, 7)}-01`;
}

export function tambahHari(tanggal: string, hari: number): string {
  return geserHari(tanggal, hari);
}

const BULAN_PENDEK = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "Mei",
  "Jun",
  "Jul",
  "Agu",
  "Sep",
  "Okt",
  "Nov",
  "Des",
] as const;

function pecahTanggal(iso: string): [number, number, number] | null {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d || m < 1 || m > 12 || d < 1 || d > 31) return null;
  return [y, m, d];
}

// Tanggal tampilan untuk pengguna; nilai ISO tetap dipakai di data dan input date.
export function formatTanggal(iso: string): string {
  const bagian = pecahTanggal(iso);
  if (!bagian) return iso;
  const [y, m, d] = bagian;
  return `${d} ${BULAN_PENDEK[m - 1]} ${y}`;
}

export function formatRentangTanggal(mulai: string, selesai: string): string {
  const a = pecahTanggal(mulai);
  const b = pecahTanggal(selesai);
  if (!a || !b) return `${mulai} s.d. ${selesai}`;
  const [y1, m1, d1] = a;
  const [y2, m2, d2] = b;
  if (y1 === y2 && m1 === m2) return `${d1}-${d2} ${BULAN_PENDEK[m1 - 1]} ${y1}`;
  if (y1 === y2) {
    return `${d1} ${BULAN_PENDEK[m1 - 1]} - ${d2} ${BULAN_PENDEK[m2 - 1]} ${y1}`;
  }
  return `${d1} ${BULAN_PENDEK[m1 - 1]} ${y1} - ${d2} ${BULAN_PENDEK[m2 - 1]} ${y2}`;
}

export function formatTanggalWaktu(nilai: string | Date): string {
  const waktu = typeof nilai === "string" ? new Date(nilai) : nilai;
  if (Number.isNaN(waktu.getTime())) return String(nilai);
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: ZONA,
    dateStyle: "medium",
    timeStyle: "short",
  }).format(waktu);
}
