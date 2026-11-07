// Admin pertama: jalankan dengan `pnpm --env-file=.env.local seed:admin`.
// Parameternya disengaja bukan argumen CLI agar tidak tersimpan di shell history.
import { randomUUID } from "node:crypto";
import { createInterface } from "node:readline/promises";
import { hashPassword } from "better-auth/crypto";
import { and, eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Client } from "pg";
import { account, karyawan, user } from "../src/db/schema";

const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
const passwordEnv = process.env.ADMIN_PASSWORD;
const namaAdmin = process.env.ADMIN_NAMA?.trim() || "Admin Perhimpunan";

function gagal(pesan: string): never {
  console.error(`seed-admin: ${pesan}`);
  process.exit(1);
}

if (!process.env.DATABASE_URL_UNPOOLED) {
  gagal("DATABASE_URL_UNPOOLED wajib diisi (pnpm --env-file=.env.local seed:admin).");
}
if (!email) gagal("ADMIN_EMAIL wajib diisi.");
if (!email.includes("@")) gagal("ADMIN_EMAIL tidak valid.");

let password = passwordEnv?.trim() || "";
if (!password && process.stdin.isTTY) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  password = (await rl.question(`Password awal untuk ${email}: `)).trim();
  rl.close();
}
if (password.length < 8) {
  gagal("ADMIN_PASSWORD (atau jawaban prompt) minimal 8 karakter.");
}

const client = new Client({ connectionString: process.env.DATABASE_URL_UNPOOLED });
await client.connect();
const db = drizzle(client);

let kode = 0;
try {
  const [sudahAda] = await db
    .select({ id: user.id, email: user.email })
    .from(user)
    .where(eq(user.role, "admin"))
    .limit(1);

  if (sudahAda) {
    console.log(`seed-admin: admin sudah ada (${sudahAda.email}); tidak ada perubahan.`);
  } else {
    const [emailTerpakai] = await db
      .select({ id: user.id })
      .from(user)
      .where(and(eq(user.email, email), sql`${user.role} IS DISTINCT FROM 'admin'`))
      .limit(1);
    if (emailTerpakai) {
      gagal(`${email} sudah dipakai user non-admin; pilih ADMIN_EMAIL lain.`);
    }

    const hash = await hashPassword(password);
    const userId = randomUUID();
    const now = new Date();

    await db.transaction(async (tx) => {
      await tx.insert(user).values({
        id: userId,
        name: namaAdmin,
        email,
        emailVerified: true,
        role: "admin",
        createdAt: now,
        updatedAt: now,
      });
      await tx.insert(account).values({
        id: randomUUID(),
        accountId: userId,
        providerId: "credential",
        userId,
        password: hash,
        createdAt: now,
        updatedAt: now,
      });
      await tx.insert(karyawan).values({
        userId,
        nama: namaAdmin,
        level: "Tetap",
        supervisorId: null,
        aktif: true,
        harusGantiPassword: true,
      });
    });

    console.log(`seed-admin: admin ${email} dibuat. Ganti password saat login pertama.`);
  }
} catch (error) {
  console.error(error);
  kode = 1;
} finally {
  await client.end();
}

process.exit(kode);
