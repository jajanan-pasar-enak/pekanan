import { connection } from "next/server";
import { z } from "zod";
import { requireKaryawan } from "@/lib/auth/current";
import { handle, jsonOk } from "@/lib/http";
import { daftarFollowupPekan } from "@/lib/klien/followup";
import { getLaporan } from "@/lib/laporan/queries";

const idSchema = z.uuid();

export async function GET(
  _request: Request,
  { params }: RouteContext<"/api/laporan/[id]/followup">,
) {
  return handle(async () => {
    await connection();
    const { profil } = await requireKaryawan();
    const id = idSchema.parse((await params).id);
    // Hak baca laporan (pemilik atau Atasan Supervisor langsung) ditegakkan di sini;
    // selain itu 404 agar keberadaan laporan tidak bocor.
    const laporan = await getLaporan(id, profil.id);
    return jsonOk(await daftarFollowupPekan(laporan.supervisor.id, laporan.pekan, profil.id));
  });
}
