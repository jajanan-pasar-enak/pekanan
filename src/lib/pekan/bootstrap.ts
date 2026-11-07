import { and, eq, gt, isNull, max, sql } from "drizzle-orm";
import { db } from "@/db";
import { karyawan, laporanPekan, pekan } from "@/db/schema";
import { pekanWIB, tanggalHariIni } from "@/lib/waktu";

// Lazy + catch-up tanpa scheduler: dipanggil layout (app) dan POST
// /api/pekan/bootstrap. Semua langkah idempoten.
//
// Batas catch-up sengaja hanya MAX(pekan.selesai) milik supervisor yang
// menjadi viewer: melengkapi pekan lampau milik supervisor lain (misalnya
// supervisor baru) bisa menimpa data historis. Draf pekan tertunda muncul
// saat supervisor pemiliknya membuka aplikasi.

async function buatAtauAmbilPekan(mulai: string, selesai: string): Promise<string> {
  const [dibuat] = await db
    .insert(pekan)
    .values({ mulai, selesai })
    .onConflictDoNothing({ target: pekan.mulai })
    .returning({ id: pekan.id });
  if (dibuat) return dibuat.id;
  const [ada] = await db
    .select({ id: pekan.id })
    .from(pekan)
    .where(eq(pekan.mulai, mulai))
    .limit(1);
  if (!ada) throw new Error(`pekan ${mulai} gagal dibuat`);
  return ada.id;
}

async function buatDraf(supervisorId: string, pekanId: string): Promise<void> {
  await db.execute(sql`
    WITH anggota_langsung AS (
      SELECT id FROM karyawan WHERE supervisor_id = ${supervisorId}::uuid
        AND (SELECT aktif FROM karyawan WHERE id = ${supervisorId}::uuid)
    ), laporan_baru AS (
      INSERT INTO laporan_pekan (pekan_id, supervisor_id, status)
      SELECT ${pekanId}::uuid, ${supervisorId}::uuid, 'Draf'
      WHERE EXISTS (SELECT 1 FROM anggota_langsung)
      ON CONFLICT (supervisor_id, pekan_id) WHERE deleted_at IS NULL DO NOTHING
      RETURNING id
    )
    INSERT INTO laporan_anggota (laporan_id, anggota_id)
    SELECT laporan_baru.id, anggota_langsung.id
    FROM laporan_baru CROSS JOIN anggota_langsung
    ON CONFLICT (laporan_id, anggota_id) DO NOTHING
  `);
}

// Dipakai perpindahan supervisor (PATCH /api/admin/karyawan/[id]): Draf pekan
// berjalan milik supervisor baru harus ada sebelum baris anggota dipindahkan.
export async function siapkanDrafPekanBerjalan(supervisorId: string): Promise<void> {
  const { mulai, selesai } = pekanWIB();
  const pekanId = await buatAtauAmbilPekan(mulai, selesai);
  await buatDraf(supervisorId, pekanId);
}

async function batasCatchUp(supervisorId: string, selesaiBerjalan: string): Promise<string> {
  const [terakhir] = await db
    .select({ selesai: max(pekan.selesai) })
    .from(laporanPekan)
    .innerJoin(pekan, eq(pekan.id, laporanPekan.pekanId))
    .where(and(eq(laporanPekan.supervisorId, supervisorId), isNull(laporanPekan.deletedAt)));
  if (terakhir?.selesai) return terakhir.selesai;
  // Belum pernah punya laporan (misalnya supervisor baru): isi hanya pekan berjalan.
  return selesaiBerjalan;
}

async function catchUp(supervisorId: string, selesaiBerjalan: string): Promise<void> {
  const batas = await batasCatchUp(supervisorId, selesaiBerjalan);
  const terlewat = await db
    .select({ id: pekan.id, mulai: pekan.mulai })
    .from(pekan)
    .where(and(gt(pekan.selesai, batas), sql`${pekan.selesai} < ${tanggalHariIni()}`))
    .orderBy(pekan.mulai);
  for (const p of terlewat) {
    await buatDraf(supervisorId, p.id);
  }
}

export async function bootstrapPekan(viewerId: string | null): Promise<void> {
  const { mulai, selesai } = pekanWIB();
  const pekanId = await buatAtauAmbilPekan(mulai, selesai);
  if (!viewerId) return;
  await buatDraf(viewerId, pekanId);
  await catchUp(viewerId, selesai);
}

export async function daftarAnggotaLangsung(supervisorId: string) {
  return db
    .select({ id: karyawan.id, nama: karyawan.nama, level: karyawan.level })
    .from(karyawan)
    .where(eq(karyawan.supervisorId, supervisorId))
    .orderBy(karyawan.nama);
}
