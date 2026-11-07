# Todo: Aplikasi Pekanan

Detail rencana: `plan.md`. Aturan domain: `CONTEXT.md`.

## 1. Fondasi database

- [ ] `pnpm add better-auth`; `pnpm remove @neon/auth @neon/functions`; `pnpm add -D @better-auth/core @better-auth/drizzle-adapter`
- [ ] Tambah `BETTER_AUTH_SECRET` dan `ADMIN_EMAIL` ke `.env.local` (dokumentasikan di README)
- [ ] `drizzle.config.ts`: `tablesFilter` mengecualikan `neon_auth`
- [ ] `src/db/schema.ts`: tabel auth lokal (`user`, `session`, `account`, `verification`)
- [ ] `src/db/schema.ts`: `karyawan`, `pekan`, `laporan_pekan`, `laporan_anggota`, `koreksi_laporan`
- [ ] `src/db/schema.ts`: `nominal_iuran`, `pembayaran_iuran`, `hasil_followup`, `klien`, `followup`
- [ ] Migration: generate, lalu tambahkan trigger `retire_transferred_laporan`, unique parsial, CHECK
- [ ] Migration: `DROP TABLE IF EXISTS todos, visits`
- [ ] Uji migration di database (psql): tabel, trigger, unique parsial, CHECK

## 2. Auth lokal

- [ ] `src/lib/auth/server.ts`: `betterAuth` + `drizzleAdapter`, `validateSchema: false`
- [ ] `src/lib/auth/client.ts`: `better-auth/react`
- [ ] `src/app/api/auth/[...path]/route.ts`: `toNextJsHandler`
- [ ] Bootstrap admin via `ADMIN_EMAIL`; tolak sign-up mandiri lainnya
- [ ] `POST /api/admin/karyawan` (pra-uji jalur internal adapter) + flag `harus_ganti_password`
- [ ] `/ganti-password` dan redirect wajib
- [ ] `AuthPanel` ke bahasa Indonesia; sign-up dihapus
- [ ] Hapus scaffold: `todo-list.tsx`, `/api/todos`, `/api/ping-function`, `hello.ts`, `neon.ts`, `src/lib/functions.ts`, `scripts/verify-db.mts`; bersihkan `src/db/index.ts`

## 3. API domain

- [ ] `src/lib/auth/current.ts` (`requireKaryawan`, `isSupervisorOf`, `isAtasanOf`)
- [ ] `GET /api/me` dan `POST /api/pekan/bootstrap` (idempoten)
- [ ] `GET /api/laporan/[id]`, `PATCH .../baris/[anggotaId]`, `POST .../submit`
- [ ] `POST /api/laporan/[id]/koreksi` (+ simpan diff dan alasan)
- [ ] `GET/POST /api/klien`, `POST /api/klien/[id]/alih`, follow-up per klien
- [ ] `GET/POST /api/pembayaran-iuran`; master `nominal-iuran`, `hasil-followup`
- [ ] `GET/POST /api/admin/karyawan`, `PATCH /api/admin/karyawan/[id]` (cegah siklus, guard nonaktif)
- [ ] `GET /api/rekap/pekan/[id]`

## 4. UI

- [ ] `/` login
- [ ] `/dashboard` (laporan saya + status anggota langsung)
- [ ] `/laporan/[id]` (form per anggota, tombol kirim terkunci sampai lengkap)
- [ ] `/laporan/[id]/koreksi` (atasan, alasan wajib)
- [ ] `/klien`, `/klien/[id]` (riwayat follow-up)
- [ ] `/iuran` (12 bulan + catat bayar)
- [ ] `/admin` (karyawan, master iuran, master hasil follow-up)

## 5. Verifikasi

- [ ] `scripts/smoke.mts`: admin bootstrap, pembatalan sign-up, alur laporan → kirim → koreksi
- [ ] `scripts/smoke.mts`: follow-up & rekap, iuran (bulan depan 400, duplikat 409)
- [ ] `scripts/smoke.mts`: nonaktif dengan klien 400 setelah dialihkan 200
- [ ] Uji trigger transfer supervisor via SQL dalam transaksi rollback
- [ ] `pnpm build` lulus
- [ ] Uji manual browser semua halaman; submit kosong ditolak; laporan lampau read-only
- [ ] Perbarui `README.md` dan `HANDOFF.md`
