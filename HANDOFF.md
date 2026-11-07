# HANDOFF — pekanan

> **Baca ini dulu.** Status terakhir: **desain domain + arsitektur kode selesai, implementasi BELUM mulai.** Tidak ada perubahan kode aplikasi; yang berubah hanya dokumen (`plan.md`, `todo.md`, `README.md`, ADR-0002 revisi, ADR-0003 baru, `.env.example`, skrip `package.json`).

## 1. Ringkasan

Aplikasi **Next.js 16.4.5 (App Router, Cache Components)** + **Neon Postgres** (Drizzle + `pg`) di `/home/xan/project/skrmb/pekanan`. Mencatat kinerja pekanan tim: Laporan Pekan (kehadiran, sebar media, one-on-one), Klien + Follow-up, dan Iuran bulanan.

- Package manager: **pnpm 12.16.1** · Node **v24.22.1** lokal (environment Qoder menyebut v26; yang dipakai `pnpm exec` adalah v24)
- Git: branch `main`, commit terakhir **`deb1838 docs: lock code architecture and local admin seeding`**
- Working tree bersih; **belum di-push**.

## 2. Lokasi dokumen (baca berurutan)

| File | Isi |
|---|---|
| `HANDOFF.md` | (file ini) status, jebakan, langkah berikutnya |
| `CONTEXT.md` | **Glosarium domain (sumber kebenaran aturan bisnis)** |
| `plan.md` | Rencana implementasi yang disetujui + **§Arsitektur Kode** + **§9 urutan commit** |
| `todo.md` | Checklist per commit (semua belum dicentang) |
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
7. Node di luar bundler Next tidak me-resolve `@neon/auth/next/server` → skrip uji lewat HTTP/Drizzle langsung.
8. Vercel Hobby non-komersial (dikonfirmasi tetap Hobby).

## 8. Aturan kerja untuk sesi berikutnya

- **Pencarian file hanya di dalam folder proyek.** Jangan `find` dari `/home/xan` (pernah timeout).
- Perintah `psql` butuh env dimuat dulu.
- Jangan mengubah `neon_auth.*` dan jangan menghapus data tanpa persetujuan.
- Desain domain **dan** arsitektur kode sudah selesai — jangan mengulang pertanyaan; rujuk `CONTEXT.md` dan `plan.md` §Arsitektur Kode.
- Setiap commit wajib lulus `pnpm build`; urutan commit ada di `plan.md` §9.

## 9. Langkah berikutnya (mulai dari sini)

Implementasi **Commit 1 — fondasi database** (`plan.md` §9, `todo.md` bagian "Commit 1"):

1. `pnpm add zod better-auth@1.7.17`; `pnpm add -D @better-auth/core@1.7.17`. **Jangan** remove `@neon/*` dulu (itu Commit 2).
2. Isi `.env.local` (`BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `ADMIN_EMAIL`).
3. `drizzle.config.ts`: `schemaFilter: ["public"]`.
4. Tulis ulang `src/db/schema.ts` (auth lokal + domain, CHECK & unique parsial di schema).
5. Buat `src/lib/waktu.ts` (helper WIB).
6. `pnpm db:generate`, lalu `pnpm db:generate --custom` untuk trigger `retire_transferred_laporan`; `pnpm db:migrate`.
7. Verifikasi dengan `psql`: tabel, CHECK, unique parsial, trigger, `todos`/`visits` ter-drop.
8. `pnpm build` lulus → commit `feat(db): schema domain, auth tables, trigger`.

Perintah dasar:
```bash
cd /home/xan/project/skrmb/pekanan
git status --short
set -a && . ./.env.local && set +a
pnpm db:generate && pnpm db:migrate
pnpm build
```
