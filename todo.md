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

- [x] `src/lib/klien/*`, `src/lib/iuran/*`, `src/lib/kepegawaian/*`
- [x] `GET/POST /api/klien`, `POST /api/klien/[id]/alih` (Admin), follow-up per klien
- [x] `GET/POST /api/pembayaran-iuran`; master `nominal-iuran`, `hasil-followup`
- [x] `GET/POST /api/admin/karyawan`, `PATCH /api/admin/karyawan/[id]` (cegah siklus, pindah baris laporan, guard nonaktif)
- [x] `GET /api/rekap/pekan/[id]`
- [x] `scripts/seed.mts` (`@seed.local`, idempoten) + `--cleanup` berurutan
- [x] `pnpm smoke` lengkap (77/77) + `pnpm test` 28/28 + `pnpm build` lulus

## Commit 5 — UI

- [x] `pnpm dlx shadcn@latest init` + `add button input label select textarea table badge dialog sonner alert card tabs`
- [x] Route group `(auth)` dan `(app)`; `(app)/layout.tsx` gate sesi + `aktif` + `harus_ganti_password` + `bootstrapPekan()` + `Toaster`
- [x] `/` login
- [x] `/ganti-password`
- [x] `/dashboard` (laporan saya + status anggota langsung)
- [x] `/laporan/[id]` (auto-save per baris `onBlur`, kirim terkunci sampai lengkap, lampau read-only)
- [x] `/laporan/[id]/koreksi` (atasan, alasan wajib)
- [x] `/klien`, `/klien/[id]` (riwayat follow-up)
- [x] `/iuran` (12 bulan + catat bayar)
- [x] `/admin` (karyawan, master iuran, master hasil follow-up)
- [x] Uji manual browser semua halaman (`pnpm start` + Playwright, semua OK; lihat HANDOFF)
- [x] Perbaikan dari uji browser: `UPDATE ... ON CONFLICT` ilegal di `pindahkanBarisDraf`; `revokeUserSessions` tanpa header admin (401) saat nonaktifkan

## Verifikasi akhir

- [x] `scripts/smoke.mts`: seed-admin, login, sign-up publik ditolak, paksa ganti password
- [x] `scripts/smoke.mts`: alur laporan → submit kosong ditolak → kirim → koreksi
- [x] `scripts/smoke.mts`: follow-up & rekap, iuran (bulan depan 400, duplikat 409)
- [x] `scripts/smoke.mts`: nonaktif dengan klien 400; alih klien non-admin 403; alih lalu nonaktif 200
- [x] `scripts/smoke.mts`: IDOR (laporan, rekap, follow-up milik orang lain); format error `{ error: { code } }`
- [ ] Uji trigger transfer supervisor via SQL dalam transaksi rollback — **diverifikasi sekali via psql di Commit 1; belum ada skrip tersimpan** (`scripts/test-db.mts` tidak pernah ditulis)
- [x] `scripts/seed.mts --cleanup` hanya menghapus baris `@seed.local` (dibatasi `id KaryawanSeed` + array nama master seed)
- [x] `pnpm build` lulus; smoke terhadap `pnpm start` (bukan `pnpm dev`)
- [x] Uji bootstrap: buka dashboard setelah pekan berganti membuat Draf baru + catch-up pekan terlewat (lewat smoke; belum dicoba manual di browser pada pergantian pekan nyata)

## Commit 8 — Halaman ganti password mandiri

- [x] `/akun` di shell `(app)` — form ganti password kapan saja, tidak menunggu `harus_ganti_password`
- [x] Nama di header menjadi tautan ke `/akun` (satu-satunya titik masuk; `/ganti-password` tetap khusus paksa ganti)
- [x] Pesan `INVALID_PASSWORD` Better Auth diterjemahkan ("Password saat ini salah.")
- [x] Uji browser 12/12 (`/tmp/pw/akun.mjs`: salah password, ulangi beda, ganti sukses, password lama mati, sesi lain dicabut) + `pnpm test` 28/28 + `pnpm build` lulus

## Commit 7 — Layar Rekap Atasan

- [x] `daftarRekapAnggota` di `src/lib/kepegawaian/queries.ts` (laporan Anggota Langsung, lintas pekan)
- [x] `/rekap` — daftar laporan anggota (supervisor, pekan, status, terisi)
- [x] `/rekap/[pekanId]` — ringkasan + rincian anggota via `getRekapPekan`; pekan asing / non-UUID → 404
- [x] Tautan "Rekap" di `nav-utama`
- [x] Uji browser 14/14 (`/tmp/pw/rekap.mjs`) + `pnpm test` 28/28 + `pnpm build` lulus

## Commit 6 — Deploy Vercel Hobby + Neon Free

- [x] `.env.local`: hapus `NEON_AUTH_*`, `NEON_FUNCTION_HELLO_BASE_URL`, cookie secret Neon
- [x] Vercel: region `sin1`, runtime Node.js, tanpa cron/`vercel.json` (live: https://pekanan.vercel.app; cek region di dashboard)
- [x] Env Vercel: `DATABASE_URL_POOLED`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `ADMIN_EMAIL`
- [x] Migrasi manual dari lokal dengan `DATABASE_URL_UNPOOLED` sebelum deploy; tidak ada migrasi di build
- [ ] Login produksi & **ganti password admin** (password lama publik di riwayat git)
- [x] Perbarui `README.md` dan `HANDOFF.md` (kuota Free, kebijakan non-komersial)
- [ ] Bersihkan data uji di DB produksi (butuh permintaan eksplisit pengguna; backup sudah ada)
