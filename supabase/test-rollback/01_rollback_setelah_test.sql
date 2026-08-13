-- ============================================================================
-- 01_ROLLBACK_SETELAH_TEST.sql
-- ----------------------------------------------------------------------------
-- Jalankan di Supabase SQL Editor SETELAH selesai testing
-- (docs/testing/TESTING-BARANG-MASUK.md).
--
-- Fungsi: menghapus SEMUA data transaksional yang dibuat selama testing dan
-- mengembalikan stok/AVCO/harga_modal produk ke nilai baseline (pre-test).
-- Data transaksional yang SUDAH ADA sebelum test dipertahankan utuh (semua
-- baris disimpan di _snap_* oleh 00_snapshot_sebelum_test.sql).
--
-- Strategi:
--   1. DELETE baris yang TIDAK ada di snapshot (artinya baris test).
--      Urutan mengikuti foreign key (child -> parent).
--   2. Restore kolom stok/AVCO/harga_modal produk dari _snap_produk_stok.
--   3. Restore urutan sequence agar id baru tidak bentrok.
--
-- PENTING: wajib menjalankan 00_snapshot_sebelum_test.sql terlebih dahulu.
--          Jika tabel _snap_* belum ada, script ini akan error (aman).
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1) Hapus baris yang dibuat selama test (baris lama = tetap di snapshot)
-- ---------------------------------------------------------------------------

-- Child -> parent sesuai relasi FK
DELETE FROM detail_retur_pembelian
  WHERE id NOT IN (SELECT id FROM _snap_detail_retur_pembelian);

DELETE FROM retur_pembelian
  WHERE id NOT IN (SELECT id FROM _snap_retur_pembelian);

DELETE FROM detail_transaksi_keluar
  WHERE id NOT IN (SELECT id FROM _snap_detail_transaksi_keluar);

DELETE FROM transaksi_keluar
  WHERE id NOT IN (SELECT id FROM _snap_transaksi_keluar);

DELETE FROM stok_opname
  WHERE id NOT IN (SELECT id FROM _snap_stok_opname);

DELETE FROM sesi_stok_opname
  WHERE id NOT IN (SELECT id FROM _snap_sesi_stok_opname);

DELETE FROM barang_masuk
  WHERE id NOT IN (SELECT id FROM _snap_barang_masuk);

DELETE FROM riwayat_avco
  WHERE id NOT IN (SELECT id FROM _snap_riwayat_avco);

DELETE FROM saldo_kas_harian
  WHERE id NOT IN (SELECT id FROM _snap_saldo_kas_harian);

DELETE FROM log_aktivitas
  WHERE id NOT IN (SELECT id FROM _snap_log_aktivitas);

-- ---------------------------------------------------------------------------
-- 2) Restore stok / AVCO / nilai persediaan / harga_modal produk
-- ---------------------------------------------------------------------------

UPDATE produk p
SET
  stok              = s.stok,
  stok_gudang       = s.stok_gudang,
  harga_pokok_avco  = s.harga_pokok_avco,
  nilai_persediaan  = s.nilai_persediaan,
  harga_modal       = s.harga_modal,
  updated_at        = now()
FROM _snap_produk_stok s
WHERE p.id = s.id;

-- ---------------------------------------------------------------------------
-- 3) Restore urutan sequence (agar id baru di tabel berseri tidak bentrok).
--    Defensif: setval hanya dijalankan bila tabel memang punya sequence.
--    Pola sama dengan 20260810_fix_sequences_after_reset.sql
-- ---------------------------------------------------------------------------

DO $$
DECLARE
    tbl_name  text;
    seq_name  text;
    max_id    bigint;
BEGIN
    FOREACH tbl_name IN ARRAY ARRAY[
        'public.barang_masuk',
        'public.transaksi_keluar',
        'public.detail_transaksi_keluar',
        'public.stok_opname'
    ] LOOP
        EXECUTE format('SELECT pg_get_serial_sequence(%L, ''id'')', tbl_name) INTO seq_name;
        IF seq_name IS NOT NULL THEN
            EXECUTE format('SELECT COALESCE(MAX(id), 0) + 1 FROM %s', tbl_name) INTO max_id;
            EXECUTE format('SELECT setval(%L, %s, false)', seq_name, max_id);
        END IF;
    END LOOP;
END $$;

COMMIT;

-- ---------------------------------------------------------------------------
-- 4) Verifikasi: jumlah baris setelah rollback harus sama dengan baseline
-- ---------------------------------------------------------------------------

SELECT 'barang_masuk' AS tabel, count(*) AS jumlah FROM barang_masuk
UNION ALL SELECT 'retur_pembelian',           count(*) FROM retur_pembelian
UNION ALL SELECT 'detail_retur_pembelian',    count(*) FROM detail_retur_pembelian
UNION ALL SELECT 'riwayat_avco',              count(*) FROM riwayat_avco
UNION ALL SELECT 'log_aktivitas',             count(*) FROM log_aktivitas
UNION ALL SELECT 'transaksi_keluar',          count(*) FROM transaksi_keluar
UNION ALL SELECT 'stok_opname',               count(*) FROM stok_opname
UNION ALL SELECT 'saldo_kas_harian',          count(*) FROM saldo_kas_harian;
