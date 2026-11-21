import assert from "node:assert/strict";
import test from "node:test";
import {
  alasanTargetSeedCsvDitolak,
  buatDataSeedCsv,
  EMAIL_LOGIN_SEED_CSV,
  normalisasiUrlSeedCsv,
} from "./seed-csv-data.mjs";

const sekarang = new Date("2026-11-20T03:00:00.000Z");

test("URL seed memaksa verify-full hanya untuk host nonlokal", () => {
  assert.equal(
    new URL(
      normalisasiUrlSeedCsv("postgresql://user:pass@contoh.neon.tech/db?sslmode=require"),
    ).searchParams.get("sslmode"),
    "verify-full",
  );
  assert.equal(
    new URL(normalisasiUrlSeedCsv("postgresql://127.0.0.1:55432/db")).searchParams.get("sslmode"),
    null,
  );
});

test("target lokal boleh tanpa FORCE dan password", () => {
  assert.equal(
    alasanTargetSeedCsvDitolak({
      databaseUrl: "postgresql://127.0.0.1:55432/pekanan_uji",
      force: false,
      password: undefined,
      cleanup: false,
    }),
    null,
  );
});

test("target nonlokal membutuhkan FORCE dan password kuat, termasuk cleanup", () => {
  const databaseUrl = "postgresql://contoh.neon.tech/pekanan";
  assert.match(
    alasanTargetSeedCsvDitolak({ databaseUrl, force: false, password: undefined, cleanup: false })!,
    /FORCE=1/,
  );
  assert.match(
    alasanTargetSeedCsvDitolak({ databaseUrl, force: true, password: undefined, cleanup: true })!,
    /SEED_CSV_PASSWORD/,
  );
  assert.equal(
    alasanTargetSeedCsvDitolak({
      databaseUrl,
      force: true,
      password: "PasswordKuat123!",
      cleanup: true,
    }),
    null,
  );
});

test("seed CSV deterministik untuk waktu dan seed Faker yang sama", () => {
  const pertama = buatDataSeedCsv({ sekarang, seed: 20261120 });
  const kedua = buatDataSeedCsv({ sekarang, seed: 20261120 });

  assert.deepEqual(kedua, pertama);
});

test("seed CSV membentuk satu atasan, dua supervisor, dan empat anggota", () => {
  const data = buatDataSeedCsv({ sekarang, seed: 20261120 });
  const login = data.karyawan.find((orang) => orang.email === EMAIL_LOGIN_SEED_CSV);
  const supervisor = data.karyawan.filter((orang) => orang.supervisorKunci === login?.kunci);
  const anggota = data.karyawan.filter((orang) =>
    supervisor.some((atasan) => atasan.kunci === orang.supervisorKunci),
  );

  assert.equal(data.karyawan.length, 7);
  assert.equal(login?.bisaLogin, true);
  assert.equal(supervisor.length, 2);
  assert.equal(anggota.length, 4);
  assert.equal(new Set(data.karyawan.map((orang) => orang.email)).size, 7);
  assert.ok(data.karyawan.every((orang) => orang.email.startsWith("csv-verifikasi-")));
});

test("seed CSV menyediakan ledger 12 bulan dengan pola lunas berbeda", () => {
  const data = buatDataSeedCsv({ sekarang, seed: 20261120 });
  const jumlahPerKaryawan = new Map<string, number>();
  for (const pembayaran of data.pembayaran) {
    jumlahPerKaryawan.set(
      pembayaran.karyawanKunci,
      (jumlahPerKaryawan.get(pembayaran.karyawanKunci) ?? 0) + 1,
    );
  }

  assert.deepEqual(
    [...jumlahPerKaryawan.values()].sort((a, b) => b - a),
    [12, 8, 4],
  );
  assert.equal(new Set(data.pembayaran.map((pembayaran) => pembayaran.bulan)).size, 12);
});

test("seed CSV menyediakan rekap lengkap dan follow-up pada pekan yang sama", () => {
  const data = buatDataSeedCsv({ sekarang, seed: 20261120 });
  const pekan = data.pekan[0]!;

  assert.equal(data.laporan.length, 3);
  assert.equal(data.laporan.flatMap((laporan) => laporan.baris).length, 6);
  assert.ok(
    data.laporan
      .flatMap((laporan) => laporan.baris)
      .every(
        (baris) =>
          baris.kehadiran && baris.mediaOnline >= 0 && baris.mediaOffline >= 0 && baris.oneOnOne,
      ),
  );
  assert.equal(data.klien.length, 4);
  assert.ok(data.followup.length >= 4);
  assert.ok(
    data.followup.every(
      (followup) => followup.tanggal >= pekan.mulai && followup.tanggal <= pekan.selesai,
    ),
  );
});
