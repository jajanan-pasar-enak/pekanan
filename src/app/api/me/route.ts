import { connection } from "next/server";
import { requireKaryawan } from "@/lib/auth/current";
import { handle, jsonOk } from "@/lib/http";

export async function GET() {
  return handle(async () => {
    // Route handler ikut di-prerender saat build; baca sesi hanya per request.
    await connection();
    const { sesi, profil } = await requireKaryawan({ izinkanGantiPassword: true });
    return jsonOk({
      id: profil.id,
      userId: sesi.user.id,
      nama: profil.nama,
      email: sesi.user.email,
      level: profil.level,
      role: sesi.user.role ?? "user",
      supervisorId: profil.supervisorId,
      aktif: profil.aktif,
      harusGantiPassword: profil.harusGantiPassword,
    });
  });
}
