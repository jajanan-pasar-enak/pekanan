// Seed data contoh untuk pengembangan lokal. Semua akun memakai email
// `@seed.local` dan ID deterministik (uuid v5 dari email), sehingga skrip aman
// dijalankan ulang walau database sudah berisi data asli.
//
//   pnpm --env-file=.env.local exec tsx scripts/seed.mts
//   pnpm --env-file=.env.local exec tsx scripts/seed.mts --cleanup
//
// Menolak berjalan pada host project produksi (dibaca dari .neon) kecuali FORCE=1.
import crypto from "node:crypto";
import { readFile } from "node:fs/promises";
import { hashPassword } from "better-auth/crypto";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Client } from "pg";
import {
  account,
  followup,
  hasilFollowup,
  karyawan,
  klien,
  nominalIuran,
  pembayaranIuran,
  user,
} from "../src/db/schema";

const URL_DB = process.env.DATABASE_URL_UNPOOLED;
const cleanup = process.argv.includes("--cleanup");
const PASSWORD_SEED = process.env.SEED_PASSWORD ?? "SeedPekanan123!";

// Namespace tetap; uuid v5(email) → ID akun dan profil yang stabil.
const NAMESPACE = "6f6a1f7e-2f4b-4d8e-9a37-0c6c3f61b9d1";

function gagal(pesan: string): never {
  console.error(`seed: ${pesan}`);
  process.exit(1);
}

function uuidV5(nama: string): string {
  const ns = Buffer.from(NAMESPACE.replaceAll("-", ""), "hex");
  const hash = crypto.createHash("sha1").update(ns).update(nama).digest();
  const b = Buffer.from(hash.subarray(0, 16));
  b[6] = (b[6]! & 0x0f) | 0x50;
  b[8] = (b[8]! & 0x3f) | 0x80;
  const h = b.toString("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

function tanggalWIB(hariLalu: number): string {
  return new Date(Date.now() + 7 * 3600_000 - hariLalu * 86_400_000).toISOString().slice(0, 10);
}

// Rabu pekan berjalan; bila hari ini belum sampai Rabu (atau sudah lewat), hari ini.
function tengahPekan(): string {
  const hariIni = tanggalWIB(0);
  const minggu = new Date(`${hariIni}T00:00:00Z`);
  minggu.setUTCDate(minggu.getUTCDate() - minggu.getUTCDay() + 3);
  const rabu = minggu.toISOString().slice(0, 10);
  return rabu <= hariIni ? rabu : hariIni;
}

const akunSeed = [
  { email: "admin@seed.local", nama: "Admin Seed", level: "Tetap", supervisor: null, admin: true },
  { email: "sup-1@seed.local", nama: "Sari Supervisor", level: "Tetap", supervisor: null, admin: false },
  { email: "sup-2@seed.local", nama: "Tono Supervisor", level: "Tetap", supervisor: "sup-1@seed.local", admin: false },
  { email: "sup-3@seed.local", nama: "Wulan Supervisor", level: "Tetap", supervisor: "sup-1@seed.local", admin: false },
  { email: "magang-1@seed.local", nama: "Bima Magang", level: "Magang", supervisor: "sup-2@seed.local", admin: false },
  { email: "magang-2@seed.local", nama: "Citra Magang", level: "Magang", supervisor: "sup-3@seed.local", admin: false },
  { email: "tetap-1@seed.local", nama: "Dani Tetap", level: "Tetap", supervisor: "sup-2@seed.local", admin: false },
  { email: "tetap-2@seed.local", nama: "Eka Tetap", level: "Tetap", supervisor: "sup-3@seed.local", admin: false },
] as const;

const NOMINAL = [
  { kunci: "iuran-normal", nama: "Iuran Normal", nominal: 50_000 },
  { kunci: "iuran-paket", nama: "Paket 6 Bulan", nominal: 270_000 },
] as const;

const HASIL = [
  { kunci: "tertarik", nama: "Tertarik", urutan: 1 },
  { kunci: "belum-tertarik", nama: "Belum Tertarik", urutan: 2 },
  { kunci: "tidak-respon", nama: "Tidak Respon", urutan: 3 },
] as const;

const KLIEN = [
  { kunci: "klien-toko-maju", nama: "Toko Maju", kontak: "081200000001", pemilik: "magang-1@seed.local" },
  { kunci: "klien-kafe-senja", nama: "Kafe Senja", kontak: "081200000002", pemilik: "tetap-1@seed.local" },
  { kunci: "klien-ud-sinar", nama: "UD Sinar Abadi", kontak: "081200000003", pemilik: "magang-2@seed.local" },
] as const;

function idAkun(email: string): string {
  return uuidV5(`user:${email}`);
}

function idKaryawan(email: string): string {
  return uuidV5(`karyawan:${email}`);
}

function idBaris(kunci: string): string {
  return uuidV5(`baris:${kunci}`);
}

async function hostProduksi() {
  try {
    const isi = await readFile(new URL("../.neon", import.meta.url), "utf8");
    const cocok = isi.match(/"(?:host|db_host|database_host)"\s*:\s*"([^"]+)"/i);
    return cocok?.[1] ?? null;
  } catch {
    return null;
  }
}

if (!URL_DB) {
  gagal("DATABASE_URL_UNPOOLED wajib diisi (pnpm --env-file=.env.local exec tsx scripts/seed.mts).");
}

const produksi = await hostProduksi();
if (produksi && URL_DB.includes(produksi) && process.env.FORCE !== "1") {
  gagal(`host ini kemungkinan project produksi (${produksi}); jalankan dengan FORCE=1 bila memang disengaja.`);
}

const client = new Client({ connectionString: URL_DB });
await client.connect();
const db = drizzle(client);
let kode = 0;

const emailSeed = akunSeed.map((a) => a.email);
// Daftar email seed sebagai array SQL, diinterpolasi dengan aman oleh drizzle.
const daftarEmail = sql`ARRAY[${sql.join(emailSeed.map((e) => sql`${e}`), sql`, `)}]::text[]`;
const idKaryawanSeed = sql`(SELECT k.id FROM karyawan k JOIN "user" u ON u.id = k.user_id WHERE u.email = ANY(${daftarEmail}))`;

try {
  if (cleanup) {
    await db.transaction(async (tx) => {
      // Urutan mengikuti FK RESTRICT: followup → klien → iuran → karyawan → user.
      const namaNominal = sql`ARRAY[${sql.join(NOMINAL.map((n) => sql`${n.nama}`), sql`, `)}]::text[]`;
      const namaHasil = sql`ARRAY[${sql.join(HASIL.map((h) => sql`${h.nama}`), sql`, `)}]::text[]`;
      await tx.execute(sql`DELETE FROM followup WHERE klien_id IN (
        SELECT k.id FROM klien k WHERE k.karyawan_id IN ${idKaryawanSeed})`);
      await tx.execute(sql`DELETE FROM klien WHERE karyawan_id IN ${idKaryawanSeed}`);
      await tx.execute(sql`DELETE FROM pembayaran_iuran WHERE karyawan_id IN ${idKaryawanSeed}`);
      await tx.execute(sql`DELETE FROM nominal_iuran WHERE nama = ANY(${namaNominal})`);
      await tx.execute(sql`DELETE FROM hasil_followup WHERE nama = ANY(${namaHasil})`);
      // laporan_* milik karyawan seed hanya ada bila supervisor seed membuka aplikasi.
      await tx.execute(sql`DELETE FROM koreksi_laporan WHERE laporan_id IN (
        SELECT lp.id FROM laporan_pekan lp WHERE lp.supervisor_id IN ${idKaryawanSeed})`);
      await tx.execute(sql`DELETE FROM laporan_pekan WHERE supervisor_id IN ${idKaryawanSeed}`);
      await tx.execute(sql`WITH profil AS (
        DELETE FROM karyawan ks USING "user" u
        WHERE ks.user_id = u.id AND u.email = ANY(${daftarEmail})
        RETURNING u.id
      ), akun AS (
        DELETE FROM "user" WHERE id IN (SELECT id FROM profil) RETURNING id
      ) SELECT count(*)::int AS n FROM akun`);
    });
    console.log("seed: data @seed.local dibersihkan.");
  } else {
    const hash = await hashPassword(PASSWORD_SEED);
    const sekarang = new Date();

    await db.transaction(async (tx) => {
      for (const a of akunSeed) {
        const userId = idAkun(a.email);
        await tx
          .insert(user)
          .values({
            id: userId,
            name: a.nama,
            email: a.email,
            emailVerified: true,
            role: a.admin ? "admin" : "user",
            createdAt: sekarang,
            updatedAt: sekarang,
          })
          .onConflictDoNothing({ target: user.id });
        await tx
          .insert(account)
          .values({
            id: uuidV5(`account:${a.email}`),
            accountId: userId,
            providerId: "credential",
            userId,
            password: hash,
            createdAt: sekarang,
            updatedAt: sekarang,
          })
          .onConflictDoNothing({ target: account.id });
      }

      // Supervisor dirujuk lewat ID deterministik; urutan dibuat agar FK terpenuhi.
      for (const a of akunSeed) {
        await tx
          .insert(karyawan)
          .values({
            id: idKaryawan(a.email),
            userId: idAkun(a.email),
            nama: a.nama,
            level: a.level,
            supervisorId: a.supervisor ? idKaryawan(a.supervisor) : null,
            aktif: true,
            // Akun seed langsung bisa dipakai; tidak memaksa ganti password.
            harusGantiPassword: false,
          })
          .onConflictDoNothing({ target: karyawan.id });
      }

      for (const n of NOMINAL) {
        await tx
          .insert(nominalIuran)
          .values({ id: idBaris(n.kunci), nama: n.nama, nominal: n.nominal })
          .onConflictDoNothing({ target: nominalIuran.id });
      }
      for (const h of HASIL) {
        await tx
          .insert(hasilFollowup)
          .values({ id: idBaris(h.kunci), nama: h.nama, urutan: h.urutan })
          .onConflictDoNothing({ target: hasilFollowup.id });
      }
      for (const k of KLIEN) {
        await tx
          .insert(klien)
          .values({
            id: idBaris(k.kunci),
            karyawanId: idKaryawan(k.pemilik),
            nama: k.nama,
            kontak: k.kontak,
          })
          .onConflictDoNothing({ target: klien.id });
      }

      // Follow-up di pekan berjalan (hari ini dan kemarin), dibuat oleh pemilik klien.
      const contohFollowup = [
        { kunci: "fu-1", klien: "klien-toko-maju", tanggal: tanggalWIB(0), hasil: "tertarik", deskripsi: "Minta proposal harga." },
        { kunci: "fu-2", klien: "klien-toko-maju", tanggal: tanggalWIB(1), hasil: "belum-tertarik", deskripsi: "Masih membandingkan vendor." },
        { kunci: "fu-3", klien: "klien-kafe-senja", tanggal: tanggalWIB(0), hasil: "tidak-respon", deskripsi: null },
        { kunci: "fu-4", klien: "klien-ud-sinar", tanggal: tengahPekan(), hasil: "tertarik", deskripsi: "Siap tanda tangan minggu ini." },
      ];
      for (const f of contohFollowup) {
        const pemilik = KLIEN.find((k) => k.kunci === f.klien)!.pemilik;
        await tx
          .insert(followup)
          .values({
            id: idBaris(f.kunci),
            klienId: idBaris(f.klien),
            tanggal: f.tanggal,
            hasilFollowupId: idBaris(f.hasil),
            deskripsi: f.deskripsi,
            createdBy: idKaryawan(pemilik),
          })
          .onConflictDoNothing({ target: followup.id });
      }

      // Iuran bulan berjalan untuk dua anggota.
      for (const [i, email] of ["magang-1@seed.local", "tetap-1@seed.local"].entries()) {
        await tx
          .insert(pembayaranIuran)
          .values({
            id: idBaris(`iuran-${i + 1}`),
            karyawanId: idKaryawan(email),
            bulan: `${tanggalWIB(0).slice(0, 7)}-01`,
            nominalIuranId: idBaris("iuran-normal"),
            tanggalBayar: tanggalWIB(0),
            pencatatId: idKaryawan(email),
          })
          .onConflictDoNothing({ target: pembayaranIuran.id });
      }
    });

    console.log(`seed: ${akunSeed.length} akun @seed.local siap (password: ${PASSWORD_SEED}).`);
  }
} catch (error) {
  console.error(error);
  kode = 1;
} finally {
  await client.end();
}

process.exit(kode);
