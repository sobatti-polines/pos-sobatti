-- ============================================================================
-- VERIFICATION SCRIPT: 20260824_admin_stockin_no_price.sql
-- 
-- Tujuan: Memastikan migration berhasil dijalankan
-- Cara: Jalankan script ini setelah migration selesai
--
-- ============================================================================

-- 1. Cek apakah fungsi process_barang_masuk ada
SELECT 
  '✅ Fungsi process_barang_masuk exists' as status,
  proname,
  pg_get_function_result(oid) as returns
FROM pg_proc 
WHERE proname = 'process_barang_masuk';

-- 2. Cek apakah ada variabel v_has_cost di fungsi baru
-- (Ini menandakan fungsi sudah versi baru)
SELECT 
  CASE 
    WHEN prosrc LIKE '%v_has_cost%' THEN '✅ Migration berhasil - fungsi baru terdeteksi'
    ELSE '❌ Migration belum dijalankan - fungsi masih versi lama'
  END as migration_status
FROM pg_proc 
WHERE proname = 'process_barang_masuk';

-- 3. Cek struktur tabel barang_masuk
SELECT 
  column_name, 
  data_type,
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'barang_masuk' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- 4. Cek apakah ada barang masuk pending (total_cost = 0)
SELECT 
  COUNT(*) as pending_count,
  CASE 
    WHEN COUNT(*) > 0 THEN '⚠️ Ada barang masuk yang belum ditentukan harganya'
    ELSE '✅ Tidak ada barang masuk pending'
  END as status
FROM barang_masuk
WHERE status = 'AKTIF'
AND (total_cost = 0 OR harga_beli = 0);

-- 5. Cek sample data barang masuk terakhir
SELECT 
  bm.id,
  bm.tgl_masuk,
  p.nama_produk,
  bm.base_qty_added,
  bm.total_cost,
  bm.harga_beli,
  bm.status,
  CASE 
    WHEN bm.total_cost = 0 THEN '⏳ Menunggu harga dari owner'
    WHEN bm.total_cost > 0 THEN '✅ Harga sudah ditentukan'
    ELSE '❓ Status tidak diketahui'
  END as price_status
FROM barang_masuk bm
JOIN produk p ON bm.id_produk = p.id
ORDER BY bm.id DESC
LIMIT 10;

-- 6. Cek riwayat AVCO terakhir
SELECT 
  ra.id_referensi,
  p.nama_produk,
  ra.qty_masuk,
  ra.harga_satuan_transaksi,
  ra.avco_sesudah,
  ra.nilai_persediaan_sesudah,
  ra.jenis_mutasi,
  CASE 
    WHEN ra.harga_satuan_transaksi = 0 THEN '⏳ Harga belum ditentukan'
    WHEN ra.harga_satuan_transaksi > 0 THEN '✅ Harga sudah ditentukan'
    ELSE '❓ Status tidak diketahui'
  END as price_status
FROM riwayat_avco ra
JOIN produk p ON ra.id_produk = p.id
WHERE ra.jenis_mutasi = 'pembelian'
ORDER BY ra.id DESC
LIMIT 10;

-- 7. Summary
SELECT 
  '📊 Ringkasan Migration' as info,
  (SELECT COUNT(*) FROM barang_masuk WHERE status = 'AKTIF' AND total_cost = 0) as pending_items,
  (SELECT COUNT(*) FROM barang_masuk WHERE status = 'AKTIF' AND total_cost > 0) as completed_items,
  (SELECT COUNT(*) FROM barang_masuk WHERE status = 'AKTIF') as total_active_items;

-- ============================================================================
-- Jika semua query di atas menghasilkan output tanpa error, 
-- migration berhasil dijalankan!
-- ============================================================================
