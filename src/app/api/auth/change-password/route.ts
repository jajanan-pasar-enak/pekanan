import { connection } from "next/server";
import { z } from "zod";
import { requireKaryawan } from "@/lib/auth/current";
import { tandaiGantiPasswordSelesai } from "@/lib/auth/kepegawaian";
import { auth } from "@/lib/auth/server";
import { AppError, handle, jsonOk } from "@/lib/http";

const bodySchema = z.object({
  currentPassword: z.string().min(1, "Password lama wajib diisi."),
  newPassword: z.string().min(8, "Password baru minimal 8 karakter."),
});

export async function POST(request: Request) {
  return handle(async () => {
    // Route handler ikut di-prerender saat build; baca sesi hanya per request.
    await connection();
    const { profil, sesi } = await requireKaryawan({ izinkanGantiPassword: true });
    const { currentPassword, newPassword } = bodySchema.parse(await request.json());
    if (currentPassword === newPassword) {
      throw new AppError("VALIDATION", "Password baru harus berbeda dari password lama.");
    }
    // Flag direset sebelum rotasi sesi: nextCookies mengganti sesi lewat
    // cookies(), yang tidak bisa dipanggil setelah tulis ke cookies. Setelah
    // own session dihapus (revokeOtherSessions), sesi baru tidak bisa dibuat.
    await tandaiGantiPasswordSelesai(profil.userId);
    await auth.api.changePassword({
      body: { currentPassword, newPassword, revokeOtherSessions: true },
      headers: request.headers,
    });
    return jsonOk({ id: profil.id, email: sesi.user.email });
  });
}
