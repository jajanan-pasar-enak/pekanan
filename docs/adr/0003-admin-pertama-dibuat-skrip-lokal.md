# ADR-0003 — Admin pertama dibuat skrip lokal, bukan route bootstrap HTTP

Status: diterima (2026-11-07). Menggantikan §3.2 plan sebelumnya.

## Konteks

Plan awal mengusulkan `POST /api/auth/bootstrap` yang memvalidasi `ADMIN_EMAIL` lalu membuat admin melalui `auth.api.createUser`. Masalahnya:

- `auth.api.createUser` adalah endpoint plugin `admin` Better Auth yang **mensyaratkan sesi admin** — dan admin pertama belum ada.
- Jalur alternatif (`signUpEmail` dengan `disableSignUp` dimatikan sementara) memerlukan race-guard (`pg_advisory_xact_lock`) untuk mencegah dua pemanggil menjadi admin.
- Route publik permanen yang "hanya berfungsi sekali" adalah permukaan serangan yang tidak perlu pada aplikasi internal kecil.

## Keputusan

Admin pertama dibuat oleh skrip `scripts/seed-admin.mts` yang dijalankan operator dari mesin yang memiliki `DATABASE_URL_UNPOOLED` dan `.env.local`:

1. Baca `ADMIN_EMAIL` dan `ADMIN_PASSWORD` (prompt bila tidak ada).
2. Tolak bila sudah ada user dengan role `admin`.
3. Di dalam satu transaksi: `user` (`emailVerified = true`, `role = 'admin'`), `account` (password hash Better Auth), `karyawan` (`level = 'Tetap'`, `harus_ganti_password = true`).

Route `/api/auth/bootstrap` **tidak dibuat**.

## Alasan menolak alternatif

- **Route bootstrap HTTP dengan advisory lock.** Tetap meninggalkan endpoint publik yang harus dijaga selamanya; nilainya kecil karena bootstrap hanya terjadi sekali.
- **Bootstrap lewat `signUpEmail` biasa.** Bertentangan dengan `disableSignUp` yang kita pakai untuk menolak daftar mandiri.
- **Membuat admin lewat konsol Neon Managed Auth.** Ditolak di ADR-0001 karena tidak mendukung `databaseHooks` dan `disableSignUp`.

## Konsekuensi

- Deployment pertama punya langkah manual: `pnpm seed:admin` sebelum login pertama.
- `seed:admin` harus idempoten-aman: bila admin sudah ada, keluar dengan kode 0 tanpa perubahan.
- Skrip memakai `DATABASE_URL_UNPOOLED`; menolak berjalan bila tidak ada.
- Uji smoke tetap membuat admin via HTTP? Tidak — smoke memakai `seed-admin` dengan `ADMIN_EMAIL` bebas lalu login lewat `signIn.email`.
