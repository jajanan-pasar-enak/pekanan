const BULAN = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
];

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
];

// `iso` adalah tanggal awal bulan (`YYYY-MM-01`).
export function labelBulan(iso: string): string {
  const [tahun, bulan] = iso.split("-").map(Number);
  return `${BULAN[bulan! - 1]} ${tahun}`;
}

export function labelBulanPendek(iso: string): string {
  const [tahun, bulan] = iso.split("-").map(Number);
  return `${BULAN_PENDEK[bulan! - 1]} ${tahun}`;
}

// Bulan berjalan dan 11 bulan sebelumnya (terbaru di atas).
export function duaBelasBulan(berjalan: string): string[] {
  let [tahun, bulan] = berjalan.split("-").map(Number) as [number, number];
  const hasil: string[] = [];
  for (let i = 0; i < 12; i++) {
    hasil.push(`${tahun}-${String(bulan).padStart(2, "0")}-01`);
    bulan -= 1;
    if (bulan < 1) {
      bulan = 12;
      tahun -= 1;
    }
  }
  return hasil;
}
