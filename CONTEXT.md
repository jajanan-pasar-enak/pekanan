# Pekanan

Aplikasi pencatatan kinerja mingguan tim penjualan: kehadiran meeting pekanan, follow-up klien, iuran perhimpunan bulanan, penyebaran media promosi, dan one-on-one supervisor.

## Language

### Organisasi

**Karyawan**:
Orang yang terdaftar di Perhimpunan dan punya akun login; berstatus Magang atau Tetap.
_Avoid_: staff, pegawai, user (user = akun auth)

**Magang**:
Karyawan berlevel magang; supervisornya wajib Karyawan Tetap.
_Avoid_: intern, anak magang

**Tetap**:
Karyawan berlevel tetap; boleh menjadi anggota maupun supervisor.
_Avoid_: permanent, karyawan tetap

**Supervisor**:
Karyawan Tetap yang membimbing Anggota langsungnya dan punya kewajiban one-on-one terhadap tiap Anggota tersebut.
_Avoid_: atasan, leader, manajer

**Anggota**:
Karyawan yang supervisor-nya adalah Karyawan tertentu (relasi kebalikan dari Supervisi).
_Avoid_: bawahan, anak buah, member

**Supervisi**:
Relasi satu-ke-banyak dari Supervisor ke Anggota langsungnya. Setiap Karyawan punya paling banyak satu Supervisor; Magang wajib punya Supervisor Tetap. Relasi ini membentuk pohon (bisa berantai); Karyawan di puncak pohon tidak punya Supervisor.
_Avoid_: hierarki, line manager, rapport

**Admin Perhimpunan**:
Karyawan Tetap (boleh merangkap Supervisor) yang mengelola data kepegawaian, master Nominal Iuran, master Hasil Follow-up, dan Pengambilalihan Klien. Tidak berhak mengisi atau mengoreksi Laporan Pekan orang lain.
_Avoid_: superadmin, root

**Nonaktif**:
Status Karyawan yang sudah keluar atau berhenti. Datanya tidak dihapus agar riwayat Laporan Pekan dan Follow-up tetap utuh; Klien miliknya wajib diambil alih sebelum bisa dinonaktifkan.
_Avoid_: dihapus, arsip, resigned

**Anggota Langsung**:
Anggota yang Supervisor-nya tepat Karyawan itu, bukan turunannya di bawah pohon Supervisi.

**Atasan Supervisor**:
Supervisor (langsung) dari seorang Supervisor. Hanya dia yang berhak memperbaiki Laporan Pekan milik supervisor tersebut; tidak ada relasi verifikasi terpisah.
_Avoid_: atasan, korektor, admin

### Waktu

**Pekan**:
Satuan periode pelaporan mingguan: Minggu 00:00 s.d. Sabtu 23:59:59 WIB (Asia/Jakarta). Tiap pasangan Supervisor & Pekan memiliki tepat satu Laporan Pekan, dibuat otomatis saat Pekan dimulai hanya bila Supervisor memiliki minimal satu Anggota Langsung saat itu; Supervisor tanpa Anggota Langsung tidak punya Laporan Pekan (ditampilkan sebagai "Tidak ada Anggota Langsung").
_Avoid_: minggu, week

**Pekan Berjalan**:
Pekan yang belum berakhir menurut WIB. Selama Pekan Berjalan Laporan Pekan berstatus Draf dan hanya bisa diubah Supervisor pemiliknya.

**Pekan Lampau**:
Pekan yang sudah berakhir. Laporan Pekan Supervisor terkunci; hanya Atasan Supervisor yang bisa mengoreksinya.

### Laporan Pekan

**Laporan Pekan**:
Data yang disubmit Supervisor untuk satu Pekan mengenai Anggota Langsungnya saja (bukan turunan). Nama grup data: kehadiran meeting, follow-up, sebar media, one-on-one. Setiap Anggota Langsung punya satu baris laporan di dalamnya; Anggota yang bergabung di tengah Pekan mendapat baris baru di Draf yang sama, sedangkan baris Anggota yang keluar di tengah Pekan yang sudah berisi nilai tetap tersimpan. Satu-satunya sumber kebenaran untuk data tersebut, kecuali Iuran yang punya kejadian sendiri.
_Avoid_: rekap, formulir

**Draf**:
Status Laporan Pekan yang dibuat server saat Pekan dimulai; belum resmi dan kosong. Laporan Draf yang tidak pernah dikirim tetap tersimpan dan tampil sebagai "Tidak Terkirim" bagi Atasan Supervisor. Karena setiap baris Anggota wajib diisi, draf kosong tidak pernah sama dengan laporan terisi.
_Avoid_: draft, sementara

**Terkirim**:
Status Laporan Pekan setelah Supervisor menyelesaikan dan mengirimnya. Sejak itu Supervisor tidak bisa mengubahnya; data menjadi resmi.

**Mengisi Sendiri**:
Aturan bahwa Supervisor wajib memasukkan setiap nilai Anggota satu per satu sebelum bisa mengirim; tombol kirim tidak aktif selama masih ada nilai kosong. Draf tidak boleh dikirim tanpa disentuh, agar Supervisor benar-benar memeriksa datanya.
_Avoid_: submit draf, kirim cepat

**Koreksi**:
Perubahan yang dilakukan Atasan Supervisor terhadap Laporan Pekan milik Supervisor-nya. Setiap Koreksi mewajibkan alasan dan menyimpan nilai lama.

**Dikoreksi**:
Laporan Pekan yang sudah pernah diubah lewat Koreksi.

**Status Kehadiran**:
Satu nilai per Anggota per Pekan, dari himpunan tetap: `Tepat Waktu`, `Terlambat < 15 Menit`, `Terlambat > 15 Menit`, `Sakit` (tidak hadir), `Tanpa Keterangan` (hadir/tidak hadir tak disebutkan). Anggota sakit yang tetap hadir dilaporkan dengan status kehadiran waktunya dan Keterangan Kehadiran.
_Avoid_: presensi, absensi

**Keterangan Kehadiran**:
Catatan bebas Supervisor yang melengkapi Status Kehadiran seorang Anggota pada satu Pekan. Boleh kosong.
_Avoid_: catatan, keterangan saja

**Keterangan One-on-One**:
Catatan bebas Supervisor tentang isi One-on-One seorang Anggota pada satu Pekan. Boleh kosong.
_Avoid_: catatan pertemuan

**Sebar Media**:
Jumlah media promosi yang disebar seorang Anggota pada satu Pekan, dicatat terpisah sebagai dua bilangan bulat ≥ 0 (online dan offline) yang diketik Supervisor di Laporan Pekan. Tidak ada kejadian per penyebaran; tidak bisa diaudit per pengiriman.
_Avoid_: promosi, iklan

**One-on-One**:
Pertemuan pribadi Supervisor dengan seorang Anggota, dicatat per Anggota Langsung per Pekan dengan tepat satu cara: `Pribadi`, `Sebelum Meeting Pekanan`, atau `Alpa` (tidak dilakukan, berarti tidak terjadi). Wajib diisi; `Alpa` adalah pilihan sah. Boleh dilengkapi Keterangan One-on-One. Ditampilkan biasa di layar Atasan Supervisor, tanpa penandaan khusus.
_Avoid_: 1:1, coaching, mentoring

### Klien & Follow-up

**Klien**:
Sasaran penawaran produk yang dimiliki tepat satu Karyawan (pemilik) dan dipantau lewat Follow-up.
_Avoid_: customer, pelanggan, prospek

**Pengambilalihan Klien**:
Perpindahan kepemilikan Klien ke Karyawan lain ketika pemiliknya resign, berhenti, atau berpindah Supervisor. Wajib dilakukan agar Klien tidak terbengkalai. Tidak ada riwayat pemegangan terpisah; kepemilikan Klien hanya satu Karyawan pada satu waktu.
_Avoid_: transfer klien, takeover

**Follow-up**:
Satu kejadian kontak dengan Klien, dicatat per kejadian: Klien, tanggal (tidak boleh di masa depan), satu Hasil Follow-up, dan deskripsi perkembangan yang opsional. Jumlah Follow-up seorang Anggota pada suatu Pekan adalah hitungan kejadian bertanggal di Pekan itu, bukan angka manual.
_Avoid_: aktivitas, telpon, jumlah follow-up (angka manual)

**Hasil Follow-up**:
Master status perkembangan sebuah Follow-up, dipilih dari pilihan seperti `Tertarik`, `Belum Tertarik`, `Tidak Respon`. Disimpan sebagai tabel master (bisa ditambah admin), bukan enum di kode.
_Avoid_: status klien, outcome

### Iuran

**Iuran**:
Kewajiban Perhimpunan yang dibayar Karyawan per bulan dengan satu Nominal Iuran; dicatatkan saat dibayar dan tampil kosong pada pekan-pekan berikutnya setelah lunas.
_Avoid_: kas, sumbangan

**Nominal Iuran**:
Master pilihan nominal (atau paket) Iuran. Karyawan cukup memilih salah satunya saat membayar; nominal tidak ditulis bebas.
_Avoid_: tarif, harga, jenis iuran

**Pembayaran Iuran**:
Kejadian seorang Karyawan melunasi Iuran untuk satu bulan tertentu dengan satu Nominal Iuran dan tanggal bayar. Dicatat oleh Karyawan itu sendiri, atau oleh Supervisor-nya atas nama Karyawan tersebut (pencatat ikut tercatat). Bulan yang dibayar hanya bulan berjalan atau bulan lampau yang belum lunas; tidak boleh bulan mendatang. Laporan Pekan hanya menampilkan Pembayaran Iuran bulan berjalan bagi Anggota Langsung; tidak ada status iuran yang disimpan di laporan, dan bulan yang belum dibayar hanya "berstatus belum lunas" secara turunan.
_Avoid_: transaksi, setoran

**Perhimpunan**:
Organisasi yang menaungi Karyawan dan memungut Iuran.
_Avoid_: organisasi, perkumpulan, koperasi
