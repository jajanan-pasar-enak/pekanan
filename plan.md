# Plan: Aplikasi Pekanan

## Context

Aplikasi Next.js 16 di proyek ini masih berupa scaffold (todos, auth lewat proxy Neon Auth, Neon Function `hello`). Aplikasi yang akan dibangun mencatat kinerja pekanan tim penjualan: Supervisor mengisi **Laporan Pekan** tiap pekan (kehadiran meeting, sebar media online/offline, one-on-one per Anggota Langsung), **Atasan Supervisor** dapat mengoreksi laporan pekan lampau, sementara **Klien + Follow-up** dan **Pembayaran Iuran** dicatat lintas-pekan/bulanan.

Sumber kebenaran aturan domain: `CONTEXT.md`. Keputusan berat tercatat di `docs/adr/`:
- `0001-sesi-auth-dilayani-better-auth-lokal.md`
- `0002-keunikan-laporan-per-pekan-dijaga-trigger.md`
- `0003-admin-pertama-dibuat-skrip-lokal.md`

Keputusan tambahan dari sesi perencanaan:
- Admin pertama dibuat skrip lokal `scripts/seed-admin.mts` (ADR-0003); tidak ada route bootstrap HTTP.
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
| `scripts/smoke.mts` | Ditulis ulang e2e (fase auth sudah ada; laporan/klien/iuran menyusul) |
| `src/app/layout.tsx`, `src/app/page.tsx` | Lepas import `@neon/auth` / `@neon/functions` (satu commit dengan Task 2) |

## Arsitektur Kode (kesepakatan sesi arsitektur)

**Baca vs tulis**
- Halaman = Server Component yang memanggil `src/lib/<domain>/queries.ts` di dalam `<Suspense>` + `await connection()`.
- Mutasi = route handler `/api/*` yang dipanggil client component lewat `fetch`, lalu `router.refresh()`.
- Layout `(app)` memanggil `bootstrapPekan()` langsung dari server component (fungsi di `src/lib/pekan/bootstrap.ts`), bukan lewat HTTP.

**Batas impor (aturan keras)**
- Hanya `src/lib/<domain>/{queries,mutations}.ts` dan `src/lib/auth/*`, `scripts/*` yang boleh impor `@/db`.
- Route handler, komponen, dan halaman **tidak** boleh impor `db`/`schema` langsung. Tujuannya: kalau perlu lapisan repository di masa depan, hanya file-file ini yang disentuh. Tidak ada class/repository/DI sekarang.

**Struktur**
```
src/lib/
  http.ts                 # AppError, jsonOk, handle(), skema error
  waktu.ts                # helper WIB
  auth/{server,client,current}.ts
  laporan/{queries,mutations}.ts
  klien/{queries,mutations}.ts
  iuran/{queries,mutations}.ts
  kepegawaian/{queries,mutations}.ts   # karyawan, master, rekap
  pekan/bootstrap.ts                   # lazy + catch-up
src/app/
  (auth)/page.tsx                      # login
  (auth)/ganti-password/page.tsx
  (app)/layout.tsx                     # gate sesi + bootstrap + navigasi + Toaster
  (app)/dashboard/page.tsx
  (app)/laporan/[id]/page.tsx
  (app)/laporan/[id]/koreksi/page.tsx
  (app)/klien/page.tsx
  (app)/klien/[id]/page.tsx
  (app)/iuran/page.tsx
  (app)/admin/page.tsx
  api/...                              # tipis: parse zod -> panggil mutations -> JSON
src/components/
  ui/                                  # shadcn
  <form spesifik>.tsx                  # "use client"
```

**Validasi & error**
- `zod` untuk body tiap endpoint; skema tinggal di file route atau `mutations.ts` yang sama.
- `AppError(code, message, status)` dan `handle(fn)` di `src/lib/http.ts`:
  - `UNAUTHORIZED` 401, `FORBIDDEN` 403, `PASSWORD_CHANGE_REQUIRED` 403, `INACTIVE` 403,
    `NOT_FOUND` 404, `CONFLICT` 409, `VALIDATION` 400, `INTERNAL` 500.
- Sukses: `{ data }`; gagal: `{ error: { code, message, details? } }`.
- Pesan error berbahasa Indonesia, dibuat di satu tempat.

**Gate halaman**
- `(app)/layout.tsx`: `auth.api.getSession()` → redirect `/` bila tanpa sesi → `requireKaryawan()` → redirect `/ganti-password` bila flag aktif → render shell.
- Ini hanya kenyamanan; enforcement sebenarnya tetap di API (§3.3).

**State form**
- `useState` per form; tidak ada library state.
- Form laporan: auto-save per baris saat `onBlur` (`PATCH .../baris/[anggotaId]`), indikator "Tersimpan", tombol Kirim disabled bila ada nilai kosong (server juga menolak).
- Notifikasi sukses/gagal via `sonner` (`Toaster` di layout `(app)`).

**Penamaan**
- Domain memakai bahasa Indonesia (`laporan`, `pekan`, `koreksi`, `iuran`, `klien`, `alih`, `rekap`, tipe `Karyawan`, `LaporanPekan`, helper `requireKaryawan`).
- Infrastruktur memakai bahasa Inggris (`db`, `auth`, `queries`, `mutations`, `AppError`, `handle`, `router`).

## 1. Dependensi & Konfigurasi

- Runtime: `pnpm add better-auth@1.7.17 zod`; `pnpm add @radix-ui/* sonner clsx tailwind-merge class-variance-authority` (via shadcn nanti); **jangan** jadikan `better-auth` devDependency.
- Dev: `pnpm add -D @better-auth/core@1.7.17`.
- `pnpm remove @neon/auth @neon/functions` **bersamaan** dengan perubahan `src/db/index.ts`, `src/lib/auth/*`, `auth-panel.tsx`, `page.tsx`, `layout.tsx` di commit auth — kalau dihapus lebih dulu, build rusak.
- shadcn/ui: `pnpm dlx shadcn@latest init` + `add button input label select textarea table badge dialog sonner alert card tabs` pada commit UI; hasil di `src/components/ui/` dan `src/lib/utils.ts`.
- `.env.local` (dan Vercel Project Env): `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `ADMIN_EMAIL`, opsional `ADMIN_PASSWORD` untuk `seed-admin`. Pastikan `DATABASE_URL_POOLED` (runtime) dan `DATABASE_URL_UNPOOLED` (migrasi/seed lokal) ada; jangan biarkan `neon env pull` menulis `DATABASE_URL` tanpa `_POOLED`.
- `drizzle.config.ts`: `schemaFilter: ["public"]`.
- `src/db/index.ts`: `DATABASE_URL_POOLED`; hapus `attachDatabasePool`.
- `next.config.ts`: tidak perlu perubahan; jangan menambahkan `export const runtime = "edge"`.

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
  - `disableSignUp: true` untuk sign-up publik; akun hanya dibuat admin lewat `auth.api.createUser` (3.2).
- Plugin `admin` dipakai **tanpa** access-control penuh; otorisasi tetap di helper aplikasi (§4). `nextCookies()` dipasang **terakhir** di plugin agar `auth.api.*` dari server action/route bisa menulis cookie.
- `databaseHooks.user.create.before/after`: simpan `karyawan` (nama, level, supervisor) dari payload; tolak bila tidak ada level/supervisor valid. `databaseHooks.session.create.before`: tolak sesi untuk `karyawan.aktif = false` atau `user.banned`.
- **Session validate:** helper `requireKaryawan()` (§4) cek `aktif` + `harus_ganti_password` di setiap request API (DB read per request; pool Neon di-cache di `globalThis`).

### 3.2 Admin pertama (ADR-0003)
- Tidak ada route bootstrap HTTP.
- `scripts/seed-admin.mts`: baca `ADMIN_EMAIL` dan `ADMIN_PASSWORD` (prompt bila kosong); tolak bila sudah ada `user.role = 'admin'`; dalam satu transaksi buat `user` (`emailVerified = true`, `role = 'admin'`), `account` (hash Better Auth), `karyawan` (`level = 'Tetap'`, `harus_ganti_password = true`).
- Idempoten: bila admin sudah ada → keluar 0 tanpa perubahan.
- Admin membuat karyawan: `POST /api/admin/karyawan` → `auth.api.createUser` (dengan sesi admin) → `karyawan.harus_ganti_password = true`. **Tidak** memakai `signUpEmail` (tidak ada efek sesi).

### 3.3 Ganti password wajib
- Flag `harus_ganti_password` di `karyawan`. Helper `requireKaryawan()` melempar `403 PASSWORD_CHANGE_REQUIRED` untuk semua endpoint selain `GET /api/me`, `POST /api/auth/change-password`, `POST /api/auth/sign-out`.
- Setelah `changePassword` sukses (hook `after` pada endpoint), reset flag + `revokeUserSessions` untuk sesi lain. UI `/ganti-password` hanya kenyamanan; enforcement di API.

### 3.4 Pembuatan Laporan Draf (lazy + catch-up)
- `POST /api/pekan/bootstrap`:
  1. Tentukan pekan WIB sekarang; buat baris `pekan` bila belum ada.
  2. Untuk user yang login (supervisor aktif dengan ≥1 Anggota Langsung), buat Draf untuk pekan berjalan via `ON CONFLICT (supervisor_id, pekan_id) WHERE deleted_at IS NULL DO NOTHING`; isi `laporan_anggota` untuk setiap Anggota Langsung **saat ini**.
  3. **Catch-up:** untuk setiap supervisor aktif, cari `MAX(pekan.selesai)` dari laporan terakhirnya; untuk setiap pekan yang sudah berakhir setelah tanggal itu dan belum punya laporan, buat Draf kosong + baris anggota (hanya bila supervisor punya anggota). Batas bawah ini menjaga biaya konstan.
  4. Idempoten. Dipanggil `bootstrapPekan()` dari layout `(app)` pada setiap load halaman aplikasi, sehingga supervisor maupun Atasan yang membuka aplikasi memicu pembuatan Draf.
- Konsekuensi yang diterima: Atasan baru melihat "Tidak Terkirim" setelah supervisor atau Atasan membuka aplikasi; tidak ada pembuatan Draf di latar belakang.

## 4. API (cek session → karyawan aktif)

Matriks otorisasi (semua endpoint wajib `requireKaryawan()` = aktif + password sudah diganti):

| Endpoint | Siapa |
|---|---|
| `GET /api/me` | user sendiri |
| `POST /api/pekan/bootstrap` | user login (dipakai smoke; halaman memanggil `bootstrapPekan()` langsung) |
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
- Route group dan shell sesuai §Arsitektur Kode; `(app)/layout.tsx` menjalankan gate sesi + `aktif` + `harus_ganti_password` lalu bootstrap.
- shadcn/ui untuk semua kontrol (`Button`, `Input`, `Select`, `Table`, `Dialog`, `Badge`, `Card`, `Tabs`) + `sonner` untuk notifikasi; `Dialog` hanya untuk konfirmasi kirim laporan dan nonaktif karyawan.
- Cache Components: tidak ada `dynamic = "force-dynamic"`; data via server component di dalam `<Suspense>` dengan `await connection()`.
- `/laporan/[id]`: auto-save per baris `onBlur`; tombol Kirim disabled selama ada nilai kosong; laporan pekan lampau read-only untuk pemilik.
- Semua teks UI berbahasa Indonesia.

## 5b. Seed & reset lokal (`scripts/seed.mts`)

- **Penanda:** semua akun seed memakai email berakhiran `@seed.local` dan ID deterministik (uuid v5 dari email) → `ON CONFLICT DO NOTHING`, aman dijalankan ulang walau sudah ada data real.
- **Isi:** 1 admin seed, 3 supervisor (`Tetap`), 4 anggota (2 `Magang`, 2 `Tetap`), 3 klien, 2 nominal iuran, 3 hasil follow-up, beberapa follow-up di pekan berjalan.
- **`--cleanup`:** menghapus berurutan `followup` → `klien` → `pembayaran_iuran` → `koreksi_laporan` → `laporan_anggota` → `laporan_pekan` → `karyawan` → `session`/`account` → `user`, semuanya dibatasi `id IN (SELECT id FROM user WHERE email LIKE '%@seed.local')` (atau FK ke baris tersebut). Data real tidak tersentuh.
- Menolak berjalan bila `DATABASE_URL_UNPOOLED` tidak ada. Bila host cocok dengan project produksi (dibaca dari `.neon`), minta `FORCE=1`.

## 6. Hapus Scaffold

Hapus `src/components/todo-list.tsx`, `src/app/api/todos/`, `src/app/api/ping-function/`, `src/lib/functions.ts`, `scripts/verify-db.mts`, `hello.ts`/`neon.ts` dari `@neon/functions`, dan `@neon/auth` references.
`DROP TABLE IF EXISTS todos, visits;` dihasilkan otomatis saat `schema.ts` tidak lagi mendeklarasikannya — **jangan** ditulis ulang manual di migration terpisah.

## 7. Uji

`scripts/smoke.mts` (HTTP + Drizzle langsung, tanpa import modul auth):
- seed admin via `scripts/seed-admin` (sudah ada di DB uji), lalu login `signIn.email`.
- sign-up publik ditolak (`disableSignUp`).
- admin buat karyawan; password awal tidak bisa akses API (403 `PASSWORD_CHANGE_REQUIRED`) sampai ganti password.
- alur laporan: bootstrap → isi baris → submit kosong ditolak → isi lengkap → submit → ubah setelah submit ditolak → koreksi oleh atasan (alasan kosong ditolak; non-atasan 403).
- follow-up: tanggal besok ditolak; rekap menghitung jumlah kejadian, bukan angka manual.
- iuran: bulan depan ditolak; duplikat 409; supervisor langsung boleh mencatat untuk anggota; supervisor tidak langsung 403.
- nonaktif dengan klien/anggota 400; alih klien oleh non-admin 403; alih klien lalu nonaktif 200.
- trigger: `UPDATE laporan_pekan SET supervisor_id` ke target yang sudah punya baris hidup → baris lama ber-`deleted_at`, target utuh (dalam transaksi + rollback). **Status: diverifikasi sekali via psql di Commit 1; belum ada skrip uji tersimpan.**
- IDOR: akses laporan/rekap/follow-up orang lain → 403/404.
- format error: `{ error: { code } }` konsisten untuk 400/403/404/409.
- `scripts/seed.mts --cleanup` menghapus hanya baris `@seed.local` (uji di DB uji).

Status implementasi smoke: **selesai** — `scripts/smoke.mts` memuat 88 check; seluruh skenario di atas (kecuali trigger yang belum punya skrip) lolos terhadap `pnpm start`.

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
- Deploy pertama: migrasi → deploy → `pnpm seed:admin` (dari lokal ke DB produksi) → buka `/` dan login.

## 9. Urutan commit

Setiap commit wajib lulus `pnpm build`.

| # | Commit | Isi | Verifikasi |
|---|---|---|---|
| 1 | `feat(db): schema domain, auth tables, trigger` | `schema.ts`, migration, `waktu.ts`, trigger SQL, `drizzle.config.ts` | `psql` cek tabel/CHECK/trigger/unique parsial |
| 2 | `feat(auth): better-auth lokal + seed-admin` | auth server/client, `http.ts`, `current.ts`, `seed-admin.mts`, hapus scaffold | login + ganti password manual |
| 3 | `feat(api): laporan pekan` | `lib/laporan/*`, `lib/pekan/bootstrap.ts`, route laporan | smoke bagian laporan |
| 4 | `feat(api): klien, follow-up, iuran, admin` | sisa API + `seed.mts` | `pnpm smoke` lengkap |
| 5 | `feat(ui): shadcn shell + halaman` | shadcn init, route group, 9 halaman | uji manual browser |
| 6 | `chore: deploy prep` | README/HANDOFF, `.env` cleanup, Vercel env | build + smoke terhadap `next start` |
