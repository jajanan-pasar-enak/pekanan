import { eq } from "drizzle-orm";
import { db } from "@/db";
import { karyawan } from "@/db/schema";

export type Level = "Magang" | "Tetap";

export type RingkasKaryawan = {
  id: string;
  nama: string;
  level: string;
  aktif: boolean;
};

export async function ambilRingkas(id: string): Promise<RingkasKaryawan | null> {
  const [row] = await db
    .select({
      id: karyawan.id,
      nama: karyawan.nama,
      level: karyawan.level,
      aktif: karyawan.aktif,
    })
    .from(karyawan)
    .where(eq(karyawan.id, id))
    .limit(1);
  return row ?? null;
}

export async function ambilIdByUserId(userId: string): Promise<string | null> {
  const [row] = await db
    .select({ id: karyawan.id })
    .from(karyawan)
    .where(eq(karyawan.userId, userId))
    .limit(1);
  return row?.id ?? null;
}

export async function supervisorIdDari(karyawanId: string): Promise<string | null> {
  const [row] = await db
    .select({ supervisorId: karyawan.supervisorId })
    .from(karyawan)
    .where(eq(karyawan.id, karyawanId))
    .limit(1);
  return row?.supervisorId ?? null;
}

// Supervisor harus ada & aktif; Magang wajib dibimbing Karyawan Tetap.
export async function periksaSupervisor(
  level: Level,
  supervisorId: string | null,
): Promise<string | null> {
  if (supervisorId === null) {
    return level === "Magang" ? "Magang wajib punya supervisor Tetap." : null;
  }
  const supervisor = await ambilRingkas(supervisorId);
  if (!supervisor) return "Supervisor tidak ditemukan.";
  if (!supervisor.aktif) return "Supervisor sudah nonaktif.";
  if (level === "Magang" && supervisor.level !== "Tetap") {
    return "Supervisor seorang Magang harus Karyawan Tetap.";
  }
  return null;
}

// Menelusuri rantai supervisor ke atas; true bila `targetId` ada di rantai
// atasan dari `mulaiId` (dipakai untuk menolak siklus supervisi).
export async function membentukSiklus(
  mulaiId: string,
  targetId: string,
): Promise<boolean> {
  let sekarang: string | null = mulaiId;
  const dikunjungi = new Set<string>();
  while (sekarang) {
    if (sekarang === targetId) return true;
    if (dikunjungi.has(sekarang)) return false;
    dikunjungi.add(sekarang);
    sekarang = await supervisorIdDari(sekarang);
  }
  return false;
}
