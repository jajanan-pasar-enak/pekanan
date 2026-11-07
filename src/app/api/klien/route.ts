import { connection } from "next/server";
import { requireKaryawan } from "@/lib/auth/current";
import { bacaJson, handle, jsonOk } from "@/lib/http";
import { buatKlien } from "@/lib/klien/mutations";
import { daftarKlienSaya } from "@/lib/klien/queries";

export async function GET() {
  return handle(async () => {
    // Route handler ikut di-prerender saat build; baca sesi hanya per request.
    await connection();
    const { profil } = await requireKaryawan();
    return jsonOk(await daftarKlienSaya(profil.id));
  });
}

export async function POST(request: Request) {
  return handle(async () => {
    await connection();
    const { profil } = await requireKaryawan();
    return jsonOk(await buatKlien(profil.id, await bacaJson(request)), 201);
  });
}
