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
    // Karena itu password lama diperiksa lebih dulu — reset flag lalu gagal
    // akan membiarkan karyawan lolos dari kewajiban ganti password.
    const lamaBenar = await auth.api
      .verifyPassword({ body: { password: currentPassword }, headers: request.headers })
      .then(() => true)
      .catch(() => false);
    if (!lamaBenar) {
      throw new AppError("VALIDATION", "Password saat ini salah.");
    }
    await tandaiGantiPasswordSelesai(profil.userId);
    try {
      await auth.api.changePassword({
        body: { currentPassword, newPassword, revokeOtherSessions: true },
        headers: request.headers,
      });
    } catch (error) {
      // Better Auth membalas pesan Inggris; aplikasi memakai satu bahasa di semua UI.
      const kode = (error as { body?: { code?: string } }).body?.code;
      if (kode === "INVALID_PASSWORD") {
        throw new AppError("VALIDATION", "Password saat ini salah.");
      }
      throw error;
    }
    return jsonOk({ id: profil.id, email: sesi.user.email });
  });
}
