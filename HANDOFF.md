# HANDOFF — pekanan

> **Baca ini dulu.** Status terakhir (2026-11-08): **Commit 6 (deploy) sudah live** di **https://pekanan.vercel.app** (Vercel Hobby, `main` auto-deploy). Remote baru: **`https://github.com/jajanan-pasar-enak/pekanan.git`** (publik; remote `sini-sana` sudah ditinggalkan tetapi **masih ada riwayatnya di GitHub**). `main` sinkron di `0b49dba`. `pnpm test` **28/28**, `pnpm build` exit 0.

> **Yang belum beres:**
> 1. **Password admin `admin@pekanan.local` = `AdminBaru123!`** — masih dipakai di DB yang sama dengan produksi dan terekspos di riwayat git kedua repo. **Ganti sekarang** lewat UI produksi.
> 2. **Data uji belum dibersihkan** — DB produksi = branch Neon yang sama dengan dev lokal, isinya 76 akun `uji-browser*`/`@seed.local`, 47 klien "Toko Uji Browser", 4 laporan, 24 koreksi, 39 iuran, 42 followup. Backup sudah dibuat (`neon branches` → `backup-sebelum-cleanup-20261108`, dan `/tmp/pekanan-backup/public-20261108-0834.sql`). Perintah hapus **butuh permintaan eksplisit dari pengguna** (lihat §9.3).
> 3. **`deepmerge` (Dependabot, low)** belum bisa dipatch — hanya lewat `shadcn` CLI, tidak masuk runtime.

## 1. Ringkasan

Aplikasi **Next.js 16.4.5 (App Router, Cache Components)** + **Neon Postgres** (Drizzle + `pg`) di `/home/xan/project/skrmb/pekanan`. Mencatat kinerja pekanan tim: Laporan Pekan (kehadiran, sebar media, one-on-one), Klien + Follow-up, dan Iuran bulanan.

- Package manager: **pnpm 12.16.1** · Node **v24.22.1** lokal (environment Qoder menyebut v26; yang dipakai `pnpm exec` adalah v24)
- Git: branch `main`, commit **`0b49dba fix(deps): pin minimatch dan esbuild di atas advisory Dependabot`** (terakhir di-push); sebelumnya `ade5699` (docs deploy runbook), `de13912` (docs), `8dc453d` (Commit 5 UI), `bd64c4a` (Commit 4).
- **Remote**: `origin` = `https://github.com/jajanan-pasar-enak/pekanan.git` (publik; org dibuat 2026-11-07, akun `mishbah` punya akses via SSH). Remote lama `sini-sana/pekanan` masih memuat riwayat lama — hapus/arsipkan bila perlu.
- **Produksi**: https://pekanan.vercel.app (project Vercel Hobby, region seharusnya `sin1`, auto-deploy dari `main`). `/` → 200, `/api/me` → 401 (benar). Env Vercel: `DATABASE_URL_POOLED`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL=https://pekanan.vercel.app`, `ADMIN_EMAIL`.
- **DB produksi = DB dev lokal**: satu branch Neon (`production`, project `still-firefly-08452520`, org `org-empty-credit-57766595`, `aws-ap-southeast-1`). 3 migrasi Drizzle diterapkan, 15 tabel `public`.
- Admin `admin@pekanan.local`: password **`AdminBaru123!`**, `harus_ganti_password = false`, `aktif = true`. **Ini akun yang dipakai di produksi.** Smoke mencoba `SMOKE_ADMIN_PASSWORD` dulu, baru `SMOKE_ADMIN_PASSWORD_BARU`; jalankan dengan `ADMIN_PASSWORD='AdminBaru123!'` selama password belum diganti.
- Akun lain di DB: `admin@seed.local` (admin kedua, sisa seed) + 76 akun uji. Tidak ada karyawan data real.
- **Testing:** Commit 1 diverifikasi manual (psql rollback + `drizzle-kit pull`), **bukan dengan suite tersimpan**. Mulai Commit 2 dipakai TDD berbasis `node:test` (lihat §9).

### Hasil Commit 5 — UI (jangan diulang)

- shadcn/ui v4 (radix-nova, paket `cn`), lucide, sonner. Komponen di `src/components/ui/*`; domain: `auth-panel`, `ganti-password-form`, `nav-utama`, `keluar-button`, `form-laporan`, `select-baris`, `form-koreksi`, `form-klien-baru`, `form-followup`, `catat-iuran`, `admin/{kelola-karyawan,kelola-klien,master-nominal-iuran,master-hasil-followup}`.
- Halaman: `/` login (pindah ke `src/app/(auth)/page.tsx`), `/ganti-password`, `/dashboard`, `/laporan/[id]`, `/laporan/[id]/koreksi`, `/klien`, `/klien/[id]`, `/iuran`, `/admin` (tab Karyawan/Klien/Nominal Iuran/Hasil Follow-up). Shell `(app)/layout.tsx`: header nav (Admin hanya melihat `/admin`), `<main>`, `Toaster`.
- Form laporan: auto-save per baris (debounce 400 ms + paksa simpan saat `onBlur`), snapshot `tersimpan` untuk menolak PATCH tanpa perubahan, dan tombol **Kirim hanya tampil** saat status `Draf` dan masih ada baris belum lengkap / belum tersimpan. Pekan lampau atau status bukan Draf → input `readOnly`.
- `select-baris`: Radix Select memindahkan fokus ke trigger; handler melepas fokus setelah memilih agar auto-save jalan.
- `catat-iuran`: preset `?catat=<karyawanId>|<bulan>` diinisialisasi lewat `useState` (bukan `useLayoutEffect`, yang jalan sebelum form ada).

### 1a. Bug yang ditemukan uji browser Commit 5 (sudah diperbaiki)

- `src/lib/kepegawaian/mutations.ts` `pindahkanBarisDraf`: ditulis `UPDATE … ON CONFLICT` — Postgres hanya mengizinkan `ON CONFLICT` di `INSERT` → **500 setiap PATCH supervisor**. Diganti `AND NOT EXISTS (SELECT 1 FROM laporan_anggota …)`.
- `ubahKaryawan` memanggil `auth.api.revokeUserSessions` dengan `headers: {}`; endpoint itu lewat `adminMiddleware` → **401**, dialog Nonaktifkan menggantung "Memproses…". Kini `headers` request admin diteruskan (`ubahKaryawan(id, input, headers)`).
- Uji manual (Playwright terhadap `pnpm start`, skrip di `/tmp/pw/uji.mjs`, tidak di repo): login admin → master nominal/hasil → tambah karyawan → paksa ganti password → dashboard kosong → koreksi laporan pekan lampau Tono (Simpan terkunci tanpa alasan/perubahan; setelah simpan status **Dikoreksi**, Riwayat Koreksi memuat alasan + diff `12 → 15`) → admin ubah (nama + supervisor) & nonaktifkan (sesi dicabut) & alih klien → Sari dashboard → laporan Terkirim read-only, Kirim terkunci saat tidak lengkap, nilai bertahan setelah reload → klien + follow-up → catat iuran dari baris rekap → non-admin ditolak `/admin`. **Semua OK.**

### Jebakan uji browser (Next 16, penting bila mengulang)

- **Activity menyimpan ≤3 rute lama di DOM** (`display:none`) → locator strict-mode bisa menemukan 2 elemen (mis. tabel laporan lama + baru). Batasi locator ke `<main>` yang terlihat; untuk `<header>` pakai selector `body > header …`; portal Radix (dialog/option/listbox) dan toast berada di luar `<main>`.
- Konteks browser bersarang bisa berbagi cookie Better Auth; lepas cookie (`ctx.clearCookies()`) sebelum konteks berikutnya login, atau tombol Keluar yang memanggil `revokeUserSessions` akan mencabut sesi admin dan memunculkan 401.
- Neon dari mesin ini sesekali `ETIMEDOUT`/`ENETUNREACH` (IPv6) → login/aksi gagal acak; itu jaringan, ulangi.
- Halaman lambat karena DB remote: tunggu dialog tertutup (`waitFor state: hidden`, 30 s) dan beri jeda sebelum membaca tabel setelah `router.refresh()`.

### Hasil Commit 4 (jangan diulang)

- `src/lib/klien/{aturan,queries,mutations}.ts`: `klienSchema`, `followupSchema` (tanggal ≤ hari ini WIB), `alihKlienSchema`, `hasilFollowupSchema`; `daftarKlienSaya`, `getKlien` (pemilik atau atasan langsung; selain itu 404), `daftarHasilFollowup`; `buatKlien`, `alihKlien` (target ada/aktif/bukan pemilik sekarang), `catatFollowup`, `tambahHasilFollowup`.
- `src/lib/iuran/{aturan,queries,mutations}.ts`: `bulanSah` (YYYY-MM-01), `alasanBulanDitolak` (bulan depan ditolak; CHECK DB juga), `pembayaranIuranSchema`, `nominalIuranSchema`; `catatPembayaranIuran(viewerId, input, karyawanId?)` — hanya diri sendiri atau Anggota Langsung, duplikat `(karyawan, bulan)` → 409.
- `src/lib/kepegawaian/{aturan,queries,mutations}.ts`: `ubahKaryawan` dalam satu transaksi di bawah `pg_advisory_xact_lock(4242)`; guard siklus (CTE rekursif), Magang wajib supervisor Tetap aktif, demote ditolak bila masih membimbing Magang atau masih punya supervisor, nonaktif ditolak bila masih punya Klien/anggota (anggota boleh bila Draf naik ke atasan atau supervisor diganti dalam PATCH yang sama); baris Draf kosong pekan berjalan pindah ke supervisor baru; `revokeUserSessions` setelah transaksi. `daftarKaryawan`, `getRekapPekan` (Admin / pemilik / atasan langsung).
- Route baru: `GET/POST /api/klien`, `GET/PATCH /api/klien/[id]`, `POST /api/klien/[id]/alih` (Admin), `GET/POST /api/klien/[id]/followup`, `GET/POST /api/pembayaran-iuran` (body boleh `karyawanId`), `GET/POST /api/nominal-iuran`, `GET/POST /api/hasil-followup`, `GET /api/rekap/pekan/[id]`, `GET/POST /api/admin/karyawan`, `PATCH /api/admin/karyawan/[id]` → `{ id, nama, level, supervisorId, aktif, sesiDicabut }`.
- `src/lib/http.ts`: `validationError` (400 `VALIDATION` + `details.issues`), `bacaJson`, `isUniqueViolation` (23505 → 409 `CONFLICT`).
- `src/lib/pekan/bootstrap.ts`: `siapkanDrafPekanBerjalan`; **`buatDraf` kini tidak membuat Draf untuk karyawan nonaktif** (kecuali ia masih memegang Anggota).
- Bug yang diperbaiki karena smoke: `db.update().set({})` → 500 "No values to set" bila PATCH hanya mengirim `supervisorId` yang sama (kini dilewati).
- `scripts/seed.mts` (`@seed.local`, uuid v5, `--cleanup`, tolak host produksi dari `.neon` kecuali `FORCE=1`); **belum dicoba ulang** untuk email admin lokal.
- Uji: `klien/aturan.test.ts`, `iuran/aturan.test.ts`, `kepegawaian/aturan.test.ts` → total 28.

### Hasil Commit 3 (jangan diulang)

- `src/lib/pekan/bootstrap.ts`: `bootstrapPekan(viewerId)`, `daftarAnggotaLangsung`. CTE tunggal `laporan_pekan ← ON CONFLICT … DO NOTHING RETURNING` + `laporan_anggota ← CROSS JOIN anggota` membuat Draf hanya bila supervisor punya Anggota Langsung. **Catch-up hanya untuk viewer** sejak `MAX(pekan.selesai)` laporannya sendiri; viewer tanpa laporan hanya mendapat pekan berjalan (mencegah supervisor baru mengisi data historis orang lain).
- `src/lib/laporan/aturan.ts` (murni): `STATUS_KEHADIRAN`, `CARA_ONE_ON_ONE`, `patchBarisSchema`, `kolomKosong`, `barisLengkap`, `normalisasiPatch`. `queries.ts`: `getLaporan`, `daftarLaporanSaya`, predikat `bolehUbahLaporan`/`bolehKoreksiLaporan`. `mutations.ts`: `patchBaris`, `submitLaporan`, `koreksiLaporan`.
- Route: `POST /api/pekan/bootstrap`, `GET /api/laporan/[id]`, `PATCH /api/laporan/[id]/baris/[anggotaId]`, `POST /api/laporan/[id]/submit`, `POST /api/laporan/[id]/koreksi`. Parameter path divalidasi `z.uuid()` → non-UUID = 400.
- Semantik akses yang dipakai (diuji smoke): orang lain baca/koreksi → **404** (tidak membocorkan keberadaan laporan); pemilik ubah setelah kirim / pekan lampau → 403; atasan ubah baris → 403; koreksi pekan berjalan → 403; koreksi tanpa diff → 400.
- `BETTER_AUTH_LOGIN_LIMIT` (default 60) di `server.ts` untuk `/sign-in/email` & `/change-password`; limiter in-memory tetap aktif.
- Uji: `src/lib/waktu.test.ts` (7), `src/lib/laporan/aturan.test.ts` (4) + `http.test.ts` (6) = 17.
- `scripts/smoke.mts` dirombak: `masukAdmin()` mencoba `SMOKE_ADMIN_PASSWORD` lalu `SMOKE_ADMIN_PASSWORD_BARU`, `tungguBilaDibatasi()`, fase laporan dalam `faseLaporan()`, pembersihan di `finally` menghapus `koreksi_laporan` → `laporan_pekan` → `karyawan` → `user` untuk email `smoke-%@seed.local`.

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
| `todo.md` | Checklist per commit (Commit 1–5 sudah dicentang; Commit 6 sebagian) |
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
BETTER_AUTH_LOGIN_LIMIT  # opsional, default 60 (login & change-password per IP/menit)
# opsional smoke: SMOKE_BASE_URL, SMOKE_ADMIN_PASSWORD, SMOKE_ADMIN_PASSWORD_BARU
```

`.env.local` **sudah bersih**: `NEON_AUTH_BASE_URL`, `NEON_AUTH_JWKS_URL`, `NEON_AUTH_COOKIE_SECRET`, `NEON_FUNCTION_HELLO_BASE_URL`, `NEON_BRANCH` dihapus di Commit 6 (backup di `/tmp/env.local.bak.*`). `.env.example` memang tidak pernah memuatnya.
`.env.local` **menunjuk DB produksi** (`BETTER_AUTH_URL` masih `http://localhost:3000`) — smoke lokal mengubah data di DB yang sama dengan https://pekanan.vercel.app. Jangan jalankan smoke/seed tanpa sadar akan hal ini.

### Jebakan env
- `neon env pull` menimpa `.env.local` dan menulis `DATABASE_URL` (tanpa `_POOLED`); hapus baris itu setelahnya.
- `.neon` berisi org/project/branch (gitignored). `psql` butuh `set -a && . ./.env.local && set +a` dulu.
- pnpm 12 **mengabaikan `pnpm.overrides` di `package.json`** — override harus di `pnpm-workspace.yaml` (kunci `overrides:`), kalau tidak muncul warning dan tidak berefek.

## 6. Fakta environment terverifikasi

- DB: Neon Postgres 18.6, project `still-firefly-08452520` (org `org-empty-credit-57766595`), branch aktif `production`, region `aws-ap-southeast-1`. Skema: `public`, `drizzle` (`__drizzle_migrations`), `neon_auth`.
- Branch backup: `backup-sebelum-cleanup-20261108` (`br-…`, dibuat 2026-11-08 sebelum percobaan cleanup). Hapus bila sudah tidak perlu (biaya storage Neon Free).
- Vercel: project `pekanan` → https://pekanan.vercel.app, deploy dari `main`. Vercel GitHub App harus mengakses org `jajanan-pasar-enak` (tombol Deploy sempat nonaktif sebelum app diberi akses).
- `neondb_owner` anggota role `neon_auth`; FK `public` → `neon_auth."user"(id)` bisa, tetapi tidak dipakai.
- 2 akun uji di `neon_auth.user` (`aku@kamu.com`, `apa@iya.com`) tanpa password diketahui; tidak dipakai.
- `better-auth@1.7.17`: `adapters/drizzle` dan `plugins/admin` tersedia; `disableSignUp`/`autoSignIn` di `@better-auth/core` `types/init-options.d.mts`; `databaseHooks.*.before` tersedia.
- `drizzle-kit@0.31.11`: `tablesFilter: string | string[]` (glob nama tabel, hanya untuk `push`); `schemaFilter: string | string[]`.
- Neon Functions + Triggers tersedia di Free (10 active Capacity-Hours, 1M invocation/bulan, cron per menit, UTC) — **sengaja tidak dipakai**. pg_cron hanya jalan saat compute aktif.
- Vercel Hobby: cron min 1×/hari (presisi per jam), function 300s, log runtime 1 jam, build 45 menit.
- shadcn/ui sudah di-init (Commit 5, `components.json`, paket `cn`); Tailwind v4 lewat plugin Turbopack, tanpa `postcss.config`.

## 7. Jebakan Next 16 / framework (masih berlaku)

1. **Cache Components**: `export const dynamic = "force-dynamic"` **dilarang**. Gunakan `await connection()` di dalam `<Suspense>`.
2. Setelah login, aplikasi memakai `window.location.reload()` (pola lama) — aman.
3. Build memakai Turbopack; dev tanpa Turbopack.
4. `pnpm-workspace.yaml` berisi `allowBuilds: esbuild: true` — jangan dihapus, atau `pnpm add` gagal `ERR_PNPM_IGNORED_BUILDS`. File yang sama juga memuat `overrides:` untuk minimatch/esbuild (pnpm 12 mengabaikan `pnpm.overrides` di `package.json`).
5. `AGENTS.md` sudah dihapus; `next dev` membuatnya lagi dengan blok bawaan — jangan di-commit ulang.
6. Warning SSL `sslmode=verify-full` dari `pg-connection-string` — harmless.
7. Node di luar bundler Next tidak me-resolve `@neon/auth/next/server` → skrip uji lewat HTTP/Drizzle langsung. (`@neon/*` sudah dihapus.)
8. Vercel Hobby non-komersial (dikonfirmasi tetap Hobby) — **sudah dipakai live** (`pekanan.vercel.app`).
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

- **Pencarian file hanya di dalam folder proyek.** Jangan `find` dari `/home/xan` (pernah timeout). Skrip uji browser sengaja disimpan di `/tmp/pw` (luar repo).
- Perintah `psql` butuh env dimuat dulu.
- Jangan mengubah `neon_auth.*` dan jangan menghapus data tanpa persetujuan.
- Desain domain **dan** arsitektur kode sudah selesai — jangan mengulang pertanyaan; rujuk `CONTEXT.md` dan `plan.md` §Arsitektur Kode.
- Setiap commit wajib lulus `pnpm build`; urutan commit ada di `plan.md` §9.

## 9. Langkah berikutnya (mulai dari sini)

1. ~~**Push**~~ — selesai. Remote `sini-sana/pekanan` → dipindah ke `jajanan-pasar-enak/pekanan` (SSH, akun `mishbah`). Verifikasi: `ssh -T git@github.com` → `Hi mishbah!`, `git ls-remote origin` OK.
2. ~~**Commit 6 — Deploy**~~ — **selesai**: https://pekanan.vercel.app live, auto-deploy dari `main`. README berisi runbook lengkap. Sisa verifikasi manual di browser (butuh pengguna):
   - Login `admin@pekanan.local` di produksi. Bila `INVALID_ORIGIN`, cek env Vercel `BETTER_AUTH_URL` harus persis `https://pekanan.vercel.app`.
   - **Ganti password admin** (password lama publik di riwayat git).
   - Tambah 1 karyawan → isi & kirim 1 Laporan Pekan → buka `/admin` (master nominal iuran + hasil follow-up).
   - Konfirmasi region function = `sin1` (Project Settings → Functions).
3. **Pembersihan data uji di DB produksi (BELUM; butuh permintaan eksplisit pengguna).** Isi DB sekarang 100% data uji: satu-satunya akun real adalah `admin@pekanan.local`. Konteks (bukan lagi hanya `uji-browser*`): 76 akun dihapus (`uji-browser*` + `@seed.local` termasuk `admin@seed.local`), 47 klien "Toko Uji Browser", 42 followup, 39 pembayaran iuran, 4 laporan (+ anggota + 24 koreksi), 423 sesi. Master `nominal_iuran` & `hasil_followup` **dipertahankan**.
   - Backup sebelum hapus: branch Neon `backup-sebelum-cleanup-20261108` dan `/tmp/pekanan-backup/public-20261108-0834.sql`.
   - Urutan FK dalam satu transaksi: `koreksi_laporan` → `laporan_anggota` → `laporan_pekan` → `followup` → `pembayaran_iuran` → `klien` → `karyawan` (null-kan `supervisor_id` dulu) → `session` → `account` → `user`, semua terbatas pada user selain `admin@pekanan.local`.
   - Rencana perintah sudah disusun sesi ini tetapi **diblokir classifier auto-mode**; jalankan ulang setelah pengguna minta eksplisit. Klien memakai kolom `karyawan_id` (bukan `pemilik_id`).
4. **Belum diuji manual (browser):** rekap Atasan (`GET /api/rekap/pekan/[id]`) belum punya layar; bootstrap setelah pergantian pekan (Draf baru + catch-up) baru diuji smoke.
5. **Kebersihan repo/riwayat:** password `AdminBaru123!` ada di `HANDOFF.md` di riwayat `sini-sana/pekanan` dan `jajanan-pasar-enak/pekanan`. Opsi: ganti password saja (paling murah), atau `git filter-repo` + force-push (kirim ke dua repo). Putuskan dengan pengguna.
6. Skrip uji browser ada di `/tmp/pw/uji.mjs` (+ Playwright-Core di `/tmp/pw`); **tidak di repo**. `pnpm start` lokal mungkin masih jalan di port 3000 — cek `ss -ltnp | grep :3000`.

**Catatan smoke yang mahal ditemukan di Commit 4 (jangan diulang):**
- Parser cookie harus memisah `Set-Cookie` per atribut; regex `max-age=0` cocok juga dengan `Max-Age=60480` dan membuang token baru setelah `change-password`.
- **Token sesi Better Auth berotasi saat sesi dibaca.** Jangan membaca sesi admin dengan jar lain di sekitar PATCH; cukup satu jar per peran. Di smoke, X/Y/Z memakai satu jar bersama (`jadi(email)`).
- `revokeUserSessions` mencabut **semua** sesi akun; jangan pakai jar lama setelah target dinonaktifkan.
- Urutan fase admin: nonaktifkan Z **sebelum** Y (Z butuh Y aktif sebagai supervisor).

**Keputusan implementasi Commit 3 yang perlu diingat:**
- "Orang lain tanpa hak" di API laporan dikembalikan **404**, bukan 403 (pemilik yang mencoba melanggar aturan → 403). Pertahankan pola ini di endpoint lain.
- `submitLaporan` memakai `UPDATE … WHERE status = 'Draf'` + `RETURNING`; hasil kosong → 409 `CONFLICT` (submit ganda bersamaan).
- Koreksi menyimpan `sebelum`/`sesudah` hanya untuk baris yang **benar-benar berubah**; tanpa diff → 400.
- `isSupervisorOf`/`isAtasanOf` dibatalkan sebagai helper terpisah: relasi cukup dibaca dari `karyawan.supervisor_id` yang sudah di-join di query (`queries.ts` predikat `bolehUbahLaporan`/`bolehKoreksiLaporan`).

**Status akun admin:** `admin@pekanan.local`, password `AdminBaru123!` (`harus_ganti_password = false`, `aktif = true`) — **dipakai di produksi**, segera ganti. `pnpm seed:admin` idempoten dan **tidak** mengganti password yang ada. Tabel `session` berisi 423 baris (sisa smoke/uji) — ikut terhapus pada cleanup §9.3.

**Adapter & snake_case:** `drizzleAdapter(db, { provider: "pg", schema })` menerima objek schema apa adanya; `usePlural` (default `false`) cocok karena nama tabel tunggal (`user`, `session`, …). Nama kolom DB di-**override eksplisit** di `src/db/schema.ts` (`account_id`, `email_verified`, dst.), jadi **jangan** menambah `casing: "snake_case"` — default Drizzle (preserve) sudah benar. Export `schema` (`import * as schema`) harus memuat tabel domain juga agar adapter menemukan `user`.

### TDD (mulai Commit 2)

- Tanpa framework baru: `node:test` + `assert` lewat `tsx`. Sudah diuji di Node 24: `pnpm exec tsx --test "src/**/*.test.ts"` menerima glob. `package.json`: `"test": "tsx --test --test-concurrency=1 \"src/**/*.test.ts\""` — **selalu serial**.
- Unit (murni, tanpa DB): `src/lib/waktu.test.ts` (batas Minggu 00:00 Sabtu 23:59:59 WIB, pergantian bulan), helper otorisasi (`isSupervisorOf`, `isAtasanOf`, cek siklus supervisor), `http.ts` (format `{ error: { code } }`, status per kode).
- DB (trigger & CHECK): `scripts/test-db.mts` — pola psql Commit 1 dipindah ke Drizzle langsung, setiap kasus dalam transaksi yang di-`ROLLBACK`, exit non-nol bila ada yang lolos. Butuh `DATABASE_URL_UNPOOLED`; jangan pernah commit data uji.
- Urutan kerja per fitur: uji gagal → implementasi → uji hijau → `pnpm build` → commit.
- **Jalankan test secara serial** (`pnpm test` sudah `--test-concurrency=1`; skrip DB/HTTP satu per satu, tidak paralel).
- Commit 2: `src/lib/http.test.ts` (6 uji). Commit 3: `src/lib/waktu.test.ts` (7), `src/lib/laporan/aturan.test.ts` (4). Commit 4: `klien/aturan.test.ts`, `iuran/aturan.test.ts`, `kepegawaian/aturan.test.ts` → total **28**.
- Commit 5 (UI) tidak butuh uji unit baru; verifikasi lewat build + uji manual browser (sudah: Playwright terhadap `pnpm start`, semua fase OK).

### Catatan operasional baru

- **Rate limit**: smoke melakukan >10 login; `BETTER_AUTH_LOGIN_LIMIT` default 60 menit-per-jendela. Untuk pengujian berkali-kali, jalankan `next start` dengan `BETTER_AUTH_LOGIN_LIMIT=1000` atau restart server (limiter in-memory). Smoke punya `tungguBilaDibatasi()` sebagai jaring pengaman.
- **Restart server**: cek `ss -ltnp | grep :3000`. Jika port sudah dipakai proses lama, `pnpm start` gagal diam-diam (`EADDRINUSE` di log) dan smoke menguji build lama. Selalu `kill <pid>` lalu tunggu port bebas.
- **Ganti password**: smoke membuat sesinya sendiri lalu mengganti password admin. Bila `next start` baru dijalankan (secret sama), sesi lama tetap valid. Jangan mengubah password lalu memakai ulang sesi yang dibuat sebelum perubahan dengan password lama → `Invalid password`.
- **Cleanup smoke** (satu transaksi, FK RESTRICT): `koreksi_laporan` → `laporan_pekan` → `followup` → `pembayaran_iuran` → `klien` → `karyawan` → `user`, lalu master `LIKE 'Smoke %'`. Email uji berawalan `smoke-` berakhiran `@seed.local`.
- Smoke fase klien/iuran butuh master `hasil_followup` & `nominal_iuran`; bila admin bukan `ADMIN_EMAIL`, fase itu di-skip dengan pesan SKIP. Seed `@seed.local` tidak wajib.
- `uuidDari()` di smoke hanya untuk UUID acak (mis. anggota fiktif) — ID karyawan selalu diambil dari DB.
- `.env.local` tidak memuat `ADMIN_PASSWORD`, jadi jalankan smoke dengan `ADMIN_PASSWORD='...' pnpm exec tsx scripts/smoke.mts`.
- `drizzle-kit generate` akan memunculkan prompt interaktif "table created or renamed?" setiap kali snapshot lama punya tabel yang di-drop; di terminal non-TTY gagal. Jawab Enter (create) atau jalankan lewat pty.
- `check(name, sql)` multi-argumen: drizzle-kit **hanya** mengeluarkan argumen pertama → pisah jadi beberapa `check()`.
- `.next/dev/types` yang basi bisa memicu error TypeScript saat build (`Cannot find module .../route.js`); `rm -rf .next` lalu build.
- `pnpm lint` masih merah: `@typescript-eslint/ban-ts-comment` untuk `// @ts-nocheck` di setiap `*.test.ts` (pola yang disengaja: `node:test` dimuat `tsx`, tipe Node tidak di-resolve) dan `no-explicit-any` di `scripts/smoke.mts`. Bukan gerbang commit; `pnpm build` lulus tanpa lint.

Perintah dasar:
```bash
cd /home/xan/project/skrmb/pekanan
git status --short
set -a && . ./.env.local && set +a
pnpm db:generate && pnpm db:migrate
pnpm test && pnpm build
pnpm start &            # pastikan port 3000 bebas dulu
ADMIN_PASSWORD='AdminBaru123!' pnpm exec tsx scripts/smoke.mts
```
