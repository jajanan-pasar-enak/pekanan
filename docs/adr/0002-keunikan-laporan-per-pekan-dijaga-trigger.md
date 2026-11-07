# Keunikan Laporan Pekan per Pekan dijaga trigger Postgres

Aturan domain: seorang Supervisor punya paling banyak satu Laporan Pekan per Pekan. Karena Supervisi bisa berpindah, keunikan `(supervisor, pekan)` bisa dilanggar lewat laporan yang kemudian ditransfer penulisnya, sehingga unique index tunggal tidak cukup.

Keputusan: **unique index parsial** hanya melindungi baris hidup (`deleted_at is null`), sedangkan fungsi trigger `retire_transferred_laporan()` menandai `deleted_at` pada baris yang `supervisor_id`-nya dipindah. Pindah penulis laporan terjadi di satu tempat, yaitu function `move_karyawan()`, yang juga memastikan Draf pekan berjalan dulu dikirim ke Atasan Supervisor seperti biasa.

## Alasan menolak alternatif

- **Unique index `(supervisor_id, pekan_id)` saja.** Menolak transfer, sehingga laporan yang ditulis oleh orang yang sudah tidak membimbingnya menjadi hal yang tidak bisa diubah.
- **Menghapus atau mengosongkan laporan saat transfer.** Riwayat laporan hilang tanpa jejak.

## Konsekuensi

- Invariant dijaga database, alurnya dijaga aplikasi.
- Baris `deleted_at` tidak tampil di layar mana pun dan bukan fitur pengguna.
- Trigger harus diuji dengan uji database karena kegagalannya hanya muncul saat transfer.
