# HANDOFF — pekanan

> **Baca ini dulu.** Status terakhir: **desain domain selesai, implementasi BELUM mulai.** Tidak ada perubahan kode aplikasi di sesi terakhir; hanya dokumen desain yang ditambahkan.

## 1. Ringkasan

Aplikasi **Next.js 16.4.5 (App Router)** + **Neon Postgres** (Drizzle + `pg`) di `/home/xan/project/skrmb/pekanan`. Tujuannya mencatat kinerja pekanan tim: Laporan Pekan (kehadiran, sebar media, one-on-one), klien + follow-up, dan iuran bulanan.

- Package manager: **pnpm 12.16.1** · Node **v24.22.1** lokal (environment Qoder menyebut v26; yang dipakai `pnpm exec` adalah v24)
- Git: branch `main`, commit terakhir `374fe23 docs: replace create-next-app README with project setup guide`
- **Belum ada commit** untuk pekerjaan sesi terakhir.

## 2. Lokasi dokumen (baca berurutan)

| File | Isi |
|---|---|
| `HANDOFF.md` | (file ini) status, jebakan, langkah berikutnya |
| `CONTEXT.md` | **Glosarium domain (sumber kebenaran aturan bisnis)** |
| `plan.md` | Rencana implementasi yang **sudah disetujui** (schema, API, UI, uji) |
| `todo.md` | Checklist implementasi (semua belum dicentang) |
| `docs/adr/0001-sesi-auth-dilayani-better-auth-lokal.md` | Keputusan pindah dari Neon Auth proxy ke Better Auth lokal |
| `docs/adr/0002-keunikan-laporan-per-pekan-dijaga-trigger.md` | Unik laporan per (supervisor, pekan) via unique parsial + trigger |

## 3. Keputusan domain yang sudah dikunci (ringkas)

- Laporan Pekan ditulis **Supervisor** untuk **Anggota Langsungnya saja**; Atasan Supervisor (supervisor-nya supervisor) boleh **Koreksi** dengan alasan, benar-benar disimpan.
- Pekan = **Minggu 00:00 – Sabtu 23:59:59 WIB**. Laporan Draf dibuat otomatis saat pekan mulai **hanya bila supervisor punya ≥1 Anggota Langsung**.
- Laporan wajib **diisi manual** (Mengisi Sendiri): tombol Kirim terkunci selama ada nilai kosong; draf kosong tidak boleh terkirim.
- Kehadiran 5 status (Tepat Waktu, Terlambat <15, Terlambat >15, Sakit=tidak hadir, Tanpa Keterangan) + keterangan.
- Sebar media: dua angka integer ≥0 (online, offline) diketik supervisor.
- One-on-One: satu cara per anggota (Pribadi / Sebelum Meeting Pekanan / Alpa) + keterangan.
- Follow-up **hanya dari kejadian** (klien, tanggal ≤ hari ini, master hasil + deskripsi opsional); jumlah per pekan = hitungan kejadian.
- Klien punya **satu pemilik**; wajib dialihkan bila pemilik nonaktif/pindah supervisor.
- Iuran: master Nominal, kejadian Pembayaran Iuran per (karyawan, bulan), dicatat sendiri atau oleh supervisor; tampil kosong di pekan setelah lunas.
- Struktur supervisi = **pohon berantai** (Tetap punya supervisor Tetap; Magang wajib supervisor Tetap). Relasi dan keputusan lengkap ada di `CONTEXT.md`.

## 4. Keputusan teknis yang sudah dibuat (belum dikodekan)

1. **Auth: Better Auth lokal**, bukan proxy Neon Auth (ADR-0001). Tabel auth pindah ke skema `public` (`user`, `session`, `account`, `verification`). `neon_auth.*` **tidak disentuh**.
2. **Bootstrap admin via env `ADMIN_EMAIL`**: hanya email itu boleh sign-up dan hanya saat belum ada admin. **Setelah admin ada, sign-up mandiri ditolak**; admin membuat akun karyawan + password awal → karyawan wajib ganti password.
3. **Scaffold lama dihapus total**: `todos`, `visits`, `/api/todos`, `TodoList`, `/api/ping-function`, `hello.ts`, `neon.ts`, `src/lib/functions.ts`, `scripts/verify-db.mts`, `@neon/functions`.
4. `drizzle.config.ts` **wajib** `tablesFilter` mengecualikan `neon_auth` (jangan sampai drizzle men-drop skema auth).
5. Better Auth harus `advanced.database.validateSchema: false` (tabel `neon_auth` lama tidak memenuhi unique index Better Auth).
6. UI berbahasa Indonesia.

## 5. Env vars (`.env.local`, gitignored)

Sudah ada:
```
DATABASE_URL_POOLED      # pooled, runtime app
DATABASE_URL_UNPOOLED    # direct, drizzle-kit migrate
NEON_BRANCH
NEON_AUTH_BASE_URL       # tidak dipakai lagi setelah auth dilokalkan
NEON_AUTH_JWKS_URL       # tidak dipakai lagi
NEON_FUNCTION_HELLO_BASE_URL  # tidak dipakai setelah scaffold dihapus
NEON_AUTH_COOKIE_SECRET
```

**Belum ada, harus ditambahkan saat implementasi:**
```
BETTER_AUTH_SECRET=<openssl rand -base64 32>
ADMIN_EMAIL=<email admin pertama>
```

### Jebakan env
- `neon deploy` / `neon env pull` **menimpa** `.env.local` dan menulis `DATABASE_URL` (tanpa `_POOLED`). Setelah itu hapus baris `DATABASE_URL=` dan pastikan `DATABASE_URL_POOLED` ada.
- `.neon` berisi org/project/branch (gitignored). `psql` butuh `set -a && . ./.env.local && set +a` dulu, jika tidak konek ke socket lokal dan gagal.

## 6. Fakta environment yang sudah diverifikasi (dengan `psql`)

- DB: Neon Postgres 18.6. Skema: `public`, `drizzle` (tabel `__drizzle_migrations`, 1 migrasi baseline), `neon_auth`.
- `neondb_owner` adalah anggota role `neon_auth` → FK dari `public` ke `neon_auth."user"(id)` **berhasil** (diuji dalam transaksi + rollback).
- Tidak ada trigger yang ditemukan di skema `neon_auth`; tabel: `account, invitation, jwks, member, organization, project_config, session, user, verification`.
- 2 akun uji di `neon_auth.user`: `aku@kamu.com`, `apa@iya.com` (email belum diverifikasi). **Password tidak diketahui dan tidak tersimpan di repo** — jangan cari di luar folder proyek.
- `better-auth@1.7.17` ada di `node_modules/.pnpm` sebagai dependency `@neon/auth`, tetapi **tidak bisa di-`import` langsung** sampai ditambahkan ke `package.json`.
- Node di luar bundler Next **tidak me-resolve** `@neon/auth/next/server` (peer `next` tidak ter-link) → skrip uji harus lewat HTTP / Drizzle langsung, jangan import modul auth.
- Verifikasi dari membaca kode library (bukan dites runtime):
  - `options.hooks.before/after` Better Auth **dijalankan** (dibaca di `dist/api/dispatch.mjs`).
  - `runPluginInit` (opsi dari `plugin.init`) dijalankan **setelah** `createAuthContext`; **hooks instance lebih dulu** daripada hooks plugin (penting untuk bootstrap admin).
  - `getSetCookie` dan `Response` body bisa dipakai ulang untuk menjeda/merusak respons auth.

## 7. Jebakan Next 16 / framework (dari sesi sebelumnya, masih berlaku)

1. **Cache Components**: `export const dynamic = "force-dynamic"` **dilarang**. Gunakan `await connection()` di dalam `<Suspense>`.
2. Setelah login, aplikasi `window.location.reload()` (pola lama di `auth-panel.tsx`) — aman.
3. Build memakai Turbopack; dev `--no-turbopack`.
4. `pnpm-workspace.yaml` berisi `allowBuilds: esbuild: true` — jangan dihapus, atau `pnpm add` gagal `ERR_PNPM_IGNORED_BUILDS`.
5. `AGENTS.md` bawaan Next 16 — jangan dihapus. `git status` sesi ini menunjukkan `M AGENTS.md` (tidak sengaja berubah); **cek diff sebelum commit**.
6. Warning SSL `sslmode=verify-full` dari `pg-connection-string` — harmless.
7. Vercel Hobby non-komersial.

## 8. Aturan kerja untuk sesi berikutnya

- **Pencarian file hanya di dalam folder proyek.** Kalau file tidak ada di proyek, laporkan; jangan mencari ke luar `/home/xan/project/skrmb/pekanan`. Jangan jalankan `find` dari `/home/xan` (sesi lalu timeout).
- Perintah `psql` butuh env dimuat dulu (lihat 5).
- Jangan mengubah `neon_auth.*` dan jangan menghapus data tanpa persetujuan.
- Grilling/desain domain sudah selesai — **jangan mengulang pertanyaan**; semua aturan ada di `CONTEXT.md`.

## 9. Langkah berikutnya (mulai dari sini)

Ikuti `plan.md` dan centang `todo.md`. Urutan:

1. **Task 1 — Fondasi DB**: `pnpm add better-auth`; `pnpm remove @neon/auth @neon/functions`; `pnpm add -D @better-auth/core @better-auth/drizzle-adapter`; tulis ulang `src/db/schema.ts`; `drizzle.config.ts` + `tablesFilter`; generate migration lalu tambahkan trigger/unique parsial/CHECK manual; `DROP TABLE IF EXISTS todos, visits`; uji dengan `psql`.
2. **Task 2 — Auth lokal**: `betterAuth` + `drizzleAdapter`, `toNextJsHandler`, client `better-auth/react`, bootstrap `ADMIN_EMAIL`, tolak sign-up mandiri, `POST /api/admin/karyawan` (pra-uji jalur pembuatan user), `/ganti-password`, hapus scaffold.
3. **Task 3 — API domain**, lalu **Task 4 — UI**, lalu **Task 5 — verifikasi** (`scripts/smoke.mts` baru, trigger test, `pnpm build`, uji browser).

Perintah dasar:
```bash
cd /home/xan/project/skrmb/pekanan
git status --short
set -a && . ./.env.local && set +a
pnpm db:generate && pnpm db:migrate
pnpm build
pnpm dev &            # atau pnpm start
pnpm exec tsx scripts/smoke.mts
```
