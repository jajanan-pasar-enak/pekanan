# HANDOFF — pekanan

> **Status UI terakhir (2026-11-19, sesi 6 — audit desain Hallmark, polish, ledger `/iuran`, pencarian `/klien`, anggota `/dashboard`):** commit sesi 6 sudah di-push (`85d8e7e`) dalam tiga commit. Daftar anggota dashboard kini punya cari + 10 baris/halaman (§1i, **belum di-commit**). `pnpm lint`/eslint bersih, sloplint halaman bersih (waiver tercatat di stamp `globals.css`). Gerbang penuh 2026-11-19: tes **35/35**, lint **0**, format **0** (`.gstack/` ditambahkan ke `.prettierignore`), `tsc --noEmit` **exit 0** (RAM puncak 82%), `pnpm build` **exit 0** (puncak 45%). **Baca §1h/§1i sebelum kerja lanjutan.**
>
> **Baca ini dulu.** Status terakhir (2026-11-09, sesi 5 — skeleton, SSL log Vercel, prettier + bersih-bersih lint): **live** di **https://pekanan.vercel.app** (Vercel Hobby, `main` auto-deploy). Remote: **`https://github.com/jajanan-pasar-enak/pekanan.git`** (publik; remote `sini-sana` sudah ditinggalkan tetapi **masih ada riwayatnya di GitHub**). `main` sinkron di **`8512042`** (sudah di-push, Vercel auto-deploy). **5 migrasi** Drizzle diterapkan (`0000`–`0004`; sesi ini **tidak** mengubah skema). Gerbang: `pnpm test` **32/32**, `pnpm lint` **bersih (0 problem)**, `pnpm format:check` lulus, `pnpm build` exit 0; `next start` lokal `/` 200 dan `/api/me` 401. 8 commit sesi ini: `66b8b0b`, `d1e3758`, `a6e95e3`, `82e6e44`, `dee932a`, `da7ca98`, `78639ad`, `8512042` — lihat §1f/§1g.

> **Yang belum beres:**
> 1. ~~Ganti password admin~~ — **SELESAI oleh pengguna** pada 2026-11-08 ±10:44 WIB. `AdminBaru123!` **tidak berlaku lagi** (sign-in 401). Password baru hanya diketahui pengguna. **`seed-admin` tidak mengganti password** dan menolak jalan lagi selama sudah ada `user.role = 'admin'` — jangan mencoba "memulihkan" password admin lewat skrip.
> 2. **Data uji belum dibersihkan** — DB produksi = branch Neon yang sama dengan dev lokal. Dihitung ulang 2026-11-09 dengan `psql`: **77 user**, 77 karyawan, 47 klien, 7 laporan (5 Draf, 1 Terkirim, 1 Dikoreksi), **45 followup hidup + 5 soft-deleted**, **11 `followup_edit`**, 24 `koreksi_laporan`, 39 `pembayaran_iuran`, **343 sesi**. Dari 77 user: 1 `admin@pekanan.local`, **9 akun seed** + **68 akun uji** (`uji-browser*`/`probe-*`) — `like 'probe-%'` juga kena `admin@pekanan.local`, jadi filter per email, bukan `probe-%`. Backup: branch Neon `backup-sebelum-cleanup-20261108` + `/tmp/pekanan-backup/public-20261108-0834.sql` (keduanya **sebelum** `followup_edit`, `pencatat_supervisor_id`, dan `followup.deleted_at` ditambahkan — restore dari backup ini berarti juga membuang fitur follow-up dan hapus). Perintah hapus **butuh permintaan eksplisit dari pengguna** (lihat §9.3).
> 3. **`deepmerge` (Dependabot, low)** belum bisa dipatch — hanya lewat `shadcn` CLI, tidak masuk runtime.
> 4. **Kebersihan riwayat git**: `HANDOFF.md` versi lama memuat `AdminBaru123!` di riwayat kedua repo. Karena password sudah diganti, nilainya basi; `git filter-repo` **tidak perlu** kecuali pengguna ingin membersihkan riwayat.

## 1. Ringkasan

Aplikasi **Next.js 16.4.5 (App Router, Cache Components)** + **Neon Postgres** (Drizzle + `pg`) di `/home/xan/project/skrmb/pekanan`. Mencatat kinerja pekanan tim: Laporan Pekan (kehadiran, sebar media, one-on-one), Klien + Follow-up, dan Iuran bulanan.

- Package manager: **pnpm 12.16.1** · Node **v24.22.1** lokal (environment Qoder menyebut v26; yang dipakai `pnpm exec` adalah v24)
- Git: branch `main`, commit **`8512042 fix(lint): bersihkan 8 warning eslint`** (terakhir di-push, sesi 5); sebelumnya `78639ad` (17 error lint), `da7ca98` (prettier), `dee932a` (skeleton revisi), `82e6e44` + `a6e95e3` (SSL), `d1e3758` (skeleton: hanya isi dinamis), `66b8b0b` (skeleton awal) — lihat §1f/§1g; lalu `7526c5c` (handoff sesi 4), `79bd6f0` (fitur hapus follow-up), `f80166b` (handoff), `3386ccd` (docs follow-up), `cb7b7c1` (fitur follow-up), `a419ff6` + `0b2a7db` (lebar tabel), `7891865` (kolom follow-up), `aec853d`, `ef45675`, `eb5d1f4`, `b3c4b2b`, `45ff04f` (lihat §1b), lalu `1a799dc` (handoff deploy), `0b49dba` (deps), `ade5699`, `de13912`, `8dc453d` (Commit 5 UI), `bd64c4a` (Commit 4).
- **Remote**: `origin` = `https://github.com/jajanan-pasar-enak/pekanan.git` (publik; org dibuat 2026-11-07, akun `mishbah` punya akses via SSH). Remote lama `sini-sana/pekanan` masih memuat riwayat lama — hapus/arsipkan bila perlu.
- **Produksi**: https://pekanan.vercel.app (project Vercel Hobby, region seharusnya `sin1`, auto-deploy dari `main`). `/` → 200, `/api/me` → 401 (benar). Env Vercel: `DATABASE_URL_POOLED`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL=https://pekanan.vercel.app`, `ADMIN_EMAIL`.
- **DB produksi = DB dev lokal**: satu branch Neon (`production`, project `still-firefly-08452520`, org `org-empty-credit-57766595`, `aws-ap-southeast-1`). **5 migrasi Drizzle** diterapkan (`0000`–`0004`, termasuk `0003_melodic_james_howlett.sql` untuk follow-up dan `0004_unusual_white_tiger.sql` untuk `followup.deleted_at`), 15 tabel `public` (termasuk `followup_edit`).
- Admin `admin@pekanan.local` (`Admin Perhimpunan`, level Tetap, `aktif = true`, `harus_ganti_password = false`): **password sudah diganti pengguna 2026-11-08; tidak dicatat di repo.** Smoke: karena admin bukan pemilik password yang diketahui, jalankan dengan `ADMIN_PASSWORD='<password admin>'` — **jangan pakai `AdminBaru123!`** (401). Alternatif untuk smoke tanpa menyentuh admin: jalankan terhadap `admin@seed.local` / `SeedPekanan123!` (akun admin kedua, `pnpm seed.mts`), atau berharap smoke melewati fase yang butuh admin.
- Akun lain di DB: `admin@seed.local` + 8 akun seed + 68 akun uji (`uji-browser*`, `probe-*`). Tidak ada karyawan data real.

### Akun untuk mencoba aplikasi (dipakai & teruji sesi ini)

Semua ber-password **`SeedPekanan123!`** (`SEED_PASSWORD`), login terverifikasi 200 di produksi:

| Email | Peran | Bisa apa |
|---|---|---|
| `sup-1@seed.local` Sari | Supervisor + **atasan** Tono/Wulan | **Rekap**, koreksi laporan pekan lampau, klien, iuran |
| `sup-2@seed.local` Tono | Supervisor (2 anggota) | isi/kirim laporan pekan, follow-up klien |
| `sup-3@seed.local` Wulan | Supervisor (11 anggota) | idem |
| `magang-1/2@seed.local`, `tetap-1/2@seed.local` | Anggota | dashboard, halaman akun, klien sendiri |
| `admin@seed.local` | Admin | master iuran/hasil follow-up, kelola karyawan, alih klien |

`admin@pekanan.local` memakai password baru pengguna.

## 1b. Hasil sesi 2026-11-08 lanjutan (Commit 7–9) — jangan diulang

Semua sudah live di produksi dan diverifikasi dengan Playwright terhadap `pnpm start` **dan** https://pekanan.vercel.app.

- **Commit 7 `45ff04f` — layar Rekap Atasan.** `daftarRekapAnggota` di `src/lib/kepegawaian/queries.ts`; `/rekap` (daftar laporan Anggota Langsung: supervisor, pekan, status, terisi) dan `/rekap/[pekanId]` (5 kartu ringkasan + tabel rincian) memakai `getRekapPekan` yang sudah ada. Tautan **Rekap** di `nav-utama`.
  - Kolom Supervisor ditambahkan karena Tono dan Wulan punya laporan pekan yang sama sehingga barisnya tampil identik.
  - `pekanId` non-UUID dijaga regex sebelum query → UI 404 (bukan 500).
- **Commit 8 `eb5d1f4` — `/akun`, ganti password kapan saja.** Sebelumnya form ganti password hanya terjangkau lewat `/ganti-password` yang me-redirect pengguna tanpa flag. Sekarang nama di header adalah tautan ke `/akun`.
  - **Bug keamanan yang diperbaiki:** `POST /api/auth/change-password` mereset `harus_ganti_password` **sebelum** verifikasi. Satu percobaan dengan password lama **salah** sudah melepas kewajiban ganti password lalu membuka `/dashboard`. Kini `auth.api.verifyPassword` dipanggil lebih dulu. Ada komentar di route yang menjelaskan jebakan `nextCookies` (urutan reset-flag → `changePassword` **wajib**; jangan dibalik).
  - Pesan `INVALID_PASSWORD` dari Better Auth diterjemahkan menjadi "Password saat ini salah." Kalau menambah endpoint auth lain, terjemahan tidak otomatis — `handle()` di `http.ts` masih meneruskan `error.body.message` mentah.
- **Commit 9 `aec853d` + `7891865` — UI kecil.**
  - Tautan akun di header diberi ikon `UserIcon` + border + `sr-only` "— buka halaman akun dan ganti password"; sebelumnya hanya teks dan tidak terbaca sebagai tautan.
  - **Kolom `Follow-up` di tabel `/laporan/[id]`** (angka, read-only, kolom terakhir setelah Keterangan O2O), dihitung dari kejadian bertanggal di pekan — sama persis dengan Rekap. `BarisLaporan` di `queries.ts` mendapat field `followup`; `BarisForm` di `form-laporan.tsx` mewarisinya, jadi tidak ikut ter-PATCH (PATCH hanya mengirim `BarisNilai`).
  - ~~Tabel laporan melebar (scroll horizontal di 1440 px karena `min-w-*`)~~ — **dirapatkan** (lihat §1c).

**Uji browser sesi ini** (di `/tmp/pw`, tidak di repo): `rekap.mjs` (14 check), `akun.mjs` (12), `wajib.mjs` (4), `prod*.mjs` (cek produksi). Semua lulus.

## 1f. Hasil sesi 2026-11-09 — skeleton saat memuat

Semua sudah di-push ke `main`. Sebelumnya **semua** `Suspense fallback={null}` (13 berkas), jadi saat data belum siap layar hanya menampilkan navbar.

- **`src/components/skeleton.tsx` (baru).** `Skeleton`, `HalamanSkeleton` (`judul`/`subjudul`/`aksi`/`anak`/`jumlahBaris`), `JudulSkeleton`, `KartuSkeleton` (judul opsional), `KartuTabelSkeleton`, `BarisTabelSkeleton` (isi tabel tanpa bingkai, untuk di dalam `KartuSkeleton`), `KartuAnggotaSkeleton`, `IsiKartuSkeleton`. `TautanSkeleton` dibuat lalu **dihapus** karena tidak dipakai.
- **Aturan yang diputuskan pengguna (pertahankan):** judul, subjudul, tombol statis (Kembali, dst.) dan **form yang tidak butuh data** tampil **apa adanya** di fallback; hanya bagian yang menunggu fetch (tabel/daftar/riwayat/angka ringkasan) yang jadi skeleton. Jangan kembalikan header ke skeleton.
- **Fallback per halaman:** dashboard, klien, `klien/[id]` (tanpa kartu form catat follow-up — form itu butuh data pemilik), rekap, `rekap/[pekanId]` (header + 5 kartu ringkasan), iuran (header + tabel; kartu "Catat pembayaran" butuh anggota+nominal → skeleton), admin, akun, `laporan/[id]`, `laporan/[id]/koreksi`, login `PanelMasukSkeleton`, ganti-password.
- **`(app)/layout.tsx`:** fallback = kerangka navbar saja (`KerangkaAplikasi`, tanpa `<main>`). **`children` sengaja di luar `Suspense` shell** — fallback layout tidak tampil saat pindah rute, dan isi `main` yang tidak memuat `children` akan terhapus saat hidrasi/streaming muat penuh. Jangan bungkus `children` lagi.
- **Aksesibilitas:** `aria-busy` + `aria-live` + teks `sr-only` "Memuat data…" di `HalamanSkeleton`; elemen skeleton `aria-hidden`.
- **Tidak di-skeleton:** `router.refresh()` setelah mutasi (sengaja; kalau tidak, tabel berkedip setiap simpan).
- **Uji** (Playwright Chrome headless di `/tmp/pw`, dokumen ditunda 3,5–4 dtk; server dijalankan dari salinan `/tmp/pt` karena `BETTER_AUTH_URL` mengunci port **3000**): skeleton muncul 100–400 ms setelah klik nav; muat penuh menampilkan skeleton di area isi; refresh tetap menampilkan data lama tanpa kedip. Halaman `/klien`, `/iuran`, `/rekap`, `/akun` render normal setelah revisi (divalidasi ulang lewat `next start`, `h1` benar, 0 skeleton tertinggal).

## 1g. Hasil sesi 2026-11-09 — SSL log Vercel, prettier, lint

- **Peringatan Vercel `SECURITY WARNING: sslmode ... aliases for verify-full`** berasal dari `pg-connection-string@2.14.1` yang membaca `sslmode=require` (URL Neon). Bukan dari `pg` langsung. **Perbaikan `src/db/index.ts`:** `opsiKoneksi()` mem-parsing URL dengan `new URL`, meng-encode ulang username/password (`#`/`?` di password tidak merusak parser), lalu memaksa `sslmode=verify-full` lewat `searchParams.set` (sisa hash/parameter lain dipertahankan: `channel_binding`, `options`). Hasil: peringatan hilang, perilaku tidak berubah (2.x memang memperlakukan `require` sebagai `verify-full`), dan aman saat naik ke `pg-connection-string` v3 (libpq `require` = tanpa verifikasi host).
  - **Jangan** mengganti ke `sslmode=require&uselibpqcompat=true` (mematikan verifikasi host, peringatan tetap muncul) dan **jangan menghapus** `sslmode` (Neon menolak: "connection is insecure").
  - Diverifikasi: koneksi pooled **dan** unpooled ke Neon OK dengan `verify-full`.
  - **Catatan aneh:** `pg_stat_ssl` melaporkan `ssl: false` di endpoint pooled maupun unpooled dari mesin ini. Tidak memengaruhi koneksi/peringatan; kalau ingin memastikan trafik terenkripsi, cek pengaturan SSL di project Neon. Belum ditindaklanjuti.
  - Jebakan uji: koneksi pertama dari mesin ini bisa `timeout expired` (±10 dtk) lalu sukses pada percobaan berikutnya — pakai `connectionTimeoutMillis` 15–20 dtk dan ulangi sebelum menyimpulkan rusak.
- **Prettier (`da7ca98`):** `prettier@3.9.10` dev-dep, `.prettierrc.json` = `{ "printWidth": 100 }`, `.prettierignore` = `drizzle/`, `pnpm-lock.yaml`, `*.md`. Skrip `pnpm format` / `pnpm format:check`. `da7ca98` juga memformat ulang `scripts/seed.mts` & `scripts/smoke.mts` (perubahan hanya kosmetik), tapi **berkas lain berubah besar** — saat membaca `git blame` sebelum `da7ca98`, format lama tidak sama.
- **Lint bersih (`78639ad` + `8512042`):** `pnpm lint` kini **exit 0** (gerbang commit sekarang mencakup lint). Perubahan perilaku kecil yang harus diingat:
  - `@ts-nocheck` di semua `*.test.ts` **dihapus**; `tsc` tetap lolos. Satu tes `handle()` di `http.test.ts` kini mengembalikan `Response`.
  - `form-laporan.tsx`: snapshot `tersimpan` dibaca dari **state** saat render (ref tetap untuk `simpan()` async) — karena aturan `react-hooks/refs`.
  - `dialog-followup.tsx`: konteks disinkronkan dari prop **saat render**, bukan `setState` di effect. State `memuat` dihapus (tidak pernah ditampilkan).
  - `keluar-button.tsx` & `ganti-password-form.tsx`: navigasi pakai **`window.location.replace`** (muat penuh agar cache router sesi lama terbuang; Back tidak kembali ke halaman ber-sesi). Login di `auth-panel.tsx` **masih** `location.reload()` — jebakan lama §7.2 masih berlaku.
  - Import schema yang tidak terpakai dihapus dari `laporan/queries.ts`, `kepegawaian/queries.ts` & `mutations.ts`; parameter `i` di `form-koreksi.tsx` dibuang.
  - `scripts/smoke.mts` memakai satu alias `Json` (bukan `any`).

## 1d. Hasil sesi 2026-11-08 (lanjutan 3) — follow-up dari layar Laporan Pekan

- **Skema (migrasi `drizzle/0003_melodic_james_howlett.sql`, sudah diterapkan):** `followup.pencatat_supervisor_id` (nullable, FK `karyawan`) dan tabel `followup_edit` (`followup_id`, `editor_id`, `alasan`, `sebelum`/`sesudah` jsonb, `created_at`). Aditif; kolom lama tidak berubah.
- **Aturan (diputuskan pengguna):** pencatat/editor = pemilik klien **atau Atasan Supervisor langsung** pemilik. Edit wajib alasan; tanpa diff → 400. Admin tetap tidak boleh (sama seperti riwayat follow-up).
- **`created_by` selalu pemilik klien**, sehingga hitungan Follow-up per pekan (dan di Rekap/laporan) tidak berubah saat atasan yang mencatat; atasan tercatat di `pencatat_supervisor_id` + `followup_edit`.
- **UI:** angka Follow-up di `/laporan/[id]` tetap read-only, di sampingnya tombol ikon (`ListIcon`, `aria-label="Lihat follow-up <nama> pekan ini (n)"`) yang membuka `DialogFollowup` (`src/components/dialog-followup.tsx`). Dialog menampilkan kejadian pekan itu, klien anggota, riwayat edit, tombol **Ubah** per kejadian, dan tombol **+ <nama klien>** untuk mencatat. Data dialog diambil ulang setelah tiap mutasi (`GET /api/laporan/[id]/followup`) — tanpa ini daftar tidak ter-update sampai dialog ditutup.
- **Halaman `/klien/[id]`:** kolom "Dicatat oleh" menampilkan `<atasan> (atas nama <pemilik>)`; deskripsi memuat riwayat edit (`diubah <editor>: <alasan>`). Tombol catat kini juga tampil untuk atasan.
- Rute baru: `GET /api/laporan/[id]/followup`, `PATCH /api/followup/[id]`. `POST /api/klien/[id]/followup` kini menerima atasan.
- Logika di `src/lib/klien/followup.ts` (query + tipe `KonteksFollowupPekan`) dan `src/lib/klien/{aturan,mutations,queries}.ts`. Uji unit baru di `klien/aturan.test.ts` (`ubahFollowupSchema`, `diffFollowup`, `bolehKelolaFollowup`) → `pnpm test` **31/31**.
- Uji browser `/tmp/pw/followup.mjs` terhadap `pnpm start`: dialog, tambah, simpan terkunci tanpa alasan, riwayat edit, angka tabel naik (4→5), kontrol atasan, PATCH tak dikenal → 404. Lulus.
- **Uji produksi** (`/tmp/pw/prod-followup.mjs` terhadap https://pekanan.vercel.app, akun `sup-1@seed.local`, laporan `dffe4dba-6a2a-4317-97f0-429e2f19fc68`, baris Tono Supervisor): **11/11 check lulus**; angka Follow-up 7 → 8 dan bertahan setelah reload.
- **Catatan data:** `sup-1@seed.local` (Sari) kini anggota laporan **salah satu supervisor** (baris akun `uji-browser*`), dan klien "Toko Uji Browser" milik Tono Supervisor. Ini sisa pengalihan klien pada uji lalu; angka follow-up Tono bertambah oleh uji sesi ini (8 followup berdeskripsi mengandung "uji" di klien itu + 6 baris `followup_edit`).
- **Penyimpangan kosmetik yang diketahui:** dua opsi master `hasil_followup` bisa bernama sama (beda `id`), sehingga badge riwayat tampil mis. "hasil Tertarik lanjut → Tertarik lanjut". Bukan bug data; pertimbangkan unique nama di master bila ingin menghindari.
- **Uji atas nama pemilik:** follow-up yang dicatat atasan tetap `created_by = pemilik`; hak ubah di dialog dihitung per kejadian (`bolehUbah`) — dialog baru membuka data lewat `GET /api/laporan/[id]/followup`, jadi angka di tabel dan isi dialog selalu dihitung dari query yang sama (`daftarFollowupPekan`).

## 1e. Hasil sesi 2026-11-08 (lanjutan 4) — hapus follow-up dari dialog

- **Skema (migrasi `0004_unusual_white_tiger.sql`, sudah diterapkan ke Neon):** `followup.deleted_at timestamptz` (nullable). Aditif.
- **Kenapa soft-delete, bukan `DELETE`:** `followup_edit.followup_id` → `followup` adalah `ON DELETE restrict`, dan riwayat edit (termasuk jejak hapus) harus tetap terbaca. Percobaan hard delete → `23001` → 500. Baris di-null-kan dengan `deleted_at`.
- **Aturan:** siapa yang boleh hapus = sama dengan ubah (`bolehKelolaFollowup`: pemilik klien / Atasan Supervisor langsungnya; Admin tidak). **Alasan wajib** (`hapusFollowupSchema`), ditolak kosong → 400 di server.
- **Data:** `UPDATE followup SET deleted_at = now()` + `INSERT followup_edit` dengan `sebelum` = nilai lama dan `sesudah = { dihapus: true }`, dalam satu transaksi. Baris yang sudah terhapus → 404.
- **Semua hitungan & daftar memfilter `deleted_at IS NULL`:** angka Follow-up di `/laporan/[id]` (`laporan/queries.ts`) dan Rekap (`kepegawaian/queries.ts`), `daftarKlienSaya` (`jumlahFollowup`, `followupTerakhir`), riwayat `/klien/[id]`, `daftarFollowupPekan`. **Jangan menambahkan filter ini** ke query "dihapus" di `followup.ts` — baris di sana memang sudah soft-deleted.
- **API:** `DELETE /api/followup/[id]` body `{ alasan }`. `kirimApi` di `api-client.ts` kini menerima `DELETE`.
- **UI (`dialog-followup.tsx`):** tombol **Hapus** (destructive) di samping **Ubah** → konfirmasi di dalam dialog yang sama (`KonfirmasiHapus`): ringkasan kejadian + alasan wajib + tombol terkunci tanpa alasan. Setelah hapus: toast, daftar di-segarkan, dan seksi **"Dihapus pada pekan ini (n)"** tampil (klien, tanggal, hasil dicoret + deskripsi + `dihapus <nama>: <alasan>`). Angka tabel turun saat dialog ditutup (`router.refresh()`).
- **Tipe:** `FollowupDihapus` (id = id `followup_edit`, `anggotaId` = `created_by`) di `KonteksFollowupPekan.dihapus`.
- **Skrip cleanup diperbaiki** (`seed.mts --cleanup`, `smoke.mts` finally): `followup_edit` dihapus **sebelum** `followup`/`karyawan` (RESTRICT; dulu gagal bila ada riwayat edit).
- **Uji:** `pnpm test` **32/32** (+`hapusFollowupSchema`); `pnpm build` exit 0. Uji browser `/tmp/pw/hapus-followup.mjs` terhadap `pnpm start`: **10/10** (konfirmasi, tombol terkunci, alasan, angka turun 1, riwayat tetap setelah reload, DELETE id acak → 400). Uji dijalankan ulang beberapa kali; tiap putaran menghapus satu follow-up "uji" di Toko Uji Browser.
- **Jebakan saat menguji (jangan diulang):** sempat menambahkan `isNull(followup.deletedAt)` ke query **daftar hapus** di `followup.ts` lewat bulk edit → seksi "Dihapus pada pekan ini" kosong. Query itu memang mencari baris soft-deleted; filter hanya untuk daftar hidup/hitungan.
- **Sudah di-commit & di-push:** `79bd6f0` (fitur + migrasi + skrip) dan `aa8f1f9` (docs). Vercel auto-deploy dari `main`; migrasi sudah diterapkan manual lebih dulu, jadi deploy tidak punya langkah DB.
- **Belum dilakukan:** entri hapus di `/klien/[id]` (riwayat hapus hanya tampil di dialog laporan).

## 1c. Hasil sesi 2026-11-08 (lanjutan 2) — lebar tabel laporan

- `min-w-40/44/48` dihapus dari `<TableHead>` tabel `form-laporan.tsx` (Anggota, Kehadiran, Keterangan kehadiran, One-on-one, Keterangan O2O) dan `form-koreksi.tsx` (kolom sama). `w-28` di Media online/offline tetap; `min-w-*` bawaan shadcn (`ui/input.tsx`, `ui/select.tsx`) tidak disentuh.
  - Aman karena `TableHead`/`TableCell` di `src/components/ui/table.tsx` sudah `whitespace-nowrap`, jadi lebar minimum praktisnya dipegang header dan placeholder.
- Verifikasi Playwright di `pnpm start`, viewport 1440 px: `/laporan/[id]` (sebagai `sup-2@seed.local`) dan `/laporan/[id]/koreksi` (sebagai `sup-1@seed.local`, karena Tono bukan atasan pemilik laporan) → `scrollWidth` wadah tabel = `clientWidth` (1072 px), **tanpa scroll horizontal**. `pnpm build` exit 0.

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

## 1h. Sesi 2026-11-19 — audit desain, polish, ledger `/iuran`, pencarian `/klien`

Audit `/hallmark` (scope app, genre modern-minimal). Diagnosis: masalahnya bukan warna/tipografi tapi **struktur halaman** — `/iuran` merender satu kartu per orang (58 kartu, ~735 baris) dengan query per orang, `/klien` mencetak semua klien tanpa cari/filter/halaman, tanggal mentah, kontrol kecil, header blur.

**Artefak baru**
- `DESIGN.md` — sistem terkunci: token OKLCH ink-only (waiver gate 22), tipografi, kontrol ≥32px + target 44px untuk `pointer: coarse`, ledger rapat, dark mode **tidak didukung** (token dark mati dihapus), daftar item terbuka.
- `AGENTS.md` — aturan mesin: cek `free -m` sebelum tes/build/browser, RAM total < 90%, tanpa swap, jangan matikan dev server pengguna.
- `src/app/error.tsx`, `src/app/not-found.tsx`, `.gitignore` + `.hallmark/`.

**`/iuran` — satu ledger, bukan kartu per orang**
- `src/lib/iuran/queries.ts`: `rekapIuranBanyak(karyawanIds, dari, sampai)` menggantikan `rekapIuranKaryawan` — 2 query untuk semua orang (was N+1 ~120 query).
- Halaman: tabel 58 × 12 bulan (ledger), header sticky + kolom nama sticky, bulan berjalan ditandai `bg-secondary`, sel lunas (centang + `sr-only`) vs belum (tautan `?catat=id|bulan#catat-iuran`), kolom "Lunas x/y". Kartu riwayat pembayaran tetap.
- Verifikasi headless: 696 sel, sticky delta 1px (scrollTop 420 / scrollLeft 280), mobile 390px tidak overflow.

**`/klien` — cari, filter, halaman lewat URL**
- `src/lib/klien/queries.ts`: `halamanKlienSaya` (count + `limit/offset`, clamp halaman), `q` pakai ILIKE dengan escape `% _ \`, `belumFollowup` pakai `NOT EXISTS`. `daftarKlienSaya` **tetap** (kontrak `GET /api/klien` = array penuh untuk smoke).
- Halaman: `?q=&belum=1&hal=N`, 25 baris/halaman, toolbar `method="get"` + toggle "Belum ada follow-up"/"Semua klien" + "Hapus filter", paginasi dengan tombol disabled.
- Verifikasi: 46 klien → 25/21 baris; 45 tanpa follow-up; filter+cari benar.

**Gerbang:** `pnpm lint` bersih, `tsc --noEmit` exit 0 (heap 512 MB), sloplint halaman bersih, RAM puncak 89%. Waiver tertulis di stamp `src/app/globals.css`: gate 22 (palet ink-only), gate 7b (permukaan putih), gate 29 di-dismiss (blur hanya scrim dialog). Screenshot: `.hallmark/captures/` (gitignored).

**File sesi 6:** `AGENTS.md`*, `DESIGN.md`*, `error.tsx`*, `not-found.tsx`*, `.gitignore`, `src/app/globals.css`, `src/lib/waktu.ts` + test, halaman `dashboard/rekap/klien/laporan`, `(app)/layout.tsx`, `dialog-followup`, `nav-utama`, `ui/button`, `lib/iuran/{queries,page}`, `lib/klien/{queries,page}` (*baru). Dipecah 3 commit: (1) polish + DESIGN/AGENTS + halaman error, (2) ledger iuran, (3) klien cari/filter/halaman.

**Berikutnya:** `pnpm build` (+ `tsc --noEmit` penuh) **hanya bila RAM < 90%** — lihat §1i. Dev server pengguna (port 3000) masih hidup — jangan dimatikan.

## 1i. Sesi 2026-11-19 lanjutan — anggota `/dashboard` berhalaman + cari (belum di-commit)

- `src/lib/pekan/bootstrap.ts`: `halamanAnggotaLangsung(supervisorId, { q, halaman, perHalaman })` — count + `limit/offset` dengan clamp, `q` nama pakai ILIKE dengan escape `% _ \`, default 10 baris. `daftarAnggotaLangsung` **tetap** (dipakai `/iuran`, `followup.ts`, `GET /api/pekan/bootstrap`).
- `src/app/(app)/dashboard/page.tsx`: kartu Anggota Langsung kini punya form cari (`?q=`), link "Hapus", daftar 10 baris + Separator, paginasi (`?hal=`) dengan tombol disabled; deskripsi kartu menampilkan total atau "N anggota cocok".
- Verifikasi live (dev server, sesi cookie): 57 anggota → 10 baris hal. 1, 7 baris hal. 6; `hal=999` di-clamp ke 6; `q=Uji` → 55 cocok; `q=zzzz` → 0; `q=%25` → 0 (wildcard ter-escape); tautan halaman mempertahankan `q` (`?q=Uji&hal=3`). DOM: 0 overflow horizontal; sloplint `--scope app` bersih; eslint 2 file bersih.
- **Catatan gerbang:** percobaan awal `tsc --noEmit` OOM pada heap 384 MB dan dibatalkan watchdog RAM di 91% pada heap 512 MB. Saat RAM turun ke 76%, gate otomatis menjalankan ulang `tsc --noEmit` dengan heap 768 MB: **exit 0**, RAM puncak 82%, tanpa abort. Setelah Chrome dimatikan dan dev server di-restart (RAM 77% → 39%), `pnpm build` dijalankan dengan dev server berhenti sementara: **exit 0**, RAM puncak 45%; dev server dinyalakan lagi (Port 3000). `format:check` gagal hanya karena profil `.gstack/` — kini di `.prettierignore`; format 0.
- File berubah: `src/app/(app)/dashboard/page.tsx`, `src/lib/pekan/bootstrap.ts`, `DESIGN.md`, `HANDOFF.md`. Screenshot: `.hallmark/captures/dashboard-{sesudah,anggota,filter,mobile}.png`.

## 1j. Sesi 2026-11-19 — perbaikan validasi Next 16 di `/dashboard` dan `/klien`

- Dua pesan berbeda muncul di log dev. (1) `Next.js encountered URL data during prerendering or a navigation` — **bug nyata**: `await searchParams` di badan halaman, di luar `<Suspense>`, dilarang Cache Components. (2) `Could not validate instant ... [cause]: NEXT_REDIRECT` — validator instant UI dev menabrak `redirect()` yang sah di `AppShell` (sesi belum ada, atau masih wajib ganti password).
- Perbaikan: default export `/dashboard` dan `/klien` kini sinkron; promise `searchParams` diteruskan ke komponen async di dalam `<Suspense>` (`IsiDashboard`, `IsiHalamanKlien`), pola yang sudah dipakai `/iuran`. Fallback `/klien` memakai `HalamanSkeleton` + `KartuSkeleton`/`KartuTabelSkeleton`. Jenis prop: `PageProps<"/rute">["searchParams"]` (bukan `PageProps` penuh, yang menuntut `params`).
- Sisa pesan `NEXT_REDIRECT` adalah noise validator dev, bukan bug alur: hilang saat sesi valid dan `harus_ganti_password` sudah false (selesai lewat `/ganti-password`). Produksi tidak menjalankan validator ini.
- Verifikasi: konsol Chromium headless bersih untuk `/dashboard`, `/dashboard?q=Uji`, `/dashboard?hal=2`, `/klien`, `/klien?belum=1`; halaman 2/6 dan filter 46/45 tetap benar; eslint 0, prettier 0, `tsc --noEmit` 0 (heap 768 MB), tes 35/35.
- File berubah: `src/app/(app)/dashboard/page.tsx`, `src/app/(app)/klien/page.tsx`, `HANDOFF.md`.

## 2. Lokasi dokumen (baca berurutan)

| File | Isi |
|---|---|
| `HANDOFF.md` | (file ini) status, jebakan, langkah berikutnya |
| `CONTEXT.md` | **Glosarium domain (sumber kebenaran aturan bisnis)** |
| `DESIGN.md` | Sistem UI terkunci (token, tipografi, kontrol, ledger, dark mode tidak didukung) — baca sebelum mengubah tampilan |
| `AGENTS.md` | Aturan mesin (RAM < 90%, tanpa swap, jangan matikan dev server pengguna) |
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
6. ~~Warning SSL dari `pg-connection-string`~~ — **selesai** (§1g). URL dipaksa `sslmode=verify-full` di `src/db/index.ts`; jangan menghapus normalisasi itu (Neon menolak URL tanpa SSL, dan `require` akan berubah semantik di v3).
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

1. ~~Push, Commit 6 deploy, Commit 7–9 UI~~ — **selesai dan live**, lihat §1b.
2. ~~Ganti password admin~~ — **selesai oleh pengguna** (password baru tidak dicatat di repo).
3. **Pembersihan data uji di DB produksi (BELUM; butuh permintaan eksplisit pengguna).** Angka terbaru **2026-11-09** ada di blok "Yang belum beres" atas: 77 user (68 akun uji), 77 karyawan, 47 klien, 7 laporan (5 Draf/1 Terkirim/1 Dikoreksi), 45 followup hidup + 5 soft-deleted, 11 `followup_edit`, 24 `koreksi_laporan`, 39 `pembayaran_iuran`, **343 sesi**. Sesi 5 tidak menambah data uji (uji hanya baca + login `sup-1`). Master `nominal_iuran` & `hasil_followup` **dipertahankan**. **Filter akun uji per email (`uji-browser%`), jangan `probe-%`** — `admin@pekanan.local` ikut cocok.
   - **Catatan cleanup baru:** `followup.deleted_at` tidak mengubah urutan FK (`followup_edit` tetap harus dihapus sebelum `followup`). Skrip `seed --cleanup` dan `smoke` **sudah diperbaiki** untuk urutan itu — pakai/ikuti polanya, jangan tulis ulang `DELETE FROM followup` tanpa menghapus `followup_edit` lebih dulu.
   - **Keputusan yang harus diambil pengguna lebih dulu:** apakah akun `@seed.local` (Sari/Tono/Wulan/anggota/admin seed) ikut dihapus atau **dipertahankan** sebagai data demo. Sesi ini justru memakainya untuk uji dan memberi pengguna daftar akun tersebut (§1).
   - Backup: branch Neon `backup-sebelum-cleanup-20261108` dan `/tmp/pekanan-backup/public-20261108-0834.sql` — **keduanya dibuat sebelum migrasi `0003`/`0004`**, jadi tidak memuat `followup_edit`/`pencatat_supervisor_id`/`followup.deleted_at`. **Ambil backup baru** (`pg_dump` skema `public`, atau branch Neon baru) sebelum cleanup.
   - Urutan FK dalam satu transaksi: **`followup_edit` → `koreksi_laporan` → `laporan_anggota` → `laporan_pekan` → `followup` → `pembayaran_iuran` → `klien` → `karyawan` (null-kan `supervisor_id` dulu) → `session` → `account` → `user`**, terbatas pada user yang dipilih. `followup_edit` merujuk `followup`/`karyawan` dengan RESTRICT → **wajib sebelum `followup`**. Kolom klien = `karyawan_id` (bukan `pemilik_id`); `followup.pencatat_supervisor_id` juga RESTRICT ke `karyawan`.
   - Sebelum menghapus, **hitung ulang** jumlahnya (angka di atas berubah tiap sesi uji).
4. **Kandidat pekerjaan berikutnya (belum ada permintaan eksplisit):**
   - ~~Rapikan lebar tabel `/laporan/[id]`~~ — **selesai** (§1c).
   - ~~Follow-up bisa diklik, daftar klien, tambah + edit oleh atasan~~ — **selesai & live** (§1d).
   - ~~Hapus follow-up dari dialog (soft-delete + alasan)~~ — **selesai & live** (§1e).
   - ~~Skeleton saat memuat + judul/tombol statis tidak di-skeleton~~ — **selesai & live** (§1f).
   - ~~Peringatan SSL `sslmode` di log Vercel~~ — **selesai** (§1g); cek log Vercel setelah deploy `a6e95e3` untuk konfirmasi peringatan tidak muncul lagi.
   - Tampilkan entri "dihapus" di riwayat `/klien/[id]` (sekarang hanya di dialog laporan).
   - `scripts/test-db.mts` untuk trigger `retire_transferred_laporan` — satu-satunya item checklist yang belum punya skrip tersimpan.
   - Smoke masih butuh password admin yang tidak diketahui; pertimbangkan menjalankannya terhadap `admin@seed.local`.
5. **Belum diuji manual (browser):** bootstrap setelah pergantian pekan nyata (Draf baru + catch-up). Rute Rekap sekarang **sudah punya layar** (§1b) — poin lama sudah usang.
6. **Kebersihan riwayat git:** `AdminBaru123!` masih ada di `HANDOFF.md` versi lama pada riwayat kedua repo, tetapi **sudah tidak berlaku**. `git filter-repo` tidak wajib.
7. Skrip uji browser ada di `/tmp/pw` (+ Playwright-Core, Chrome `/usr/bin/google-chrome-stable`); **tidak di repo**: `uji.mjs`, `rekap.mjs`, `akun.mjs`, `wajib.mjs`, `tabel.mjs`, `followup.mjs`, `hapus-followup.mjs`, `cek-klien.mjs`, `prod*.mjs`, `prod-followup.mjs`, plus skrip sesi 5: `auth.mjs` (login + simpan cookie ke `storage.json`), `firstload.mjs`, `nav3.mjs`, `detail.mjs`, `shape2.mjs`. Sesi ini berakhir dengan **server lokal dimatikan** (port 3000 bebas).
- **Jebakan skrip sesi 5:** `localhost:3000` dikunci `BETTER_AUTH_URL`; server di port lain → login 403 `INVALID_ORIGIN`. Untuk uji dengan sumber yang diedit, jalankan salinan bersih (`rsync` src ke `/tmp/pt` + `pnpm install`, cukup pakai `node_modules` milik sendiri) di port 3000. Men-symlink `node_modules` proyek ke salinan **merusak Turbopack** ("Could not find the Next.js package"). Cookie Better Auth disuntik ke konteks Playwright dengan `domain: 'localhost', path: '/'` (bukan `url`). Menunda request `document` 4 dtk = simulasi lambat; skeleton terjadi di navigasi klien, bukan muat penuh pertama. `BASE` script di-hardcode ke `http://localhost:3000` — untuk uji produksi salin script dan ganti BASE.

**Jebakan locator Playwright yang ditemukan sesi ini (jangan diulang):**
- `body > header` **tidak selalu cocok** — header aplikasi berada di dalam `div` pembungkus, jadi `page.locator("header")` menemukan 1 elemen sedangkan `"body > header"` menemukan 0. Jangan percaya catatan lama yang menyuruh pakai `body > header`.
- Toaster/Next menyisipkan `<p role="alert">` **kosong** di samping alert asli; `getByRole("alert").innerText()` bisa mengambil yang kosong. Pakai `allInnerTexts()` lalu filter yang tidak kosong.
- Jangan asumsikan dua laporan dengan pekan sama milik satu orang: di data seed Tono dan Wulan berbagi pekan.
- Login produksi kadang gagal sekali saat cold start Neon (`/` dengan form tetap tampil). Ulangi sampai `/dashboard`, jangan simpulkan fitur rusak.
- `notFound()` di dalam boundary `<Suspense>` merender UI 404 tetapi **status HTTP tetap 200**; uji UI 404, bukan `response.status()`.
- Respons 400 yang sengaja diuji (mis. password salah) memunculkan `console.error "Failed to load resource"` — jangan dihitung sebagai kegagalan.

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

**Status akun admin:** `admin@pekanan.local` (`harus_ganti_password = false`, `aktif = true`). Password **dibuat pengguna sendiri pada 2026-11-08** dan **tidak** dicatat di repo; `AdminBaru123!` sudah tidak berlaku. `pnpm seed:admin` idempoten, **tidak** mengganti password yang ada, dan **berhenti** bila sudah ada `user.role = 'admin'`. Tabel `session` berisi 333 baris (sisa smoke/uji) — ikut terhapus pada cleanup §9.3.

**Akun seed demo** (semua password `SeedPekanan123!`, terverifikasi login 200 di produksi): `sup-1@seed.local` Sari (Supervisor, atasan Tono/Wulan), `sup-2@seed.local` Tono, `sup-3@seed.local` Wulan (Supervisor), `magang-1@seed.local`, `magang-2@seed.local`, `tetap-1@seed.local`, `tetap-2@seed.local` (anggota), `admin@seed.local` (admin). Cocok untuk mencoba `/laporan`, `/rekap`, `/klien`, `/iuran`, `/admin` tanpa menyentuh akun admin real.

**Adapter & snake_case:** `drizzleAdapter(db, { provider: "pg", schema })` menerima objek schema apa adanya; `usePlural` (default `false`) cocok karena nama tabel tunggal (`user`, `session`, …). Nama kolom DB di-**override eksplisit** di `src/db/schema.ts` (`account_id`, `email_verified`, dst.), jadi **jangan** menambah `casing: "snake_case"` — default Drizzle (preserve) sudah benar. Export `schema` (`import * as schema`) harus memuat tabel domain juga agar adapter menemukan `user`.

### TDD (mulai Commit 2)

- Tanpa framework baru: `node:test` + `assert` lewat `tsx`. Sudah diuji di Node 24: `pnpm exec tsx --test "src/**/*.test.ts"` menerima glob. `package.json`: `"test": "tsx --test --test-concurrency=1 \"src/**/*.test.ts\""` — **selalu serial**.
- Unit (murni, tanpa DB): `src/lib/waktu.test.ts` (batas Minggu 00:00 Sabtu 23:59:59 WIB, pergantian bulan), helper otorisasi (`isSupervisorOf`, `isAtasanOf`, cek siklus supervisor), `http.ts` (format `{ error: { code } }`, status per kode).
- DB (trigger & CHECK): `scripts/test-db.mts` — pola psql Commit 1 dipindah ke Drizzle langsung, setiap kasus dalam transaksi yang di-`ROLLBACK`, exit non-nol bila ada yang lolos. Butuh `DATABASE_URL_UNPOOLED`; jangan pernah commit data uji.
- Urutan kerja per fitur: uji gagal → implementasi → uji hijau → `pnpm lint` → `pnpm format:check` (atau `pnpm format`) → `pnpm build` → commit.
- **Jalankan test secara serial** (`pnpm test` sudah `--test-concurrency=1`; skrip DB/HTTP satu per satu, tidak paralel).
- Commit 2: `src/lib/http.test.ts` (6 uji). Commit 3: `src/lib/waktu.test.ts` (7), `src/lib/laporan/aturan.test.ts` (4). Commit 4: `klien/aturan.test.ts`, `iuran/aturan.test.ts`, `kepegawaian/aturan.test.ts` → total 28. Sesi lanjutan 3: 3 uji baru di `klien/aturan.test.ts` (`ubahFollowupSchema`, `diffFollowup`, `bolehKelolaFollowup`) → total **31**. Sesi lanjutan 4: `hapusFollowupSchema` → total **32** (tetap 32 setelah `78639ad`/`da7ca98`; tidak ada uji baru di sesi 5).
- Commit 5 (UI) tidak butuh uji unit baru; verifikasi lewat build + uji manual browser (sudah: Playwright terhadap `pnpm start`, semua fase OK).

### Catatan operasional baru

- **Rate limit**: smoke melakukan >10 login; `BETTER_AUTH_LOGIN_LIMIT` default 60 menit-per-jendela. Untuk pengujian berkali-kali, jalankan `next start` dengan `BETTER_AUTH_LOGIN_LIMIT=1000` atau restart server (limiter in-memory). Smoke punya `tungguBilaDibatasi()` sebagai jaring pengaman.
- **Restart server**: cek `ss -ltnp | grep :3000`. Jika port sudah dipakai proses lama, `pnpm start` gagal diam-diam (`EADDRINUSE` di log) dan smoke menguji build lama. Selalu `kill <pid>` lalu tunggu port bebas.
- **Ganti password**: smoke membuat sesinya sendiri lalu mengganti password admin. Bila `next start` baru dijalankan (secret sama), sesi lama tetap valid. Jangan mengubah password lalu memakai ulang sesi yang dibuat sebelum perubahan dengan password lama → `Invalid password`.
- **Cleanup smoke** (satu transaksi, FK RESTRICT): `followup_edit` → `koreksi_laporan` → `laporan_pekan` → `followup` → `pembayaran_iuran` → `klien` → `karyawan` → `user`, lalu master `LIKE 'Smoke %'`. Email uji berawalan `smoke-` berakhiran `@seed.local`. `followup_edit` wajib lebih dulu (RESTRICT ke `followup` **dan** `karyawan`; bisa berisi entri "dihapus").
- Smoke fase klien/iuran butuh master `hasil_followup` & `nominal_iuran`; bila admin bukan `ADMIN_EMAIL`, fase itu di-skip dengan pesan SKIP. Seed `@seed.local` tidak wajib.
- `uuidDari()` di smoke hanya untuk UUID acak (mis. anggota fiktif) — ID karyawan selalu diambil dari DB.
- `.env.local` tidak memuat `ADMIN_PASSWORD`, jadi jalankan smoke dengan `ADMIN_PASSWORD='...' pnpm exec tsx scripts/smoke.mts`.
- `drizzle-kit generate` akan memunculkan prompt interaktif "table created or renamed?" setiap kali snapshot lama punya tabel yang di-drop; di terminal non-TTY gagal. Jawab Enter (create) atau jalankan lewat pty.
- `check(name, sql)` multi-argumen: drizzle-kit **hanya** mengeluarkan argumen pertama → pisah jadi beberapa `check()`.
- **Selalu baca isi migrasi hasil `pnpm db:generate` sebelum `pnpm db:migrate`.** Dengan snapshot lama, drizzle 0.31 bisa menerbitkan `ALTER INDEX ... DETACH PARTITION` untuk index yang memang belum ada di DB (mis. `followup_klien_tanggal_idx`) — itu akan gagal saat migrate. Sesi ini aman (migrasi `0004` hanya `ADD COLUMN`), tetapi cek `grep DETACH drizzle/0004_snapshot.json` sebelum menambah migrasi berikutnya.
- `.next/dev/types` yang basi bisa memicu error TypeScript saat build (`Cannot find module .../route.js`); `rm -rf .next` lalu build.
- ~~`pnpm lint` masih merah~~ — **bersih sejak `8512042`** (§1g); `@ts-nocheck` di file tes sudah dihapus tanpa membuat `tsc` gagal. Gerbang sebelum commit sekarang: `pnpm test` → `pnpm lint` → `pnpm format:check` → `pnpm build`. `prettier` tersedia lewat `pnpm format` (`*.md` di-ignore, jadi HANDOFF tidak diformat).

Perintah dasar:
```bash
cd /home/xan/project/skrmb/pekanan
git status --short
set -a && . ./.env.local && set +a
pnpm db:generate && pnpm db:migrate
pnpm test && pnpm lint && pnpm format:check && pnpm build
pnpm start &            # pastikan port 3000 bebas dulu
ADMIN_PASSWORD='<password admin>' pnpm exec tsx scripts/smoke.mts   # atau akun @seed.local lain yang berrole admin
```
