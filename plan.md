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

Target deploy final: **Vercel Hobby (Free) + Neon Free**, non-komersial/internal, seluruh aplikasi termasuk auth. Batasan yang mengikuti target itu:
- **Tanpa scheduler sama sekali.** Neon Functions (tersedia di Free: 10 active Capacity-Hours, 1M invocation/bulan) dan Function Triggers (cron per menit) serta pg_cron **sengaja tidak dipakai**; Vercel Hobby cron juga tidak dipakai (maks 1×/hari). Laporan Draf dibuat **lazy + catch-up** saat `POST /api/pekan/bootstrap` (lihat §3.4).
- Runtime Node.js (bukan Edge) karena `pg` + Better Auth password hashing. Hobby: 300 detik, 1 vCPU/2 GB, runtime log 1 jam.
- Hit Vercel region `sin1` (Singapore) agar dekat Neon `aws-ap-southeast-1`; pooled connection.
- Migrasi dijalankan **manual dari lokal** dengan `DATABASE_URL_UNPOOLED`; tidak ada migrasi otomatis saat build/deploy.
- `.neon` CLI tidak dipakai saat deploy Vercel.

## Fakta Environment (sudah diverifikasi)

- `drizzle-kit@0.31.11`: `tablesFilter` bertipe `string | string[]` (glob **nama tabel**) dan hanya berpengaruh pada `push`; `schemaFilter` bertipe `string | string[]` dan menentukan skema yang di-introspect/push. Tabel `neon_auth` bernama sama dengan tabel auth baru (`user`, `session`, …), jadi `tablesFilter` **tidak bisa** memisahkan keduanya → pakai `schemaFilter: ["public"]` dan hapus skrip `db:push`.
- `drizzle-kit generate` hanya menyentuh skema yang dideklarasikan di `schema.ts`; skema `neon_auth` tidak akan ikut di-drop selama tidak di-introspect dan `push` tidak dijalankan.
- `better-auth@1.7.17` sudah ada di `node_modules/.pnpm` (transitif `@neon/auth`) tetapi belum terpasang langsung.
- `better-auth/adapters/drizzle` tersedia (adapter tidak perlu paket terpisah). `better-auth/plugins/admin` tersedia dan menyediakan `createUser`, `setUserPassword`, `revokeUserSessions`, `setRole`, `banUser`.
- `emailAndPassword.disableSignUp?: boolean` dan `emailAndPassword.autoSignIn?: boolean` (default `true`) tersedia di `@better-auth/core@1.7.17` (`types/init-options.d.mts`).
- `databaseHooks.user/session/account.before` (create/update/delete) tersedia untuk menyisipkan profil `karyawan` dan mencegah login karyawan nonaktif.
- **Neon Managed Better Auth** (Free, 60k MAU) mendukung admin plugin tetapi **tidak** mendukung `databaseHooks`, `disableSignUp`, `autoSignIn: false`, atau `additionalFields` kustom → ditolak; tetap Better Auth lokal (ADR-0001).
- **pg_cron** hanya berjalan saat compute aktif (scale-to-zero Neon Free) → tidak dipakai.
- Vercel Hobby: cron minimal 1×/hari dengan presisi per jam; tidak dipakai karena lazy + catch-up.
- Node lokal tidak me-resolve `@neon/auth/next/server` di luar bundler Next → skrip uji memakai HTTP + Drizzle langsung.
- Akun lama `aku@kamu.com` / `apa@iya.com` tidak memiliki password yang diketahui; tidak dipakai.

## Reuse Kode yang Ada

| File | Perubahan |
|---|---|
| `src/db/index.ts` | Tetap pool `pg` (`DATABASE_URL_POOLED`, `max: 5` untuk Neon pooled); hapus `attachDatabasePool` |
| `src/db/schema.ts` | Ditulis ulang: tabel auth lokal + domain, dengan CHECK dan unique parsial **dideklarasikan di schema** |
| `src/lib/auth/server.ts` | `createNeonAuth` → `betterAuth({...})` + `drizzleAdapter` + plugin `admin` |
| `src/lib/auth/client.ts` | `@neon/auth/next` → `better-auth/react` + `adminClient` |
| `src/app/api/auth/[...path]/route.ts` | `toNextJsHandler(auth)` |
| `src/components/auth-panel.tsx` | Sign-in tetap; sign-up dihapus; pesan error Better Auth; bahasa Indonesia |
| `drizzle.config.ts` | Tambah `schemaFilter: ["public"]` |
| `scripts/smoke.mts` | Ditulis ulang e2e |
| `src/app/layout.tsx`, `src/app/page.tsx` | Lepas import `@neon/auth` / `@neon/functions` (satu commit dengan Task 2) |

## 1. Dependensi & Konfigurasi

- `pnpm add better-auth@1.7.17` (pin persis; plan bergantung on internal 1.7.x); `pnpm remove @neon/auth @neon/functions`; `pnpm add -D @better-auth/core@1.7.17`.
- **Urutan penting:** `@neon/auth` / `@neon/functions` baru dihapus **bersamaan** dengan perubahan `src/db/index.ts`, `src/lib/auth/*`, `auth-panel.tsx`, `page.tsx`, `layout.tsx` di Task 2 — kalau dihapus di Task 1, build Rusak. Task 1 hanya menambah.
- `.env.local` (dan Vercel Project Env): tambah `BETTER_AUTH_SECRET` (`openssl rand -base64 32`), `BETTER_AUTH_URL` (origin app, mis. `https://<proyek>.vercel.app`), `ADMIN_EMAIL`. Pastikan `DATABASE_URL_POOLED` (runtime) dan `DATABASE_URL_UNPOOLED` (migrasi lokal/CI) ada; jangan biarkan `neon env pull` menulis `DATABASE_URL` tanpa `_POOLED`.
- `drizzle.config.ts`: `schemaFilter: ["public"]`; hapus skrip `db:push` dan `neon:deploy` dari `package.json`.
- `src/db/index.ts`: `DATABASE_URL_POOLED`; hapus `attachDatabasePool`.
- `next.config.ts`: tidak perlu perubahan (`cacheComponents` tetap). Route handler auth dan domain dijalankan di Node runtime (default); jangan menambahkan `export const runtime = "edge"`.

## 2. Schema Drizzle (`src/db/schema.ts`)

Semua CHECK/enum dideklarasikan di schema (drizzle-kit 0.31 mendukung `check()` dan `uniqueIndex().where(...)`), sehingga snapshot dan SQL tidak melenceng. Trigger ditambahkan lewat `drizzle-kit generate --custom`.

### Auth lokal (Better Auth, skema `public`)
- `user`: `id` text PK, `name`, `email` unique, `emailVerified` boolean, `image`, `role` text default `"user"` (dikelola plugin admin: `adminRoles: ["admin"]`, `defaultRole: "user"`; **bukan** `additionalFields` — jangan bisa diinjeksi klien), `createdAt`, `updatedAt`, plus kolom plugin admin (`banned`, `banReason`, `banExpires`).
- `session`: `id` PK, `expiresAt`, `token` unique, `ipAddress`, `userAgent`, `userId` FK→user cascade, `impersonatedBy` (admin plugin), timestamps.
- `account`: `id` PK, `accountId`, `providerId`, `userId` FK cascade, `accessToken`, `refreshToken`, `idToken`, `accessTokenExpiresAt`, `refreshTokenExpiresAt`, `scope`, `password`, timestamps; unique `(providerId, accountId)`.
- `verification`: `id`, `identifier`, `value`, `expiresAt`, timestamps; unique `(identifier, value)`.
- Daftar kolom wajib persis sesuai yang diminta Better Auth (`npx @better-auth/cli generate` sebagai referensi) — `validateSchema` dibiarkan **aktif** (§3).

### Domain
- `karyawan`: uuid PK, `user_id` FK→user unique, `nama`, `level` (`Magang`|`Tetap`), `supervisor_id` FK self (nullable), `aktif` default true, `harus_ganti_password` default true, timestamps. CHECK `supervisor_id <> id`.
- `pekan`: uuid PK, `mulai` date unique, `selesai` date. CHECK `extract(dow from mulai) = 0` dan `selesai = mulai + 6`.
- `laporan_pekan`: uuid PK, `pekan_id` FK, `supervisor_id` FK→karyawan, `status` (`Draf`|`Terkirim`|`Dikoreksi`), `submitted_at`, `deleted_at`; unique parsial `(supervisor_id, pekan_id) where deleted_at is null`.
- `laporan_anggota`: uuid PK, `laporan_id` FK cascade, `anggota_id` FK, `kehadiran`, `keterangan_hadir`, `media_online` int, `media_offline` int, `one_on_one`, `keterangan_one_on_one`; unique `(laporan_id, anggota_id)`; CHECK media ≥ 0; CHECK `kehadiran` ∈ 5 nilai; CHECK `one_on_one` ∈ 3 nilai. NULL di DB; "wajib" ditegakkan saat submit.
- `koreksi_laporan`: uuid PK, `laporan_id` FK, `korektor_id` FK→karyawan, `alasan` not null, `sebelum` jsonb, `sesudah` jsonb, `created_at`.
- `nominal_iuran`: uuid PK, `nama`, `nominal` int CHECK ≥ 0, `aktif`, `created_at`.
- `pembayaran_iuran`: uuid PK, `karyawan_id` FK, `bulan` date, `nominal_iuran_id` FK, `tanggal_bayar`, `pencatat_id` FK→karyawan, `created_at`; unique `(karyawan_id, bulan)`; CHECK `bulan = date_trunc('month', bulan)`; CHECK `bulan <= (now() AT TIME ZONE 'Asia/Jakarta')::date`.
- `hasil_followup`: uuid PK, `nama`, `urutan`, `aktif`.
- `klien`: uuid PK, `karyawan_id` FK→karyawan (pemilik), `nama`, `kontak`, `created_at`.
- `followup`: uuid PK, `klien_id` FK, `tanggal` date, `hasil_followup_id` FK, `deskripsi`, `created_by` FK→karyawan, `created_at`. CHECK `tanggal <= (now() AT TIME ZONE 'Asia/Jakarta')::date` (bukan `current_date`, yang memakai TZ sesi UTC Neon).

Index: `karyawan(supervisor_id)`, `followup(klien_id, tanggal)`, `followup(created_by, tanggal)`, unique parsial laporan.

Helper tunggal `src/lib/waktu.ts` (WIB): `pekanWIB(date)`, `awalPekan`, `pekanBerjalan`, `bulanBerjalan` — semua perhitungan memakai `Asia/Jakarta`, tidak ada aritmetika tanggal di tempat lain.

### Trigger & pemindahan supervisor

Aplikasi tidak pernah melakukan `UPDATE laporan_pekan.supervisor_id` (laporan terikat pada supervisor yang menulisnya; perpindahan Anggota tercermin di `karyawan.supervisor_id` dan di baris Draf berikutnya). Maka:
- Trigger `retire_transferred_laporan()` **tetap dibuat** sebagai pengaman (ADR-0002): BEFORE UPDATE OF `supervisor_id`, hanya mengisi `NEW.deleted_at = now()` bila target sudah punya baris hidup untuk `pekan_id` yang sama (dicek dengan `SELECT … FOR UPDATE`); tidak pernah menghapus/mengosongkan.
- ADR-0002 **direvisi**: hapus kalimat "Draf pekan berjalan dulu dikirim ke Atasan Supervisor" (bertentangan dengan **Mengisi Sendiri**), dan `move_karyawan()` tidak diimplementasikan sebagai fungsi SQL; logika perpindahan ada di `PATCH /api/admin/karyawan/[id]` (§4).

## 3. Auth

### 3.1 Konfigurasi
- `betterAuth({ secret: env.BETTER_AUTH_SECRET, baseURL: env.BETTER_AUTH_URL, database: drizzleAdapter(db, { provider: "pg", schema }), emailAndPassword: { enabled: true, autoSignIn: false, disableSignUp: true, minPasswordLength: 8 }, user: { additionalFields: { role: { type: "string", input: false, defaultValue: "user" } } }, plugins: [admin({ adminRoles: ["admin"], defaultRole: "user" })], databaseHooks })`.
  - `autoSignIn: false` wajib: pembuatan akun oleh admin tidak boleh mengganti cookie sesi admin.
  - `disableSignUp: true` untuk sign-up publik; bootstrap admin memakai jalur internal (3.2).
- Plugin `admin` dipakai **tanpa** access-control penuh; otorisasi tetap di helper aplikasi (§4). `nextCookies()` dipasang **terakhir** di plugin agar `auth.api.*` dari server action/route bisa menulis cookie.
- `databaseHooks.user.create.before/after`: simpan `karyawan` (nama, level, supervisor) dari payload; tolak bila tidak ada level/supervisor valid. `databaseHooks.session.create.before`: tolak sesi untuk `karyawan.aktif = false` atau `user.banned`.
- **Session validate:** helper `requireKaryawan()` (§4) cek `aktif` + `harus_ganti_password` di setiap request API (DB read per request; pool Neon di-cache di `globalThis`).

### 3.2 Bootstrap admin
- Rute `POST /api/auth/bootstrap` (satu-satunya jalur sign-up):
  1. Validasi `email === ADMIN_EMAIL`.
  2. Dalam transmisi `pg_advisory_xact_lock` + cek "belum ada user role admin", panggil `auth.api.createUser` (plugin admin) untuk admin, lalu set `role = "admin"`.
  3. Setelah admin ada, setiap percobaan sign-up/bootstrap ditolak (`403`). Sign-up publik tetap `disableSignUp` → `404`/`SIGN_UP_DISABLED`.
  4. Admin dibuat dengan `emailVerified = true` (tidak ada verifikasi email di deploy ini; tanpa SMTP).
  5. Admin juga mendapat `karyawan` level `Tetap`, supaya Admin Perhimpunan memenuhi definisi CONTEXT (Karyawan Tetap).
- Admin membuat karyawan: `POST /api/admin/karyawan` → `auth.api.createUser` (password awal) → set `karyawan.harus_ganti_password = true`. **Tidak** memakai `signUpEmail` (tidak ada efek sesi).

### 3.3 Ganti password wajib
- Flag `harus_ganti_password` di `karyawan`. Helper `requireKaryawan()` melempar `403 PASSWORD_CHANGE_REQUIRED` untuk semua endpoint selain `GET /api/me`, `POST /api/auth/change-password`, `POST /api/auth/sign-out`.
- Setelah `changePassword` sukses (hook `after` pada endpoint), reset flag + `revokeUserSessions` untuk sesi lain. UI `/ganti-password` hanya kenyamanan; enforcement di API.

### 3.4 Pembuatan Laporan Draf (lazy + catch-up)
- `POST /api/pekan/bootstrap`:
  1. Tentukan pekan WIB sekarang; buat baris `pekan` bila belum ada.
  2. Untuk user yang login (supervisor aktif dengan ≥1 Anggota Langsung), buat Draf untuk pekan berjalan via `ON CONFLICT (supervisor_id, pekan_id) WHERE deleted_at IS NULL DO NOTHING`; isi `laporan_anggota` untuk setiap Anggota Langsung **saat ini**.
  3. **Catch-up:** untuk setiap supervisor aktif, cari `MAX(pekan.selesai)` dari laporan terakhirnya; untuk setiap pekan yang sudah berakhir setelah tanggal itu dan belum punya laporan, buat Draf kosong + baris anggota (hanya bila supervisor punya anggota). Batas bawah ini menjaga biaya konstan.
  4. Idempoten. Dipanggil oleh layout shell `src/app/(app)/layout.tsx` (server action dalam `<Suspense>`) setiap kali halaman aplikasi dibuka, sehingga supervisor maupun Atasan yang membuka dashboard memicu pembuatan Draf.
- Konsekuensi yang diterima: Atasan baru melihat "Tidak Terkirim" setelah supervisor atau Atasan membuka aplikasi; tidak ada pembuatan Draf di latar belakang.

## 4. API (cek session → karyawan aktif)

Matriks otorisasi (semua endpoint wajib `requireKaryawan()` = aktif + password sudah diganti):

| Endpoint | Siapa |
|---|---|
| `GET /api/me` | user sendiri |
| `POST /api/pekan/bootstrap` | user login |
| `GET /api/laporan/[id]` | pemilik (`supervisor_id` = saya) **atau** Atasan Supervisor langsung pemilik |
| `PATCH /api/laporan/[id]/baris/[anggotaId]` | pemilik saja, status `Draf`, pekan berjalan, baris `anggota_id` harus ada di `laporan_anggota` milik laporan itu |
| `POST /api/laporan/[id]/submit` | pemilik saja, status `Draf`, pekan berjalan, semua nilai wajib terisi |
| `POST /api/laporan/[id]/koreksi` | Atasan Supervisor langsung pemilik; laporan pekan lampau; alasan wajib; boleh laporan `Draf` ("Tidak Terkirim"), `Terkirim`, `Dikoreksi`; satu transaksi: tulis `koreksi_laporan` + diff `sebelum/sesudah` + set `status = 'Dikoreksi'` |
| `GET/POST /api/klien` | klien milik saya; `POST` pemilik = saya |
| `POST /api/klien/[id]/alih` | **Admin**: body `{keKaryawanId}`; target harus `aktif`; wajib dipanggil sebelum nonaktif (guard di §4 admin) |
| `GET /api/klien/[id]/followup` | pemilik klien atau Atasan Supervisor langsung pemilik klien |
| `POST /api/klien/[id]/followup` | pemilik klien; `tanggal` ≤ hari ini WIB; `hasil_followup_id` aktif |
| `GET/POST /api/pembayaran-iuran` | `GET`: saya atau supervisor langsung saya; `POST`: saya sendiri atau supervisor langsung saya atas nama saya; `bulan` ≤ bulan berjalan; duplikat `(karyawan, bulan)` → 409 |
| `GET/POST /api/nominal-iuran`, `/api/hasil-followup` | `GET` user login; `POST` Admin |
| `GET/POST /api/admin/karyawan`, `PATCH /api/admin/karyawan/[id]` | Admin |
| `GET /api/rekap/pekan/[id]` | saya bila laporan terkait, Atasan Supervisor, atau Admin |

`PATCH /api/admin/karyawan/[id]` wajib:
- Cegah siklus supervisor (CTE rekursif, di bawah `pg_advisory_xact_lock`).
- Supervisor harus `aktif` dan (bila karyawan `Magang`) supervisor harus `Tetap`.
- Demote `Tetap` → `Magang` ditolak bila masih membimbing Magang.
- Nonaktif hanya bila: tidak punya Anggota (`karyawan.supervisor_id = id`) **dan** tidak punya Klien; kalau masih punya, `400` dengan petunjuk tindakan (alih klien dulu via §4 alih). Setelah nonaktif: `revokeUserSessions`.
- **Ganti `supervisor_id`** (kasus perpindahan): pindahkan baris `laporan_anggota` ke Draf pekan berjalan supervisor baru (buat `laporan_pekan` Draf baru bila belum ada), dan hapus baris kosong di Draf lama (baris yang sudah terisi tetap dipertahankan di laporan lama, sesuai CONTEXT).

Helper `src/lib/auth/current.ts`: `requireKaryawan()`, `requireAdmin()`, `isSupervisorOf(karyawanId)`, `isAtasanOf(supervisorKaryawanId)`, `assertTidakCeklik`.

## 5. UI

- `/` login · `/ganti-password` · `/dashboard` · `/laporan/[id]` · `/laporan/[id]/koreksi` · `/klien` · `/klien/[id]` · `/iuran` · `/admin`.
- Shell `src/app/(app)/layout.tsx` memicu `POST /api/pekan/bootstrap` lewat server action di dalam `<Suspense>` pada setiap load halaman aplikasi (idempoten).
- Cache Components: tidak ada `dynamic = "force-dynamic"`; data via server component di dalam `<Suspense>` dengan `await connection()`.
- `/laporan/[id]`: tombol Kirim disabled selama ada nilai kosong atau submit API gagal (server-side guard tetap ada). Laporan pekan lampau read-only untuk pemilik.

## 6. Hapus Scaffold

Hapus `src/components/todo-list.tsx`, `src/app/api/todos/`, `src/app/api/ping-function/`, `src/lib/functions.ts`, `scripts/verify-db.mts`, `hello.ts`/`neon.ts` dari `@neon/functions`, dan `@neon/auth` references.
`DROP TABLE IF EXISTS todos, visits;` dihasilkan otomatis saat `schema.ts` tidak lagi mendeklarasikannya — **jangan** ditulis ulang manual di migration terpisah.

## 7. Uji

`scripts/smoke.mts` (HTTP + Drizzle langsung, tanpa import modul auth):
- bootstrap admin: sukses sekali, percobaan kedua 403; sign-up publik ditolak.
- admin buat karyawan; password awal tidak bisa akses API (403 `PASSWORD_CHANGE_REQUIRED`) sampai ganti password.
- alur laporan: bootstrap → isi baris → submit kosong ditolak → isi lengkap → submit → ubah setelah submit ditolak → koreksi oleh atasan (alasan kosong ditolak; non-atasan 403).
- follow-up: tanggal besok ditolak; rekap menghitung jumlah kejadian, bukan angka manual.
- iuran: bulan depan ditolak; duplikat 409; supervisor langsung boleh mencatat untuk anggota; supervisor tidak langsung 403.
- nonaktif dengan klien/anggota 400; alih klien oleh non-admin 403; alih klien lalu nonaktif 200.
- trigger: `UPDATE laporan_pekan SET supervisor_id` ke target yang sudah punya baris hidup → baris lama ber-`deleted_at`, target utuh (dalam transaksi + rollback).
- IDOR: akses laporan/rekap/follow-up orang lain → 403/404.

`pnpm build` lulus. Smoke dijalankan terhadap `pnpm start` (bukan `pnpm dev`) agar perilaku menyerupai build produksi. Uji manual browser semua halaman (golden path + edge: submit kosong, laporan lampau read-only, ganti password paksa, Draf baru setelah pekan berganti).

## Verifikasi

```bash
set -a && . ./.env.local && set +a && pnpm db:generate && pnpm db:migrate
pnpm build
pnpm start &            # bukan pnpm dev
pnpm exec tsx scripts/smoke.mts
```

## 8. Deploy Vercel Hobby + Neon Free (non-komersial)

- **Vercel**: Framework Next.js, runtime Node.js, region **`sin1`**, tanpa cron, tanpa `vercel.json` khusus.
- **Env Vercel** (Production + Preview): `DATABASE_URL_POOLED`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `ADMIN_EMAIL`. `DATABASE_URL_UNPOOLED` tidak dipakai runtime.
- **Neon**: branch produksi di `aws-ap-southeast-1`; runtime memakai pooled URL. Scale-to-zero 5 menit (cold start ratusan ms, diterima).
- **Migrasi**: jalankan manual dari lokal dengan `DATABASE_URL_UNPOOLED` **sebelum** deploy/merge. Tidak ada `pnpm db:migrate` di build Vercel.
- **Bersihkan env Neon Auth**: hapus `NEON_AUTH_*`, `NEON_FUNCTION_HELLO_BASE_URL`, cookie secret Neon dari `.env.local` dan Vercel setelah auth lokal aktif.
- **Kuota Free**: 1 GB storage/project, 100 CU-hours/project/bulan, egress 5 GB/project; logs Vercel 1 jam → `console.log` seminimal mungkin.
- **Kebijakan**: Hobby hanya untuk non-komersial (dikonfirmasi). Bila berubah, upgrade Pro tanpa perubahan kode.
- Deploy pertama: migrasi → deploy → buka `/` → bootstrap admin dengan `ADMIN_EMAIL`.
