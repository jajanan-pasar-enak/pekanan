import { attachDatabasePool } from "@neon/functions";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

const globalForDb = globalThis as unknown as { neonPool?: Pool };

const pool =
  globalForDb.neonPool ??
  new Pool({
    connectionString:
      process.env.DATABASE_URL_POOLED ?? process.env.DATABASE_URL,
    max: 5,
  });

attachDatabasePool(pool);
if (process.env.NODE_ENV !== "production") globalForDb.neonPool = pool;

export const db = drizzle(pool, { schema });
