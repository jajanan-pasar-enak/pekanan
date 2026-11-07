import { connection } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/current";
import { bacaJson, handle, jsonOk } from "@/lib/http";
import { alihKlien } from "@/lib/klien/mutations";

const idSchema = z.uuid();

export async function POST(request: Request, { params }: RouteContext<"/api/klien/[id]/alih">) {
  return handle(async () => {
    // Route handler ikut di-prerender saat build; baca sesi hanya per request.
    await connection();
    await requireAdmin();
    const id = idSchema.parse((await params).id);
    return jsonOk(await alihKlien(id, await bacaJson(request)));
  });
}
