import { fakerID_ID } from "@faker-js/faker";
import { bulanBerjalan, pekanWIB, tanggalHariIni } from "../src/lib/waktu";

export const EMAIL_LOGIN_SEED_CSV = "csv-verifikasi-atasan@seed.local";

export function normalisasiUrlSeedCsv(raw: string): string {
  const url = new URL(raw);
  const lokal = ["localhost", "127.0.0.1", "::1", "[::1]"].includes(url.hostname);
  if (!lokal) url.searchParams.set("sslmode", "verify-full");
  return url.toString();
}

export type KaryawanSeedCsv = {
  kunci: string;
  email: string;
  nama: string;
  level: "Magang" | "Tetap";
  supervisorKunci: string | null;
  bisaLogin: boolean;
};

export function alasanTargetSeedCsvDitolak({
  databaseUrl,
  force,
  password,
  cleanup,
}: {
  databaseUrl: string | undefined;
  force: boolean;
  password: string | undefined;
  cleanup: boolean;
}): string | null {
  if (!databaseUrl) return "DATABASE_URL_UNPOOLED wajib diisi.";

  let lokal = false;
  try {
    lokal = ["localhost", "127.0.0.1", "::1", "[::1]"].includes(new URL(databaseUrl).hostname);
  } catch {
    return "DATABASE_URL_UNPOOLED tidak valid.";
  }

  if (!lokal && !force) {
    return "host nonlokal ditolak; gunakan FORCE=1 bila penyemaian memang disengaja.";
  }
  if (!lokal && (!password || password.length < 12)) {
    return "SEED_CSV_PASSWORD minimal 12 karakter dan wajib untuk host nonlokal.";
  }
  if (!cleanup && password !== undefined && password.length < 12) {
    return "SEED_CSV_PASSWORD minimal 12 karakter.";
  }
  return null;
}

export type DataSeedCsv = {
  karyawan: KaryawanSeedCsv[];
  pekan: { kunci: string; mulai: string; selesai: string }[];
  laporan: {
    kunci: string;
    pekanKunci: string;
    supervisorKunci: string;
    baris: {
      kunci: string;
      anggotaKunci: string;
      kehadiran: string;
      keteranganHadir: string | null;
      mediaOnline: number;
      mediaOffline: number;
      oneOnOne: string;
      keteranganOneOnOne: string | null;
    }[];
  }[];
  nominal: { kunci: string; nama: string; nominal: number };
  pembayaran: {
    kunci: string;
    karyawanKunci: string;
    bulan: string;
    tanggalBayar: string;
  }[];
  hasilFollowup: { kunci: string; nama: string; urutan: number };
  klien: {
    kunci: string;
    pemilikKunci: string;
    nama: string;
    kontak: string;
  }[];
  followup: {
    kunci: string;
    klienKunci: string;
    pemilikKunci: string;
    tanggal: string;
    deskripsi: string;
  }[];
};

function bulanSebelumnya(bulan: string, mundur: number): string {
  const [tahun, nomor] = bulan.split("-").map(Number) as [number, number];
  return new Date(Date.UTC(tahun, nomor - 1 - mundur, 1)).toISOString().slice(0, 10);
}

function namaUnik(sudah: Set<string>): string {
  let nama = fakerID_ID.person.fullName();
  while (sudah.has(nama)) nama = fakerID_ID.person.fullName();
  sudah.add(nama);
  return nama;
}

export function buatDataSeedCsv({
  sekarang = new Date(),
  seed = 20261120,
}: {
  sekarang?: Date;
  seed?: number;
} = {}): DataSeedCsv {
  fakerID_ID.seed(seed);
  const namaTerpakai = new Set<string>();
  const karyawan: KaryawanSeedCsv[] = [
    {
      kunci: "atasan",
      email: EMAIL_LOGIN_SEED_CSV,
      nama: namaUnik(namaTerpakai),
      level: "Tetap",
      supervisorKunci: null,
      bisaLogin: true,
    },
  ];

  for (let nomorSupervisor = 1; nomorSupervisor <= 2; nomorSupervisor++) {
    const supervisorKunci = `supervisor-${nomorSupervisor}`;
    karyawan.push({
      kunci: supervisorKunci,
      email: `csv-verifikasi-supervisor-${nomorSupervisor}@seed.local`,
      nama: namaUnik(namaTerpakai),
      level: "Tetap",
      supervisorKunci: "atasan",
      bisaLogin: false,
    });
    for (let nomorAnggota = 1; nomorAnggota <= 2; nomorAnggota++) {
      karyawan.push({
        kunci: `anggota-${nomorSupervisor}-${nomorAnggota}`,
        email: `csv-verifikasi-anggota-${nomorSupervisor}-${nomorAnggota}@seed.local`,
        nama: namaUnik(namaTerpakai),
        level: nomorAnggota === 1 ? "Magang" : "Tetap",
        supervisorKunci,
        bisaLogin: false,
      });
    }
  }

  const rentang = pekanWIB(sekarang);
  const pekan = [{ kunci: "berjalan", ...rentang }];
  const kehadiran = ["Tepat Waktu", "Terlambat < 15 Menit", "Sakit"] as const;
  const oneOnOne = ["Pribadi", "Sebelum Meeting Pekanan", "Alpa"] as const;
  function buatBarisLaporan(prefix: string, anggotaKunci: string[]) {
    return anggotaKunci.map((kunci, index) => ({
      kunci: `baris-${prefix}-${index + 1}`,
      anggotaKunci: kunci,
      kehadiran: fakerID_ID.helpers.arrayElement(kehadiran),
      keteranganHadir: index === 0 ? fakerID_ID.lorem.sentence({ min: 4, max: 8 }) : null,
      mediaOnline: fakerID_ID.number.int({ min: 2, max: 20 }),
      mediaOffline: fakerID_ID.number.int({ min: 0, max: 8 }),
      oneOnOne: fakerID_ID.helpers.arrayElement(oneOnOne),
      keteranganOneOnOne: index === 1 ? fakerID_ID.lorem.sentence({ min: 4, max: 8 }) : null,
    }));
  }
  const laporan = [
    {
      kunci: "laporan-atasan",
      pekanKunci: "berjalan",
      supervisorKunci: "atasan",
      baris: buatBarisLaporan("atasan", ["supervisor-1", "supervisor-2"]),
    },
    ...[1, 2].map((nomorSupervisor) => ({
      kunci: `laporan-${nomorSupervisor}`,
      pekanKunci: "berjalan",
      supervisorKunci: `supervisor-${nomorSupervisor}`,
      baris: buatBarisLaporan(`supervisor-${nomorSupervisor}`, [
        `anggota-${nomorSupervisor}-1`,
        `anggota-${nomorSupervisor}-2`,
      ]),
    })),
  ];

  const nominal = {
    kunci: "nominal",
    nama: "Iuran verifikasi CSV",
    nominal: fakerID_ID.helpers.arrayElement([25_000, 50_000, 75_000]),
  };
  const bulanKini = bulanBerjalan(sekarang);
  const daftarBulan = Array.from({ length: 12 }, (_, index) => bulanSebelumnya(bulanKini, index));
  const polaLunas = [
    ["atasan", 12],
    ["supervisor-1", 8],
    ["supervisor-2", 4],
  ] as const;
  const pembayaran = polaLunas.flatMap(([karyawanKunci, jumlah]) =>
    daftarBulan.slice(0, jumlah).map((bulan, index) => ({
      kunci: `bayar-${karyawanKunci}-${index}`,
      karyawanKunci,
      bulan,
      tanggalBayar: bulan,
    })),
  );

  const hasilFollowup = {
    kunci: "hasil",
    nama: "Tertarik (verifikasi CSV)",
    urutan: 999,
  };
  const anggota = karyawan.filter((orang) => orang.kunci.startsWith("anggota-"));
  const klien = anggota.map((orang, index) => ({
    kunci: `klien-${index + 1}`,
    pemilikKunci: orang.kunci,
    nama: fakerID_ID.company.name(),
    kontak: fakerID_ID.phone.number(),
  }));
  const tanggalFollowup = tanggalHariIni(sekarang);
  const followup = klien.flatMap((pelanggan, index) =>
    Array.from({ length: index % 2 === 0 ? 1 : 2 }, (_, nomor) => ({
      kunci: `followup-${index + 1}-${nomor + 1}`,
      klienKunci: pelanggan.kunci,
      pemilikKunci: pelanggan.pemilikKunci,
      tanggal: tanggalFollowup,
      deskripsi: fakerID_ID.lorem.sentence({ min: 5, max: 10 }),
    })),
  );

  return {
    karyawan,
    pekan,
    laporan,
    nominal,
    pembayaran,
    hasilFollowup,
    klien,
    followup,
  };
}
