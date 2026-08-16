# Panduan Uji Manual — Modul Event Promo

> Dokumen panduan step-by-step untuk memverifikasi fitur **Event Promo (Diskon Otomatis Berbasis Tanggal)**.
> Mulai dari manajemen CRUD (Create, Read, Update, Delete) di dashboard admin, logika overlap tanggal, hingga integrasi efek harga promo di layar kasir dan daftar inventaris.

---

## PRASYARAT

- [ ] Pastikan file migrasi `20260814_add_event_promo.sql` SUDAH dijalankan di Supabase **SQL Editor** (sukses tanpa error).
- [ ] Tabel `event_promo`, `event_promo_produk`, dan fungsi RPC `get_harga_efektif_produk` sudah ada di database.
- [ ] Login sebagai **ADMIN** (atau OWNER) di `http://localhost:3000`.
- [ ] Pastikan ada minimal **2 produk** di Inventaris (`/dashboard/inventory`). (Misal: Produk A dan Produk B).
- [ ] (Opsional) Catat harga jual normal (Harga Satuan, Grosir, dll) dari Produk A dan Produk B sebelum pengujian.

> Jika ada langkah yang gagal, catat pesan errornya dan laporkan. Jangan lanjut ke test berikutnya sebelum memahami kenapa gagal.

---

## TIER 1 — Manajemen Event Promo (Dashboard)

### TEST 1 — Pembuatan Event Promo Baru (Nominal & Persen)

**Lokasi**: `/dashboard/event-promo`

1. Buka menu **Event Promo** dari sidebar dashboard.
2. Klik tombol **"+ Tambah Event"**.
3. Di dalam dialog, isikan form berikut:
   - **Nama Event**: `Promo Kemerdekaan`
   - **Rentang Tanggal**: Pilih dari tanggal hari ini hingga 3 hari ke depan.
   - **Tipe Diskon**: Pilih `Persentase (%)`
   - **Nilai Diskon**: `10` (artinya diskon 10%)
   - **Pilih Produk**: Cari dan centang **Produk A**.
   - **Status**: Pastikan toggle "Aktif" menyala.
4. Klik **Simpan**.

**Hasil yang diharapkan**:
- Toast sukses muncul ("Event promo berhasil disimpan").
- `Promo Kemerdekaan` tampil di daftar event promo.
- Klik badge "Lihat 1 Produk" di tabel, pastikan yang muncul adalah Produk A.

### TEST 2 — Pencegahan Overlap Tanggal (Validasi DB)

**Lokasi**: `/dashboard/event-promo`

1. Klik tombol **"+ Tambah Event"** lagi.
2. Isi form:
   - **Nama Event**: `Promo Overlap Test`
   - **Rentang Tanggal**: Pilih tanggal yang *beririsan/tumpang tindih* dengan event pertama (misal: besok sampai 5 hari ke depan).
   - **Tipe Diskon**: `Nominal (Rp)`
   - **Nilai Diskon**: `5000`
   - **Pilih Produk**: Centang **Produk A** (produk yang sama dengan Test 1).
   - **Status**: Aktif.
3. Klik **Simpan**.

**Hasil yang diharapkan**:
- Toast atau pesan error merah muncul menolak penyimpanan: **"Produk A sudah terdaftar di event aktif lain pada rentang tanggal tersebut."** (Atau error dari database berupa pencegahan overlap).
- Event `Promo Overlap Test` gagal dibuat jika produk yang dimasukkan bentrok.

### TEST 3 — Mengizinkan Overlap Jika Event Tidak Aktif

**Lokasi**: `/dashboard/event-promo`

1. Masih di form `Promo Overlap Test` (dari Test 2), matikan toggle **Aktif** (ubah ke Tidak Aktif).
2. Biarkan Produk A tetap terpilih, dan rentang tanggal tetap overlap.
3. Klik **Simpan**.

**Hasil yang diharapkan**:
- Proses penyimpanan **berhasil**.
- Tabel DB dan Trigger mengizinkan overlap *karena* salah satu event statusnya tidak aktif.

### TEST 4 — Edit Event Promo

**Lokasi**: `/dashboard/event-promo`

1. Pada baris `Promo Kemerdekaan` di daftar event, klik tombol icon pensil (Edit).
2. Ubah **Nilai Diskon** menjadi `15` (15%).
3. Tambahkan **Produk B** ke dalam pilihan produk.
4. Klik **Simpan**.

**Hasil yang diharapkan**:
- Toast sukses muncul.
- Di daftar, produk yang terhubung kini berjumlah 2 (Produk A dan B).
- Data berubah tanpa error.

### TEST 5 — Hapus Event Promo

**Lokasi**: `/dashboard/event-promo`

1. Pada baris event `Promo Overlap Test` (yang tidak aktif), klik tombol icon tempat sampah (Hapus).
2. Konfirmasi penghapusan di alert dialog.

**Hasil yang diharapkan**:
- Toast sukses muncul ("Event promo berhasil dihapus").
- Event tersebut hilang dari daftar.

---

## TIER 2 — Integrasi Harga Promo di Aplikasi

### TEST 6 — Tampilan Daftar Inventaris (Badge & Harga Coret)

**Lokasi**: `/dashboard/inventory`

1. Buka menu **Inventaris**.
2. Cari baris **Produk A** dan **Produk B**.
3. Cek kolom **Harga Jual**.

**Hasil yang diharapkan**:
- Harga normal (asli) ditampilkan dengan format *dicoret* (strikethrough) warna abu-abu.
- Harga promo (setelah diskon 15%) ditampilkan dengan warna merah/berbeda.
- Muncul badge kecil hijau/biru bertuliskan `🏷 Promo Kemerdekaan`.
- Produk lain (yang tidak masuk event promo) tetap menampilkan harga normal biasa tanpa coretan dan tanpa badge.

### TEST 7 — POS / Kasir (Penjualan dengan Harga Event)

**Lokasi**: `/pos`

1. Buka halaman **Kasir** (`/pos`).
2. Cari dan klik **Produk A** untuk dimasukkan ke keranjang/cart.
3. Di dalam daftar cart, cek **Harga Item**.
4. Coba ubah tipe harga (dari icon label di item cart) menjadi **Grosir** atau **Promo** (opsi manual). 

**Hasil yang diharapkan**:
- Harga produk saat pertama masuk cart adalah **harga efektif** setelah diskon promo (bukan harga normal).
- Terdapat indikator / badge `🏷 Promo Kemerdekaan` pada nama item di cart atau daftar produk.
- Semua layer harga (Satuan, Grosir, Harga Promo bawaan) otomatis ikut terdiskon sesuai aturan `15%` karena ini *computed pricing*.

### TEST 8 — Transaksi Checkout dan Bukti Faktur

**Lokasi**: `/pos`

1. Lanjutkan pembayaran (Checkout) untuk cart berisi Produk A tadi (bayar lunas/tunai).
2. Setelah transaksi sukses, Anda akan diarahkan ke halaman invoice/struk (`/pos/invoice/[id]`).

**Hasil yang diharapkan**:
- Nominal harga di struk sesuai dengan **harga promo event**, BUKAN harga asli tabel produk.
- Kalkulasi total (termasuk diskon tambahan manual jika ada, dan pajak) tetap berjalan normal.

### TEST 9 — Expired Event (Tanggal Terlewat)

**Lokasi**: `/dashboard/event-promo` dan `/pos`

1. Kembali ke Dashboard admin, Edit `Promo Kemerdekaan`.
2. Ubah **Tanggal Selesai** menjadi **kemarin** (event sudah kadaluwarsa).
3. Klik **Simpan**.
4. Buka kembali halaman **Kasir** (`/pos`) dan **Inventaris** (`/dashboard/inventory`).

**Hasil yang diharapkan**:
- Harga Produk A dan B **kembali normal**.
- Tidak ada harga dicoret dan tidak ada badge promo di UI.
- Memasukkan ke cart di POS menggunakan harga normal sepenuhnya (tanpa diskon event).

---

## REGRESI — Pastikan Fitur Lama Tetap Jalan

1. [ ] **Penjualan Produk Non-Promo**: Lakukan transaksi POS untuk produk yang tidak di-assign ke event promo apa pun. Pastikan harga normal berlaku.
2. [ ] **Fitur Diskon Manual POS**: Di keranjang POS, coba input "Diskon Rp/Persen" (diskon keranjang manual). Pastikan perhitungannya tidak bentrok dan berjalan lancar di atas harga efektif.
3. [ ] **Barang Masuk**: Input Barang Masuk untuk Produk A (yang sedang promo). Pastikan perhitungan harga pokok (AVCO) dan riwayat HPP tidak error (karena barang masuk tidak pakai harga jual, tapi harga beli).
4. [ ] **Akses Kasir**: Login sebagai Role KASIR. Kasir harus bisa melihat harga promo dan badge di layar `/pos`, tetapi *tidak boleh* memiliki akses ke menu `/dashboard/event-promo` (harus di-block/redirect).

---

## CATATAN AKHIR

- Jika semua test di atas lolos (terutama validasi cegah *overlap* di DB dan harga efektif otomatis di kasir), maka **Modul Event Promo dinyatakan stabil**.
- Fitur ini murni berjalan di sisi SQL Query/RPC on-the-fly (`get_harga_efektif_produk`) saat halaman dimuat, sehingga tidak perlu mengecek _cron job_. Selama jam/tanggal server sudah sesuai (WIB), perpindahan harga promo ke normal pada lewat tengah malam otomatis langsung berlaku tanpa _delay_.
