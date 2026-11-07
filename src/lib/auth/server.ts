import { APIError, betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { admin } from "better-auth/plugins";
import { db } from "@/db";
import * as schema from "@/db/schema";
import { ambilProfil, buatProfilKaryawan } from "./kepegawaian";
import { periksaSupervisor, type Level } from "./otorisasi";

const LEVEL = new Set(["Magang", "Tetap"]);
const KUNCI_PROFIL = "profilKaryawan";

type ProfilDariPayload = {
  nama: string;
  level: Level;
  supervisorId: string | null;
};

// Uji otomatis memakai banyak login berturut-turut dari satu IP; kuota login
// tidak dimatikan agar perilaku produksi tetap sama, hanya dilonggarkan.
const BATAS_LOGIN = Number(process.env.BETTER_AUTH_LOGIN_LIMIT ?? 60);

function tolak(pesan: string, kode: string): never {
  throw new APIError("BAD_REQUEST", { message: pesan, code: kode });
}

function bacaProfil(data: Record<string, unknown>): ProfilDariPayload {
  const level = data.level;
  if (typeof level !== "string" || !LEVEL.has(level)) {
    tolak("Level karyawan wajib Magang atau Tetap.", "INVALID_LEVEL");
  }
  const supervisorId = data.supervisorId ?? null;
  if (supervisorId !== null && typeof supervisorId !== "string") {
    tolak("Supervisor tidak valid.", "INVALID_SUPERVISOR");
  }
  if (typeof data.name !== "string" || !data.name.trim()) {
    tolak("Nama karyawan wajib diisi.", "INVALID_NAMA");
  }
  return { nama: data.name.trim(), level: level as Level, supervisorId };
}

export const auth = betterAuth({
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL,
  database: drizzleAdapter(db, { provider: "pg", schema }),
  emailAndPassword: {
    enabled: true,
    autoSignIn: false,
    disableSignUp: true,
    minPasswordLength: 8,
  },
  rateLimit: {
    enabled: true,
    window: 60,
    max: BATAS_LOGIN,
    customRules: {
      "/sign-in/email": { window: 60, max: BATAS_LOGIN },
      "/change-password": { window: 60, max: BATAS_LOGIN },
    },
  },
  databaseHooks: {
    user: {
      create: {
        // auth.api.* tidak berjalan dalam transaksi request: validasi di `before`,
        // profil karyawan ditulis di `after` karena id user baru ada di sana.
        before: async (data, ctx) => {
          const profil = bacaProfil(data);
          const masalah = await periksaSupervisor(profil.level, profil.supervisorId);
          if (masalah) tolak(masalah, "SUPERVISOR_TIDAK_VALID");
          // Dibawa lewat context: adapter membuang key di luar skema, dan objek
          // user hasil insert tidak memuatnya.
          (ctx?.context as unknown as Record<string, unknown>)[KUNCI_PROFIL] = profil;
          return { data: { ...data, name: profil.nama } };
        },
        after: async (user, ctx) => {
          const profil = (ctx?.context as unknown as Record<string, unknown> | undefined)?.[
            KUNCI_PROFIL
          ] as ProfilDariPayload | undefined;
          if (!profil?.level) {
            throw new APIError("INTERNAL_SERVER_ERROR", {
              message: "Profil karyawan tidak lengkap.",
              code: "PROFIL_TIDAK_LENGKAP",
            });
          }
          await buatProfilKaryawan({
            userId: user.id,
            nama: profil.nama,
            level: profil.level,
            supervisorId: profil.supervisorId,
          });
        },
      },
    },
    session: {
      create: {
        before: async (session) => {
          const profil = await ambilProfil(session.userId);
          if (!profil) {
            throw new APIError("FORBIDDEN", {
              message: "Akun ini belum punya profil karyawan.",
              code: "PROFIL_TIDAK_ADA",
            });
          }
          if (!profil.aktif) {
            throw new APIError("FORBIDDEN", {
              message: "Akun sudah nonaktif.",
              code: "KARYAWAN_NONAKTIF",
            });
          }
        },
      },
    },
  },
  plugins: [admin({ adminRoles: ["admin"], defaultRole: "user" }), nextCookies()],
});

export type Session = typeof auth.$Infer.Session;
