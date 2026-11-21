// Seed sementara khusus verifikasi ekspor CSV ledger iuran dan rekap pekan.
// Data memakai Faker dengan seed deterministik, mempunyai penanda
// `csv-verifikasi-*`, dan dapat dibersihkan tanpa menyentuh data lain.
//
// Lokal:
//   DATABASE_URL_UNPOOLED=postgresql://... pnpm seed:csv
//   DATABASE_URL_UNPOOLED=postgresql://... pnpm seed:csv --cleanup
//
// Host nonlokal membutuhkan persetujuan eksplisit dan password sendiri:
//   FORCE=1 SEED_CSV_PASSWORD='...' pnpm --env-file=.env.local seed:csv
//   FORCE=1 SEED_CSV_PASSWORD='...' pnpm --env-file=.env.local seed:csv --cleanup
import crypto from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import { eq, sql, type SQL } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Client } from "pg";
import {
  account,
  followup,
  hasilFollowup,
  karyawan,
  klien,
  laporanAnggota,
  laporanPekan,
  nominalIuran,
  pembayaranIuran,
  pekan as tabelPekan,
  user,
} from "../src/db/schema";
import {
  alasanTargetSeedCsvDitolak,
  buatDataSeedCsv,
  EMAIL_LOGIN_SEED_CSV,
  normalisasiUrlSeedCsv,
} from "./seed-csv-data.mjs";

const URL_DB = process.env.DATABASE_URL_UNPOOLED;
const cleanup = process.argv.includes("--cleanup");
const force = process.env.FORCE === "1";
const seedFaker = Number(process.env.SEED_CSV_FAKER_SEED ?? 20261120);
const sekarang = new Date();
const NAMESPACE = "e6a95f8b-d34b-4be2-b798-c4c7e43d9c50";

function gagal(pesan: string): never {
  console.error(`seed:csv: ${pesan}`);
  process.exit(1);
}

function uuidV5(nama: string): string {
  const ns = Buffer.from(NAMESPACE.replaceAll("-", ""), "hex");
  const hash = crypto.createHash("sha1").update(ns).update(nama).digest();
  const bytes = Buffer.from(hash.subarray(0, 16));
  bytes[6] = (bytes[6]! & 0x0f) | 0x50;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const heksadesimal = bytes.toString("hex");
  return `${heksadesimal.slice(0, 8)}-${heksadesimal.slice(8, 12)}-${heksadesimal.slice(12, 16)}-${heksadesimal.slice(16, 20)}-${heksadesimal.slice(20)}`;
}

function id(kategori: string, kunci: string): string {
  return uuidV5(`${kategori}:${kunci}`);
}

function arraySql(nilai: string[], tipe: "text" | "uuid") {
  return sql`ARRAY[${sql.join(
    nilai.map((isi) => sql`${isi}`),
    sql`, `,
  )}]::${sql.raw(tipe)}[]`;
}

if (!Number.isSafeInteger(seedFaker)) {
  gagal("SEED_CSV_FAKER_SEED wajib berupa bilangan bulat yang aman.");
}
const data = buatDataSeedCsv({ sekarang, seed: seedFaker });
const idUser = new Map(data.karyawan.map((orang) => [orang.kunci, id("user", orang.kunci)]));
const idKaryawan = new Map(
  data.karyawan.map((orang) => [orang.kunci, id("karyawan", orang.kunci)]),
);
const idLaporan = new Map(
  data.laporan.map((laporan) => [laporan.kunci, id("laporan", laporan.kunci)]),
);
const idKlien = new Map(
  data.klien.map((pelanggan) => [pelanggan.kunci, id("klien", pelanggan.kunci)]),
);
const idFollowup = new Map(
  data.followup.map((kejadian) => [kejadian.kunci, id("followup", kejadian.kunci)]),
);
const idPembayaran = new Map(
  data.pembayaran.map((bayar) => [bayar.kunci, id("pembayaran", bayar.kunci)]),
);
const nominalId = id("nominal", data.nominal.kunci);
const hasilId = id("hasil-followup", data.hasilFollowup.kunci);

function perintahCleanup(): SQL[] {
  const userIds = arraySql([...idUser.values()], "text");
  const karyawanIds = arraySql([...idKaryawan.values()], "uuid");
  const laporanIds = arraySql([...idLaporan.values()], "uuid");
  const klienIds = arraySql([...idKlien.values()], "uuid");
  const followupIds = arraySql([...idFollowup.values()], "uuid");
  const pembayaranIds = arraySql([...idPembayaran.values()], "uuid");
  const pekanIds = arraySql(
    data.pekan.map((minggu) => id("pekan", minggu.mulai)),
    "uuid",
  );
  return [
    sql`DELETE FROM followup_edit WHERE followup_id = ANY(${followupIds})`,
    sql`DELETE FROM followup WHERE id = ANY(${followupIds})`,
    sql`DELETE FROM klien WHERE id = ANY(${klienIds})`,
    sql`DELETE FROM pembayaran_iuran WHERE id = ANY(${pembayaranIds})`,
    sql`DELETE FROM koreksi_laporan WHERE laporan_id = ANY(${laporanIds})`,
    sql`DELETE FROM laporan_pekan WHERE id = ANY(${laporanIds})`,
    sql`DELETE FROM karyawan WHERE id = ANY(${karyawanIds})`,
    sql`DELETE FROM "user" WHERE id = ANY(${userIds})`,
    sql`DELETE FROM nominal_iuran WHERE id = ${nominalId}`,
    sql`DELETE FROM hasil_followup WHERE id = ${hasilId}`,
    sql`DELETE FROM pekan p WHERE p.id = ANY(${pekanIds})
      AND NOT EXISTS (SELECT 1 FROM laporan_pekan lp WHERE lp.pekan_id = p.id)`,
  ];
}

const passwordEnv = process.env.SEED_CSV_PASSWORD;
const alasanTarget = alasanTargetSeedCsvDitolak({
  databaseUrl: URL_DB,
  force,
  password: passwordEnv,
  cleanup,
});
if (alasanTarget) gagal(alasanTarget);
const password = passwordEnv ?? "CsvVerifikasi123!";

const client = new Client({ connectionString: normalisasiUrlSeedCsv(URL_DB!) });
await client.connect();
const db = drizzle(client);
let kode = 0;

try {
  await db.transaction(async (tx) => {
    for (const perintah of perintahCleanup()) await tx.execute(perintah);
    if (cleanup) return;

    const hash = await hashPassword(password);
    const dibuatPada = new Date(sekarang.getTime() - 90 * 86_400_000);
    for (const orang of data.karyawan) {
      const userId = idUser.get(orang.kunci)!;
      await tx.insert(user).values({
        id: userId,
        name: orang.nama,
        email: orang.email,
        emailVerified: true,
        role: "user",
        createdAt: dibuatPada,
        updatedAt: dibuatPada,
      });
      if (orang.bisaLogin) {
        await tx.insert(account).values({
          id: id("account", orang.kunci),
          accountId: userId,
          providerId: "credential",
          userId,
          password: hash,
          createdAt: sekarang,
          updatedAt: sekarang,
        });
      }
      await tx.insert(karyawan).values({
        id: idKaryawan.get(orang.kunci)!,
        userId,
        nama: orang.nama,
        level: orang.level,
        supervisorId: orang.supervisorKunci ? idKaryawan.get(orang.supervisorKunci)! : null,
        aktif: true,
        harusGantiPassword: false,
        createdAt: dibuatPada,
        updatedAt: dibuatPada,
      });
    }

    await tx.insert(nominalIuran).values({
      id: nominalId,
      nama: data.nominal.nama,
      nominal: data.nominal.nominal,
    });
    await tx.insert(hasilFollowup).values({
      id: hasilId,
      nama: data.hasilFollowup.nama,
      urutan: data.hasilFollowup.urutan,
    });

    const pekanIds = new Map<string, string>();
    for (const minggu of data.pekan) {
      await tx
        .insert(tabelPekan)
        .values({ id: id("pekan", minggu.mulai), mulai: minggu.mulai, selesai: minggu.selesai })
        .onConflictDoNothing({ target: tabelPekan.mulai });
      const [tersimpan] = await tx
        .select({ id: tabelPekan.id })
        .from(tabelPekan)
        .where(eq(tabelPekan.mulai, minggu.mulai))
        .limit(1);
      if (!tersimpan) throw new Error(`Pekan ${minggu.mulai} tidak ditemukan setelah insert.`);
      pekanIds.set(minggu.kunci, tersimpan.id);
    }

    for (const laporan of data.laporan) {
      const laporanId = idLaporan.get(laporan.kunci)!;
      await tx.insert(laporanPekan).values({
        id: laporanId,
        pekanId: pekanIds.get(laporan.pekanKunci)!,
        supervisorId: idKaryawan.get(laporan.supervisorKunci)!,
        status: "Terkirim",
        submittedAt: sekarang,
      });
      for (const baris of laporan.baris) {
        await tx.insert(laporanAnggota).values({
          id: id("laporan-anggota", baris.kunci),
          laporanId,
          anggotaId: idKaryawan.get(baris.anggotaKunci)!,
          kehadiran: baris.kehadiran,
          keteranganHadir: baris.keteranganHadir,
          mediaOnline: baris.mediaOnline,
          mediaOffline: baris.mediaOffline,
          oneOnOne: baris.oneOnOne,
          keteranganOneOnOne: baris.keteranganOneOnOne,
        });
      }
    }

    for (const pelanggan of data.klien) {
      await tx.insert(klien).values({
        id: idKlien.get(pelanggan.kunci)!,
        karyawanId: idKaryawan.get(pelanggan.pemilikKunci)!,
        nama: pelanggan.nama,
        kontak: pelanggan.kontak,
      });
    }
    for (const kejadian of data.followup) {
      await tx.insert(followup).values({
        id: idFollowup.get(kejadian.kunci)!,
        klienId: idKlien.get(kejadian.klienKunci)!,
        tanggal: kejadian.tanggal,
        hasilFollowupId: hasilId,
        deskripsi: kejadian.deskripsi,
        createdBy: idKaryawan.get(kejadian.pemilikKunci)!,
      });
    }
    for (const bayar of data.pembayaran) {
      await tx.insert(pembayaranIuran).values({
        id: idPembayaran.get(bayar.kunci)!,
        karyawanId: idKaryawan.get(bayar.karyawanKunci)!,
        bulan: bayar.bulan,
        nominalIuranId: nominalId,
        tanggalBayar: bayar.tanggalBayar,
        pencatatId: idKaryawan.get("atasan")!,
      });
    }
  });

  if (cleanup) {
    console.log("seed:csv: data verifikasi dibersihkan.");
  } else {
    console.log(`seed:csv: data Faker siap untuk ${EMAIL_LOGIN_SEED_CSV}.`);
    console.log("seed:csv: cakupan: ledger 12 bulan, 3 laporan, 4 anggota, dan follow-up.");
    console.log("seed:csv: bersihkan dengan perintah yang sama ditambah --cleanup.");
  }
} catch (error) {
  console.error(error);
  kode = 1;
} finally {
  await client.end();
}

process.exit(kode);
