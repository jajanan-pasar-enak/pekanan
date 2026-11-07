import { connection } from "next/server";
import { z } from "zod";
import { requireKaryawan } from "@/lib/auth/current";
import { handle, jsonOk } from "@/lib/http";
import { getKlien } from "@/lib/klien/queries";

const idSchema = z.uuid();

export async function GET(_request: Request, { params }: RouteContext<"/api/klien/[id]">) {
  return handle(async () => {
    // Route handler ikut di-prerender saat build; baca sesi hanya per request.
    await connection();
    const { profil } = await requireKaryawan();
    const id = idSchema.parse((await params).id);
    return jsonOk(await getKlien(id, profil.id));
  });
}
