-- 20260904_reset_data_drop_piutang.sql
-- Fresh start: hapus data transaksional, pertahankan referensi & pengguna.
-- Drop tabel piutang/hutang (fitur sudah dihapus dari kode).

-- 1) Drop tabel hutang/piutang + RLS policies (CASCADE otomatis)
DROP TABLE IF EXISTS pembayaran_piutang CASCADE;
DROP TABLE IF EXISTS piutang_dagang CASCADE;
DROP TABLE IF EXISTS pembayaran_hutang CASCADE;
DROP TABLE IF EXISTS hutang_dagang CASCADE;

-- 2) Truncate semua tabel transaksional + reset auto increment (RESTART IDENTITY)
--    PERTAHANKAN: pengguna, kategori, satuan, merk, metode_bayar, lokasi_area,
--                 pengaturan, pengaturan_keuangan
TRUNCATE TABLE
  produk,
  supplier,
  pelanggan,
  transaksi_keluar,
  detail_transaksi_keluar,
  barang_masuk,
  stok_opname,
  absensi,
  qr_session,
  saldo_kas_harian,
  riwayat_avco,
  log_aktivitas
RESTART IDENTITY CASCADE;
