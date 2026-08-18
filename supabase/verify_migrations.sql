-- ============================================================
-- VERIFIKASI 3 MIGRATION — Jalankan di SQL Editor Supabase
-- ============================================================

-- ── 1. Cek overload process_isi_stok_paket ──────────────────
-- HARUS: cuma 1 baris (versi 3-arg dengan p_total_berat)
-- KALAU 2 baris = migration 20260909 belum jalan
SELECT
  p.proname AS nama_fungsi,
  pg_get_function_arguments(p.oid) AS signature,
  CASE WHEN p.pronargs = 3 THEN '✅ Benar (3 arg)' ELSE '❌ MASIH ADA OVERLOAD!' END AS status
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.proname = 'process_isi_stok_paket';


-- ── 2. Cek increment_point & reset_pelanggan_id_seq ──────────
-- HARUS: 2 baris (keduanya ada)
-- KALAU kosong = migration 20260910 belum jalan
SELECT
  p.proname AS nama_fungsi,
  pg_get_function_arguments(p.oid) AS signature,
  '✅ Ada' AS status
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.proname IN ('increment_point', 'reset_pelanggan_id_seq');


-- ── 3. Cek trigger sync_harga_jual_besar ─────────────────────
-- HARUS: 1 baris
-- KALAU kosong = migration 20260911 belum jalan
SELECT
  tgname AS nama_trigger,
  tgrelid::regclass AS tabel,
  '✅ Ada' AS status
FROM pg_trigger
WHERE tgname = 'trg_sync_harga_jual_besar';


-- ── 4. Cek SEMUA RPC sekaligus (quick overview) ──────────────
-- Pastikan semua 11 function + 1 trigger ada
SELECT
  p.proname AS nama_fungsi,
  pg_get_function_arguments(p.oid) AS signature,
  CASE
    WHEN p.proname = 'process_checkout' THEN '✅ Checkout'
    WHEN p.proname = 'process_barang_masuk' THEN '✅ Barang Masuk'
    WHEN p.proname = 'cancel_barang_masuk' THEN '✅ Cancel BM'
    WHEN p.proname = 'process_retur_pembelian' THEN '✅ Retur'
    WHEN p.proname = 'process_stok_opname_apply' THEN '✅ Stok Opname'
    WHEN p.proname = 'batalkan_sesi_stok_opname' THEN '✅ Batalkan Opname'
    WHEN p.proname = 'process_isi_stok_paket' THEN '✅ Isi Stok Paket'
    WHEN p.proname = 'increment_point' THEN '✅ Member Point'
    WHEN p.proname = 'reset_pelanggan_id_seq' THEN '✅ Reset Seq'
    WHEN p.proname = 'get_inventory_value_at_date' THEN '✅ Neraca'
    WHEN p.proname = 'tambah_log_aktivitas' THEN '✅ Log Aktivitas'
    ELSE '⚠️ Lainnya'
  END AS keterangan
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.proname IN (
    'process_checkout',
    'process_barang_masuk',
    'cancel_barang_masuk',
    'process_retur_pembelian',
    'process_stok_opname_apply',
    'batalkan_sesi_stok_opname',
    'process_isi_stok_paket',
    'increment_point',
    'reset_pelanggan_id_seq',
    'get_inventory_value_at_date',
    'tambah_log_aktivitas'
  )
ORDER BY p.proname;
