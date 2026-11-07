# Todo: Aplikasi Pekanan

Detail rencana: `plan.md`. Aturan domain: `CONTEXT.md`. Target deploy: Vercel Hobby (non-komersial) + Neon Free (lihat `plan.md` §8).

## 1. Fondasi database

- [ ] `pnpm add better-auth@1.7.17`; `pnpm add -D @better-auth/core@1.7.17` (belum remove `@neon/*`)
- [ ] Tambah `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `ADMIN_EMAIL` ke `.env.local` (dokumentasikan di README)
- [ ] `drizzle.config.ts`: `schemaFilter: ["public"]`; hapus skrip `db:push` dan `neon:deploy`
- [ ] `src/db/schema.ts`: tabel auth lokal (`user`, `session`, `account`, `verification`) + kolom plugin admin
- [ ] `src/db/schema.ts`: `karyawan`, `pekan`, `laporan_pekan`, `laporan_anggota`, `koreksi_laporan`
- [ ] `src/db/schema.ts`: `nominal_iuran`, `pembayaran_iuran`, `hasil_followup`, `klien`, `followup`
- [ ] CHECK/enum & unique parsial dideklarasikan di schema (media ≥ 0, tanggal WIB, bulan awal bulan)
- [ ] `src/lib/waktu.ts` helper WIB (`pekanWIB`, `pekanBerjalan`, `bulanBerjalan`)
- [ ] Migration: generate, lalu `generate --custom` untuk trigger `retire_transferred_laporan`
- [ ] Revisi ADR-0002 (hapus "auto-kirim Draf", tanpa `move_karyawan()`)
- [ ] Uji migration di database (psql): tabel, trigger, unique parsial, CHECK; `DROP todos, visits` otomatis

## 2. Auth lokal

- [ ] `src/lib/auth/server.ts`: `betterAuth` + `drizzleAdapter`, `disableSignUp`, `autoSignIn: false`, plugin `admin`, `nextCookies()`
- [ ] `databaseHooks`: buat `karyawan` saat user dibuat; tolak sesi karyawan nonaktif/banned
- [ ] `src/lib/auth/client.ts`: `better-auth/react` + `adminClient`
- [ ] `src/app/api/auth/[...path]/route.ts`: `toNextJsHandler`
- [ ] `POST /api/auth/bootstrap` (hanya `ADMIN_EMAIL`, advisory lock, sekali saja)
- [ ] `POST /api/admin/karyawan` via `auth.api.createUser` + `harus_ganti_password = true`
- [ ] Enforcement `PASSWORD_CHANGE_REQUIRED` di helper + `/ganti-password` + revoke sesi lain
- [ ] Hapus `@neon/auth`, `@neon/functions` **bersamaan** dengan update `src/db/index.ts`, `page.tsx`, `layout.tsx`, `auth-panel.tsx`
- [ ] Hapus scaffold: `todo-list.tsx`, `/api/todos`, `/api/ping-function`, `src/lib/functions.ts`, `scripts/verify-db.mts`

## 3. API domain

- [ ] `src/lib/auth/current.ts` (`requireKaryawan`, `requireAdmin`, `isSupervisorOf`, `isAtasanOf`)
- [ ] `GET /api/me` dan `POST /api/pekan/bootstrap` (Draf pekan berjalan + catch-up sejak `MAX(pekan.selesai)` laporan terakhir, idempoten)
- [ ] Shell `src/app/(app)/layout.tsx` memicu bootstrap via server action dalam `<Suspense>`
- [ ] `GET /api/laporan/[id]`, `PATCH .../baris/[anggotaId]`, `POST .../submit`
- [ ] `POST /api/laporan/[id]/koreksi` (+ diff dan alasan; izin Atasan Supervisor langsung)
- [ ] `GET/POST /api/klien`, `POST /api/klien/[id]/alih` (Admin), follow-up per klien
- [ ] `GET/POST /api/pembayaran-iuran`; master `nominal-iuran`, `hasil-followup`
- [ ] `GET/POST /api/admin/karyawan`, `PATCH /api/admin/karyawan/[id]` (cegah siklus, pindah baris laporan, guard nonaktif)
- [ ] `GET /api/rekap/pekan/[id]`

## 4. UI

- [ ] `/` login
- [ ] `/ganti-password`
- [ ] `/dashboard` (laporan saya + status anggota langsung)
- [ ] `/laporan/[id]` (form per anggota, tombol kirim terkunci sampai lengkap, lampau read-only)
- [ ] `/laporan/[id]/koreksi` (atasan, alasan wajib)
- [ ] `/klien`, `/klien/[id]` (riwayat follow-up)
- [ ] `/iuran` (12 bulan + catat bayar)
- [ ] `/admin` (karyawan, master iuran, master hasil follow-up)

## 5. Verifikasi

- [ ] `scripts/smoke.mts`: bootstrap admin (sekali), sign-up publik ditolak, paksa ganti password
- [ ] `scripts/smoke.mts`: alur laporan → submit kosong ditolak → kirim → koreksi
- [ ] `scripts/smoke.mts`: follow-up & rekap, iuran (bulan depan 400, duplikat 409)
- [ ] `scripts/smoke.mts`: nonaktif dengan klien 400; alih klien non-admin 403; alih lalu nonaktif 200
- [ ] `scripts/smoke.mts`: IDOR (laporan, rekap, follow-up milik orang lain)
- [ ] Uji trigger transfer supervisor via SQL dalam transaksi rollback
- [ ] `pnpm build` lulus; smoke dijalankan terhadap `pnpm start` (bukan `pnpm dev`)
- [ ] Uji manual browser semua halaman; submit kosong ditolak; laporan lampau read-only
- [ ] Uji bootstrap: buka dashboard setelah pekan berganti membuat Draf baru + catch-up pekan terlewat
- [ ] Perbarui `README.md` dan `HANDOFF.md`

## 6. Deploy Vercel Hobby + Neon Free

- [ ] `.env.local`: hapus `NEON_AUTH_*`, `NEON_FUNCTION_HELLO_BASE_URL`, cookie secret Neon
- [ ] Vercel: region `sin1`, runtime Node.js, tanpa cron/`vercel.json`
- [ ] Env Vercel: `DATABASE_URL_POOLED`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `ADMIN_EMAIL`
- [ ] Migrasi manual dari lokal dengan `DATABASE_URL_UNPOOLED` sebelum deploy; tidak ada migrasi di build
- [ ] Deploy pertama: bootstrap admin dengan `ADMIN_EMAIL`, uji login & ganti password
- [ ] Catat kuota Free (1 GB storage, 100 CU-hours/bulan, 5 GB egress) dan kebijakan non-komersial di README
