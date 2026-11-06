# HANDOFF — pekanan

## 1. Ringkasan

Aplikasi **Next.js 16.4.5 (App Router)** yang di-deploy ke **Vercel** dengan backend **Neon**: Postgres (lakebase), Neon Auth (Managed Better Auth) dan Neon Functions. Project awalnya kosong; scaffold dibuat di sesi sebelumnya.

- Lokasi: `/home/xan/project/skrmb/pekanan`
- Package manager: **pnpm 12.16.1** (npm tidak dipakai)
- Node: v24.22.1 · Neon CLI: 8.23.3
- Git: repo diinisialisasi oleh `create-next-app`. Hanya ada 1 commit (`b1e7d8a Initial commit from Create Next App`); **semua pekerjaan masih uncommitted**.

## 2. Resource Neon

| Item | Value |
|---|---|
| Org | `org-empty-credit-57766595` |
| Project | `still-firefly-08452520` |
| Branch | `production` (`br-floral-tooth-aog0qwgs`) |
| Region | `aws-ap-southeast-1` |
| Postgres host (pooled) | `ep-shy-frog-aox88nsm-pooler.c-2.ap-southeast-1.aws.neon.tech` |
| Auth Base URL | `https://ep-shy-frog-aox88nsm.neonauth.c-2.ap-southeast-1.aws.neon.tech/neondb/auth` |
| Function `hello` | `https://br-floral-tooth-aog0qwgs-hello.compute.c-2.ap-southeast-1.aws.neon.tech/` |
| Neon Auth setting | Email/password aktif, `Require Verification: false`, `Disable Sign Up: false`, trusted domain `http://localhost:3000` |

`.neon` berisi org/project/branch link (gitignored). Kredensial ada di `.env.local` (gitignored).

## 3. Env vars (`.env.local`)

```
DATABASE_URL_POOLED      # pooled, dipakai runtime app (di-rename dari DATABASE_URL)
DATABASE_URL_UNPOOLED    # direct, dipakai drizzle-kit migrate
NEON_BRANCH
NEON_AUTH_BASE_URL
NEON_AUTH_JWKS_URL
NEON_FUNCTION_HELLO_BASE_URL
NEON_AUTH_COOKIE_SECRET  # dibuat manual: openssl rand -base64 32
```

### Penting: setelah `neon deploy` / `neon env pull`
Keduanya **menulis ulang** `DATABASE_URL` (pooled) dan menimpa file. Langkah wajib:

```bash
# hapus DATABASE_URL ambigu, pastikan DATABASE_URL_POOLED ada
python3 - <<'EOF'
p='.env.local'
lines=[l for l in open(p).read().splitlines() if not l.startswith('DATABASE_URL=')]
open(p,'w').write('\n'.join(lines)+'\n')
EOF
```

`NEON_AUTH_COOKIE_SECRET` tidak di-inject Neon; harus ditambahkan manual jika file terhapus.

### Untuk deploy ke Vercel
Set env yang sama di project Vercel. `NEON_FUNCTION_*` dan `NEON_AUTH_*` dapat dari `neon env pull`. Jangan commit `.env.local`.

## 4. Struktur file yang dibuat

```
neon.ts                     # infra-as-code: auth:true + functions.hello
hello.ts                    # Neon Function: Response("Hello from Neon Functions")
drizzle.config.ts           # pakai DATABASE_URL_UNPOOLED
drizzle/                    # migrasi 0000_kind_satana.sql (todos, visits)
src/db/schema.ts            # tabel todos, visits
src/db/index.ts             # Pool pg pooled, max:5, attachDatabasePool, singleton dev
src/lib/auth/server.ts      # createNeonAuth (cookie secret)
src/lib/auth/client.ts      # createAuthClient() tanpa argumen (same-origin proxy)
src/lib/functions.ts        # functionUrl(slug) dari NEON_FUNCTION_<SLUG>_BASE_URL
src/app/api/auth/[...path]/route.ts
src/app/api/todos/route.ts            # GET publik; POST/DELETE wajib session; validasi 1-500 char
src/app/api/ping-function/route.ts    # proxy ke Neon Function hello
src/app/page.tsx                      # Suspense + connection(); status function
src/components/auth-panel.tsx         # sign in/up/out, try/catch isAuthError
src/components/todo-list.tsx          # list + add/delete (butuh login)
scripts/verify-db.mts                 # cek tabel + seed 2 todos (destruktif: menambah baris)
scripts/smoke.mts                     # 11 tes end-to-end
```

## 5. Perintah

```bash
pnpm dev                          # dev server
pnpm build && pnpm start          # build + produksi
pnpm db:generate                  # generate migrasi (set -a && . ./.env.local && set +a dulu)
set -a && . ./.env.local && set +a && pnpm db:migrate
neon deploy                       # apply neon.ts (lihat langkah env di atas!)
neon neon-auth status
neon neon-auth config email-password get
neon functions list
pnpm exec tsx scripts/smoke.mts   # butuh server jalan di :3000
```

## 6. Status verifikasi (sesi sebelumnya)

- `pnpm build` lulus. Route: `/` (◐ PPR), `/api/auth/[...path]`, `/api/ping-function`, `/api/todos`.
- `scripts/smoke.mts`: **11/11 PASS** (postgres read/write/delete/validasi/401, auth sign-up/session/sign-out/sign-in/wrong-password 401, function via app).
- Log server bersih dari `unhandledRejection`.
- **Belum** diverifikasi di browser sungguhan (form diklik manual) — jalur API sudah dicek.

## 7. Keputusan teknis & jebakan

1. **`@neon/auth` melempar error, tidak mengembalikan `{ error }`.** SDK memakai `throw: true` di custom fetch; `signIn.email` dkk. throw `AuthApiError`. Selalu bungkus `try/catch` dan pakai `isAuthError()` untuk pesan user-friendly. Ini bug yang sudah diperbaiki di `auth-panel.tsx`.
2. **Next 16 Cache Components**: `export const dynamic = "force-dynamic"` dilarang. Pakai `await connection()` di dalam `<Suspense>`.
3. **Driver**: `pg` + `drizzle-orm/node-postgres` (bukan serverless driver) karena Next 16 + Cache Components = Node runtime. Di Vercel: pertimbangkan `import { attachDatabasePool } from "@vercel/functions"` (skill Neon menyarankan ini + Fluid compute). Saat ini `attachDatabasePool` dari `@neon/functions` (no-op di luar Neon) — **perlu ditinjau untuk produksi Vercel**.
4. **`Disable Sign Up` pernah berubah sendiri ke `true`** setelah `neon deploy`/konfigurasi. Selalu cek ulang setelah deploy; perbaiki dengan `neon neon-auth config email-password update --disable-sign-up false`.
5. **`neon env pull`/`neon deploy` menimpa `.env.local`** dan menulis `DATABASE_URL` — lihat bagian 3.
6. `pnpm-workspace.yaml` berisi `allowBuilds: esbuild: true` (wajib, jika tidak `pnpm add` gagal `ERR_PNPM_IGNORED_BUILDS`).
7. `create-next-app` menulis `AGENTS.md` (bawaan Next 16) — jangan dihapus sembarangan; `next dev` menambahkannya kembali.
8. Warning SSL `sslmode=verify-full` dari `pg-connection-string` muncul di log — harmless.
9. `create-next-app` memilih `--no-turbopack` untuk dev, tetapi build memakai Turbopack (bawaan Next 16).

## 8. Yang belum dikerjakan / kandidat lanjutan

- Belum ada commit; perubahan belum di-review sebagai satu set.
- Belum ada test UI browser (Playwright) untuk form auth.
- `src/app/api/todos` belum memfilter berdasarkan user (todos global, siapa pun yang login bisa hapus). Jika multi-user: tambah `user_id` + RLS atau cek di handler.
- Belum ada deploy Vercel; belum ada `vercel.json`/CI.
- `scripts/verify-db.mts` selalu insert 2 baris — jangan dijalankan ke produksi.
- Function `hello` masih stub.
- Vercel Hobby **non-komersial** — eskalasi jika dipakai komersial.

## 9. Mulai sesi berikutnya

```bash
cd /home/xan/project/skrmb/pekanan
git status && cat HANDOFF.md
neon whoami                      # cek login Neon (~/.config/neonctl)
neon neon-auth config email-password get   # pastikan Disable Sign Up false
set -a && . ./.env.local && set +a
pnpm build && pnpm start &
pnpm exec tsx scripts/smoke.mts
```
