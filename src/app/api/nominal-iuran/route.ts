import { connection } from "next/server";
import { requireAdmin, requireKaryawan } from "@/lib/auth/current";
import { bacaJson, handle, jsonOk } from "@/lib/http";
import { tambahNominalIuran } from "@/lib/iuran/mutations";
import { daftarNominalIuran } from "@/lib/iuran/queries";

export async function GET(request: Request) {
  return handle(async () => {
    // Route handler ikut di-prerender saat build; baca sesi hanya per request.
    await connection();
    await requireKaryawan();
    const hanyaAktif = new URL(request.url).searchParams.get("aktif") === "1";
    return jsonOk(await daftarNominalIuran(hanyaAktif));
  });
}

export async function POST(request: Request) {
  return handle(async () => {
    await connection();
    await requireAdmin();
    return jsonOk(await tambahNominalIuran(await bacaJson(request)), 201);
  });
}
