import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import {
  karyawan,
  koreksiLaporan as tabelKoreksi,
  laporanAnggota,
  laporanPekan,
  pekan,
} from "@/db/schema";
import { AppError } from "@/lib/http";
import { pekanWIB } from "@/lib/waktu";
import { kolomKosong, normalisasiPatch, patchBarisSchema, type BarisNilai } from "./aturan";

export const koreksiSchema = z.object({
  alasan: z.string().trim().min(1, "Alasan koreksi wajib diisi.").max(2000),
  baris: z
    .array(patchBarisSchema.extend({ anggotaId: z.uuid() }))
    .min(1, "Tidak ada perubahan yang dikirim."),
});

export type KoreksiInput = z.infer<typeof koreksiSchema>;

async function ambilUntukUbah(laporanId: string) {
  const [row] = await db
    .select({
      id: laporanPekan.id,
      status: laporanPekan.status,
      supervisorId: laporanPekan.supervisorId,
      pekanMulai: pekan.mulai,
      pekanSelesai: pekan.selesai,
    })
    .from(laporanPekan)
    .innerJoin(pekan, eq(pekan.id, laporanPekan.pekanId))
    .where(and(eq(laporanPekan.id, laporanId), isNull(laporanPekan.deletedAt)))
    .limit(1);
  if (!row) throw new AppError("NOT_FOUND", "Laporan tidak ditemukan.");
  return row;
}

function pastikanMilikDanBerjalan(
  row: { supervisorId: string; pekanMulai: string },
  viewerId: string,
) {
  if (row.supervisorId !== viewerId) {
    throw new AppError("FORBIDDEN", "Hanya supervisor pemilik laporan yang boleh mengubahnya.");
  }
  if (row.pekanMulai !== pekanWIB().mulai) {
    throw new AppError("FORBIDDEN", "Pekan sudah berakhir; laporan hanya bisa dikoreksi atasan.");
  }
}

const kolomNilai = {
  kehadiran: laporanAnggota.kehadiran,
  keteranganHadir: laporanAnggota.keteranganHadir,
  mediaOnline: laporanAnggota.mediaOnline,
  mediaOffline: laporanAnggota.mediaOffline,
  oneOnOne: laporanAnggota.oneOnOne,
  keteranganOneOnOne: laporanAnggota.keteranganOneOnOne,
};

export type HasilPatchBaris = { baris: BarisNilai; barisLengkap: boolean };

export async function patchBaris(
  laporanId: string,
  anggotaId: string,
  viewerId: string,
  patch: unknown,
): Promise<HasilPatchBaris> {
  const row = await ambilUntukUbah(laporanId);
  if (row.status !== "Draf") {
    throw new AppError("FORBIDDEN", "Laporan yang sudah dikirim tidak bisa diubah.");
  }
  pastikanMilikDanBerjalan(row, viewerId);
  const nilai = normalisasiPatch(patchBarisSchema.parse(patch));

  const [diperbarui] = await db
    .update(laporanAnggota)
    .set(nilai)
    .where(and(eq(laporanAnggota.laporanId, laporanId), eq(laporanAnggota.anggotaId, anggotaId)))
    .returning({ baris: kolomNilai });
  if (!diperbarui) {
    throw new AppError("NOT_FOUND", "Anggota tidak ada di laporan ini.");
  }
  const kosong = kolomKosong(diperbarui.baris);
  return { baris: diperbarui.baris, barisLengkap: kosong.length === 0 };
}

export async function submitLaporan(laporanId: string, viewerId: string) {
  const row = await ambilUntukUbah(laporanId);
  if (row.supervisorId !== viewerId) {
    throw new AppError("FORBIDDEN", "Hanya supervisor pemilik laporan yang boleh mengirimnya.");
  }
  if (row.status !== "Draf") {
    throw new AppError("FORBIDDEN", "Laporan ini sudah dikirim.");
  }
  if (row.pekanMulai !== pekanWIB().mulai) {
    throw new AppError("FORBIDDEN", "Pekan sudah berakhir; laporan tidak bisa dikirim.");
  }

  const baris = await db
    .select({ anggotaId: laporanAnggota.anggotaId, nama: karyawan.nama, ...kolomNilai })
    .from(laporanAnggota)
    .innerJoin(karyawan, eq(karyawan.id, laporanAnggota.anggotaId))
    .where(eq(laporanAnggota.laporanId, laporanId));
  if (baris.length === 0) {
    throw new AppError("VALIDATION", "Laporan tidak punya baris anggota.");
  }
  const belumLengkap = baris
    .map((b) => ({ anggotaId: b.anggotaId, nama: b.nama, kolom: kolomKosong(b) }))
    .filter((b) => b.kolom.length > 0);
  if (belumLengkap.length > 0) {
    throw new AppError(
      "VALIDATION",
      "Masih ada nilai yang kosong. Lengkapi semua baris sebelum mengirim.",
      { baris: belumLengkap },
    );
  }

  // Guard status di WHERE: submit ganda bersamaan tidak menghasilkan dua update.
  const [diubah] = await db
    .update(laporanPekan)
    .set({ status: "Terkirim", submittedAt: new Date() })
    .where(
      and(
        eq(laporanPekan.id, laporanId),
        eq(laporanPekan.status, "Draf"),
        isNull(laporanPekan.deletedAt),
      ),
    )
    .returning({ id: laporanPekan.id, status: laporanPekan.status });
  if (!diubah) {
    throw new AppError("CONFLICT", "Laporan sudah dikirim oleh permintaan lain.");
  }
  return diubah;
}

// Koreksi oleh Atasan Supervisor langsung untuk pekan yang sudah berakhir.
// Satu transaksi: diff sebelum/sesudah + catatan koreksi + status Dikoreksi.
export async function koreksiLaporan(laporanId: string, viewerId: string, input: unknown) {
  const body = koreksiSchema.parse(input);
  const row = await ambilUntukUbah(laporanId);
  if (row.supervisorId === viewerId) {
    throw new AppError("FORBIDDEN", "Koreksi dilakukan Atasan Supervisor, bukan pemilik.");
  }
  const [pemilik] = await db
    .select({ supervisorId: karyawan.supervisorId })
    .from(karyawan)
    .where(eq(karyawan.id, row.supervisorId))
    .limit(1);
  if (!pemilik || pemilik.supervisorId !== viewerId) {
    throw new AppError("NOT_FOUND", "Laporan tidak ditemukan.");
  }
  if (row.pekanSelesai >= pekanWIB().mulai) {
    throw new AppError(
      "FORBIDDEN",
      "Pekan ini belum berakhir; koreksi hanya untuk laporan pekan lampau.",
    );
  }

  return db.transaction(async (tx) => {
    const baris = await tx
      .select({ anggotaId: laporanAnggota.anggotaId, ...kolomNilai })
      .from(laporanAnggota)
      .where(eq(laporanAnggota.laporanId, laporanId));
    const perAnggota = new Map(baris.map((b) => [b.anggotaId, b]));

    const sebelum: Record<string, BarisNilai> = {};
    const sesudah: Record<string, BarisNilai> = {};
    for (const ubah of body.baris) {
      const lama = perAnggota.get(ubah.anggotaId);
      if (!lama) {
        throw new AppError("NOT_FOUND", "Anggota tidak ada di laporan ini.");
      }
      const baru = { ...lama, ...normalisasiPatch(ubah) };
      const berubah = (Object.keys(kolomNilai) as (keyof BarisNilai)[]).filter(
        (k) => baru[k] !== lama[k],
      );
      if (berubah.length === 0) continue;
      sebelum[ubah.anggotaId] = lama;
      sesudah[ubah.anggotaId] = baru;
    }
    if (Object.keys(sebelum).length === 0) {
      throw new AppError("VALIDATION", "Tidak ada perubahan yang dikirim.");
    }

    const [catatan] = await tx
      .insert(tabelKoreksi)
      .values({
        laporanId,
        korektorId: viewerId,
        alasan: body.alasan,
        sebelum,
        sesudah,
      })
      .returning({ id: tabelKoreksi.id });

    for (const [anggotaId, nilai] of Object.entries(sesudah)) {
      await tx
        .update(laporanAnggota)
        .set(nilai)
        .where(
          and(eq(laporanAnggota.laporanId, laporanId), eq(laporanAnggota.anggotaId, anggotaId)),
        );
    }

    const [diubah] = await tx
      .update(laporanPekan)
      .set({ status: "Dikoreksi" })
      .where(eq(laporanPekan.id, laporanId))
      .returning({ id: laporanPekan.id, status: laporanPekan.status });

    return { koreksiId: catatan!.id, status: diubah!.status, baris: Object.keys(sesudah) };
  });
}
