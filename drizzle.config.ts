import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  // Tabel auth baru bernama sama dengan neon_auth.*; skema itu tidak boleh di-introspect.
  schemaFilter: ["public"],
  dbCredentials: {
    // Migrations use the direct (non-pooled) connection.
    url: process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL!,
  },
});
