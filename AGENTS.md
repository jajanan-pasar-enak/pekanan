# AGENTS.md

## Aturan mesin (dari pemilik proyek)

- Sebelum menjalankan tes, build, dev server tambahan, browser headless/capture, atau apa pun yang berpotensi menaikkan penggunaan memori: cek RAM dulu (`free -m`). Jangan memulai proses berat bila pemakaian sudah tinggi; target pemakaian total tetap di bawah 90%.
- Mesin ini tanpa swap dan RAM 9,8 GB. Chrome penuh memakai >1 GB; pakai `chrome-headless-shell` atau proses seringan mungkin, dan pantau RAM selama proses berjalan.
- Jangan mematikan proses milik pengguna lain. Server dev/preview proyek ini sendiri boleh dihentikan saat beralih ke alur build + preview.
- Verifikasi lokal setelah tiap perbaikan memakai `pnpm build` lalu `pnpm start` (preview), bukan `next dev`: jauh lebih hemat RAM daripada dev server yang berjalan terus.
