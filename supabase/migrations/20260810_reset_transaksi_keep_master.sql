-- 20260810_reset_transaksi_keep_master.sql
-- Hapus SEMUA data riwayat transaksi (barang masuk, penjualan, stok opname,
-- absensi, log, kas, AVCO) TETAPI PERTAHANKAN data master:
--     produk, supplier, kategori, satuan, merk, metode_bayar,
--     lokasi_area, pengguna, pengaturan, pengaturan_keuangan
-- Catatan: stok / harga_pokok_avco / nilai_persediaan di tabel produk
--          TIDAK ikut direset (tetap sesuai nilai terakhir).
--          Jika ingin reset juga, jalankan blok OPTIONAL di bawah.

BEGIN;

-- Truncate semua tabel transaksional + reset auto increment.
-- CASCADE hanya menjangkau turunan (child) dari tabel yang dilist,
-- tidak akan menyentuh tabel master.
TRUNCATE TABLE
  transaksi_keluar,          -- + detail_transaksi_keluar (child)
  barang_masuk,
  stok_opname,
  sesi_stok_opname,
  absensi,
  qr_session,
  saldo_kas_harian,
  riwayat_avco,
  log_aktivitas,
  pelanggan
RESTART IDENTITY CASCADE;

-- OPSIONAL: reset stok & AVCO produk ke nol (jalankan jika ingin bersih total)
-- UPDATE produk SET
--   stok = 0,
--   stok_gudang = 0,
--   harga_pokok_avco = 0,
--   nilai_persediaan = 0,
--   updated_at = now()
-- WHERE hitung_stok = true;

COMMIT;