-- ============================================================================
-- 01_SNAPSHOT_SEBELUM_SIMULASI.sql
-- Restore point sebelum simulasi kasir (pembelian barang & transaksi penjualan)
--
-- ⚠️ JALANKAN DULU di Supabase SQL Editor SEBELUM memulai simulasi.
--
-- Script ini AMAN: tidak menghapus / mengubah data apa pun, hanya membuat
-- 3 tabel permanen sebagai titik pemulihan:
--
--   _sim_snapshot_produk     → salinan state produk saat ini
--                              (stok, stok_gudang, harga_pokok_avco,
--                               nilai_persediaan, harga_modal, updated_at)
--   _sim_snapshot_pelanggan  → salinan poin member (pelanggan.point) — karena
--                              checkout otomatis menambah poin saat total
--                              >= poin_min_pembelian
--   _sim_marker              → penanda waktu snapshot + ID maksimum barang_masuk
--
-- Ketiga tabel ini dibaca oleh 02_rollback_simulasi.sql untuk:
--   • menghapus HANYA data dummy yang dibuat SETELAH snapshot
--     (barang masuk, transaksi penjualan, retur, riwayat AVCO, log, pelanggan baru)
--   • memulihkan stok & AVCO produk, dan poin member, ke kondisi sebelum simulasi
--
-- Catatan: AVCO (harga pokok rata-rata) dihitung berantai dari mutasi
-- sebelumnya, sehingga tidak bisa dibalik manual dengan andal. Snapshot
-- produk inilah cara paling aman untuk mengembalikan stok & HPP.
--
-- Bisa dijalankan berulang: snapshot lama akan ditimpa dengan yang baru.
-- ============================================================================

-- 1) Snapshot state produk
DROP TABLE IF EXISTS _sim_snapshot_produk;
CREATE TABLE _sim_snapshot_produk AS
SELECT
  id,
  stok,
  stok_gudang,
  harga_pokok_avco,
  nilai_persediaan,
  harga_modal,
  updated_at
FROM produk;

-- 2) Snapshot poin member (untuk memulihkan poin setelah checkout)
DROP TABLE IF EXISTS _sim_snapshot_pelanggan;
CREATE TABLE _sim_snapshot_pelanggan AS
SELECT id, point FROM pelanggan;

-- 3) Marker: waktu snapshot + ID maksimum barang_masuk saat ini
--    (barang_masuk.id dipakai sebagai pengaman ganda selain created_at)
DROP TABLE IF EXISTS _sim_marker;
CREATE TABLE _sim_marker AS
SELECT
  now()                                                    AS waktu_snapshot,
  COALESCE((SELECT MAX(id) FROM barang_masuk), 0)          AS max_id_barang_masuk;

-- 4) Konfirmasi snapshot berhasil
SELECT 'Snapshot selesai — silakan mulai simulasi' AS status,
       waktu_snapshot,
       max_id_barang_masuk
FROM _sim_marker;

SELECT count(*) AS jumlah_produk_disnapshot FROM _sim_snapshot_produk;
SELECT count(*) AS jumlah_pelanggan_disnapshot FROM _sim_snapshot_pelanggan;
