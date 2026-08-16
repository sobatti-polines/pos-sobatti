-- ============================================================================
-- 02_ROLLBACK_SIMULASI.sql
-- Rollback simulasi kasir (pembelian barang & transaksi penjualan, data dummy)
--
-- ⚠️ Prasyarat: 01_snapshot_sebelum_simulasi.sql SUDAH dijalankan
--    SEBELUM simulasi dimulai. Jika belum, script ini akan dibatalkan.
--
-- Yang dilakukan (dalam SATU transaksi, rollback otomatis bila gagal):
--
--   A. Menghapus data dummy yang dibuat setelah snapshot:
--        • transaksi_keluar + detail_transaksi_keluar   (penjualan POS)
--        • barang_masuk                                 (pembelian, AKTIF & DIVOID)
--        • retur_pembelian + detail_retur_pembelian     (via CASCADE)
--        • riwayat_avco                                 (mutasi 'penjualan',
--                                                         'pembelian', 'retur_beli')
--        • log_aktivitas                                (entitas barang_masuk
--                                                         & retur_pembelian)
--        • pelanggan baru yang didaftarkan saat simulasi
--
--   B. Memulihkan state dari snapshot:
--        • produk  → stok, stok_gudang, harga_pokok_avco, nilai_persediaan,
--                    harga_modal, updated_at
--        • pelanggan → poin member (point dikembalikan ke nilai sebelum checkout)
--
--   C. (OPSIONAL) Data lain yang ikut tersimulasi: tutup kasir (saldo_kas_harian),
--        pengeluaran operasional, stok opname. Aktifkan sesuai kebutuhan.
--
--   D. (OPSIONAL) Reset sequence.
--
-- Setelah rollback, jalankan query VERIFIKASI di bagian bawah — semua hasil
-- harus 0 (tidak ada sisa data dummy).
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- Prasyarat: pastikan snapshot sudah ada sebelum simulasi
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  v_ada_marker   BOOLEAN;
  v_ada_snapshot BOOLEAN;
  v_jumlah       INTEGER;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM pg_tables
    WHERE schemaname = 'public' AND tablename = '_sim_marker'
  ) INTO v_ada_marker;

  SELECT EXISTS (
    SELECT 1 FROM pg_tables
    WHERE schemaname = 'public' AND tablename = '_sim_snapshot_produk'
  ) INTO v_ada_snapshot;

  IF NOT v_ada_marker OR NOT v_ada_snapshot THEN
    RAISE EXCEPTION 'Snapshot belum ada — jalankan 01_snapshot_sebelum_simulasi.sql SEBELUM simulasi. Rollback dibatalkan.';
  END IF;

  SELECT count(*) INTO v_jumlah FROM _sim_snapshot_produk;
  IF v_jumlah = 0 THEN
    RAISE EXCEPTION 'Snapshot produk kosong. Rollback dibatalkan.';
  END IF;
END $$;

-- ============================================================================
-- BAGIAN A — HAPUS DATA DUMMY
-- ============================================================================

-- 1) Retur pembelian (detail_retur_pembelian ikut terhapus via ON DELETE CASCADE)
DELETE FROM retur_pembelian
WHERE created_at > (SELECT waktu_snapshot FROM _sim_marker);

-- 2) Barang masuk — semua baris dummy sejak snapshot (AKTIF maupun DIVOID).
--    Filter ganda (id + created_at) agar aman dari baris dengan id kecil
--    yang mungkin diinput manual saat simulasi.
--    created_at bertipe timestamp (tanpa tz) dan tersimpan dalam UTC, jadi
--    dibandingkan via AT TIME ZONE 'UTC' agar tidak terpengaruh timezone sesi.
DELETE FROM barang_masuk
WHERE id > (SELECT max_id_barang_masuk FROM _sim_marker)
   OR (created_at AT TIME ZONE 'UTC') > (SELECT waktu_snapshot FROM _sim_marker);

-- 3) Detail transaksi penjualan — hapus DULU (FK ke transaksi_keluar),
--    sebelum header-nya. tgl_transaksi & created_at juga timestamp UTC.
DELETE FROM detail_transaksi_keluar
WHERE id_transaksi IN (
  SELECT id FROM transaksi_keluar
  WHERE (tgl_transaksi AT TIME ZONE 'UTC') > (SELECT waktu_snapshot FROM _sim_marker)
     OR (created_at   AT TIME ZONE 'UTC') > (SELECT waktu_snapshot FROM _sim_marker)
);

-- 4) Header transaksi penjualan (transaksi dummy dari simulasi kasir)
DELETE FROM transaksi_keluar
WHERE (tgl_transaksi AT TIME ZONE 'UTC') > (SELECT waktu_snapshot FROM _sim_marker)
   OR (created_at   AT TIME ZONE 'UTC') > (SELECT waktu_snapshot FROM _sim_marker);

-- 5) Riwayat AVCO yang dibuat sejak snapshot
--    (mencakup mutasi 'penjualan' dari checkout, 'pembelian' dari barang masuk,
--     dan 'retur_beli' dari void / retur yang dilakukan saat simulasi)
DELETE FROM riwayat_avco
WHERE tanggal > (SELECT waktu_snapshot FROM _sim_marker);

-- 6) Log aktivitas terkait barang masuk & retur pembelian
DELETE FROM log_aktivitas
WHERE created_at > (SELECT waktu_snapshot FROM _sim_marker)
  AND entitas IN ('barang_masuk', 'retur_pembelian');

-- ============================================================================
-- BAGIAN B — PULIHKAN STATE DARI SNAPSHOT
-- ============================================================================

-- 7) Pulihkan produk: stok, stok_gudang, AVCO, nilai persediaan, harga_modal
UPDATE produk p
SET
  stok             = s.stok,
  stok_gudang      = s.stok_gudang,
  harga_pokok_avco = s.harga_pokok_avco,
  nilai_persediaan = s.nilai_persediaan,
  harga_modal      = s.harga_modal,
  updated_at       = s.updated_at
FROM _sim_snapshot_produk s
WHERE p.id = s.id;

-- 8) Hapus pelanggan baru yang didaftarkan saat simulasi (member dummy).
--    Dijalankan SETELAH transaksi dihapus (FK transaksi_keluar.id_pelanggan).
DELETE FROM pelanggan
WHERE (created_at AT TIME ZONE 'UTC') > (SELECT waktu_snapshot FROM _sim_marker);

-- 9) Pulihkan poin member (checkout otomatis menambah poin saat
--    total >= poin_min_pembelian) — dikembalikan ke nilai sebelum simulasi
UPDATE pelanggan c
SET point = s.point
FROM _sim_snapshot_pelanggan s
WHERE c.id = s.id;

-- ============================================================================
-- BAGIAN C — OPSIONAL: data lain yang ikut tersimulasi
--
-- Aktifkan (hapus tanda komentar) HANYA bila simulasi juga mencakup aktivitas
-- di bawah ini. Efek stok & AVCO dari data dummy sudah dikembalikan oleh
-- BAGIAN B, jadi bagian ini hanya membersihkan catatannya.
-- ============================================================================

-- 10) Tutup kasir (saldo_kas_harian) — isi rentang tanggal simulasi:
-- DELETE FROM saldo_kas_harian
-- WHERE tanggal BETWEEN '2026-08-15' AND '2026-08-15';

-- 11) Pengeluaran operasional (jika dicatat saat simulasi)
-- DELETE FROM pengeluaran
-- WHERE created_at > (SELECT waktu_snapshot FROM _sim_marker);

-- 12) Stok opname (jika dilakukan saat simulasi)
-- DELETE FROM stok_opname
-- WHERE (created_at AT TIME ZONE 'UTC') > (SELECT waktu_snapshot FROM _sim_marker);
-- DELETE FROM sesi_stok_opname
-- WHERE created_at > (SELECT waktu_snapshot FROM _sim_marker);

-- ============================================================================
-- BAGIAN D — OPSIONAL: reset sequence
--
-- Aktifkan bila ingin ID berikutnya lanjut dari posisi lama.
-- Biasanya tidak wajib — ID yang lebih tinggi tetap valid dan unik.
-- ============================================================================
-- SELECT setval(
--   pg_get_serial_sequence('barang_masuk', 'id'),
--   COALESCE((SELECT MAX(id) FROM barang_masuk), 1)
-- );
-- SELECT setval(
--   pg_get_serial_sequence('transaksi_keluar', 'id'),
--   COALESCE((SELECT MAX(id) FROM transaksi_keluar), 1)
-- );

COMMIT;

-- ============================================================================
-- VERIFIKASI — pastikan tidak ada sisa data dummy
-- (Semua kolom hasil harus bernilai 0)
-- ============================================================================
SELECT
  (SELECT count(*) FROM barang_masuk
    WHERE id > (SELECT max_id_barang_masuk FROM _sim_marker)
       OR (created_at AT TIME ZONE 'UTC') > (SELECT waktu_snapshot FROM _sim_marker)) AS sisa_barang_masuk,
  (SELECT count(*) FROM transaksi_keluar
    WHERE (tgl_transaksi AT TIME ZONE 'UTC') > (SELECT waktu_snapshot FROM _sim_marker)
       OR (created_at   AT TIME ZONE 'UTC') > (SELECT waktu_snapshot FROM _sim_marker)) AS sisa_transaksi,
  (SELECT count(*) FROM detail_transaksi_keluar
    WHERE id_transaksi IN (
      SELECT id FROM transaksi_keluar
      WHERE (tgl_transaksi AT TIME ZONE 'UTC') > (SELECT waktu_snapshot FROM _sim_marker)
         OR (created_at   AT TIME ZONE 'UTC') > (SELECT waktu_snapshot FROM _sim_marker)
    )) AS sisa_detail_transaksi,
  (SELECT count(*) FROM riwayat_avco
    WHERE tanggal > (SELECT waktu_snapshot FROM _sim_marker))           AS sisa_riwayat_avco,
  (SELECT count(*) FROM retur_pembelian
    WHERE created_at > (SELECT waktu_snapshot FROM _sim_marker))        AS sisa_retur,
  (SELECT count(*) FROM log_aktivitas
    WHERE created_at > (SELECT waktu_snapshot FROM _sim_marker)
      AND entitas IN ('barang_masuk', 'retur_pembelian'))               AS sisa_log,
  (SELECT count(*) FROM pelanggan
    WHERE (created_at AT TIME ZONE 'UTC') > (SELECT waktu_snapshot FROM _sim_marker)) AS sisa_pelanggan_baru;

-- ============================================================================
-- Pembersihan (jalankan nanti, setelah yakin tidak perlu rollback lagi):
--   DROP TABLE IF EXISTS _sim_snapshot_produk;
--   DROP TABLE IF EXISTS _sim_snapshot_pelanggan;
--   DROP TABLE IF EXISTS _sim_marker;
-- ============================================================================
