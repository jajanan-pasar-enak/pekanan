import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { karyawan, nominalIuran, pembayaranIuran } from "@/db/schema";
import { AppError } from "@/lib/http";
import { bulanBerjalan, tanggalHariIni } from "@/lib/waktu";
import { alasanBulanDitolak, nominalIuranSchema, pembayaranIuranSchema } from "./aturan";

// Pembayaran dicatat oleh karyawan itu sendiri atau supervisor langsungnya
// atas nama karyawan tersebut; pencatat selalu viewer.
export async function catatPembayaranIuran(
  viewerId: string,
  input: unknown,
  karyawanId: string = viewerId,
) {
  const body = pembayaranIuranSchema.parse(input);

  if (karyawanId !== viewerId) {
    const [anggota] = await db
      .select({ id: karyawan.id, nama: karyawan.nama })
      .from(karyawan)
      .where(and(eq(karyawan.id, karyawanId), eq(karyawan.supervisorId, viewerId)))
      .limit(1);
    if (!anggota) {
      throw new AppError("FORBIDDEN", "Hanya supervisor langsung yang boleh mencatat untuk karyawan ini.");
    }
  }

  const alasan = alasanBulanDitolak(body.bulan, bulanBerjalan());
  if (alasan) throw new AppError("VALIDATION", alasan);

  const [nominal] = await db
    .select({ id: nominalIuran.id })
    .from(nominalIuran)
    .where(and(eq(nominalIuran.id, body.nominalIuranId), eq(nominalIuran.aktif, true)))
    .limit(1);
  if (!nominal) throw new AppError("VALIDATION", "Nominal iuran tidak tersedia.");

  const tanggalBayar = body.tanggalBayar ?? tanggalHariIni();
  if (tanggalBayar > tanggalHariIni()) {
    throw new AppError("VALIDATION", "Tanggal bayar tidak boleh di masa depan.");
  }

  const [sudah] = await db
    .select({ id: pembayaranIuran.id })
    .from(pembayaranIuran)
    .where(
      and(eq(pembayaranIuran.karyawanId, karyawanId), eq(pembayaranIuran.bulan, body.bulan)),
    )
    .limit(1);
  if (sudah) {
    throw new AppError("CONFLICT", "Iuran karyawan untuk bulan itu sudah lunas.", {
      bulan: body.bulan,
    });
  }

  const [baru] = await db
    .insert(pembayaranIuran)
    .values({
      karyawanId,
      bulan: body.bulan,
      nominalIuranId: nominal.id,
      tanggalBayar,
      pencatatId: viewerId,
    })
    .returning({
      id: pembayaranIuran.id,
      bulan: pembayaranIuran.bulan,
      tanggalBayar: pembayaranIuran.tanggalBayar,
    });
  return {
    ...baru!,
    karyawanId,
    dicatatUntukOrangLain: karyawanId !== viewerId,
  };
}

export async function tambahNominalIuran(input: unknown) {
  const body = nominalIuranSchema.parse(input);
  const [baru] = await db
    .insert(nominalIuran)
    .values(body)
    .returning({
      id: nominalIuran.id,
      nama: nominalIuran.nama,
      nominal: nominalIuran.nominal,
      aktif: nominalIuran.aktif,
    });
  return baru!;
}
