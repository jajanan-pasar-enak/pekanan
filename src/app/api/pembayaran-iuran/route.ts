import { connection } from "next/server";
import { z } from "zod";
import { requireKaryawan } from "@/lib/auth/current";
import { bacaJson, handle, jsonOk } from "@/lib/http";
import { pembayaranIuranSchema } from "@/lib/iuran/aturan";
import { catatPembayaranIuran } from "@/lib/iuran/mutations";
import { daftarPembayaran } from "@/lib/iuran/queries";

// karyawanId opsional: absen = catat untuk diri sendiri (pencatat = viewer).
const bodySchema = pembayaranIuranSchema.extend({
  karyawanId: z.uuid("Karyawan tidak valid.").optional(),
});

export async function GET(request: Request) {
  return handle(async () => {
    // Route handler ikut di-prerender saat build; baca sesi hanya per request.
    await connection();
    const { profil } = await requireKaryawan();
    const mentah = new URL(request.url).searchParams.get("karyawanId");
    const karyawanId = mentah === null ? undefined : z.uuid().parse(mentah);
    return jsonOk(await daftarPembayaran(profil.id, karyawanId));
  });
}

export async function POST(request: Request) {
  return handle(async () => {
    await connection();
    const { profil } = await requireKaryawan();
    const { karyawanId, ...input } = bodySchema.parse(await bacaJson(request));
    return jsonOk(await catatPembayaranIuran(profil.id, input, karyawanId), 201);
  });
}
