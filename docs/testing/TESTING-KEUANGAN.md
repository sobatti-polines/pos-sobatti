## Goal Description
Dokumen ini berisi panduan alur pengujian (testing flow) manual untuk fitur **Modul Keuangan & Laporan Keuangan** (Fase A, B, dan C) berdasarkan `todo-keuangan.md`. Tujuannya adalah untuk memverifikasi konsistensi Laporan Laba Rugi, Neraca, Arus Kas, Tutup Kasir, serta memastikan tidak ada regresi pada sistem berjalan. Dokumen ini juga menyertakan prosedur rollback untuk membersihkan data dummy setelah proses testing selesai.

## User Review Required
> [!WARNING]
> **Prosedur Rollback Data Dummy**: Mengingat pengujian akan mencatat mutasi di berbagai tabel penting (penjualan, pengeluaran, barang masuk, retur, stok opname, riwayat AVCO, dan tutup kasir), sebuah skrip SQL disiapkan di bagian akhir untuk melakukan pembersihan data HARI INI. Mohon pastikan pengujian dilakukan di environment yang aman atau pastikan tidak ada transaksi asli di hari pengujian jika ingin menjalankan skrip rollback secara keseluruhan.

## Proposed Changes
> [!NOTE]
> Karena tugas ini merupakan pembuatan rencana pengujian, bagian ini berisi rincian Testing Flow dan prosedur Rollback yang akan didokumentasikan, dan bukan perubahan pada kode aplikasi secara langsung.

---

### TIER 1 — FASE A: Konsistensi & Neraca Balance

## TEST 1 — Skenario 100% Tunai & Tutup Kasir Normal
1. Lakukan **Barang Masuk** senilai Rp X secara tunai (pastikan stok & HPP/AVCO terupdate).
2. Lakukan transaksi **Checkout POS** secara Tunai senilai Rp Y.
3. Buka **Tutup Kasir** (`/dashboard/tutup-kasir`), pastikan total masuk (penjualan) dan total keluar (pembelian) sesuai dengan transaksi yang baru dibuat.
4. Input uang aktual sama dengan saldo sistem (selisih = 0), lalu konfirmasi Tutup Kasir.
5. Cek **Laba Rugi**: Pastikan Laba Kotor = Laba Bersih (jika belum ada beban).
6. Cek **Neraca**: Pastikan total Aset = total Kewajiban + Ekuitas (Penyesuaian Neraca = 0).

## TEST 2 — Skenario Penjualan QRIS/Transfer
1. Lakukan transaksi **Checkout POS** menggunakan metode bayar **QRIS/Transfer**.
2. Buka **Neraca** (`/dashboard/laporan/neraca`).
3. Cek baris **Kas Bank / QRIS**: Nilainya harus bertambah sesuai transaksi non-tunai tersebut.
4. Pastikan Neraca tetap *balance*.

## TEST 3 — Skenario Opname & Retur Pembelian
1. Lakukan **Stok Opname** dengan selisih fisik yang *lebih kecil* (muncul selisih minus).
2. Lakukan **Retur Pembelian** untuk barang masuk (dari Test 1).
3. Buka **Laba Rugi**: Pastikan muncul baris **Koreksi/Selisih Stok** di bagian Penyesuaian.
4. Buka **Neraca**: Pastikan baris **Penyesuaian Stok (opname/retur)** muncul di bagian Laba Ditahan, dan Neraca tetap *balance*.

## TEST 4 — Skenario Selisih Kas saat Tutup Kasir
1. Lakukan transaksi POS Tunai.
2. Buka **Tutup Kasir**, masukkan jumlah uang laci/aktual *lebih kecil* atau *lebih besar* dari saldo sistem.
3. Konfirmasi Tutup Kasir.
4. Buka **Laba Rugi**: Pastikan baris **Selisih Kas** muncul dengan nilai yang sesuai.
5. Buka **Neraca**: Pastikan baris Selisih Kas muncul di bagian Laba Ditahan (kumulatif), dan Neraca tetap *balance*.

## TEST 5 — Skenario Simulasi Hari Berjalan (Tanpa Tutup Kasir)
1. Lakukan transaksi Checkout POS hari ini.
2. JANGAN lakukan Tutup Kasir.
3. Buka **Neraca**: Pastikan saldo kas tetap mencerminkan akumulasi pergerakan hari ini (tidak *stale* di modal awal) dan Neraca tetap *balance*.

---

### TIER 2 — FASE B: Beban Operasional & Arus Kas

## TEST 6 — Pengeluaran Operasional Tunai
1. Buka halaman **Pengeluaran** (`/dashboard/keuangan/pengeluaran`).
2. Buat data pengeluaran baru, pilih kategori (mis. Gaji), masukkan nominal, dan pilih metode **Tunai**.
3. Buka **Tutup Kasir**: Pastikan pengeluaran tersebut tercatat di bagian *outflow* (rincian "Pengeluaran Operasional").
4. Buka **Neraca**: Pastikan Kas Tunai berkurang.
5. Buka **Laba Rugi**: Pastikan Laba Bersih berkurang, dan ada rincian beban operasional per kategori.

## TEST 7 — Pengeluaran Operasional Transfer
1. Buat data pengeluaran baru dengan metode **Transfer**.
2. Buka **Tutup Kasir**: Pastikan pengeluaran ini TIDAK masuk ke *outflow* kas laci tunai.
3. Buka **Laba Rugi**: Pastikan Beban bertambah dan Laba Bersih berkurang.
4. Buka **Neraca**: Pastikan Laba Ditahan berkurang dan Penyesuaian Neraca (residual) menampung selisih jika ada asumsi kas bank yang belum terpotong secara khusus.

## TEST 8 — Void Pengeluaran
1. Buka Riwayat Pengeluaran, lakukan **Void** pada data pengeluaran dari Test 6.
2. Buka **Laba Rugi** & **Neraca**: Pastikan beban tersebut hilang dari Laba Rugi dan kas kembali utuh di Neraca.

## TEST 9 — Laporan Arus Kas
1. Buka halaman **Arus Kas** (`/dashboard/keuangan/arus-kas`).
2. Periksa rincian arus kas aktivitas operasi (Penerimaan Penjualan, Retur, Pembayaran Pembelian, Pembayaran Pengeluaran Operasional).
3. Pastikan angka total Kas Bersih konsisten dengan total pergerakan transaksi yang telah dilakukan di atas.

---

### TIER 3 — FASE C: Polish & Konsistensi

## TEST 10 — UI & Ekspor Data
1. Buka halaman Dashboard utama: Pastikan widget **Laba Bersih** dan **Beban Operasional** menampilkan nilai yang benar.
2. Di Laba Rugi, Neraca, dan Arus Kas, klik **Export CSV** dan **Cetak Dokumen**.
3. Pastikan PDF/Print Preview menampilkan header toko yang konsisten (dari `pengaturan`), tampilan rapi, dan blok tanda tangan tersedia.

---

## Verification Plan

### Manual Verification
Anda dapat mengikuti langkah-langkah skenario `TEST 1` hingga `TEST 10` di atas melalui web browser pada akun ber-role ADMIN/OWNER. Setiap langkah dirancang agar mencakup *edge case* modul akuntansi (kas basis & perpetual AVCO).

### Rollback / Cleanup Script (Data Dummy)
Setelah selesai melakukan verifikasi, jalankan skrip SQL di bawah ini pada **Supabase SQL Editor** untuk menghapus seluruh data yang dibuat HARI INI secara aman.

> [!CAUTION]
> Skrip di bawah ini akan menghapus SEMUA transaksi penjualan, barang masuk, retur, pengeluaran, stok opname, riwayat HPP, dan tutup kasir yang memiliki cap waktu (timestamp) hari ini. **JANGAN jalankan di database produksi jika Anda memiliki transaksi asli hari ini.**

```sql
BEGIN;

-- 1. Hapus Pengeluaran dummy
DELETE FROM pengeluaran WHERE created_at >= CURRENT_DATE;

-- 2. Hapus Transaksi POS dummy
DELETE FROM detail_transaksi_keluar WHERE id_transaksi IN (SELECT id FROM transaksi_keluar WHERE tgl_transaksi >= CURRENT_DATE);
DELETE FROM transaksi_keluar WHERE tgl_transaksi >= CURRENT_DATE;

-- 3. Hapus Barang Masuk & Retur dummy
DELETE FROM detail_retur_pembelian WHERE id_retur IN (SELECT id FROM retur_pembelian WHERE tgl_retur >= CURRENT_DATE);
DELETE FROM retur_pembelian WHERE tgl_retur >= CURRENT_DATE;
DELETE FROM barang_masuk WHERE created_at >= CURRENT_DATE;

-- 4. Hapus Stok Opname dummy
DELETE FROM stok_opname WHERE tgl_opname >= CURRENT_DATE;

-- 5. Hapus Saldo Kas Harian (Tutup Kasir) dummy
DELETE FROM saldo_kas_harian WHERE tanggal >= CURRENT_DATE;

-- 6. Hapus Riwayat AVCO dummy
DELETE FROM riwayat_avco WHERE tanggal >= CURRENT_DATE;

-- 7. Reset Stok & HPP Produk (OPSIONAL)
-- (Jalankan baris di bawah secara berhati-hati HANYA JIKA Anda ingin mereset seluruh nilai stok semua barang kembali ke 0)
-- UPDATE produk SET stok = 0, stok_gudang = 0, harga_pokok_avco = 0, nilai_persediaan = 0, harga_modal = 0;

COMMIT;
```
