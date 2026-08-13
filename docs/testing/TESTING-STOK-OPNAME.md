# Panduan Uji Manual & Dokumentasi — Modul Stok Opname

> Dokumen panduan step-by-step untuk memverifikasi fungsionalitas dan alur bisnis **Modul Stok Opname** (berdasarkan standar praktik akuntansi & retail).
>
> **Status**: Semua task terkait Stok Opname (Tier 1 & Tier 2) sudah selesai dikerjakan. Dokumen ini merupakan gabungan dari Panduan Pengguna dan Checklist Verifikasi Manual. Jalankan secara berurutan dan centang tiap langkah setelah lolos untuk memastikan tidak ada yang terlewat & tidak ada regresi.

---

## PRASYARAT

- [ ] Semua migration di bawah SUDAH dijalankan di Supabase **SQL Editor** (berurutan, tanpa error):
    1. `20260810_stok_opname_sesi.sql` (atau versi migration stok opname terbaru)
- [ ] Login sebagai **ADMIN** atau **OWNER** di `http://localhost:3000` (KASIR/KARYAWAN tidak bisa mengakses).
- [ ] Pastikan ada minimal **2-3 produk** di Inventaris (`/dashboard/inventory`) dengan stok awal yang diketahui (misal > 10).
- [ ] Siapkan file CSV template uji (untuk Test 2) berisi: `SKU / Barcode, Stok Fisik, Keterangan`.

---

## ALUR BISNIS & ATURAN PENTING (Referensi)

1. **Stok di-Snapshot saat Simpan Draft**: `Stok Sistem` dan `Harga Pokok` diambil dari database saat input/draft, bukan saat apply. Ini memastikan nilai Rp akurat saat penghitungan.
2. **Tidak Freeze Transaksi**: Toko tetap beroperasi. Jika stok berubah antara input dan apply, fitur **Muat Ulang Stok** digunakan untuk menyegarkan data.
3. **Apply = Permanen**: Saat diterapkan, stok produk berubah, riwayat AVCO tercatat (jenis: `koreksi`), sesi jadi SELESAI, dan tidak bisa diedit.
4. **Hanya Satu Aksi per Sesi**: Sesi hanya bisa di-apply satu kali. Menggunakan PostgreSQL advisory lock (`987654323`).

---

## TIER 1 & 2 — PENGUJIAN MODUL STOK OPNAME

### TEST 1 — Mulai Sesi Stok Opname

**Lokasi**: `/dashboard/inventory/stock-opname`

1. Buka menu **Inventaris → Stok Opname**.
2. Di form "Mulai Sesi Stok Opname", biarkan **Tanggal Opname** default (hari ini di zona Asia/Jakarta).
3. Isi **Keterangan** (contoh: "Opname bulanan Agustus").
4. Klik **Mulai Opname**.

**Hasil yang diharapkan**:
- [ ] Form berhasil disubmit.
- [ ] Redirect ke langkah 2 (Input Fisik) dengan nomor sesi format `OP-YYYYMMDD-NN` (contoh: OP-20260831-01).
- [ ] Sesi DRAFT dibuat di database, **stok produk belum berubah**.

---

### TEST 2 — Input Fisik & Klasifikasi (Manual & CSV)

**Lokasi**: Langkah 2 (Input Fisik) Sesi DRAFT

1. **Tambah Manual**:
   - Klik **"+ Tambah Baris"**.
   - Cari dan pilih produk pertama (Produk A).
   - Isi **Stok Fisik** lebih kecil dari Stok Sistem (defisit).
   - Pilih Klasifikasi **Hilang**, Keterangan "bocor/rusak".
2. **Tambah via Import CSV**:
   - Klik **"Import CSV"**.
   - Unggah file CSV uji yang berisi SKU Produk B, stok fisik lebih besar dari sistem (surplus), dan keterangan.
3. **Periksa Perhitungan Otomatis**:
   - Selisih terhitung: `Stok Fisik - Stok Sistem`.
   - Warna indikator: 0 (abu-abu), negatif (merah), positif (hijau).

**Hasil yang diharapkan**:
- [ ] Baris manual bisa ditambahkan dan produk bisa dicari.
- [ ] Import CSV berhasil mengisi baris sesuai data file.
- [ ] Selisih (Selisih = Fisik - Sistem) dihitung otomatis per baris dengan indikator warna yang benar.

---

### TEST 3 — Simpan Draft & Peringatan Perubahan Stok

**Lokasi**: Langkah 2 (Input Fisik) & Tab Baru

1. Klik **Simpan Draft** di footer kanan.
2. Buka tab browser baru (tanpa menutup tab opname).
3. Di tab baru, buka `/dashboard/inventory` atau `/pos` dan **ubah stok Produk A** (misal: tambah qty via Barang Masuk atau kurangi via POS).
4. Kembali ke tab Stok Opname, refresh halaman (atau sistem akan mendeteksi saat navigasi/simpan).
5. Akan muncul banner peringatan: **"⚠ Stok berubah sejak input"** pada baris Produk A.
6. Klik **Muat Ulang Stok Sistem** di header tabel.

**Hasil yang diharapkan**:
- [ ] Simpan Draft berhasil meng-overwrite baris ke DB, sesi tetap DRAFT, stok aktual produk di DB tidak berubah.
- [ ] Peringatan stok berubah muncul jika stok di DB berbeda dengan stok sistem di baris draft.
- [ ] Klik "Muat Ulang Stok Sistem" berhasil memperbarui `stok_sistem` di baris ke nilai terbaru dari database, dan selisih terhitung ulang.

---

### TEST 4 — Review & Terapkan Opname

**Lokasi**: Langkah 3 (Review & Terapkan)

1. Pastikan Anda memiliki produk yang defisit (Hilang/Rusak) dan surplus (Kelebihan) atau nol.
2. Klik **Simpan Draft** lalu klik tab/tombol **Lanjut ke Review** (jika ada) atau klik **Review & Terapkan**.
3. Di Tampilan Review, periksa:
   - **Kartu Ringkasan**: Total Item, Total Selisih, Surplus (Rp), Defisit (Rp) — dihitung dari `Selisih × harga_pokok_snap`.
   - **Breakdown per Klasifikasi**: Menampilkan jumlah item dan nilai Rp per klasifikasi.
   - **Tabel Detail**: Daftar item lengkap beserta nilai (Rp).
4. Klik **Terapkan Opname** → Muncul konfirmasi → Klik **Ya, Terapkan**.

**Hasil yang diharapkan**:
- [ ] Layar Review menampilkan kalkulasi Total Item, Selisih, Surplus, Defisit (Rp) dan Shrinkage dengan benar.
- [ ] Proses apply berhasil secara atomik (status Sesi → SELESAI, `applied_at` terisi).
- [ ] **Stok display produk di sistem berubah** sesuai `stok_fisik` yang dimasukkan.
- [ ] Buka `/dashboard/inventory`, pilih produk yang di-opname, cek tab **Riwayat AVCO**. Pastikan ada mutasi jenis `koreksi` dengan stok sesudah & avco sesudah yang akurat.

---

### TEST 5 — Batalkan Sesi DRAFT

1. Mulai Sesi Stok Opname baru (Test 1).
2. Tambahkan 1 produk acak dan simpan draft.
3. Klik **Batalkan Sesi** di footer kiri (baik di langkah 2 atau 3).

**Hasil yang diharapkan**:
- [ ] Status sesi menjadi **DIBATALKAN**.
- [ ] Semua baris draft di dalam sesi dihapus dari database.
- [ ] Stok produk **TIDAK berubah**.

---

### TEST 6 — Riwayat Stok Opname

**Lokasi**: `/dashboard/inventory/stock-opname/history`

1. Buka menu Riwayat Stok Opname.
2. Anda akan melihat sesi SELESAI dari Test 4 dan sesi DIBATALKAN dari Test 5.
3. Klik kartu (accordion) sesi SELESAI untuk melihat detail (tabel item, operator, tanggal, nilai Rp).
4. Uji **Pencarian** (ketik nomor sesi/operator) dan **Filter Tanggal**.
5. Klik **Export CSV** atau **Export PDF** pada salah satu sesi.

**Hasil yang diharapkan**:
- [ ] Daftar sesi tampil berurutan (terbaru di atas) dengan badge status yang sesuai.
- [ ] Accordion bisa dibuka menampilkan detail lengkap baris-baris opname.
- [ ] Pencarian dan filter tanggal berfungsi.
- [ ] Export CSV/PDF per sesi (dan Export Semua) berhasil diunduh dan datanya benar.

---

### TEST 7 — Laporan Stok Opname & Analisis Shrinkage

**Lokasi**: `/dashboard/laporan/stok-opname`

1. Buka menu Laporan Stok Opname.
2. Pastikan filter rentang tanggal mencakup hari ini.
3. Cek Kartu Ringkasan: Total Sesi, Total Item Diperiksa, Total Defisit (Rp), Total Surplus (Rp).
4. Cek Tabel Bulanan: Menampilkan agregat per bulan beserta persentase **Shrinkage %** (`|Defisit| / (|Defisit| + Surplus) × 100%`).
5. Klik tombol **Export** di kanan atas.

**Hasil yang diharapkan**:
- [ ] Laporan hanya menghitung sesi dengan status **SELESAI**.
- [ ] Kalkulasi Total (Rp) dan Shrinkage % sesuai dengan akumulasi seluruh sesi di bulan tersebut.
- [ ] Export CSV/PDF dari halaman laporan berhasil diunduh.

---

### TEST 8 — Role-Based Access Control (RBAC)

1. Logout dari akun ADMIN/OWNER.
2. Login sebagai akun ber-role **KASIR** atau **KARYAWAN**.
3. Coba akses `/dashboard/inventory/stock-opname`, `/dashboard/inventory/stock-opname/history`, dan `/dashboard/laporan/stok-opname`.

**Hasil yang diharapkan**:
- [ ] Menu Stok Opname tidak muncul di sidebar.
- [ ] Akses langsung URL ditolak (redirect ke halaman akses ditolak / tidak ditemukan).

---

## REGRESI — Pastikan Fitur Lain Tetap Jalan

- [ ] **Checkout POS normal**: Buka `/pos`, pilih produk, bayar → transaksi sukses & stok display berkurang.
- [ ] **Barang masuk biasa**: Tambah barang masuk (`/dashboard/inventory/stock-in`) → stok gudang bertambah.
- [ ] **Restock display**: Pindahkan stok (gudang → display) tetap normal.
- [ ] **Laba Rugi & Neraca**: Laporan keuangan bisa dibuka tanpa error, dan Nilai Persediaan terhitung akurat sesuai mutasi `koreksi` dari opname.

---

## TROUBLESHOOTING & CATATAN AKHIR

- **Sesi DRAFT tertinggal**: DRAFT tidak memengaruhi stok. Operator bebas membuat sesi baru, atau membatalkan sesi DRAFT lama lewat riwayat.
- **Race Condition / Sesi Ganda**: Sistem menggunakan `pg_advisory_xact_lock` pada saat fungsi `process_stok_opname_apply` dipanggil untuk mencegah eksekusi paralel pada sesi yang sama.
- **Audit Trail**: Setiap apply/batal tercatat di tabel `log_aktivitas` secara otomatis.
- **Jika Test di atas lolos semua**, maka seluruh flow modul Stok Opname (dari Panduan & TODO) sudah terintegrasi dan siap digunakan.
