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
