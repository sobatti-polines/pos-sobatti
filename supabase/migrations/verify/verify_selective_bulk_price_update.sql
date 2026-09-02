BEGIN;

DO $$
DECLARE
  v_suffix text := substr(md5(clock_timestamp()::text), 1, 8);
  v_username text := 'bulk_' || v_suffix;
  v_merk integer;
  v_merk_lain integer;
  v_master_ids integer[];
  v_paket integer;
  v_produk_lain integer;
  v_result jsonb;
  v_count integer;
BEGIN
  INSERT INTO public.pengguna (username, password, level, nama)
  VALUES (v_username, '-', 'OWNER', 'Uji Harga Massal');

  PERFORM set_config(
    'request.jwt.claims',
    jsonb_build_object('email', v_username || '@test.local')::text,
    true
  );

  INSERT INTO public.merk (nama, kode)
  VALUES ('Merk Uji ' || v_suffix, upper(substr(v_suffix, 1, 4)))
  RETURNING id INTO v_merk;

  INSERT INTO public.merk (nama, kode)
  VALUES ('Merk Lain ' || v_suffix, upper(substr(v_suffix, 5, 4)))
  RETURNING id INTO v_merk_lain;

  WITH inserted AS (
    INSERT INTO public.produk (
      nama_produk, id_merk, harga_jual_satuan, harga_jual_grosir, harga_jual_promo
    )
    SELECT
      'Produk Master ' || nomor || ' ' || v_suffix,
      v_merk,
      1000,
      NULL,
      0
    FROM generate_series(1, 12) AS nomor
    RETURNING id
  )
  SELECT array_agg(id ORDER BY id) INTO v_master_ids FROM inserted;

  INSERT INTO public.produk (
    nama_produk, id_merk, id_produk_master, qty_per_unit, jenis_isi_paket, harga_jual_satuan
  )
  VALUES ('Produk Paket ' || v_suffix, v_merk, v_master_ids[1], 2, 'FIXED_RATIO', 5000)
  RETURNING id INTO v_paket;

  INSERT INTO public.produk (nama_produk, id_merk, harga_jual_satuan)
  VALUES ('Produk Merk Lain ' || v_suffix, v_merk_lain, 7000)
  RETURNING id INTO v_produk_lain;

  v_result := public.bulk_adjust_product_prices(
    p_id_merk => v_merk,
    p_jenis_barang => 'MASTER',
    p_direction => 'NAIK',
    p_percentage => 10,
    p_rounding => 100,
    p_update_retail => true,
    p_update_grosir => true,
    p_update_promo => true
  );

  IF (v_result ->> 'affected_count')::integer <> 12
    OR jsonb_array_length(v_result -> 'products') <> 12 THEN
    RAISE EXCEPTION 'Preview tidak mengembalikan semua produk master';
  END IF;

  v_result := public.bulk_adjust_product_prices(
    p_id_merk => v_merk,
    p_jenis_barang => 'MASTER',
    p_direction => 'NAIK',
    p_percentage => 10,
    p_rounding => 100,
    p_update_retail => true,
    p_update_grosir => true,
    p_update_promo => true,
    p_apply => true,
    p_selected_product_ids => v_master_ids[1:11] || ARRAY[v_paket, v_produk_lain]
  );

  IF (v_result ->> 'updated_count')::integer <> 11 THEN
    RAISE EXCEPTION 'Jumlah produk yang diperbarui salah: %', v_result ->> 'updated_count';
  END IF;

  SELECT count(*) INTO v_count
  FROM public.produk
  WHERE id = ANY (v_master_ids[1:11])
    AND harga_jual_satuan = 1100
    AND harga_jual_grosir IS NULL
    AND harga_jual_promo = 0;

  IF v_count <> 11 THEN
    RAISE EXCEPTION 'Harga produk terpilih atau nilai kosong/0 tidak sesuai';
  END IF;

  IF (SELECT harga_jual_satuan FROM public.produk WHERE id = v_master_ids[12]) <> 1000
    OR (SELECT harga_jual_satuan FROM public.produk WHERE id = v_paket) <> 5000
    OR (SELECT harga_jual_satuan FROM public.produk WHERE id = v_produk_lain) <> 7000 THEN
    RAISE EXCEPTION 'Produk di luar pilihan atau filter ikut berubah';
  END IF;

  v_result := public.bulk_adjust_product_prices(
    p_id_merk => v_merk,
    p_jenis_barang => 'PAKET',
    p_update_retail => true
  );

  IF (v_result ->> 'affected_count')::integer <> 1
    OR (v_result -> 'products' -> 0 ->> 'id')::integer <> v_paket THEN
    RAISE EXCEPTION 'Filter barang paket tidak sesuai';
  END IF;

  BEGIN
    PERFORM public.bulk_adjust_product_prices(
      p_id_merk => v_merk,
      p_update_retail => true,
      p_apply => true,
      p_selected_product_ids => ARRAY[]::integer[]
    );
    RAISE EXCEPTION 'Pilihan produk kosong seharusnya ditolak';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'Pilih minimal 1 produk' THEN
      RAISE;
    END IF;
  END;
END;
$$;

ROLLBACK;
