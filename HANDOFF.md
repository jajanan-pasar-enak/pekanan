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
| `todo.md` | Checklist per commit (Commit 1 & 2 sudah dicentang; Commit 3–6 belum) |
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

## 4. Keputusan teknis & arsitektur yang sudah dikunci (auth sudah dikodekan di Commit 2; sisanya belum)

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
ADMIN_PASSWORD           # seed:admin; opsional (prompt bila TTY)
ADMIN_NAMA               # opsional, default "Admin Perhimpunan"
# opsional smoke: SMOKE_BASE_URL, SMOKE_ADMIN_PASSWORD, SMOKE_ADMIN_PASSWORD_BARU
```

`.env.local` **masih** memuat sisa Neon: `NEON_AUTH_BASE_URL`, `NEON_AUTH_JWKS_URL`, `NEON_AUTH_COOKIE_SECRET`, `NEON_FUNCTION_HELLO_BASE_URL`, `NEON_BRANCH` — sudah tidak dibaca kode, dihapus di Commit 6 (deploy prep).

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

Implementasi **Commit 3 — API laporan pekan** (`plan.md` §3.4 & §4, `todo.md` bagian "Commit 3"). Urutan kerja: tulis uji (gagal) → implementasi → uji hijau → `pnpm build` → smoke → commit. Semua test/skrip dijalankan **serial**.

1. **Uji dulu (merah):**
   - `src/lib/waktu.test.ts` — batas pekan (Minggu 00:00 s.d. Sabtu 23:59:59 WIB): Sabtu 23:59 WIB masih pekan berjalan, Minggu 00:00 WIB mulai pekan baru, kasus pergantian bulan/tahun, `bulanBerjalan`.
   - Uji otorisasi (murni/DB): pemilik vs Atasan Supervisor langsung vs orang lain untuk baca/submit/koreksi; laporan lampau read-only untuk pemilik.
2. **`src/lib/pekan/bootstrap.ts`** — `bootstrapPekan()`: buat baris `pekan` WIB bila belum ada; untuk user login, buat Draf pekan berjalan + baris `laporan_anggota` untuk setiap Anggota Langsung **saat ini** (hanya bila ≥1); catch-up untuk setiap supervisor aktif sejak `MAX(pekan.selesai)` laporan terakhirnya. Idempoten via `ON CONFLICT (supervisor_id, pekan_id) WHERE deleted_at IS NULL DO NOTHING`. Batasi bukan-supervisor (tanpa anggota) supaya murah.
3. **`src/lib/laporan/queries.ts` / `mutations.ts`** (hanya file ini yang impor `@/db`):
   - `getLaporan(id, viewer)` (pemilik atau Atasan langsung), `patchBaris` (pemilik, `Draf`, pekan berjalan, `anggota_id` harus ada di laporan itu), `submitLaporan` (semua nilai wajib terisi, selain itu 400 `VALIDATION`), `koreksiLaporan` (Atasan langsung, pekan lampau, alasan wajib; satu transaksi: `koreksi_laporan` + `sebelum`/`sesudah` + `status = 'Dikoreksi'`).
   - Tambah helper di `src/lib/auth/otorisasi.ts`: `isSupervisorOf(supervisorId, anggotaId)`, `isAtasanOf(karyawanId, calonAtasanId)` (supervisor langsung), lalu uji unit-nya.
4. **Route (tipis, `zod` + `handle()` + `requireKaryawan()` + `await connection()`):**
   - `POST /api/pekan/bootstrap` (untuk smoke), `GET /api/laporan/[id]`,
   - `PATCH /api/laporan/[id]/baris/[anggotaId]`, `POST /api/laporan/[id]/submit`, `POST /api/laporan/[id]/koreksi`.
   - Ingat jebakan #9: route handler wajib `await connection()`.
5. **`scripts/smoke.mts` fase laporan** (jalankan serial setelah `pnpm build` + `pnpm start`, port harus = `BETTER_AUTH_URL`): bootstrap → isi baris → submit kosong ditolak → isi lengkap → submit → ubah setelah submit 403/409 → koreksi (alasan kosong ditolak, non-atasan 403) → IDOR 403/404. Bersihkan data uji di `finally` (prefix `smoke-%@seed.local`).
6. Pasang `bootstrapPekan()` di `(app)/layout.tsx` pada commit ini (supaya smoke lewat halaman juga memicu Draf); `Toaster`/shadcn tetap di Commit 5.
7. Commit `feat(api): laporan pekan`, lalu perbarui `todo.md` + `HANDOFF.md`.

**Status akun admin lokal saat ini:** `admin@pekanan.local`, password terakhir `AdminSmokeBaru999!` (`harus_ganti_password = false`, sudah diubah smoke). `pnpm seed:admin` tidak mengubahnya (idempoten). Ganti lewat `/api/auth/change-password` atau UI bila perlu.

**Adapter & snake_case:** `drizzleAdapter(db, { provider: "pg", schema })` menerima objek schema apa adanya; `usePlural` (default `false`) cocok karena nama tabel tunggal (`user`, `session`, …). Nama kolom DB di-**override eksplisit** di `src/db/schema.ts` (`account_id`, `email_verified`, dst.), jadi **jangan** menambah `casing: "snake_case"` — default Drizzle (preserve) sudah benar. Export `schema` (`import * as schema`) harus memuat tabel domain juga agar adapter menemukan `user`.

### TDD (mulai Commit 2)

- Tanpa framework baru: `node:test` + `assert` lewat `tsx`. Sudah diuji di Node 24: `pnpm exec tsx --test "src/**/*.test.ts"` menerima glob. `package.json`: `"test": "tsx --test --test-concurrency=1 \"src/**/*.test.ts\""` — **selalu serial**.
- Unit (murni, tanpa DB): `src/lib/waktu.test.ts` (batas Minggu 00:00 Sabtu 23:59:59 WIB, pergantian bulan), helper otorisasi (`isSupervisorOf`, `isAtasanOf`, cek siklus supervisor), `http.ts` (format `{ error: { code } }`, status per kode).
- DB (trigger & CHECK): `scripts/test-db.mts` — pola psql Commit 1 dipindah ke Drizzle langsung, setiap kasus dalam transaksi yang di-`ROLLBACK`, exit non-nol bila ada yang lolos. Butuh `DATABASE_URL_UNPOOLED`; jangan pernah commit data uji.
- Urutan kerja per fitur: uji gagal → implementasi → uji hijau → `pnpm build` → commit.
- **Jalankan test secara serial** (`pnpm test` sudah `--test-concurrency=1`; skrip DB/HTTP satu per satu, tidak paralel).
- Commit 2 sudah menulis `src/lib/http.test.ts` (6 uji). Backlog: `src/lib/waktu.test.ts` dan uji otorisasi → dikerjakan di awal Commit 3.

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
