# Plan: Aplikasi Pekanan

## Context

Aplikasi Next.js 16 di proyek ini masih berupa scaffold (todos, auth lewat proxy Neon Auth, Neon Function `hello`). Aplikasi yang akan dibangun mencatat kinerja pekanan tim penjualan: Supervisor mengisi **Laporan Pekan** tiap pekan (kehadiran meeting, sebar media online/offline, one-on-one per Anggota Langsung), **Atasan Supervisor** dapat mengoreksi laporan pekan lampau, sementara **Klien + Follow-up** dan **Pembayaran Iuran** dicatat lintas-pekan/bulanan.

Sumber kebenaran aturan domain: `CONTEXT.md`. Keputusan berat tercatat di `docs/adr/`:
- `0001-sesi-auth-dilayani-better-auth-lokal.md`
- `0002-keunikan-laporan-per-pekan-dijaga-trigger.md`

Keputusan tambahan dari sesi perencanaan:
- Admin pertama ditentukan env `ADMIN_EMAIL`; sign-up dengan email itu menjadi admin.
- Setelah admin pertama ada, **sign-up mandiri ditolak**; akun dibuat admin (nama, email, password awal, level, supervisor) dan karyawan wajib ganti password saat login pertama.
- Scaffold lama dihapus total (todos, visits, `/api/todos`, TodoList, `/api/ping-function`, `hello.ts`, `neon.ts`, `src/lib/functions.ts`, `scripts/verify-db.mts`, `@neon/functions`).
- UI berbahasa Indonesia.

## Fakta Environment (sudah diverifikasi)

- `drizzle-kit` membaca skema `neon_auth`; **wajib** `tablesFilter` agar tidak pernah men-drop skema tersebut.
- `better-auth`, `@better-auth/core`, `@better-auth/drizzle-adapter` belum terpasang langsung → `pnpm add`/`pnpm add -D`.
- Better Auth 1.7.17 menuntut unique index tertentu pada tabel auth; tabel `neon_auth` lama tidak memenuhi → matikan `advanced.database.validateSchema` dan pra-uji.
- Node lokal tidak me-resolve `@neon/auth/next/server` di luar bundler Next → skrip uji memakai HTTP + Drizzle langsung, bukan import modul auth.
- Akun lama `aku@kamu.com` / `apa@iya.com` tidak memiliki password yang diketahui; tidak dipakai.

## Reuse Kode yang Ada

| File | Perubahan |
|---|---|
| `src/db/index.ts` | Tetap pool `pg`; hapus `attachDatabasePool` |
| `src/db/schema.ts` | Ditulis ulang: tabel auth lokal + domain |
| `src/lib/auth/server.ts` | `createNeonAuth` → `betterAuth({...})` + `drizzleAdapter` |
| `src/lib/auth/client.ts` | `@neon/auth/next` → `better-auth/react` |
| `src/app/api/auth/[...path]/route.ts` | `auth.handler()` → `toNextJsHandler(auth)` |
| `src/components/auth-panel.tsx` | Sign-in tetap; sign-up dihapus; pesan error Better Auth; bahasa Indonesia |
| `drizzle.config.ts` | Tambah `tablesFilter` |
| `scripts/smoke.mts` | Ditulis ulang e2e |

## 1. Dependensi & Konfigurasi

- `pnpm add better-auth`; `pnpm remove @neon/auth @neon/functions`; `pnpm add -D @better-auth/core @better-auth/drizzle-adapter`.
- `.env.local`: tambah `BETTER_AUTH_SECRET` dan `ADMIN_EMAIL`.
- `drizzle.config.ts`: `tablesFilter: (all) => all.filter((t) => !t.startsWith("neon_auth"))`.
- `src/db/index.ts`: pakai `DATABASE_URL_POOLED`; hapus `attachDatabasePool`.

## 2. Schema Drizzle (`src/db/schema.ts`)

### Auth lokal (Better Auth, skema `public`)
- `user`: `id` text PK, `name`, `email` unique, `emailVerified`, `image`, `role` default `"user"`, timestamps.
- `session`: `id` PK, `expiresAt`, `token` unique, `ipAddress`, `userAgent`, `userId` FK→user, timestamps.
- `account`: `id` PK, `accountId`, `providerId`, `userId` FK, field token, `password`, timestamps; unique `(providerId, accountId)`.
- `verification`: `id`, `identifier`, `value`, `expiresAt`, timestamps; unique `(identifier, value)`.

### Domain
- `karyawan`: uuid PK, `user_id` FK→user unique, `nama`, `level` (`Magang`|`Tetap`), `supervisor_id` FK self (nullable), `aktif`, `harus_ganti_password`, timestamps. Magang wajib supervisor Tetap (ditegakkan aplikasi).
- `pekan`: uuid PK, `mulai` date unique (Minggu), `selesai` date (Sabtu).
- `laporan_pekan`: uuid PK, `pekan_id` FK, `supervisor_id` FK→karyawan, `status` (`Draf`|`Terkirim`|`Dikoreksi`), `submitted_at`, `deleted_at`; unique parsial `(supervisor_id, pekan_id) where deleted_at is null`.
- `laporan_anggota`: uuid PK, `laporan_id` FK cascade, `anggota_id` FK, `kehadiran`, `keterangan_hadir`, `media_online` int, `media_offline` int, `one_on_one`, `keterangan_one_on_one`; unique `(laporan_id, anggota_id)`; CHECK media ≥ 0. NULL di DB; "wajib" ditegakkan saat submit.
- `koreksi_laporan`: uuid PK, `laporan_id` FK, `korektor_id`, `alasan` not null, `sebelum` jsonb, `sesudah` jsonb, `created_at`.
- `nominal_iuran`: uuid PK, `nama`, `nominal` int CHECK ≥ 0, `aktif`, `created_at`.
- `pembayaran_iuran`: uuid PK, `karyawan_id` FK, `bulan` date (tgl 1), `nominal_iuran_id` FK, `tanggal_bayar`, `pencatat_id` FK, `created_at`; unique `(karyawan_id, bulan)`.
- `hasil_followup`: uuid PK, `nama`, `urutan`, `aktif`.
- `klien`: uuid PK, `karyawan_id` FK (pemilik), `nama`, `kontak`, `created_at`.
- `followup`: uuid PK, `klien_id` FK, `tanggal` date CHECK ≤ `current_date`, `hasil_followup_id` FK, `deskripsi`, `created_by` FK, `created_at`.

Index: `karyawan(supervisor_id)`, `followup(klien_id, tanggal)`, unique parsial laporan.

**Trigger** `retire_transferred_laporan()` BEFORE UPDATE OF `supervisor_id` ON `laporan_pekan` — bila target sudah punya laporan hidup untuk `pekan_id` sama, isi `deleted_at`.

Migration: generate drizzle-kit lalu tambahkan SQL trigger dan CHECK secara manual ke file migration.

## 3. Auth

- `betterAuth({ secret, database: drizzleAdapter(db, { provider: "pg", schema }), emailAndPassword: { enabled: true, autoSignIn: true }, advanced: { database: { validateSchema: false } }, databaseHooks })`.
- Bootstrap admin: hanya email `ADMIN_EMAIL` bisa sign-up, dan hanya saat belum ada admin.
- Admin membuat akun karyawan lewat `POST /api/admin/karyawan` (jalur internal adapter — pra-uji dulu; alternatif signUpEmail dengan guard).
- Karyawan `harus_ganti_password` diarahkan ke `/ganti-password` sebelum dashboard.

## 4. API (cek session → karyawan aktif)

- `GET /api/me`; `POST /api/pekan/bootstrap` (idempoten, dipanggil saat dashboard dibuka).
- `GET /api/laporan/[id]`; `PATCH /api/laporan/[id]/baris/[anggotaId]` (pemilik, Draf, pekan berjalan); `POST /api/laporan/[id]/submit`; `POST /api/laporan/[id]/koreksi` (atasan saja, alasan wajib).
- `GET/POST /api/klien`; `POST /api/klien/[id]/alih`; `GET/POST /api/klien/[id]/followup` (tanggal ≤ hari ini WIB, hasil wajib).
- `GET/POST /api/pembayaran-iuran` (diri sendiri atau supervisor langsung; bulan ≤ berjalan; duplikat → 409).
- `GET/POST /api/nominal-iuran`, `GET/POST /api/hasil-followup` (POST admin).
- `GET/POST /api/admin/karyawan`, `PATCH /api/admin/karyawan/[id]` (cegah siklus supervisor; nonaktif hanya bila klien dialihkan).
- `GET /api/rekap/pekan/[id]`.

Helper `src/lib/auth/current.ts`: `requireKaryawan()`, `isSupervisorOf()`, `isAtasanOf()`.

## 5. UI

- `/` login; `/ganti-password`; `/dashboard`; `/laporan/[id]`; `/laporan/[id]/koreksi`; `/klien`; `/klien/[id]`; `/iuran`; `/admin`.

## 6. Hapus Scaffold

Hapus file terkait scaffolding, dan satu migration baru memuat `DROP TABLE IF EXISTS todos, visits` (keduanya hanya scaffold).

## 7. Uji

`scripts/smoke.mts` (HTTP): bootstrap admin, admin buat karyawan, alur laporan → kirim → koreksi, follow-up & rekap, iuran (validasi bulan/duplikat), larangan nonaktif dengan klien, trigger via SQL langsung.

Manual: golden path tiap halaman di browser + submit kosong ditolak + laporan lampau read-only.

## Verifikasi

```bash
set -a && . ./.env.local && set +a && pnpm db:generate && pnpm db:migrate
pnpm build
pnpm dev &   # atau pnpm start
pnpm exec tsx scripts/smoke.mts
```
