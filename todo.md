# Todo: Aplikasi Pekanan

Detail rencana: `plan.md` (termasuk §Arsitektur Kode). Aturan domain: `CONTEXT.md`. Target deploy: Vercel Hobby (non-komersial) + Neon Free (`plan.md` §8).

Urutan commit mengikuti `plan.md` §9; setiap commit wajib lulus `pnpm build`.

## Commit 1 — Fondasi database

- [x] `pnpm add zod`; `pnpm add better-auth@1.7.17`; `pnpm add -D @better-auth/core@1.7.17` (belum remove `@neon/*`)
- [x] Tambah `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `ADMIN_EMAIL`, `ADMIN_PASSWORD` (opsional) ke `.env.local` + `.env.example`
- [x] `drizzle.config.ts`: `schemaFilter: ["public"]`
- [x] `src/db/schema.ts`: tabel auth lokal (`user`, `session`, `account`, `verification`) + kolom plugin admin
- [x] `src/db/schema.ts`: `karyawan`, `pekan`, `laporan_pekan`, `laporan_anggota`, `koreksi_laporan`
- [x] `src/db/schema.ts`: `nominal_iuran`, `pembayaran_iuran`, `hasil_followup`, `klien`, `followup`
- [x] CHECK/enum & unique parsial dideklarasikan di schema (media ≥ 0, tanggal WIB, bulan awal bulan)
- [x] `src/lib/waktu.ts` helper WIB (`pekanWIB`, `pekanBerjalan`, `bulanBerjalan`)
- [x] Migration: generate, lalu `generate --custom` untuk trigger `retire_transferred_laporan`
- [x] Uji migration di database (psql): tabel, trigger, unique parsial, CHECK; `DROP todos, visits` otomatis
- [x] `pnpm build` lulus

## Commit 2 — Auth lokal

- [x] `src/lib/http.ts`: `AppError`, `jsonOk`, `handle()`, kode error
- [x] `src/lib/auth/server.ts`: `betterAuth` + `drizzleAdapter`, `disableSignUp`, `autoSignIn: false`, plugin `admin`, `nextCookies()`
- [x] `databaseHooks`: buat `karyawan` saat user dibuat; tolak sesi karyawan nonaktif/banned
- [x] `src/lib/auth/client.ts`: `better-auth/react` + `adminClient`
- [x] `src/lib/auth/current.ts`: `requireKaryawan`, `requireAdmin`, `bacaSesiSekarang`, `requireSession` (helper `periksaSupervisor`/`membentukSiklus` di `otorisasi.ts`)
- [x] `src/app/api/auth/[...path]/route.ts`: `toNextJsHandler`
- [x] `scripts/seed-admin.mts` (ADR-0003): idempoten, transaksi, `user`+`account`+`karyawan`
- [x] `POST /api/admin/karyawan` via `auth.api.createUser` + `harus_ganti_password = true`
- [x] Enforcement `PASSWORD_CHANGE_REQUIRED` di helper (403) + revoke sesi lain setelah ganti password (`POST /api/auth/change-password`)
- [x] Hapus `@neon/auth`, `@neon/functions` **bersamaan** dengan update `src/db/index.ts`, `page.tsx`, `layout.tsx`, `auth-panel.tsx`
- [x] Hapus scaffold: `todo-list.tsx`, `/api/todos`, `/api/ping-function`, `src/lib/functions.ts`, `scripts/verify-db.mts`, `hello.ts`, `neon.ts`
- [x] `pnpm build` lulus; login + ganti password manual (smoke 21/21 lulus terhadap `next start`)
- [ ] UI `/dashboard` / `(app)` shell penuh + `bootstrapPekan()` → dipindah ke Commit 5 (shell minimal ada di Commit 2)

## Commit 3 — API laporan pekan

- [x] `src/lib/pekan/bootstrap.ts`: Draf pekan berjalan + catch-up sejak `MAX(pekan.selesai)`, idempoten
- [x] `src/lib/laporan/queries.ts`, `src/lib/laporan/mutations.ts` (+ `aturan.ts` murni: skema zod, "Mengisi Sendiri")
- [x] `GET /api/me` (dari Commit 2), `POST /api/pekan/bootstrap`
- [x] `GET /api/laporan/[id]`, `PATCH .../baris/[anggotaId]`, `POST .../submit`
- [x] `POST /api/laporan/[id]/koreksi` (+ diff dan alasan; izin Atasan Supervisor langsung)
- [x] `bootstrapPekan()` dipasang di `(app)/layout.tsx`
- [x] Uji unit `waktu.test.ts`, `laporan/aturan.test.ts`; smoke fase laporan (50/50)
- [x] `pnpm build` lulus

## Commit 4 — API klien, follow-up, iuran, admin

- [ ] `src/lib/klien/*`, `src/lib/iuran/*`, `src/lib/kepegawaian/*`
- [ ] `GET/POST /api/klien`, `POST /api/klien/[id]/alih` (Admin), follow-up per klien
- [ ] `GET/POST /api/pembayaran-iuran`; master `nominal-iuran`, `hasil-followup`
- [ ] `GET/POST /api/admin/karyawan`, `PATCH /api/admin/karyawan/[id]` (cegah siklus, pindah baris laporan, guard nonaktif)
- [ ] `GET /api/rekap/pekan/[id]`
- [ ] `scripts/seed.mts` (`@seed.local`, idempoten) + `--cleanup` berurutan
- [ ] `pnpm smoke` lengkap

## Commit 5 — UI

- [ ] `pnpm dlx shadcn@latest init` + `add button input label select textarea table badge dialog sonner alert card tabs`
- [ ] Route group `(auth)` dan `(app)`; `(app)/layout.tsx` gate sesi + `aktif` + `harus_ganti_password` + `bootstrapPekan()` + `Toaster`
- [ ] `/` login
- [ ] `/ganti-password`
- [ ] `/dashboard` (laporan saya + status anggota langsung)
- [ ] `/laporan/[id]` (auto-save per baris `onBlur`, kirim terkunci sampai lengkap, lampau read-only)
- [ ] `/laporan/[id]/koreksi` (atasan, alasan wajib)
- [ ] `/klien`, `/klien/[id]` (riwayat follow-up)
- [ ] `/iuran` (12 bulan + catat bayar)
- [ ] `/admin` (karyawan, master iuran, master hasil follow-up)
- [ ] Uji manual browser semua halaman

## Verifikasi akhir

- [ ] `scripts/smoke.mts`: seed-admin, login, sign-up publik ditolak, paksa ganti password
- [ ] `scripts/smoke.mts`: alur laporan → submit kosong ditolak → kirim → koreksi
- [ ] `scripts/smoke.mts`: follow-up & rekap, iuran (bulan depan 400, duplikat 409)
- [ ] `scripts/smoke.mts`: nonaktif dengan klien 400; alih klien non-admin 403; alih lalu nonaktif 200
- [ ] `scripts/smoke.mts`: IDOR (laporan, rekap, follow-up milik orang lain); format error `{ error: { code } }`
- [ ] Uji trigger transfer supervisor via SQL dalam transaksi rollback
- [ ] `scripts/seed.mts --cleanup` hanya menghapus baris `@seed.local`
- [ ] `pnpm build` lulus; smoke terhadap `pnpm start` (bukan `pnpm dev`)
- [ ] Uji bootstrap: buka dashboard setelah pekan berganti membuat Draf baru + catch-up pekan terlewat

## Commit 6 — Deploy Vercel Hobby + Neon Free

- [ ] `.env.local`: hapus `NEON_AUTH_*`, `NEON_FUNCTION_HELLO_BASE_URL`, cookie secret Neon
- [ ] Vercel: region `sin1`, runtime Node.js, tanpa cron/`vercel.json`
- [ ] Env Vercel: `DATABASE_URL_POOLED`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `ADMIN_EMAIL`
- [ ] Migrasi manual dari lokal dengan `DATABASE_URL_UNPOOLED` sebelum deploy; tidak ada migrasi di build
- [ ] `pnpm seed:admin` ke DB produksi, lalu login & ganti password
- [ ] Perbarui `README.md` dan `HANDOFF.md` (kuota Free, kebijakan non-komersial)
