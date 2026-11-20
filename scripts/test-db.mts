// Uji integrasi trigger retire_transferred_laporan dan CHECK inti terhadap
// Postgres lokal (bukan produksi). Setiap kasus berjalan dalam transaksi yang
// di-rollback, jadi skrip aman dijalankan berulang.
//
// Jalankan setelah migrasi:
//   DATABASE_URL=postgresql://127.0.0.1:55432/pekanan_uji \
//   pnpm exec tsx scripts/test-db.mts
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { db } from "../src/db";
import { karyawan, laporanPekan, pekan, user } from "../src/db/schema";
import { pekanWIB, tambahHari } from "../src/lib/waktu";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

function hostLokal(raw: string | undefined): boolean {
  if (!raw) return false;
  try {
    return ["localhost", "127.0.0.1", "::1", "[::1]"].includes(new URL(raw).hostname);
  } catch {
    return false;
  }
}

if (!hostLokal(process.env.DATABASE_URL)) {
  console.error("test-db: DATABASE_URL wajib menunjuk Postgres lokal.");
  process.exit(1);
}

const PEKAN = pekanWIB();
let lulus = 0;

function cek(aktual: unknown, harapan: unknown, pesan: string) {
  assert.deepEqual(aktual, harapan, pesan);
  lulus++;
  console.log(`ok ${lulus} - ${pesan}`);
}

class Gulung extends Error {}

async function dalamTransaksi(fn: (tx: Tx) => Promise<void>) {
  try {
    await db.transaction(async (tx) => {
      await fn(tx);
      throw new Gulung();
    });
  } catch (error) {
    if (!(error instanceof Gulung)) throw error;
  }
}

async function buatSupervisor(tx: Tx, nama: string) {
  const userId = `uji-${crypto.randomUUID()}`;
  await tx.insert(user).values({
    id: userId,
    name: nama,
    email: `uji-trigger-${crypto.randomUUID()}@contoh.local`,
  });
  const [baris] = await tx
    .insert(karyawan)
    .values({ userId, nama, level: "Tetap" })
    .returning({ id: karyawan.id });
  return baris!.id;
}

async function buatPekan(tx: Tx) {
  const [baris] = await tx.insert(pekan).values(PEKAN).returning({ id: pekan.id });
  return baris!.id;
}

async function buatLaporan(
  tx: Tx,
  pekanId: string,
  supervisorId: string,
  opsi: { deletedAt?: Date; status?: string } = {},
) {
  const [baris] = await tx
    .insert(laporanPekan)
    .values({
      pekanId,
      supervisorId,
      status: opsi.status ?? "Draf",
      ...(opsi.deletedAt ? { deletedAt: opsi.deletedAt } : {}),
    })
    .returning({ id: laporanPekan.id });
  return baris!.id;
}

async function pindahkan(tx: Tx, laporanId: string, supervisorId: string) {
  const [baris] = await tx
    .update(laporanPekan)
    .set({ supervisorId })
    .where(eq(laporanPekan.id, laporanId))
    .returning({ deletedAt: laporanPekan.deletedAt });
  return baris!.deletedAt;
}

function rantaiPesan(error: unknown): string {
  const bagian: string[] = [];
  let e: unknown = error;
  for (let i = 0; i < 5 && e instanceof Error; i++) {
    bagian.push(e.message);
    e = (e as Error & { cause?: unknown }).cause;
  }
  return bagian.join(" | ");
}

async function harusGagal(tx: Tx, fn: (t: Tx) => Promise<unknown>, pola: RegExp, pesan: string) {
  let pesanError = "";
  try {
    await tx.transaction(async (t) => {
      await fn(t);
    });
  } catch (error) {
    pesanError = rantaiPesan(error);
  }
  assert.match(pesanError, pola, `${pesan} (error: ${pesanError || "tidak ada"})`);
  lulus++;
  console.log(`ok ${lulus} - ${pesan}`);
}

async function main() {
  await db.execute(
    sql`TRUNCATE TABLE laporan_anggota, laporan_pekan, pekan, karyawan, "user" CASCADE`,
  );

  await dalamTransaksi(async (tx) => {
    const s1 = await buatSupervisor(tx, "Uji Pindah A");
    const s2 = await buatSupervisor(tx, "Uji Pindah B");
    const s3 = await buatSupervisor(tx, "Uji Pindah C");
    const p = await buatPekan(tx);
    const a = await buatLaporan(tx, p, s1);
    await buatLaporan(tx, p, s2);

    const deletedAt = await pindahkan(tx, a, s2);
    cek(
      deletedAt instanceof Date,
      true,
      "laporan dipensiunkan saat tujuan sudah punya laporan hidup",
    );

    const [row] = await tx
      .select({ deletedAt: laporanPekan.deletedAt })
      .from(laporanPekan)
      .where(eq(laporanPekan.id, a));
    cek(row?.deletedAt instanceof Date, true, "deleted_at tersimpan pada baris yang kalah");

    const a2 = await buatLaporan(tx, p, s1);
    cek(
      await pindahkan(tx, a2, s3),
      null,
      "laporan tidak dipensiunkan bila tujuan belum punya laporan",
    );
  });

  await dalamTransaksi(async (tx) => {
    const s1 = await buatSupervisor(tx, "Uji Sama A");
    const s2 = await buatSupervisor(tx, "Uji Sama B");
    const p = await buatPekan(tx);
    const a = await buatLaporan(tx, p, s1);
    await buatLaporan(tx, p, s2);

    cek(await pindahkan(tx, a, s1), null, "supervisor yang sama tidak memicu pemensiunan");
    const [row] = await tx
      .update(laporanPekan)
      .set({ status: "Terkirim" })
      .where(eq(laporanPekan.id, a))
      .returning({ deletedAt: laporanPekan.deletedAt });
    cek(row?.deletedAt, null, "mengubah kolom selain supervisor tidak memicu trigger");
  });

  await dalamTransaksi(async (tx) => {
    const s1 = await buatSupervisor(tx, "Uji Hapus A");
    const s2 = await buatSupervisor(tx, "Uji Hapus B");
    const p = await buatPekan(tx);
    const lama = new Date("2026-01-01T00:00:00Z");
    const a = await buatLaporan(tx, p, s1, { deletedAt: lama });
    await buatLaporan(tx, p, s2);

    const deletedAt = await pindahkan(tx, a, s2);
    cek(deletedAt?.getTime(), lama.getTime(), "baris yang sudah terhapus tidak diubah trigger");
  });

  await dalamTransaksi(async (tx) => {
    const s1 = await buatSupervisor(tx, "Uji Unik A");
    const p = await buatPekan(tx);
    await buatLaporan(tx, p, s1);
    await harusGagal(
      tx,
      (t) => buatLaporan(t, p, s1),
      /laporan_pekan_hidup_unique|duplicate key/i,
      "dua laporan hidup untuk supervisor dan pekan yang sama ditolak",
    );
  });

  await dalamTransaksi(async (tx) => {
    await harusGagal(
      tx,
      (t) => t.insert(pekan).values({ mulai: tambahHari(PEKAN.mulai, 1), selesai: PEKAN.selesai }),
      /pekan_mulai_minggu_check|violates check/i,
      "pekan yang tidak dimulai hari Minggu ditolak",
    );
    await harusGagal(
      tx,
      (t) => t.insert(pekan).values({ mulai: PEKAN.mulai, selesai: tambahHari(PEKAN.selesai, 1) }),
      /pekan_tujuh_hari_check|violates check|duplicate key/i,
      "pekan yang bukan tujuh hari ditolak",
    );
  });

  await dalamTransaksi(async (tx) => {
    const s = await buatSupervisor(tx, "Uji Status");
    const p = await buatPekan(tx);
    await harusGagal(
      tx,
      (t) => buatLaporan(t, p, s, { status: "Selesai" }),
      /laporan_pekan_status_check|violates check/i,
      "status laporan di luar himpunan ditolak",
    );
  });
}

try {
  await main();
  console.log(`# ${lulus} pemeriksaan lulus`);
  process.exit(0);
} catch (error) {
  console.error(`not ok - ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}
