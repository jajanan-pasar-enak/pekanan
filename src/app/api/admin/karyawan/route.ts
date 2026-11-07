import { connection } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/current";
import { auth } from "@/lib/auth/server";
import { AppError, handle, jsonOk } from "@/lib/http";

const bodySchema = z.object({
  nama: z.string().trim().min(1, "Nama wajib diisi."),
  email: z.email("Email tidak valid."),
  password: z.string().min(8, "Password awal minimal 8 karakter."),
  level: z.enum(["Magang", "Tetap"]),
  supervisorId: z.uuid("Supervisor tidak valid.").nullable().default(null),
  admin: z.boolean().default(false),
});

export async function POST(request: Request) {
  return handle(async () => {
    // Route handler ikut di-prerender saat build; baca sesi hanya per request.
    await connection();
    await requireAdmin();
    const { admin, ...karyawanBaru } = bodySchema.parse(await request.json());

    // auth.api.createUser memvalidasi level & supervisor lewat databaseHooks
    // dan membuat profil karyawan (harus_ganti_password = true). autoSignIn
    // false memastikan sesi admin tidak tertimpa.
    const hasil = await auth.api.createUser({
      body: {
        name: karyawanBaru.nama,
        email: karyawanBaru.email.toLowerCase(),
        password: karyawanBaru.password,
        role: admin ? "admin" : "user",
        data: {
          level: karyawanBaru.level,
          supervisorId: karyawanBaru.supervisorId,
        },
      },
      headers: request.headers,
    });

    if (!hasil?.user) {
      throw new AppError("INTERNAL", "Karyawan gagal dibuat.");
    }
    return jsonOk(
      {
        userId: hasil.user.id,
        email: hasil.user.email,
        nama: hasil.user.name,
        level: karyawanBaru.level,
        supervisorId: karyawanBaru.supervisorId,
        harusGantiPassword: true,
      },
      201,
    );
  });
}
