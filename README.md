# pekanan

Aplikasi pencatatan kinerja pekanan tim: Laporan Pekan (kehadiran, sebar media,
one-on-one), Klien + Follow-up, dan Iuran bulanan.

- Frontend + server: Next.js 16.4.5 (App Router, Cache Components)
- Database: Neon Postgres via Drizzle ORM + `node-postgres` (pooled)
- Auth: Better Auth lokal (`better-auth@1.7.17`), tabel auth di skema `public`
- Hosting: Vercel **Hobby** (non-komersial) + **Neon Free**
- Package manager: pnpm

Aturan domain ada di [CONTEXT.md](./CONTEXT.md); rencana implementasi di
[plan.md](./plan.md); status pekerjaan di [HANDOFF.md](./HANDOFF.md).

## Arsitektur deploy

| Bagian | Teknologi | Catatan |
| --- | --- | --- |
| Web + API | Vercel Hobby, region `sin1` | runtime Node.js, tanpa Edge |
| Database | Neon Free, branch produksi `aws-ap-southeast-1` | scale-to-zero 5 menit |
| Auth | Better Auth lokal di route `/api/auth/[...path]` | `neon_auth.*` tidak dipakai |
| Scheduler | **tidak ada** | Laporan Draf dibuat lazy + catch-up saat aplikasi dibuka |
| Migrasi | manual dari lokal | tidak dijalankan saat build Vercel |

Hobby hanya boleh untuk penggunaan non-komersial. Bila status berubah, upgrade
Vercel ke Pro — tidak ada perubahan kode.

## Environment variables

| Variabel | Lokal | Vercel | Dipakai untuk |
| --- | :---: | :---: | --- |
| `DATABASE_URL_POOLED` | ✓ | ✓ | query runtime (`pg` Pool, `max: 5`) |
| `DATABASE_URL_UNPOOLED` | ✓ | – | migrasi Drizzle dari lokal |
| `BETTER_AUTH_SECRET` | ✓ | ✓ | `openssl rand -base64 32` |
| `BETTER_AUTH_URL` | ✓ | ✓ | origin app (`http://localhost:3000`, `https://<domain>`) |
| `ADMIN_EMAIL` | ✓ | ✓ | email admin pertama (dipakai `seed:admin`) |
| `ADMIN_PASSWORD` | – | – | opsional; password awal admin untuk `seed:admin` |

Setelah auth lokal aktif, `NEON_AUTH_*`, `NEON_FUNCTION_HELLO_BASE_URL`, dan
`NEON_AUTH_COOKIE_SECRET` tidak dipakai lagi — hapus dari `.env.local` dan Vercel.

## Setup lokal

```bash
pnpm install
cp .env.example .env.local   # isi nilai sesuai tabel di atas
```

Bila memakai `neon env pull` / `neon deploy`, hapus baris `DATABASE_URL=` agar
tidak ambigu dengan URL pooled:

```bash
sed -i '/^DATABASE_URL=/d' .env.local
```

## Migrasi

Migrasi Drizzle dijalankan manual dengan koneksi direct dan **tidak** memakai
pooled:

```bash
set -a && . ./.env.local && set +a && pnpm db:migrate
```

Saat schema berubah: jalankan `pnpm db:generate` → periksa SQL → `pnpm db:migrate`
sebelum merge/deploy. Jangan gunakan `drizzle-kit push` (bisa mengubah skema lain).

## Script

```bash
pnpm dev            # dev server (Turbopack)
pnpm build          # production build
pnpm start          # jalankan hasil build
pnpm db:generate    # generate migrasi dari schema
pnpm db:migrate     # terapkan migrasi (DATABASE_URL_UNPOOLED)
pnpm smoke          # tes end-to-end terhadap server yang sedang berjalan
```

Smoke test dijalankan terhadap hasil build, bukan dev server:

```bash
pnpm build && pnpm start &
pnpm smoke
```

## Struktur

```
drizzle.config.ts, drizzle/     # konfigurasi (schemaFilter: ["public"]) dan migrasi
src/db/                         # schema + pool Postgres
src/lib/auth/                   # server (Better Auth) & client
src/lib/waktu.ts                # helper pekan/bulan WIB (Asia/Jakarta)
src/app/api/auth/[...path]/     # handler Better Auth
src/app/(app)/                  # shell aplikasi; memicu bootstrap laporan
src/components/                 # UI (bahasa Indonesia)
scripts/smoke.mts               # tes end-to-end
```

## Deploy (Vercel Hobby + Neon Free)

1. Buat project Neon di region `aws-ap-southeast-1`; salin pooled dan unpooled URL.
2. Set env Vercel pada tabel di atas (Production + Preview). Jangan set
   `DATABASE_URL_UNPOOLED` untuk runtime.
3. Jalankan migrasi dari lokal ke branch produksi.
4. Import repo di Vercel (region `sin1`, Framework Next.js), lalu deploy.
5. Jalankan `pnpm seed:admin` dari lokal ke DB produksi (ADR-0003), lalu login dan ganti password.
6. Tidak ada cron, `vercel.json`, atau Neon Function yang perlu dikonfigurasi.

Kuota Neon Free yang perlu dijaga: 1 GB storage/project, 100 CU-hours/project
per bulan, egress 5 GB/project. Runtime log Vercel hanya tersimpan 1 jam.
