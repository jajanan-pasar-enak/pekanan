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
| `ADMIN_PASSWORD` | – | – | opsional; password awal admin untuk `seed:admin` (jangan diset di Vercel) |

`NEON_AUTH_*`, `NEON_FUNCTION_HELLO_BASE_URL`, `NEON_AUTH_COOKIE_SECRET`, dan
`NEON_BRANCH` tidak dipakai kode — jangan ditambahkan ke `.env.local` atau
Vercel.

## Setup lokal

```bash
pnpm install
cp .env.example .env.local   # isi nilai sesuai tabel di atas
```

`allowBuilds: esbuild: true` di `pnpm-workspace.yaml` harus tetap ada, atau
`pnpm add` gagal `ERR_PNPM_IGNORED_BUILDS`.

Bila memakai `neon env pull`, hapus baris `DATABASE_URL=` hasil pull agar
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

Tidak ada `vercel.json`, cron, atau Neon Function. Build Vercel hanya
`pnpm build`; migrasi dan pembuatan admin pertama dijalankan **manual dari
lokal** sebelum deploy pertama (dan setiap kali schema berubah).

### 1. Siapkan Neon (Free)

1. Buat project Neon di region **`aws-ap-southeast-1` (Singapore)**, Postgres
   versi 18, database `neondb`.
2. Salin dua connection string dari dashboard (Connect):
   - **Pooled** (`-pooler` di host) → `DATABASE_URL_POOLED`
   - **Direct / unpooled** → `DATABASE_URL_UNPOOLED`
3. Jangan mengaktifkan skema `neon_auth.*`; auth memakai tabel di `public`.

### 2. Terapkan migrasi dari lokal

`drizzle.config.ts` memakai `DATABASE_URL_UNPOOLED`, jadi migrasi tidak
melewati pooler.

```bash
# sementara isi .env.local dengan URL Neon produksi
set -a && . ./.env.local && set +a && pnpm db:migrate
```

Kosongkan kembali URL Neon produksi dari `.env.local` setelah selesai.
Setiap perubahan schema: `pnpm db:generate` → periksa SQL → commit → jalankan
`pnpm db:migrate` ke produksi **sebelum** deploy.

### 3. Buat admin pertama (produksi)

```bash
set -a && . ./.env.local && set +a
pnpm seed:admin
```

Skrip memakai `DATABASE_URL_UNPOOLED`, `ADMIN_EMAIL`, dan `ADMIN_PASSWORD`
(atau prompt). Idempoten: bila sudah ada user `role = 'admin'`, tidak ada
perubahan (ADR-0003) — pada project Neon yang sudah berisi admin, langkah ini
tidak mengubah password. Admin baru dari seed ber-flag
`harus_ganti_password = true`, sehingga password diganti lewat UI saat login
pertama.

### 4. Import repo di Vercel

1. Add New → Project → import `sini-sana/pekanan`, framework **Next.js**
   (deteksi otomatis), root directory default.
2. Function region **Singapore (`sin1`)** — Project Settings → Functions.
3. Environment variables untuk **Production** dan **Preview**:

   | Variabel | Nilai |
   | --- | --- |
   | `DATABASE_URL_POOLED` | URL pooled Neon |
   | `BETTER_AUTH_SECRET` | `openssl rand -base64 32` (baru, jangan pakai secret lokal) |
   | `BETTER_AUTH_URL` | `https://<domain>` (domain produksi, tanpa slash) |
   | `ADMIN_EMAIL` | email admin pertama |

   Jangan set `DATABASE_URL_UNPOOLED`, `ADMIN_PASSWORD`, atau `SMOKE_*` di
   Vercel; semuanya hanya untuk lokal.
4. Deploy.

### 5. Verifikasi go-live

1. Buka `https://<domain>` → login `ADMIN_EMAIL` → ganti password.
2. Tambah satu karyawan, isi & kirim satu Laporan Pekan, buka `/admin` untuk
   master nominal iuran dan hasil follow-up.
3. Buka dashboard setelah pekan berganti: Draf pekan baru dan catch-up pekan
   terlewat dibuat otomatis (lazy + catch-up, tanpa cron).

### Catatan operasional

- `BETTER_AUTH_URL` harus persis sama dengan origin yang dibuka; Login
  menolak request dari origin lain (403 `INVALID_ORIGIN`).
- Neon Free scale-to-zero setelah 5 menit idle; request pertama terasa
  beberapa ratus ms (cold start), diterima untuk skala tim kecil.
- Kuota Neon Free: 1 GB storage/project, 100 CU-hours/project per bulan,
  egress 5 GB/project.
- Runtime log Vercel hanya tersimpan 1 jam → jaga `console.log` minimal.
- Hobby hanya untuk non-komersial. Bila status berubah, upgrade Vercel ke Pro
  tanpa perubahan kode.
