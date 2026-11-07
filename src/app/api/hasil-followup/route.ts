import { connection } from "next/server";
import { requireAdmin, requireKaryawan } from "@/lib/auth/current";
import { bacaJson, handle, jsonOk } from "@/lib/http";
import { tambahHasilFollowup } from "@/lib/klien/mutations";
import { daftarHasilFollowup } from "@/lib/klien/queries";

export async function GET(request: Request) {
  return handle(async () => {
    // Route handler ikut di-prerender saat build; baca sesi hanya per request.
    await connection();
    await requireKaryawan();
    const hanyaAktif = new URL(request.url).searchParams.get("aktif") === "1";
    return jsonOk(await daftarHasilFollowup(hanyaAktif));
  });
}

export async function POST(request: Request) {
  return handle(async () => {
    await connection();
    await requireAdmin();
    return jsonOk(await tambahHasilFollowup(await bacaJson(request)), 201);
  });
}
