-- 20260907_allow_custom_price.sql
-- Allow cashier to set a custom price ONLY for products with a price of 0.
-- When set, it permanently updates the product's database price.

CREATE OR REPLACE FUNCTION process_checkout(
  p_items jsonb,
  p_id_kasir integer,
  p_id_pelanggan integer DEFAULT NULL,
  p_id_metode_bayar integer DEFAULT NULL,
  p_diskon_persen numeric DEFAULT 0,
  p_bayar numeric DEFAULT 0,
  p_pajak_persen numeric DEFAULT 0,
  p_is_dp boolean DEFAULT false
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_prefix text;
  v_last bigint;
  v_seq int;
  v_no_transaksi bigint;
  v_subtotal numeric := 0;
  v_diskon_nominal numeric := 0;
  v_pajak_nominal numeric := 0;
  v_total numeric := 0;
  v_item jsonb;
  v_prod record;
  v_qty numeric;
  v_qty_satuan numeric;
  v_harga_jual numeric;
  v_type_harga text;
  v_diskon_item numeric;
  v_id_transaksi integer;
  v_satuan_jual text;
  v_jual_ratio_snapshot numeric;
  v_sisa numeric := 0;
  v_total_hpp numeric := 0;
  v_hpp_item numeric := 0;
  v_profit numeric := 0;
  v_harga_efektif record;
  v_harga_jual_custom numeric;
  v_update_price numeric;
BEGIN
  -- Acq lock to avoid duplicate no_transaksi
  PERFORM pg_advisory_xact_lock(987654321);

  v_prefix := to_char(now() AT TIME ZONE 'Asia/Jakarta', 'YYYYMM');

  SELECT COALESCE(MAX(no_transaksi), 0) INTO v_last
  FROM transaksi_keluar
  WHERE no_transaksi::text LIKE v_prefix || '%';

  IF v_last = 0 THEN
    v_seq := 1;
  ELSE
    v_seq := (v_last % 10000)::int + 1;
  END IF;

  v_no_transaksi := (v_prefix || lpad(v_seq::text, 4, '0'))::bigint;

  -- === PASS 1: Validasi stok & hitung subtotal ===
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    SELECT id, nama_produk, harga_modal,
           harga_jual_satuan, harga_jual_grosir, harga_jual_promo,
           harga_jual_besar_satuan, harga_jual_besar_grosir, harga_jual_besar_promo,
           hitung_stok, stok, stok_gudang, harga_pokok_avco, nilai_persediaan,
           jual_satuan, conversion_ratio
    INTO v_prod
    FROM produk
    WHERE id = (v_item->>'id_produk')::integer;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Produk dengan ID % tidak ditemukan', (v_item->>'id_produk')::integer;
    END IF;

    SELECT * INTO v_harga_efektif FROM get_harga_efektif_produk(v_prod.id, current_date);

    v_type_harga        := upper(COALESCE(v_item->>'type_harga_jual', 'SATUAN'));
    v_diskon_item       := COALESCE((v_item->>'diskon_item')::numeric, 0);
    v_satuan_jual       := NULLIF(TRIM(COALESCE(v_item->>'satuan_jual', '')), '');
    v_harga_jual_custom := (v_item->>'harga_jual_custom')::numeric;

    v_qty_satuan := (v_item->>'qty_satuan')::numeric;

    IF v_qty_satuan IS NULL OR v_qty_satuan <= 0 THEN
      v_qty_satuan := (v_item->>'qty')::numeric;
    END IF;

    IF v_qty_satuan <= 0 THEN
      RAISE EXCEPTION 'Qty tidak valid untuk produk "%"', v_prod.nama_produk;
    END IF;

    IF v_satuan_jual IS NOT NULL AND v_prod.jual_satuan IS NOT NULL
       AND UPPER(v_satuan_jual) = UPPER(v_prod.jual_satuan)
    THEN
      v_jual_ratio_snapshot := COALESCE(v_prod.conversion_ratio, 1);
      v_qty := v_qty_satuan * v_jual_ratio_snapshot;
    ELSE
      v_jual_ratio_snapshot := 1;
      v_qty_satuan := v_qty;
      v_qty := (v_item->>'qty')::numeric;
      IF v_qty IS NULL OR v_qty <= 0 THEN
        v_qty := v_qty_satuan;
      END IF;
      v_qty_satuan := v_qty;
      v_satuan_jual := NULL;
    END IF;

    IF v_qty <= 0 THEN
      RAISE EXCEPTION 'Qty tidak valid untuk produk "%"', v_prod.nama_produk;
    END IF;

    IF v_prod.hitung_stok THEN
      IF v_qty > COALESCE(v_prod.stok, 0) + COALESCE(v_prod.stok_gudang, 0) THEN
        RAISE EXCEPTION 'Stok tidak mencukupi untuk produk "%" (tersedia %, diminta %)',
          v_prod.nama_produk,
          COALESCE(v_prod.stok, 0) + COALESCE(v_prod.stok_gudang, 0),
          v_qty;
      END IF;
    END IF;

    IF v_satuan_jual IS NOT NULL AND UPPER(v_satuan_jual) = UPPER(v_prod.jual_satuan) THEN
      v_harga_jual := COALESCE(v_harga_efektif.harga_jual_besar_satuan, 0);
      IF v_type_harga = 'GROSIR' AND v_harga_efektif.harga_jual_besar_grosir IS NOT NULL THEN
        v_harga_jual := v_harga_efektif.harga_jual_besar_grosir;
      END IF;
      IF v_type_harga = 'PROMO' AND v_harga_efektif.harga_jual_besar_promo IS NOT NULL THEN
        v_harga_jual := v_harga_efektif.harga_jual_besar_promo;
      END IF;
    ELSE
      v_harga_jual := v_harga_efektif.harga_jual_satuan;
      IF v_type_harga = 'GROSIR' THEN v_harga_jual := v_harga_efektif.harga_jual_grosir; END IF;
      IF v_type_harga = 'PROMO' AND v_harga_efektif.harga_jual_promo IS NOT NULL THEN
        v_harga_jual := v_harga_efektif.harga_jual_promo;
      END IF;
    END IF;

    -- === KUSTOMISASI HARGA UNTUK PRODUK DENGAN HARGA 0 ===
    IF COALESCE(v_harga_jual, 0) = 0 AND v_harga_jual_custom IS NOT NULL AND v_harga_jual_custom >= 0 THEN
      v_harga_jual := v_harga_jual_custom;

      -- Hitung mundur harga per unit kecil
      v_update_price := v_harga_jual_custom;
      IF v_satuan_jual IS NOT NULL AND UPPER(v_satuan_jual) = UPPER(v_prod.jual_satuan) THEN
         v_update_price := ROUND(v_harga_jual_custom / COALESCE(v_prod.conversion_ratio, 1));
      END IF;

      -- Simpan harga ini secara permanen ke produk!
      IF v_type_harga = 'GROSIR' THEN
         UPDATE produk SET harga_jual_grosir = v_update_price WHERE id = v_prod.id;
      ELSIF v_type_harga = 'PROMO' THEN
         UPDATE produk SET harga_jual_promo = v_update_price WHERE id = v_prod.id;
      ELSE
         UPDATE produk SET harga_jual_satuan = v_update_price WHERE id = v_prod.id;
      END IF;
    END IF;

    v_subtotal := v_subtotal + ((v_harga_jual - v_diskon_item) * v_qty_satuan);
    v_hpp_item := COALESCE(NULLIF(v_prod.harga_pokok_avco, 0), v_prod.harga_modal, 0);
    v_total_hpp := v_total_hpp + (v_hpp_item * v_qty);
  END LOOP;

  v_diskon_nominal := ROUND((v_subtotal * COALESCE(p_diskon_persen, 0)) / 100);
  v_total := v_subtotal - v_diskon_nominal;
  v_pajak_nominal := ROUND((v_total * COALESCE(p_pajak_persen, 0)) / 100);
  v_total := v_total + v_pajak_nominal;

  IF NOT p_is_dp AND p_bayar < v_total THEN
    RAISE EXCEPTION 'Jumlah bayar kurang. Total: %, Bayar: %', v_total, p_bayar;
  END IF;

  v_sisa := p_bayar - v_total;
  IF p_is_dp THEN
    v_sisa := v_total - p_bayar; 
  END IF;

  INSERT INTO transaksi_keluar (
    no_transaksi,
    tgl_transaksi,
    id_kasir,
    id_pelanggan,
    id_metode_bayar,
    subtotal,
    diskon_persen,
    diskon_nominal,
    pajak_persen,
    pajak_nominal,
    total,
    bayar,
    kembali,
    dp,
    sisa,
    total_hpp,
    laba_kotor
  ) VALUES (
    v_no_transaksi,
    now() AT TIME ZONE 'Asia/Jakarta',
    p_id_kasir,
    p_id_pelanggan,
    p_id_metode_bayar,
    v_subtotal,
    COALESCE(p_diskon_persen, 0),
    v_diskon_nominal,
    COALESCE(p_pajak_persen, 0),
    v_pajak_nominal,
    v_total,
    p_bayar,
    CASE WHEN NOT p_is_dp THEN v_sisa ELSE 0 END,
    CASE WHEN p_is_dp THEN p_bayar ELSE 0 END,
    CASE WHEN p_is_dp THEN v_sisa ELSE 0 END,
    v_total_hpp,
    (v_total - v_pajak_nominal - v_total_hpp)
  ) RETURNING id INTO v_id_transaksi;

  -- === PASS 2: Deduct stock, insert detail & AVCO history ===
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    SELECT id, harga_modal,
           harga_jual_satuan, harga_jual_grosir, harga_jual_promo,
           harga_jual_besar_satuan, harga_jual_besar_grosir, harga_jual_besar_promo,
           hitung_stok, stok, stok_gudang, harga_pokok_avco, nilai_persediaan,
           jual_satuan, conversion_ratio
    INTO v_prod
    FROM produk
    WHERE id = (v_item->>'id_produk')::integer;
    
    SELECT * INTO v_harga_efektif FROM get_harga_efektif_produk(v_prod.id, current_date);

    v_type_harga  := upper(COALESCE(v_item->>'type_harga_jual', 'SATUAN'));
    v_diskon_item := COALESCE((v_item->>'diskon_item')::numeric, 0);
    v_satuan_jual := NULLIF(TRIM(COALESCE(v_item->>'satuan_jual', '')), '');
    v_harga_jual_custom := (v_item->>'harga_jual_custom')::numeric;

    IF v_satuan_jual IS NOT NULL AND v_prod.jual_satuan IS NOT NULL
       AND UPPER(v_satuan_jual) = UPPER(v_prod.jual_satuan)
    THEN
      v_jual_ratio_snapshot := COALESCE(v_prod.conversion_ratio, 1);
      v_qty_satuan := (v_item->>'qty_satuan')::numeric;
      IF v_qty_satuan IS NULL OR v_qty_satuan <= 0 THEN v_qty_satuan := (v_item->>'qty')::numeric; END IF;
      v_qty := v_qty_satuan * v_jual_ratio_snapshot;

      v_harga_jual := COALESCE(v_harga_efektif.harga_jual_besar_satuan, 0);
      IF v_type_harga = 'GROSIR' AND v_harga_efektif.harga_jual_besar_grosir IS NOT NULL THEN
        v_harga_jual := v_harga_efektif.harga_jual_besar_grosir;
      END IF;
      IF v_type_harga = 'PROMO' AND v_harga_efektif.harga_jual_besar_promo IS NOT NULL THEN
        v_harga_jual := v_harga_efektif.harga_jual_besar_promo;
      END IF;
    ELSE
      v_jual_ratio_snapshot := 1;
      v_qty := (v_item->>'qty')::numeric;
      IF v_qty IS NULL OR v_qty <= 0 THEN v_qty := (v_item->>'qty_satuan')::numeric; END IF;
      v_qty_satuan := v_qty;
      v_satuan_jual := NULL;

      v_harga_jual := v_harga_efektif.harga_jual_satuan;
      IF v_type_harga = 'GROSIR' THEN v_harga_jual := v_harga_efektif.harga_jual_grosir; END IF;
      IF v_type_harga = 'PROMO' AND v_harga_efektif.harga_jual_promo IS NOT NULL THEN
        v_harga_jual := v_harga_efektif.harga_jual_promo;
      END IF;
    END IF;

    -- Apply custom price if original was 0
    IF COALESCE(v_harga_jual, 0) = 0 AND v_harga_jual_custom IS NOT NULL AND v_harga_jual_custom >= 0 THEN
      v_harga_jual := v_harga_jual_custom;
    END IF;

    v_hpp_item := COALESCE(NULLIF(v_prod.harga_pokok_avco, 0), v_prod.harga_modal, 0);
    v_profit := ((v_harga_jual - v_diskon_item) * v_qty_satuan) - (v_hpp_item * v_qty);

    INSERT INTO detail_transaksi_keluar (
      id_transaksi,
      id_produk,
      type_harga_jual,
      harga_modal,
      harga_jual,
      diskon_item,
      qty,
      jumlah,
      kas_masuk,
      profit,
      harga_pokok_satuan,
      total_harga_pokok,
      satuan_jual,
      qty_satuan,
      jual_ratio
    ) VALUES (
      v_id_transaksi,
      v_prod.id,
      v_type_harga,
      COALESCE(v_prod.harga_modal, 0),
      v_harga_jual,
      v_diskon_item,
      v_qty,
      (v_harga_jual - v_diskon_item) * v_qty_satuan,
      (v_harga_jual - v_diskon_item) * v_qty_satuan,
      v_profit,
      v_hpp_item,
      v_hpp_item * v_qty,
      v_satuan_jual,
      v_qty_satuan,
      v_jual_ratio_snapshot
    );

    IF v_prod.hitung_stok THEN
      DECLARE
        v_sisa_qty numeric := v_qty;
        v_stok_display numeric := COALESCE(v_prod.stok, 0);
        v_stok_gudang numeric := COALESCE(v_prod.stok_gudang, 0);
        v_kurang_display numeric := 0;
        v_kurang_gudang numeric := 0;
      BEGIN
        IF v_stok_display >= v_sisa_qty THEN
          v_kurang_display := v_sisa_qty;
          v_sisa_qty := 0;
        ELSE
          v_kurang_display := v_stok_display;
          v_sisa_qty := v_sisa_qty - v_stok_display;
        END IF;

        IF v_sisa_qty > 0 THEN
          IF v_stok_gudang >= v_sisa_qty THEN
            v_kurang_gudang := v_sisa_qty;
            v_sisa_qty := 0;
          ELSE
            RAISE EXCEPTION 'Race condition stok';
          END IF;
        END IF;

        UPDATE produk
        SET 
          stok = stok - v_kurang_display,
          stok_gudang = stok_gudang - v_kurang_gudang,
          nilai_persediaan = COALESCE(harga_pokok_avco, harga_modal, 0) * (COALESCE(stok, 0) - v_kurang_display + COALESCE(stok_gudang, 0) - v_kurang_gudang)
        WHERE id = v_prod.id;

        INSERT INTO riwayat_avco (
          id_produk, tanggal, jenis_mutasi, id_referensi,
          qty_masuk, qty_keluar, harga_satuan_transaksi,
          stok_sebelum, avco_sebelum,
          stok_sesudah, avco_sesudah, nilai_persediaan_sesudah
        ) VALUES (
          v_prod.id, now() AT TIME ZONE 'Asia/Jakarta', 'penjualan', v_id_transaksi,
          0, v_qty, (v_harga_jual - v_diskon_item),
          (v_stok_display + v_stok_gudang), COALESCE(v_prod.harga_pokok_avco, 0),
          (v_stok_display - v_kurang_display + v_stok_gudang - v_kurang_gudang), COALESCE(v_prod.harga_pokok_avco, 0),
          COALESCE(v_prod.harga_pokok_avco, v_prod.harga_modal, 0) * (v_stok_display - v_kurang_display + v_stok_gudang - v_kurang_gudang)
        );
      END;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'id', v_id_transaksi,
    'no_transaksi', v_no_transaksi,
    'total', v_total,
    'kembali', CASE WHEN NOT p_is_dp THEN v_sisa ELSE 0 END,
    'sisa', CASE WHEN p_is_dp THEN v_sisa ELSE 0 END
  );
END;
$$;

GRANT EXECUTE ON FUNCTION process_checkout(jsonb, integer, integer, integer, numeric, numeric, numeric, boolean) TO authenticated;
