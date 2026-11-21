// Uji integrasi seed CSV terhadap database Postgres lokal khusus.
// Database wajib bernama `pekanan_csv_uji` dan migrasi harus sudah diterapkan.
//
//   DATABASE_URL_UNPOOLED=postgresql://127.0.0.1:55432/pekanan_csv_uji \
//   pnpm test:seed-csv
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { spawn } from "node:child_process";
import { Client } from "pg";

const URL_DB = process.env.DATABASE_URL_UNPOOLED;

function gagal(pesan: string): never {
  console.error(`test-seed-csv: ${pesan}`);
  process.exit(1);
}

if (!URL_DB) gagal("DATABASE_URL_UNPOOLED wajib diisi.");
const url = new URL(URL_DB);
if (!["localhost", "127.0.0.1", "::1", "[::1]"].includes(url.hostname)) {
  gagal("database wajib berada di host lokal.");
}
if (url.pathname !== "/pekanan_csv_uji") {
  gagal("database wajib bernama pekanan_csv_uji.");
}

const client = new Client({ connectionString: URL_DB });
await client.connect();
let nomor = 0;

function cek(aktual: unknown, harapan: unknown, pesan: string) {
  assert.deepEqual(aktual, harapan, pesan);
  nomor++;
  console.log(`ok ${nomor} - ${pesan}`);
}

function jalankanSeed(argumen: string[] = [], harusBerhasil = true): Promise<number> {
  return new Promise((resolve, reject) => {
    const anak = spawn("pnpm", ["seed:csv", ...argumen], {
      cwd: process.cwd(),
      env: { ...process.env, DATABASE_URL_UNPOOLED: URL_DB },
      stdio: harusBerhasil ? "inherit" : "ignore",
    });
    anak.once("error", reject);
    anak.once("exit", (kode) => resolve(kode ?? 1));
  });
}

async function hitungSeed() {
  const hasil = await client.query<{
    pengguna: number;
    laporan: number;
    pembayaran: number;
    pekan: number;
  }>(`
    SELECT
      (SELECT count(*)::int FROM "user" WHERE email LIKE 'csv-verifikasi-%') AS pengguna,
      (SELECT count(*)::int FROM laporan_pekan lp
        JOIN karyawan k ON k.id = lp.supervisor_id
        JOIN "user" u ON u.id = k.user_id
        WHERE u.email LIKE 'csv-verifikasi-%') AS laporan,
      (SELECT count(*)::int FROM pembayaran_iuran pi
        JOIN karyawan k ON k.id = pi.karyawan_id
        JOIN "user" u ON u.id = k.user_id
        WHERE u.email LIKE 'csv-verifikasi-%') AS pembayaran,
      (SELECT count(*)::int FROM pekan) AS pekan
  `);
  return hasil.rows[0]!;
}

try {
  await client.query(`
    TRUNCATE TABLE
      followup_edit, followup, klien, pembayaran_iuran, koreksi_laporan,
      laporan_anggota, laporan_pekan, pekan, karyawan, account, session, "user",
      nominal_iuran, hasil_followup
    CASCADE
  `);

  cek(await jalankanSeed(), 0, "seed pertama berhasil");
  const sesudahPertama = await hitungSeed();
  cek(
    sesudahPertama,
    { pengguna: 7, laporan: 3, pembayaran: 24, pekan: 1 },
    "seed pertama membuat tepat data verifikasi",
  );

  cek(await jalankanSeed(), 0, "seed kedua idempoten");
  cek(await hitungSeed(), sesudahPertama, "seed kedua tidak menggandakan data");

  const userId = `uji-${crypto.randomUUID()}`;
  const karyawanId = crypto.randomUUID();
  const klienId = crypto.randomUUID();
  const atasan = await client.query<{ id: string }>(`
    SELECT k.id FROM karyawan k JOIN "user" u ON u.id = k.user_id
    WHERE u.email = 'csv-verifikasi-atasan@seed.local'
  `);
  await client.query(`INSERT INTO "user" (id, name, email) VALUES ($1, 'Data Lain', $2)`, [
    userId,
    `data-lain-${crypto.randomUUID()}@contoh.local`,
  ]);
  await client.query(
    `INSERT INTO karyawan (id, user_id, nama, level, aktif, harus_ganti_password)
     VALUES ($1, $2, 'Data Lain', 'Tetap', true, false)`,
    [karyawanId, userId],
  );
  await client.query(
    `INSERT INTO klien (id, karyawan_id, nama) VALUES ($1, $2, 'Referensi asing')`,
    [klienId, atasan.rows[0]!.id],
  );

  cek(await jalankanSeed(["--cleanup"], false), 1, "cleanup menolak referensi asing");
  cek(await hitungSeed(), sesudahPertama, "cleanup gagal melakukan rollback seluruh transaksi");
  const asingMasihAda = await client.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM klien WHERE id = $1`,
    [klienId],
  );
  cek(asingMasihAda.rows[0]!.n, 1, "referensi asing tidak ikut terhapus");

  await client.query(`DELETE FROM klien WHERE id = $1`, [klienId]);
  cek(await jalankanSeed(["--cleanup"]), 0, "cleanup berhasil setelah referensi asing dilepas");
  cek(
    await hitungSeed(),
    { pengguna: 0, laporan: 0, pembayaran: 0, pekan: 0 },
    "cleanup menghapus tepat seluruh data seed",
  );
  cek(await jalankanSeed(["--cleanup"]), 0, "cleanup kedua idempoten");

  const dataLain = await client.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM "user" WHERE id = $1`,
    [userId],
  );
  cek(dataLain.rows[0]!.n, 1, "data pengguna yang tidak dimiliki seed dipertahankan");

  await client.query(`DELETE FROM karyawan WHERE id = $1`, [karyawanId]);
  await client.query(`DELETE FROM "user" WHERE id = $1`, [userId]);
  console.log(`test-seed-csv: ${nomor} pemeriksaan lulus.`);
} finally {
  await client.end();
}
