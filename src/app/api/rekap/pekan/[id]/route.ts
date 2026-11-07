import { connection } from "next/server";
import { z } from "zod";
import { requireKaryawan } from "@/lib/auth/current";
import { handle, jsonOk } from "@/lib/http";
import { getRekapPekan } from "@/lib/kepegawaian/queries";

const idSchema = z.uuid();

export async function GET(_request: Request, { params }: RouteContext<"/api/rekap/pekan/[id]">) {
  return handle(async () => {
    // Route handler ikut di-prerender saat build; baca sesi hanya per request.
    await connection();
    const { sesi, profil } = await requireKaryawan();
    const id = idSchema.parse((await params).id);
    return jsonOk(
      await getRekapPekan(id, {
        karyawanId: profil.id,
        admin: sesi.user.role === "admin",
      }),
    );
  });
}
