# HANDOFF — pekanan

> **Baca ini dulu.** Status terakhir: **Commit 2 (auth lokal) selesai.** Better Auth lokal aktif, `seed-admin` jalan, `POST /api/admin/karyawan`, wajib ganti password, scaffold Neon Functions/todos terhapus. `pnpm build`, `pnpm test` (serial), dan `scripts/smoke.mts` (21/21) lulus terhadap `next start`. Berikutnya: Commit 3 (API laporan pekan).

## 1. Ringkasan

Aplikasi **Next.js 16.4.5 (App Router, Cache Components)** + **Neon Postgres** (Drizzle + `pg`) di `/home/xan/project/skrmb/pekanan`. Mencatat kinerja pekanan tim: Laporan Pekan (kehadiran, sebar media, one-on-one), Klien + Follow-up, dan Iuran bulanan.

- Package manager: **pnpm 12.16.1** · Node **v24.22.1** lokal (environment Qoder menyebut v26; yang dipakai `pnpm exec` adalah v24)
- Git: branch `main`, commit terakhir **`bc1f075 feat(auth): better-auth lokal + seed-admin`**.
- Working tree bersih (kecuali perubahan dokumen ini); **belum di-push**. Admin lokal `admin@pekanan.local` sudah di-seed; password-nya **telah diganti** lewat smoke (bukan `ADMIN_PASSWORD` asal) dan flag wajib-ganti tetap `true`.
- **Testing:** Commit 1 diverifikasi manual (psql rollback + `drizzle-kit pull`), **bukan dengan suite tersimpan**. Mulai Commit 2 dipakai TDD berbasis `node:test` (lihat §9).

### Hasil Commit 2 (jangan diulang)

- Auth: `src/lib/auth/{server,client,current,kepegawaian,otorisasi}.ts`; route `api/auth/[...path]` (`toNextJsHandler`), `POST /api/auth/change-password`, `GET /api/me`, `POST /api/admin/karyawan`. `src/lib/http.ts` (`AppError`, `jsonOk`, `jsonError`, `handle`, status per kode).
- Halaman: `/` (login + redirect bila sudah sesi), `/ganti-password`, shell `(app)/layout.tsx` + `/dashboard` minimal.
- `scripts/seed-admin.mts` (`pnpm --env-file=.env.local seed:admin`), idempoten. Admin seed punya `harus_ganti_password = true`.
- Dihapus: `hello.ts`, `neon.ts`, `src/lib/functions.ts`, `scripts/verify-db.mts`, `todo-list.tsx`, `api/ping-function`, dep `@neon/*` + `hono`.
- `scripts/smoke.mts` ditulis ulang: fase auth lengkap, membersihkan baris `smoke-%@seed.local` lewat DB.
- `src/lib/http.test.ts` (node:test, 6 uji). `pnpm test` memakai `--test-concurrency=1` (serial).

### Hasil Commit 1 (jangan diulang)

- Terpasang: `zod@4.6.7`, `better-auth@1.7.17`, `@better-auth/core@1.7.17` (dev). `@neon/*` masih ada (dihapus di Commit 2).
- `.env.local`: `BETTER_AUTH_SECRET` (acak), `BETTER_AUTH_URL=http://localhost:3000`, `ADMIN_EMAIL=admin@pekanan.local`. `ADMIN_PASSWORD` sengaja kosong (diisi saat seed).
- `drizzle/0001_panoramic_legion.sql` (tabel + CHECK + unique parsial + `DROP todos, visits`), `drizzle/0002_retire_transferred_laporan.sql` (fungsi + trigger `laporan_pekan_retire_transferred`). Keduanya sudah **diterapkan** ke DB Neon.
- `src/lib/waktu.ts`: `tanggalHariIni`, `pekanWIB`, `awalPekan`, `bulanBerjalan`, `tambahHari` (semua mengembalikan string `YYYY-MM-DD`).
- `src/app/api/todos/route.ts` dihapus (tabelnya sudah di-drop). Sisa scaffold yang masih ada dan **masih dirujuk `todo.md` Commit 2**: `src/components/todo-list.tsx`, `src/app/api/ping-function/`, `src/lib/functions.ts`, `hello.ts`, `neon.ts`, `scripts/verify-db.mts`, `scripts/smoke.mts` (masih menyebut `/api/todos`).
- Diverifikasi via psql: 14 tabel, 15 CHECK, unique parsial hidup, trigger memensiunkan baris yang kalah tanpa menghapus, `neon_auth` utuh. Uji constraint dilakukan dalam transaksi `ROLLBACK` (DB bersih).

## 2. Lokasi dokumen (baca berurutan)

| File | Isi |
|---|---|
| `HANDOFF.md` | (file ini) status, jebakan, langkah berikutnya |
| `CONTEXT.md` | **Glosarium domain (sumber kebenaran aturan bisnis)** |
| `plan.md` | Rencana implementasi yang disetujui + **§Arsitektur Kode** + **§9 urutan commit** |
| `todo.md` | Checklist per commit (Commit 1 sudah dicentang; Commit 2–6 belum) |
| `docs/adr/0001-sesi-auth-dilayani-better-auth-lokal.md` | Better Auth lokal, bukan proxy Neon Auth |
| `docs/adr/0002-keunikan-laporan-per-pekan-dijaga-trigger.md` | Unique parsial + trigger; **direvisi** (tanpa auto-kirim Draf, tanpa `move_karyawan()`) |
| `docs/adr/0003-admin-pertama-dibuat-skrip-lokal.md` | Admin pertama via `scripts/seed-admin.mts`, **tanpa route bootstrap HTTP** |

## 3. Keputusan domain yang sudah dikunci (ringkas)

- Laporan Pekan ditulis **Supervisor** untuk **Anggota Langsungnya saja**; Atasan Supervisor boleh **Koreksi** dengan alasan, tersimpan.
- Pekan = **Minggu 00:00 – Sabtu 23:59:59 WIB**. Laporan Draf dibuat **hanya bila supervisor punya ≥1 Anggota Langsung**.
- Laporan wajib **diisi manual** (Mengisi Sendiri): Kirim terkunci selama ada nilai kosong.
- Kehadiran 5 status + keterangan; sebar media = dua integer ≥0; one-on-one satu cara (Pribadi / Sebelum Meeting Pekanan / Alpa) + keterangan.
- Follow-up **hanya dari kejadian** (tanggal ≤ hari ini WIB); jumlah per pekan = hitungan kejadian.
- Klien punya **satu pemilik**; wajib dialihkan (oleh Admin) bila pemilik nonaktif/pindah supervisor.
- Iuran: master Nominal + kejadian Pembayaran per (karyawan, bulan).
- Supervisi = **pohon berantai**; Magang wajib supervisor Tetap.
- Detail lengkap di `CONTEXT.md`.

## 4. Keputusan teknis & arsitektur yang sudah dikunci (belum dikodekan)

**Deploy:** Vercel **Hobby** (non-komersial) + Neon **Free**. Runtime Node.js, region Vercel `sin1`, Neon `aws-ap-southeast-1`. **Tanpa scheduler**: Neon Functions/Triggers/pg_cron dan Vercel Cron sengaja tidak dipakai.

**Auth:** Better Auth lokal `better-auth@1.7.17`, tabel di skema `public` (`user`, `session`, `account`, `verification` + kolom plugin admin). `neon_auth.*` tidak disentuh. Managed Better Auth ditolak (tidak mendukung `databaseHooks`, `disableSignUp`, `autoSignIn: false`).

**Admin pertama:** `scripts/seed-admin.mts` (ADR-0003), idempoten, satu transaksi (`user` + `account` + `karyawan` Tetap). `disableSignUp: true`, `autoSignIn: false`, plugin `admin` (`adminRoles: ["admin"]`). Admin membuat karyawan lewat `POST /api/admin/karyawan` (`auth.api.createUser`) → `harus_ganti_password = true`.

**Arsitektur kode:**
- Baca = Server Component; tulis = route handler `/api/*` + `fetch` + `router.refresh()`. Tanpa Server Action.
- **Aturan keras:** hanya `src/lib/<domain>/{queries,mutations}.ts`, `src/lib/auth/*`, dan `scripts/*` boleh impor `@/db`.
- `zod` per endpoint + `AppError`/`handle()` di `src/lib/http.ts`; respons `{ data }` / `{ error: { code, message, details? } }`.
- Route group `(auth)` (login, ganti-password) dan `(app)` (shell: gate sesi + `aktif` + `harus_ganti_password` + `bootstrapPekan()` + `Toaster`).
- Shadcn/ui + `sonner`; form pakai `useState` + `fetch`; form laporan auto-save per baris `onBlur`.
- Penamaan: domain Indonesia, infrastruktur Inggris.

**Draf otomatis:** lazy + catch-up di `src/lib/pekan/bootstrap.ts`, dipanggil layout `(app)`; batas bawah `MAX(pekan.selesai)` laporan terakhir per supervisor. `POST /api/pekan/bootstrap` hanya untuk smoke.

**DB:** `drizzle.config.ts` → `schemaFilter: ["public"]` (bukan `tablesFilter`). Migrasi manual dari lokal dengan `DATABASE_URL_UNPOOLED`; tidak ada migrasi saat build. CHECK dan unique parsial dideklarasikan di schema; trigger lewat `drizzle-kit generate --custom`.

**Seed:** `scripts/seed.mts` dengan email `@seed.local`, ID deterministik, `--cleanup` berurutan; aman walau ada data real.

## 5. Env vars (`.env.local`, gitignored; `.env.example` di repo)

```
DATABASE_URL_POOLED      # runtime app
DATABASE_URL_UNPOOLED    # drizzle-kit migrate + seed lokal
BETTER_AUTH_SECRET       # openssl rand -base64 32
BETTER_AUTH_URL          # http://localhost:3000 / https://<domain>
ADMIN_EMAIL
ADMIN_PASSWORD           # opsional, untuk seed:admin
```

Tidak dipakai lagi setelah auth lokal aktif (hapus): `NEON_AUTH_BASE_URL`, `NEON_AUTH_JWKS_URL`, `NEON_AUTH_COOKIE_SECRET`, `NEON_FUNCTION_HELLO_BASE_URL`, `NEON_BRANCH`.

### Jebakan env
- `neon deploy` / `neon env pull` menimpa `.env.local` dan menulis `DATABASE_URL` (tanpa `_POOLED`); hapus baris itu setelahnya.
- `.neon` berisi org/project/branch (gitignored). `psql` butuh `set -a && . ./.env.local && set +a` dulu.

## 6. Fakta environment terverifikasi

- DB: Neon Postgres 18.6. Skema: `public`, `drizzle` (`__drizzle_migrations`), `neon_auth`.
- `neondb_owner` anggota role `neon_auth`; FK `public` → `neon_auth."user"(id)` bisa, tetapi tidak dipakai.
- 2 akun uji di `neon_auth.user` (`aku@kamu.com`, `apa@iya.com`) tanpa password diketahui; tidak dipakai.
- `better-auth@1.7.17`: `adapters/drizzle` dan `plugins/admin` tersedia; `disableSignUp`/`autoSignIn` di `@better-auth/core` `types/init-options.d.mts`; `databaseHooks.*.before` tersedia.
- `drizzle-kit@0.31.11`: `tablesFilter: string | string[]` (glob nama tabel, hanya untuk `push`); `schemaFilter: string | string[]`.
- Neon Functions + Triggers tersedia di Free (10 active Capacity-Hours, 1M invocation/bulan, cron per menit, UTC) — **sengaja tidak dipakai**. pg_cron hanya jalan saat compute aktif.
- Vercel Hobby: cron min 1×/hari (presisi per jam), function 300s, log runtime 1 jam, build 45 menit.
- shadcn/ui belum di-init (`components.json` belum ada); Tailwind v4 dipakai lewat plugin Turbopack, tanpa PostCSS.

## 7. Jebakan Next 16 / framework (masih berlaku)

1. **Cache Components**: `export const dynamic = "force-dynamic"` **dilarang**. Gunakan `await connection()` di dalam `<Suspense>`.
2. Setelah login, aplikasi memakai `window.location.reload()` (pola lama) — aman.
3. Build memakai Turbopack; dev tanpa Turbopack.
4. `pnpm-workspace.yaml` berisi `allowBuilds: esbuild: true` — jangan dihapus, atau `pnpm add` gagal `ERR_PNPM_IGNORED_BUILDS`.
5. `AGENTS.md` sudah dihapus; `next dev` membuatnya lagi dengan blok bawaan — jangan di-commit ulang.
6. Warning SSL `sslmode=verify-full` dari `pg-connection-string` — harmless.
7. Node di luar bundler Next tidak me-resolve `@neon/auth/next/server` → skrip uji lewat HTTP/Drizzle langsung. (`@neon/*` sudah dihapus.)
8. Vercel Hobby non-komersial (dikonfirmasi tetap Hobby).
9. Route handler dan page **wajib** `await connection()` sebelum `headers()`; halaman yang butuh request data harus dibungkus `<Suspense>`. Saat build, Next tetap men-prerender `/api/me` dan mencetak "connection() rejects ... HANGING_PROMISE_REJECTION" — itu **banner yang diharapkan**, build tetap exit 0 dan runtime 200/401 benar.
10. Route `api/auth/[...catch-all]` milik Better Auth menangkap semua sub-path; penanganan "wajib ganti password" **tidak** dikerjakan di route catch-all, melainkan di helper `requireKaryawan()` yang dipanggil setiap route API aplikasi (lihat §7b).

## 7b. Jebakan Better Auth 1.7.17 (terbukti di sesi ini)

1. **`databaseHooks.user.create.after` tidak menerima field non-schema.** Adapter membuang key di luar skema, dan objek `user` hasil insert tidak memuatnya. Solusi terpakai: `before` menyimpan profil di `ctx.context` (object milik context auth) dengan key privat, `after` membacanya dari `ctx` yang sama.
2. **`auth.api.createUser` adalah endpoint plugin admin**: butuh sesi admin (`headers` request) dan memvalidasi `role` against `roles`/default. Desain saat ini memang memakai sesi admin — aman karena hanya dipanggil dari route admin.
3. **`changePassword` dengan `revokeOtherSessions: true`**: `nextCookies` membuat sesi pengganti **setelah** `changePassword` selesai; kalau ada penulisan cookie sebelumnya (`cookies().set`), sesi baru tidak bisa disimpan. Urutan di route: reset flag di DB **dulu**, baru `changePassword`.
4. **`disableSignUp: true`** membuat `sign-up/email` → 400/403 (bukan membuat akun). `autoSignIn: false` tidak membuat cookie saat `createUser`.
5. **Rate limit** in-memory default memuat hit `/sign-in/email` (429 bila smoke dijalankan berulang dalam 60 detik). Konfigurasi sekarang: window 60s, max 20, `/sign-in/email` dan `/change-password` max 10. Reset cepat saat uji: restart `next start` atau tunggu 60 detik.
6. **Origin check**: request `POST /api/auth/*` harus ber-`Origin` sama dengan `BETTER_AUTH_URL` (403 `INVALID_ORIGIN`). Smoke dan curl harus memakai port yang sama dengan `.env.local`.
7. Password admin hasil `seed-admin` **berubah** setiap kali lewat `/api/auth/change-password`. Smoke menerima `SMOKE_ADMIN_PASSWORD` bila sudah diganti.

## 8. Aturan kerja untuk sesi berikutnya

- **Pencarian file hanya di dalam folder proyek.** Jangan `find` dari `/home/xan` (pernah timeout).
- Perintah `psql` butuh env dimuat dulu.
- Jangan mengubah `neon_auth.*` dan jangan menghapus data tanpa persetujuan.
- Desain domain **dan** arsitektur kode sudah selesai — jangan mengulang pertanyaan; rujuk `CONTEXT.md` dan `plan.md` §Arsitektur Kode.
- Setiap commit wajib lulus `pnpm build`; urutan commit ada di `plan.md` §9.

## 9. Langkah berikutnya (mulai dari sini)

Implementasi **Commit 3 — API laporan pekan** (`plan.md` §3.4, `todo.md` bagian "Commit 3"):

1. Uji serial dulu (red): `src/lib/waktu.test.ts` (batas pekan WIB) dan uji otorisasi laporan.
2. `src/lib/pekan/bootstrap.ts` (Draf + catch-up, idempoten), `src/lib/laporan/{queries,mutations}.ts`.
3. Route `GET /api/me` sudah ada; tambah `POST /api/pekan/bootstrap`, `GET /api/laporan/[id]`, `PATCH .../baris/[anggotaId]`, `POST .../submit`, `POST .../koreksi`.
4. Perluas `scripts/smoke.mts` (fase laporan) — jalankan serial setelah build.
5. `pnpm build` + `pnpm test` + smoke lulus; commit.

Hook `bootstrapPekan()` di layout `(app)` bisa dipasang di Commit 3 (akan memicu Draf lebih awal) atau ditunda ke Commit 5.

**Adapter & snake_case:** `drizzleAdapter(db, { provider: "pg", schema })` menerima objek schema apa adanya; `usePlural` (default `false`) cocok karena nama tabel tunggal (`user`, `session`, …). Nama kolom DB di-**override eksplisit** di `src/db/schema.ts` (`account_id`, `email_verified`, dst.), jadi **jangan** menambah `casing: "snake_case"` — default Drizzle (preserve) sudah benar. Export `schema` (`import * as schema`) harus memuat tabel domain juga agar adapter menemukan `user`.

### TDD (mulai Commit 2)

- Tanpa framework baru: `node:test` + `assert` lewat `tsx`. Sudah diuji di Node 24: `pnpm exec tsx --test "src/**/*.test.ts"` menerima glob. `package.json`: `"test": "tsx --test --test-concurrency=1 \"src/**/*.test.ts\""` — **selalu serial**.
- Unit (murni, tanpa DB): `src/lib/waktu.test.ts` (batas Minggu 00:00 Sabtu 23:59:59 WIB, pergantian bulan), helper otorisasi (`isSupervisorOf`, `isAtasanOf`, cek siklus supervisor), `http.ts` (format `{ error: { code } }`, status per kode).
- DB (trigger & CHECK): `scripts/test-db.mts` — pola psql Commit 1 dipindah ke Drizzle langsung, setiap kasus dalam transaksi yang di-`ROLLBACK`, exit non-nol bila ada yang lolos. Butuh `DATABASE_URL_UNPOOLED`; jangan pernah commit data uji.
- Urutan kerja per fitur: uji gagal → implementasi → uji hijau → `pnpm build` → commit.
- **Jalankan test secara serial** (`pnpm test` sudah `--test-concurrency=1`; skrip DB/HTTP satu per satu, tidak paralel).
- Backlog: `src/lib/waktu.test.ts` untuk `waktu.ts` yang sudah ada (Commit 1) ditulis belakangan, boleh jadi bagian commit Commit 2.

### Catatan operasional baru

- `drizzle-kit generate` akan memunculkan prompt interaktif "table created or renamed?" setiap kali snapshot lama punya tabel yang di-drop; di terminal non-TTY gagal. Jawab Enter (create) atau jalankan lewat pty.
- `check(name, sql)` multi-argumen: drizzle-kit **hanya** mengeluarkan argumen pertama → pisah jadi beberapa `check()`.
- `.next/dev/types` yang basi bisa memicu error TypeScript saat build (`Cannot find module .../route.js`); `rm -rf .next` lalu build.

Perintah dasar:
```bash
cd /home/xan/project/skrmb/pekanan
git status --short
set -a && . ./.env.local && set +a
pnpm db:generate && pnpm db:migrate
pnpm build
```
