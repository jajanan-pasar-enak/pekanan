import { connection } from "next/server";
import { z } from "zod";
import { requireKaryawan } from "@/lib/auth/current";
import { bacaJson, handle, jsonOk } from "@/lib/http";
import { ubahFollowup } from "@/lib/klien/mutations";

const idSchema = z.uuid();

export async function PATCH(request: Request, { params }: RouteContext<"/api/followup/[id]">) {
  return handle(async () => {
    await connection();
    const { profil } = await requireKaryawan();
    const id = idSchema.parse((await params).id);
    return jsonOk(await ubahFollowup(id, profil.id, await bacaJson(request)));
  });
}
