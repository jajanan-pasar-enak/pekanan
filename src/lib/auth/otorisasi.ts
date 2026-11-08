import { sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { karyawan } from "@/db/schema";

export type Level = "Magang" | "Tetap";

export type RingkasKaryawan = {
  id: string;
  nama: string;
  level: string;
  aktif: boolean;
};

// Lock global untuk setiap perubahan relasi supervisi. Siklus hanya bisa
// tercipta oleh dua perubahan bersamaan, jadi semua perubahan diserialkan
// pada satu kunci ini.
const KUNCI_SUPERVISI = 4242;

export type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export async function kunciSupervisi(tx: Tx): Promise<void> {
  await tx.execute(sql`SELECT pg_advisory_xact_lock(${KUNCI_SUPERVISI})`);
}

// Supervisor harus ada & aktif; Magang wajib dibimbing Karyawan Tetap.
export async function periksaSupervisor(
  level: Level,
  supervisorId: string | null,
): Promise<string | null> {
  if (supervisorId === null) {
    return level === "Magang" ? "Magang wajib punya supervisor Tetap." : null;
  }
  const [supervisor] = await db
    .select({ level: karyawan.level, aktif: karyawan.aktif })
    .from(karyawan)
    .where(sql`${karyawan.id} = ${supervisorId}`)
    .limit(1);
  if (!supervisor) return "Supervisor tidak ditemukan.";
  if (!supervisor.aktif) return "Supervisor sudah nonaktif.";
  if (level === "Magang" && supervisor.level !== "Tetap") {
    return "Supervisor seorang Magang harus Karyawan Tetap.";
  }
  return null;
}

// Target (supervisor baru) tidak boleh menjadi turunan dari karyawan yang
// diubah, dan baris karyawan tidak boleh dibimbing dirinya sendiri.
export function sqlSupervisorMembentukSiklus(karyawanId: string, supervisorId: string): SQL {
  return sql`EXISTS (
    WITH RECURSIVE rantai AS (
      SELECT id, supervisor_id, 1 AS kedalaman FROM karyawan WHERE id = ${supervisorId}::uuid
      UNION ALL
      SELECT k.id, k.supervisor_id, r.kedalaman + 1
      FROM karyawan k JOIN rantai r ON k.id = r.supervisor_id
      WHERE r.kedalaman < 100
    )
    SELECT 1 FROM rantai WHERE id = ${karyawanId}::uuid
  )`;
}
