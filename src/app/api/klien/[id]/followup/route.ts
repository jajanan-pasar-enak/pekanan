import { connection } from "next/server";
import { z } from "zod";
import { requireKaryawan } from "@/lib/auth/current";
import { bacaJson, handle, jsonOk } from "@/lib/http";
import { catatFollowup } from "@/lib/klien/mutations";
import { getKlien } from "@/lib/klien/queries";

const idSchema = z.uuid();

export async function GET(_request: Request, { params }: RouteContext<"/api/klien/[id]/followup">) {
  return handle(async () => {
    // Route handler ikut di-prerender saat build; baca sesi hanya per request.
    await connection();
    const { profil } = await requireKaryawan();
    const id = idSchema.parse((await params).id);
    const klien = await getKlien(id, profil.id);
    return jsonOk(klien.followup);
  });
}

export async function POST(request: Request, { params }: RouteContext<"/api/klien/[id]/followup">) {
  return handle(async () => {
    await connection();
    const { profil } = await requireKaryawan();
    const id = idSchema.parse((await params).id);
    return jsonOk(await catatFollowup(id, profil.id, await bacaJson(request)), 201);
  });
}
