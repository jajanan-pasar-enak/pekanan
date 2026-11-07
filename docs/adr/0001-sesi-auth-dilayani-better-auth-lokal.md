# Sesi auth dilayani lokal oleh Better Auth, bukan lewat proxy Neon Auth

Aplikasi membutuhkan profil karyawan (level, supervisor, role admin) yang berubah-ubah; profil itu harus disimpan di tabel milik aplikasi, sementara `neon_auth.*` tidak boleh disentuh.

Karena itu, `/api/auth/[...path]` tidak lagi diproksi ke Neon Auth. Route ini membuat instance Better Auth sendiri dengan schema Drizzle di `public` (`user`, `session`, `account`, `verification`) dan menulis profil ke tabel `karyawan` lewat instance hook yang sudah terbukti berjalan dari opsi Better Auth.

## Alasan menolak alternatif

- **Tetap memakai `@neon/auth` dan menyimpan profil di tabel terpisah.** Mengharuskan sinkronisasi hook di depan proxy, dan cookie `__Secure-neon-auth*` tidak bisa ditulis lewat `next/headers` sesi ini, sehingga sesi akan bergantung pada perilaku internal proxy Neon Auth.
- **Menambah `additionalFields` ke jalur Neon Auth.** Sesi ini belum bisa menyentuh konfigurasi server Neon Auth (CLI butuh login browser) dan tidak ada cara membuat instance Better Auth yang benar-benar lewat `@neon/auth`.

## Konsekuensi

- Akun lama (`aku@kamu.com`, `apa@iya.com`) tetap di `neon_auth.user` tetapi tidak bisa dipakai login sampai dibuatkan akun baru. Ini dapat dibalik dengan mengembalikan route lama, karena `neon_auth` tidak diubah.
- Data otentikasi app sekarang berada di skema `public`, sehingga `drizzle-kit` perlu dikecualikan dari tabel `neon_auth`.
- Password disimpan di `public.account.password` dengan hash scrypt Better Auth.
- `NEON_AUTH_BASE_URL` dan `NEON_AUTH_JWKS_URL` tidak lagi dipakai; `BETTER_AUTH_SECRET` wajib diisi.
- Session punya `user.role` (`user` | `admin`), dipakai admin Perhimpunan untuk pengelolaan data.
