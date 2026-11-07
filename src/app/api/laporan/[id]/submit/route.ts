import { connection } from "next/server";
import { z } from "zod";
import { requireKaryawan } from "@/lib/auth/current";
import { handle, jsonOk } from "@/lib/http";
import { submitLaporan } from "@/lib/laporan/mutations";

const idSchema = z.uuid();

export async function POST(request: Request, { params }: RouteContext<"/api/laporan/[id]/submit">) {
  return handle(async () => {
    // Route handler ikut di-prerender saat build; baca sesi hanya per request.
    await connection();
    const { profil } = await requireKaryawan();
    const id = idSchema.parse((await params).id);
    return jsonOk(await submitLaporan(id, profil.id));
  });
}
