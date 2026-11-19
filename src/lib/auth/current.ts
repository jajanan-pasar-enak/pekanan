import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { AppError } from "@/lib/http";
import { ambilProfil, type ProfilKaryawan } from "./kepegawaian";
import { auth, type Session } from "./server";

export type AppUser = {
  sesi: Session;
  profil: ProfilKaryawan;
};

export async function bacaSesiSekarang(): Promise<Session | null> {
  return auth.api.getSession({ headers: await headers() });
}

export async function requireSession(): Promise<Session> {
  const sesi = await bacaSesiSekarang();
  if (!sesi) redirect("/");
  return sesi;
}

// Enforcement sebenarnya: setiap endpoint API memakai ini. Flag
// harus_ganti_password hanya dilonggarkan untuk endpoint ganti-password & keluar.
export async function requireKaryawan({
  izinkanGantiPassword = false,
}: { izinkanGantiPassword?: boolean } = {}): Promise<AppUser> {
  const sesi = await bacaSesiSekarang();
  if (!sesi) {
    throw new AppError("UNAUTHORIZED", "Sesi tidak valid. Silakan masuk lagi.");
  }
  const profil = await ambilProfil(sesi.user.id);
  if (!profil) {
    throw new AppError("FORBIDDEN", "Akun ini belum punya profil karyawan.");
  }
  if (!profil.aktif) {
    throw new AppError("INACTIVE", "Akun sudah nonaktif.");
  }
  if (profil.harusGantiPassword && !izinkanGantiPassword) {
    throw new AppError(
      "PASSWORD_CHANGE_REQUIRED",
      "Anda wajib mengganti password sebelum melanjutkan.",
    );
  }
  return { sesi, profil };
}

// Untuk Server Component halaman: tanpa sesi harus mengarahkan ke login,
// bukan melempar error seperti endpoint API.
export async function requireKaryawanHalaman({
  izinkanGantiPassword = false,
}: { izinkanGantiPassword?: boolean } = {}): Promise<AppUser> {
  const sesi = await requireSession();
  const profil = await ambilProfil(sesi.user.id);
  if (!profil) {
    throw new AppError("FORBIDDEN", "Akun ini belum punya profil karyawan.");
  }
  if (!profil.aktif) {
    throw new AppError("INACTIVE", "Akun sudah nonaktif.");
  }
  if (profil.harusGantiPassword && !izinkanGantiPassword) {
    redirect("/ganti-password");
  }
  return { sesi, profil };
}

export async function requireAdmin(): Promise<AppUser> {
  const user = await requireKaryawan();
  if (user.sesi.user.role !== "admin") {
    throw new AppError("FORBIDDEN", "Hanya Admin yang boleh melakukan tindakan ini.");
  }
  return user;
}
