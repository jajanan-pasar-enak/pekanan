import { connection } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/current";
import { bacaJson, handle, jsonOk } from "@/lib/http";
import { ubahKaryawan } from "@/lib/kepegawaian/mutations";

const idSchema = z.uuid();

export async function PATCH(
  request: Request,
  { params }: RouteContext<"/api/admin/karyawan/[id]">,
) {
  return handle(async () => {
    // Route handler ikut di-prerender saat build; baca sesi hanya per request.
    await connection();
    await requireAdmin();
    const id = idSchema.parse((await params).id);
    const { sesudah, perluCabutSesi } = await ubahKaryawan(id, await bacaJson(request));
    return jsonOk({
      id: sesudah.id,
      nama: sesudah.nama,
      level: sesudah.level,
      supervisorId: sesudah.supervisorId,
      aktif: sesudah.aktif,
      sesiDicabut: perluCabutSesi,
    });
  });
}
