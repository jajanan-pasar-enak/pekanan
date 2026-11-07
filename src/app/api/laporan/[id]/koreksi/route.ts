import { connection } from "next/server";
import { z } from "zod";
import { requireKaryawan } from "@/lib/auth/current";
import { handle, jsonOk } from "@/lib/http";
import { koreksiLaporan } from "@/lib/laporan/mutations";

const idSchema = z.uuid();

export async function POST(
  request: Request,
  { params }: RouteContext<"/api/laporan/[id]/koreksi">,
) {
  return handle(async () => {
    // Route handler ikut di-prerender saat build; baca sesi hanya per request.
    await connection();
    const { profil } = await requireKaryawan();
    const id = idSchema.parse((await params).id);
    const body = await request.json();
    return jsonOk(await koreksiLaporan(id, profil.id, body));
  });
}
