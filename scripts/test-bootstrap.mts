// Uji integrasi bootstrap pekan terhadap Postgres lokal (bukan produksi).
// Menyiapkan pekan lampau + laporan, lalu memanggil bootstrapPekan dan
// memeriksa draf yang dibuat, catch-up, idempotensi, dan supervisor nonaktif.
//
// Jalankan setelah migrasi:
//   DATABASE_URL=postgresql://127.0.0.1:55432/pekanan_uji \
//   pnpm exec tsx scripts/test-bootstrap.mts
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { and, eq, isNull, sql } from "drizzle-orm";
import { db } from "../src/db";
import { karyawan, laporanAnggota, laporanPekan, pekan, user } from "../src/db/schema";
import { bootstrapPekan, siapkanDrafPekanBerjalan } from "../src/lib/pekan/bootstrap";
import { pekanWIB, tambahHari } from "../src/lib/waktu";

function hostLokal(raw: string | undefined): boolean {
  if (!raw) return false;
  try {
    return ["localhost", "127.0.0.1", "::1", "[::1]"].includes(new URL(raw).hostname);
  } catch {
    return false;
  }
}

if (!hostLokal(process.env.DATABASE_URL)) {
  console.error("test-bootstrap: DATABASE_URL wajib menunjuk Postgres lokal.");
  process.exit(1);
}

const SEKARANG = pekanWIB();

function pekanLampau(n: number) {
  const mulai = tambahHari(SEKARANG.mulai, -7 * n);
  return { mulai, selesai: tambahHari(mulai, 6) };
}

const P1 = pekanLampau(1);
const P2 = pekanLampau(2);
const P3 = pekanLampau(3);
const P4 = pekanLampau(4);

let lulus = 0;

function cek(aktual: unknown, harapan: unknown, pesan: string) {
  assert.deepEqual(aktual, harapan, pesan);
  lulus++;
  console.log(`ok ${lulus} - ${pesan}`);
}

async function buatKaryawan(nama: string, supervisorId: string | null, aktif = true) {
  const userId = `uji-${crypto.randomUUID()}`;
  await db.insert(user).values({
    id: userId,
    name: nama,
    email: `uji-bootstrap-${crypto.randomUUID()}@contoh.local`,
  });
  const [baris] = await db
    .insert(karyawan)
    .values({ userId, nama, level: "Tetap", supervisorId, aktif })
    .returning({ id: karyawan.id });
  return baris!.id;
}

async function laporanHidup(supervisorId: string) {
  return db
    .select({ id: laporanPekan.id, pekanId: laporanPekan.pekanId, status: laporanPekan.status })
    .from(laporanPekan)
    .where(and(eq(laporanPekan.supervisorId, supervisorId), isNull(laporanPekan.deletedAt)));
}

async function anggotaLaporan(laporanId: string) {
  const baris = await db
    .select({ anggotaId: laporanAnggota.anggotaId })
    .from(laporanAnggota)
    .where(eq(laporanAnggota.laporanId, laporanId));
  return baris.map((b) => b.anggotaId).sort();
}

async function main() {
  await db.execute(
    sql`TRUNCATE TABLE laporan_anggota, laporan_pekan, pekan, karyawan, "user" CASCADE`,
  );

  // S1 punya riwayat (batas catch-up), S2 nonaktif, S3 supervisor baru tanpa
  // riwayat, S4 dipakai siapkanDrafPekanBerjalan.
  const s1 = await buatKaryawan("Uji Satu", null);
  const m1 = await buatKaryawan("Uji Anggota A", s1);
  const m2 = await buatKaryawan("Uji Anggota B", s1);
  const s2 = await buatKaryawan("Uji Dua", null, false);
  await buatKaryawan("Uji Anggota C", s2);
  const s3 = await buatKaryawan("Uji Tiga", null);
  const m4 = await buatKaryawan("Uji Anggota D", s3);
  const s4 = await buatKaryawan("Uji Empat", null);
  const m5 = await buatKaryawan("Uji Anggota E", s4);

  const pekanTersimpan = await db
    .insert(pekan)
    .values([P1, P2, P3, P4])
    .returning({ id: pekan.id, mulai: pekan.mulai });
  const idPekan = new Map(pekanTersimpan.map((p) => [p.mulai, p.id]));

  // S1 sudah lapor pada pekan terlama; pekan P3 punya laporan terhapus yang
  // tidak boleh menghalangi draf baru.
  await db.insert(laporanPekan).values({
    pekanId: idPekan.get(P4.mulai)!,
    supervisorId: s1,
    status: "Terkirim",
  });
  await db.insert(laporanPekan).values({
    pekanId: idPekan.get(P3.mulai)!,
    supervisorId: s1,
    status: "Draf",
    deletedAt: new Date(),
  });

  // Tanpa viewer: hanya pekan berjalan yang dibuat.
  await bootstrapPekan(null);
  const [pekanSekarang] = await db
    .select({ id: pekan.id, mulai: pekan.mulai, selesai: pekan.selesai })
    .from(pekan)
    .where(eq(pekan.mulai, SEKARANG.mulai));
  cek(
    pekanSekarang && { mulai: pekanSekarang.mulai, selesai: pekanSekarang.selesai },
    { mulai: SEKARANG.mulai, selesai: SEKARANG.selesai },
    "pekan berjalan dibuat dengan tanggal WIB yang benar",
  );

  await bootstrapPekan(s1);
  const laporanS1 = await laporanHidup(s1);
  cek(laporanS1.length, 5, "S1 punya 5 laporan hidup: 1 lama, 3 catch-up, 1 pekan berjalan");
  cek(
    laporanS1.filter((l) => l.pekanId === idPekan.get(P4.mulai)!).length,
    1,
    "pekan yang sudah dilaporkan tidak diduplikasi",
  );
  cek(
    laporanS1.filter((l) => l.pekanId === idPekan.get(P3.mulai)!).length,
    1,
    "laporan terhapus tidak menghalangi draf pengganti",
  );
  for (const [label, minggu] of [
    ["pekan-1", P1],
    ["pekan-2", P2],
    ["pekan-3", P3],
  ] as const) {
    const draf = laporanS1.find((l) => l.pekanId === idPekan.get(minggu.mulai)!);
    cek(draf?.status, "Draf", `${label} diisi lewat catch-up sebagai Draf`);
    cek(
      draf ? await anggotaLaporan(draf.id) : null,
      [m1, m2].sort(),
      `${label} memuat tepat anggota langsung S1`,
    );
  }
  const laporanBerjalan = laporanS1.find((l) => l.pekanId === pekanSekarang?.id);
  cek(laporanBerjalan?.status, "Draf", "pekan berjalan memakai status Draf");
  cek(
    laporanBerjalan ? await anggotaLaporan(laporanBerjalan.id) : null,
    [m1, m2].sort(),
    "pekan berjalan S1 memuat tepat anggota langsungnya",
  );

  const jumlahS1 = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(laporanPekan)
    .where(eq(laporanPekan.supervisorId, s1));
  await bootstrapPekan(s1);
  const jumlahS1Lagi = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(laporanPekan)
    .where(eq(laporanPekan.supervisorId, s1));
  cek(jumlahS1Lagi[0]?.n, jumlahS1[0]?.n, "bootstrap kedua tidak menambah baris apa pun");
  const jumlahPekan = await db.select({ n: sql<number>`count(*)::int` }).from(pekan);
  cek(jumlahPekan[0]?.n, 5, "tidak ada pekan ganda: 4 lampau + 1 berjalan");

  await bootstrapPekan(s2);
  cek((await laporanHidup(s2)).length, 0, "supervisor nonaktif tidak mendapat draf");
  const anggotaS2 = await db
    .select({ id: laporanAnggota.id })
    .from(laporanAnggota)
    .innerJoin(laporanPekan, eq(laporanPekan.id, laporanAnggota.laporanId))
    .where(eq(laporanPekan.supervisorId, s2));
  cek(anggotaS2.length, 0, "anggota supervisor nonaktif tidak ikut masuk laporan");

  await bootstrapPekan(s3);
  const laporanS3 = await laporanHidup(s3);
  cek(laporanS3.length, 1, "supervisor baru hanya mendapat pekan berjalan");
  cek(
    laporanS3[0] ? await anggotaLaporan(laporanS3[0].id) : null,
    [m4],
    "pekan berjalan supervisor baru memuat anggotanya",
  );

  await siapkanDrafPekanBerjalan(s4);
  const laporanS4 = await laporanHidup(s4);
  cek(laporanS4.length, 1, "siapkanDrafPekanBerjalan hanya membuat pekan berjalan");
  cek(
    laporanS4[0] ? await anggotaLaporan(laporanS4[0].id) : null,
    [m5],
    "draf perpindahan supervisor memuat anggotanya",
  );
  cek(
    laporanS4.every((l) => laporanS1.every((s) => s.id !== l.id)),
    true,
    "draf antar supervisor tidak tercampur",
  );
}

try {
  await main();
  console.log(`# ${lulus} pemeriksaan lulus`);
  process.exit(0);
} catch (error) {
  console.error(`not ok - ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}
