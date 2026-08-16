-- SQL Test script untuk fungsi get_harga_efektif_produk
-- Jalankan block DO ini di Supabase SQL Editor untuk memverifikasi logika.
-- Semua data dummy akan otomatis dihapus kembali (di dalam block transaksi yang kita manual cleanup atau bisa juga ditaruh dalam BEGIN...ROLLBACK, tapi PL/pgSQL DO block tidak support ROLLBACK jika tidak dalam procedure. Jadi kita gunakan cleanup manual).

DO $$
DECLARE
  v_id_produk INT;
  v_id_event1 UUID;
  v_id_event2 UUID;
  v_res RECORD;
  v_current_date DATE := CURRENT_DATE;
BEGIN
  -- 1. Setup dummy product
  -- Kita pastikan SKU ini belum ada
  DELETE FROM produk WHERE sku = 'TEST-PROMO-001';
  
  INSERT INTO produk (nama_produk, harga_jual_satuan, harga_jual_grosir, sku)
  VALUES ('TEST PROMO PROD', 10000, 9000, 'TEST-PROMO-001')
  RETURNING id INTO v_id_produk;

  -- Test 1: Tidak ada event
  SELECT * INTO v_res FROM get_harga_efektif_produk(v_id_produk, v_current_date);
  IF v_res.harga_jual_satuan <> 10000 THEN
    RAISE EXCEPTION 'Test 1 Failed: Harga tidak berubah saat tidak ada event. Expected 10000, Got %', v_res.harga_jual_satuan;
  END IF;

  -- 2. Setup Event 1 (Aktif hari ini, Diskon 10%)
  INSERT INTO event_promo (nama, tanggal_mulai, tanggal_selesai, tipe_diskon, nilai_diskon, aktif)
  VALUES ('Diskon 10%', v_current_date - 1, v_current_date + 1, 'persen', 10, true)
  RETURNING id INTO v_id_event1;

  INSERT INTO event_promo_produk (id_event_promo, id_produk)
  VALUES (v_id_event1, v_id_produk);

  -- Test 2: Ada 1 event aktif
  SELECT * INTO v_res FROM get_harga_efektif_produk(v_id_produk, v_current_date);
  IF v_res.harga_jual_satuan <> 9000 THEN
    RAISE EXCEPTION 'Test 2 Failed: Diskon 10%% tidak teraplikasi. Expected 9000, Got %', v_res.harga_jual_satuan;
  END IF;

  -- Test 3: Tanggal di luar rentang
  SELECT * INTO v_res FROM get_harga_efektif_produk(v_id_produk, v_current_date + 5);
  IF v_res.harga_jual_satuan <> 10000 THEN
    RAISE EXCEPTION 'Test 3 Failed: Harga harus normal di luar rentang. Expected 10000, Got %', v_res.harga_jual_satuan;
  END IF;

  -- 3. Setup Event 2 (Bulan depan, Diskon nominal 5K)
  INSERT INTO event_promo (nama, tanggal_mulai, tanggal_selesai, tipe_diskon, nilai_diskon, aktif)
  VALUES ('Diskon 5K', v_current_date + 10, v_current_date + 20, 'nominal', 5000, true)
  RETURNING id INTO v_id_event2;

  INSERT INTO event_promo_produk (id_event_promo, id_produk)
  VALUES (v_id_event2, v_id_produk);

  -- Test 4: Dua event berbeda tanggal non-overlap (Test event 2)
  SELECT * INTO v_res FROM get_harga_efektif_produk(v_id_produk, v_current_date + 15);
  IF v_res.harga_jual_satuan <> 5000 THEN
    RAISE EXCEPTION 'Test 4 Failed: Diskon nominal 5K tidak teraplikasi. Expected 5000, Got %', v_res.harga_jual_satuan;
  END IF;

  -- Cleanup data dummy
  DELETE FROM event_promo_produk WHERE id_event_promo IN (v_id_event1, v_id_event2);
  DELETE FROM event_promo WHERE id IN (v_id_event1, v_id_event2);
  DELETE FROM produk WHERE id = v_id_produk;

  RAISE NOTICE 'ALL TESTS PASSED SUCCESSFULLY! ✅';
END $$;
