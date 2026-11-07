import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

const globalForDb = globalThis as unknown as { pekananPool?: Pool };

const pool =
  globalForDb.pekananPool ??
  new Pool({
    connectionString:
      process.env.DATABASE_URL_POOLED ?? process.env.DATABASE_URL,
    max: 5,
  });

if (process.env.NODE_ENV !== "production") globalForDb.pekananPool = pool;

export const db = drizzle(pool, { schema });
