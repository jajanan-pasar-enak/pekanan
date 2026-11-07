import { connection } from "next/server";
import { z } from "zod";
import { requireKaryawan } from "@/lib/auth/current";
import { handle, jsonOk } from "@/lib/http";
import { patchBaris } from "@/lib/laporan/mutations";

const idSchema = z.uuid();

export async function PATCH(
  request: Request,
  { params }: RouteContext<"/api/laporan/[id]/baris/[anggotaId]">,
) {
  return handle(async () => {
    // Route handler ikut di-prerender saat build; baca sesi hanya per request.
    await connection();
    const { profil } = await requireKaryawan();
    const { id, anggotaId } = await params;
    const body = await request.json();
    return jsonOk(await patchBaris(idSchema.parse(id), idSchema.parse(anggotaId), profil.id, body));
  });
}
