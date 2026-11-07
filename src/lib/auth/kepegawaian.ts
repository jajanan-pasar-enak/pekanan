import { eq } from "drizzle-orm";
import { db } from "@/db";
import { karyawan } from "@/db/schema";
import type { Level } from "./otorisasi";

export type ProfilKaryawan = {
  id: string;
  userId: string;
  nama: string;
  level: Level;
  supervisorId: string | null;
  aktif: boolean;
  harusGantiPassword: boolean;
};

export type ProfilBaru = {
  userId: string;
  nama: string;
  level: Level;
  supervisorId: string | null;
};

const kolomProfil = {
  id: karyawan.id,
  userId: karyawan.userId,
  nama: karyawan.nama,
  level: karyawan.level,
  supervisorId: karyawan.supervisorId,
  aktif: karyawan.aktif,
  harusGantiPassword: karyawan.harusGantiPassword,
};

export async function ambilProfil(userId: string): Promise<ProfilKaryawan | null> {
  const [row] = await db
    .select(kolomProfil)
    .from(karyawan)
    .where(eq(karyawan.userId, userId))
    .limit(1);
  return (row as ProfilKaryawan | undefined) ?? null;
}

// Dipanggil dari databaseHooks Better Auth: auth.api.* berjalan di luar
// transaksi request, jadi profil ditulis tepat setelah user dibuat.
export async function buatProfilKaryawan(profil: ProfilBaru): Promise<void> {
  await db.insert(karyawan).values(profil);
}

export async function perbaruiProfil(
  userId: string,
  data: { nama?: string; level?: Level; supervisorId?: string | null },
): Promise<void> {
  if (Object.keys(data).length === 0) return;
  await db.update(karyawan).set(data).where(eq(karyawan.userId, userId));
}

export async function tandaiGantiPasswordSelesai(userId: string): Promise<void> {
  await db
    .update(karyawan)
    .set({ harusGantiPassword: false })
    .where(eq(karyawan.userId, userId));
}
