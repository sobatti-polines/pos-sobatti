BEGIN;

DO $$
DECLARE
  v_id integer;
  v_harga numeric;
  v_event uuid;
BEGIN
  INSERT INTO public.produk (
    nama_produk, harga_jual_satuan, harga_jual_grosir, harga_jual_promo,
    conversion_ratio, jual_satuan, harga_jual_besar_manual
  ) VALUES ('TEST HARGA BESAR', 5000, 4500, 4000, 50, 'ROLL', false)
  RETURNING id, harga_jual_besar_satuan INTO v_id, v_harga;

  IF v_harga <> 250000 THEN
    RAISE EXCEPTION 'Harga otomatis salah: %', v_harga;
  END IF;

  UPDATE public.produk
  SET harga_jual_besar_manual = true,
      harga_jual_besar_satuan = 200000,
      harga_jual_besar_grosir = 190000,
      harga_jual_besar_promo = 180000
  WHERE id = v_id;

  IF NOT EXISTS (
    SELECT 1
    FROM public.riwayat_harga_produk
    WHERE id_produk = v_id AND harga_jual_besar_satuan = 200000
  ) THEN
    RAISE EXCEPTION 'Snapshot harga manual tidak tercatat';
  END IF;

  UPDATE public.produk
  SET harga_jual_satuan = 6000, conversion_ratio = 40
  WHERE id = v_id
  RETURNING harga_jual_besar_satuan INTO v_harga;

  IF v_harga <> 200000 THEN
    RAISE EXCEPTION 'Harga manual tertimpa: %', v_harga;
  END IF;

  BEGIN
    UPDATE public.produk SET harga_jual_besar_satuan = 0 WHERE id = v_id;
    RAISE EXCEPTION 'Harga manual tidak valid lolos';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'Harga Retail satuan besar harus lebih dari 0' THEN
      RAISE;
    END IF;
  END;

  INSERT INTO public.event_promo (
    nama, tanggal_mulai, tanggal_selesai, tipe_diskon, nilai_diskon, aktif
  ) VALUES ('TEST DISKON HARGA BESAR', CURRENT_DATE, CURRENT_DATE, 'persen', 10, true)
  RETURNING id INTO v_event;

  INSERT INTO public.event_promo_produk (id_event_promo, id_produk)
  VALUES (v_event, v_id);

  SELECT harga_jual_besar_satuan INTO v_harga
  FROM public.get_harga_efektif_produk(v_id, CURRENT_DATE);

  IF v_harga <> 180000 THEN
    RAISE EXCEPTION 'Event promo pada harga manual salah: %', v_harga;
  END IF;

  UPDATE public.produk
  SET harga_jual_besar_manual = false
  WHERE id = v_id
  RETURNING harga_jual_besar_satuan INTO v_harga;

  IF v_harga <> 240000 THEN
    RAISE EXCEPTION 'Kembali ke otomatis salah: %', v_harga;
  END IF;

  RAISE NOTICE 'Semua pemeriksaan harga satuan besar lulus';
END;
$$;

ROLLBACK;
