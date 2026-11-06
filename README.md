# pekanan

Aplikasi Next.js yang memakai Neon sebagai backend: Postgres untuk data, Neon Auth
(Managed Better Auth) untuk login, dan Neon Function untuk endpoint di sisi Neon.

- Frontend + server: Next.js 16.4.5 (App Router, Cache Components)
- Database: Neon Postgres via Drizzle ORM + `node-postgres`
- Auth: Neon Auth (`@neon/auth`)
- Function: Neon Functions (`neon.ts` + `hello.ts`)
- Package manager: pnpm

## Prasyarat

- Node.js 24
- pnpm
- Neon CLI (`neon`) dan akun Neon yang sudah login

## Setup

```bash
pnpm install
neon whoami                        # pastikan sudah login, jika belum: neon login
neon init -y --org-id <org-id> --project-id <project-id> --branch production
neon deploy                        # provisioning service + menulis env ke .env.local
```

Setelah `neon deploy` atau `neon env pull`, hapus key `DATABASE_URL` agar tidak ambigu
dengan URL pooled, lalu tambahkan cookie secret:

```bash
# hapus baris DATABASE_URL; runtime memakai DATABASE_URL_POOLED
sed -i '/^DATABASE_URL=/d' .env.local
# jika belum ada
printf 'NEON_AUTH_COOKIE_SECRET=%s\n' "$(openssl rand -base64 32)" >> .env.local
```

Jalankan migrasi (memakai koneksi direct):

```bash
set -a && . ./.env.local && set +a && pnpm db:migrate
```

## Environment variables

| Variabel | Sumber | Dipakai untuk |
| --- | --- | --- |
| `DATABASE_URL_POOLED` | `neon deploy` (renamed dari `DATABASE_URL`) | query runtime |
| `DATABASE_URL_UNPOOLED` | `neon deploy` | migrasi Drizzle |
| `NEON_AUTH_BASE_URL` | `neon deploy` | server Neon Auth |
| `NEON_AUTH_JWKS_URL` | `neon deploy` | verifikasi JWT |
| `NEON_FUNCTION_HELLO_BASE_URL` | `neon deploy` | memanggil function `hello` |
| `NEON_AUTH_COOKIE_SECRET` | dibuat manual | cookie session Next |
| `NEON_BRANCH` | `neon deploy` | informasi branch |

## Script

```bash
pnpm dev            # dev server
pnpm build          # production build
pnpm start          # jalankan hasil build
pnpm db:generate    # generate migrasi dari schema
pnpm db:migrate     # terapkan migrasi
pnpm neon:deploy    # apply neon.ts
pnpm neon:dev       # jalankan Neon Functions lokal
```

## Struktur

```
neon.ts                         # infra-as-code: auth + functions
hello.ts                        # Neon Function hello
drizzle.config.ts, drizzle/     # konfigurasi dan migrasi Drizzle
src/db/                         # schema + pool Postgres
src/lib/auth/                   # server & client Neon Auth
src/lib/functions.ts            # helper URL Neon Function
src/app/api/auth/[...path]/     # proxy Neon Auth
src/app/api/todos/              # CRUD todos (POST/DELETE wajib login)
src/app/api/ping-function/      # proxy ke function hello
src/app/page.tsx                # beranda
src/components/                 # panel auth dan daftar todo
scripts/smoke.mts               # tes end-to-end
```

## Tes

Dengan server berjalan di `localhost:3000`:

```bash
pnpm exec tsx scripts/smoke.mts
```

`scripts/verify-db.mts` memeriksa tabel dan menambah dua todo contoh — jangan
dijalankan terhadap database produksi.

## Deploy ke Vercel

1. Import repo di Vercel dan set semua variabel pada tabel di atas.
2. Pastikan trusted domain Neon Auth mencakup domain produksi:
   `neon neon-auth domain add https://<domain>`.
3. Setelah `neon deploy`, periksa bahwa `Disable Sign Up` masih `false`:
   `neon neon-auth config email-password get`.

Tier Hobby Vercel hanya untuk penggunaan non-komersial.

Catatan detail, jebakan, dan status pekerjaan ada di [HANDOFF.md](./HANDOFF.md).
