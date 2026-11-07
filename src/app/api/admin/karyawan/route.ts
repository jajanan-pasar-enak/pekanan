import { connection } from "next/server";
import { requireAdmin } from "@/lib/auth/current";
import { bacaJson, handle, jsonOk } from "@/lib/http";
import { buatKaryawan } from "@/lib/kepegawaian/mutations";
import { daftarKaryawan } from "@/lib/kepegawaian/queries";

export async function GET() {
  return handle(async () => {
    // Route handler ikut di-prerender saat build; baca sesi hanya per request.
    await connection();
    await requireAdmin();
    return jsonOk(await daftarKaryawan());
  });
}

export async function POST(request: Request) {
  return handle(async () => {
    await connection();
    await requireAdmin();
    // auth.api.createUser memvalidasi level & supervisor lewat databaseHooks
    // dan membuat profil karyawan (harus_ganti_password = true). autoSignIn
    // false memastikan sesi admin tidak tertimpa.
    return jsonOk(await buatKaryawan(await bacaJson(request), request.headers), 201);
  });
}
