-- ============================================================================
-- 00_SNAPSHOT_SEBELUM_TEST.sql
-- ----------------------------------------------------------------------------
-- Jalankan SEKALI di Supabase SQL Editor SEBELUM mulai testing
-- (docs/testing/TESTING-BARANG-MASUK.md).
--
-- Fungsi: membuat tabel _snap_* yang menyimpan baseline seluruh data
-- transaksional + kolom stok/AVCO/harga_modal produk. Baseline ini dipakai
-- oleh 01_rollback_setelah_test.sql untuk mengembalikan database ke kondisi
-- sebelum test (hanya menghapus data test, data lain dipertahankan).
--
-- Catatan:
--  * SQL Editor Supabase berjalan sebagai role postgres => bypass RLS,
--    aman untuk SELECT seluruh tabel.
--  * Aman dijalankan ulang (DROP + CREATE ulang tiap kali).
-- ============================================================================

DROP TABLE IF EXISTS _snap_transaksi_keluar;
DROP TABLE IF EXISTS _snap_detail_transaksi_keluar;
DROP TABLE IF EXISTS _snap_barang_masuk;
DROP TABLE IF EXISTS _snap_retur_pembelian;
DROP TABLE IF EXISTS _snap_detail_retur_pembelian;
DROP TABLE IF EXISTS _snap_riwayat_avco;
DROP TABLE IF EXISTS _snap_stok_opname;
DROP TABLE IF EXISTS _snap_sesi_stok_opname;
DROP TABLE IF EXISTS _snap_saldo_kas_harian;
DROP TABLE IF EXISTS _snap_log_aktivitas;
DROP TABLE IF EXISTS _snap_produk_stok;

CREATE TABLE _snap_transaksi_keluar      AS SELECT * FROM transaksi_keluar;
CREATE TABLE _snap_detail_transaksi_keluar AS SELECT * FROM detail_transaksi_keluar;
CREATE TABLE _snap_barang_masuk          AS SELECT * FROM barang_masuk;
CREATE TABLE _snap_retur_pembelian       AS SELECT * FROM retur_pembelian;
CREATE TABLE _snap_detail_retur_pembelian AS SELECT * FROM detail_retur_pembelian;
CREATE TABLE _snap_riwayat_avco          AS SELECT * FROM riwayat_avco;
CREATE TABLE _snap_stok_opname           AS SELECT * FROM stok_opname;
CREATE TABLE _snap_sesi_stok_opname      AS SELECT * FROM sesi_stok_opname;
CREATE TABLE _snap_saldo_kas_harian      AS SELECT * FROM saldo_kas_harian;
CREATE TABLE _snap_log_aktivitas         AS SELECT * FROM log_aktivitas;
CREATE TABLE _snap_produk_stok AS
  SELECT id, stok, stok_gudang, harga_pokok_avco, nilai_persediaan, harga_modal
  FROM produk;

-- Ringkasan baseline untuk verifikasi
SELECT 'barang_masuk' AS tabel, count(*) AS jumlah FROM _snap_barang_masuk
UNION ALL SELECT 'retur_pembelian',           count(*) FROM _snap_retur_pembelian
UNION ALL SELECT 'detail_retur_pembelian',    count(*) FROM _snap_detail_retur_pembelian
UNION ALL SELECT 'riwayat_avco',              count(*) FROM _snap_riwayat_avco
UNION ALL SELECT 'log_aktivitas',             count(*) FROM _snap_log_aktivitas
UNION ALL SELECT 'transaksi_keluar',          count(*) FROM _snap_transaksi_keluar
UNION ALL SELECT 'stok_opname',               count(*) FROM _snap_stok_opname
UNION ALL SELECT 'saldo_kas_harian',          count(*) FROM _snap_saldo_kas_harian
UNION ALL SELECT 'produk (snapshot stok)',    count(*) FROM _snap_produk_stok;
