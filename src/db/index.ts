import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

const globalForDb = globalThis as unknown as { pekananPool?: Pool };

// pg-connection-string 2.x memetakan 'require'/'prefer'/'verify-ca' ke
// 'verify-full' (dengan peringatan SECURITY WARNING); v3 memakai semantik
// libpq tanpa verifikasi nama host. 'verify-full' dipertahankan eksplisit agar
// hasil sama di kedua versi. Username/password di-encode ulang supaya '#' atau
// karakter query lain di dalamnya tidak merusak parser; sisa URL dibiarkan.
function opsiKoneksi(raw: string | undefined) {
  if (!raw) return { connectionString: raw };
  const r = new URL(raw);
  const username = encodeURIComponent(decodeURIComponent(r.username));
  const password = encodeURIComponent(decodeURIComponent(r.password));
  const host = r.hostname;
  const port = r.port ? `:${r.port}` : "";
  r.searchParams.set("sslmode", "verify-full");
  return { connectionString: `${r.protocol}//${username}:${password}@${host}${port}${r.pathname}${r.search}` };
}

const pool =
  globalForDb.pekananPool ??
  new Pool({ ...opsiKoneksi(process.env.DATABASE_URL_POOLED ?? process.env.DATABASE_URL), max: 5 });

if (process.env.NODE_ENV !== "production") globalForDb.pekananPool = pool;

export const db = drizzle(pool, { schema });
