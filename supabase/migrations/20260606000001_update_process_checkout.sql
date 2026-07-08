-- File: 20260606000001_update_process_checkout.sql

CREATE OR REPLACE FUNCTION process_checkout(
  p_items jsonb,
  p_id_kasir integer,
  p_id_pelanggan integer DEFAULT NULL,
  p_id_metode_bayar integer DEFAULT NULL,
  p_diskon_persen numeric DEFAULT 0,
  p_bayar numeric DEFAULT 0,
  p_pajak_persen numeric DEFAULT 0,
  p_is_dp boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_prefix       text;
  v_last         bigint;
  v_seq          int;
  v_no_transaksi bigint;
  v_item         jsonb;
  v_subtotal     numeric := 0;
  v_jumlah       numeric;
  v_harga_jual   numeric;
  v_diskon_item  numeric;
  v_profit       numeric;
  v_diskon_nominal numeric;
  v_pajak_nominal  numeric;
  v_total        numeric;
  v_kembali      numeric;
  v_dp           numeric;
  v_sisa         numeric;
  v_tx_id        integer;
  v_details      jsonb[] := '{}';
  v_prod         record;
  v_type_harga   text;
  v_total_hpp          numeric := 0;
  v_laba_kotor         numeric := 0;
  v_harga_pokok_satuan numeric;
  v_total_harga_pokok  numeric;
BEGIN
  -- Serialise concurrent calls with an advisory lock (released at end of txn)
  PERFORM pg_advisory_xact_lock(987654321);

  -- Build YYYYMM prefix in WIB timezone
  v_prefix := to_char(now() AT TIME ZONE 'Asia/Jakarta', 'YYYYMM');

  -- Find the highest no_transaksi this month
  SELECT COALESCE(MAX(no_transaksi), 0) INTO v_last
  FROM transaksi_keluar
  WHERE no_transaksi::text LIKE v_prefix || '%';

  IF v_last = 0 THEN
    v_seq := 1;
  ELSE
    v_seq := (v_last % 10000)::int + 1;
  END IF;

  v_no_transaksi := (v_prefix || lpad(v_seq::text, 4, '0'))::bigint;

  -- Calculate subtotal from items
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    SELECT id, harga_modal, harga_jual_satuan, harga_jual_grosir, harga_jual_promo, hitung_stok, stok, harga_pokok_avco, nilai_persediaan
    INTO v_prod
    FROM produk
    WHERE id = (v_item->>'id_produk')::integer;

    IF NOT FOUND THEN CONTINUE; END IF;

    v_type_harga  := upper(COALESCE(v_item->>'type_harga_jual', 'SATUAN'));
    v_diskon_item := COALESCE((v_item->>'diskon_item')::numeric, 0);

    v_harga_jual := v_prod.harga_jual_satuan;
    IF v_type_harga = 'GROSIR' THEN v_harga_jual := v_prod.harga_jual_grosir; END IF;
    IF v_type_harga = 'PROMO' AND v_prod.harga_jual_promo IS NOT NULL THEN
      v_harga_jual := v_prod.harga_jual_promo;
    END IF;

    v_jumlah  := (v_harga_jual - v_diskon_item) * (v_item->>'qty')::numeric;
    
    -- AVCO HPP calculation
    v_harga_pokok_satuan := COALESCE(NULLIF(v_prod.harga_pokok_avco, 0), v_prod.harga_modal);
    v_total_harga_pokok := v_harga_pokok_satuan * (v_item->>'qty')::numeric;
    
    v_total_hpp := v_total_hpp + v_total_harga_pokok;
    
    -- Profit based on AVCO
    v_profit  := v_jumlah - v_total_harga_pokok;
    v_laba_kotor := v_laba_kotor + v_profit;

    v_subtotal := v_subtotal + v_jumlah;

    v_details := v_details || jsonb_build_object(
      'id_produk',      v_prod.id,
      'type_harga_jual', v_type_harga,
      'harga_modal',    v_prod.harga_modal,
      'harga_jual',     v_harga_jual,
      'diskon_item',    v_diskon_item,
      'qty',            (v_item->>'qty')::numeric,
      'jumlah',         v_jumlah,
      'kas_masuk',      v_jumlah,
      'profit',         v_profit,
      'harga_pokok_satuan', v_harga_pokok_satuan,
      'total_harga_pokok', v_total_harga_pokok
    );
  END LOOP;

  v_diskon_nominal := ROUND(v_subtotal * (p_diskon_persen / 100));
  v_pajak_nominal  := ROUND((v_subtotal - v_diskon_nominal) * (p_pajak_persen / 100));
  v_total          := v_subtotal - v_diskon_nominal + v_pajak_nominal;
  v_kembali        := GREATEST(0, p_bayar - v_total);
  v_dp             := CASE WHEN p_is_dp THEN p_bayar ELSE 0 END;
  v_sisa           := CASE WHEN p_bayar < v_total THEN v_total - p_bayar ELSE 0 END;

  -- Insert header
  INSERT INTO transaksi_keluar (
    no_transaksi, tgl_transaksi, id_kasir, id_pelanggan, id_metode_bayar,
    subtotal, diskon_persen, diskon_nominal, pajak_persen, pajak_nominal,
    total, bayar, kembali, dp, sisa, total_hpp, laba_kotor
  ) VALUES (
    v_no_transaksi, now(), p_id_kasir, p_id_pelanggan, p_id_metode_bayar,
    v_subtotal, p_diskon_persen, v_diskon_nominal, p_pajak_persen, v_pajak_nominal,
    v_total, p_bayar, v_kembali, v_dp, v_sisa, v_total_hpp, v_laba_kotor
  )
  RETURNING id INTO v_tx_id;

  -- Insert detail rows
  INSERT INTO detail_transaksi_keluar (
    id_transaksi, id_produk, type_harga_jual, harga_modal, harga_jual,
    diskon_item, qty, jumlah, kas_masuk, profit, harga_pokok_satuan, total_harga_pokok
  )
  SELECT
    v_tx_id,
    (d->>'id_produk')::integer,
    d->>'type_harga_jual',
    (d->>'harga_modal')::numeric,
    (d->>'harga_jual')::numeric,
    (d->>'diskon_item')::numeric,
    (d->>'qty')::numeric,
    (d->>'jumlah')::numeric,
    (d->>'kas_masuk')::numeric,
    (d->>'profit')::numeric,
    (d->>'harga_pokok_satuan')::numeric,
    (d->>'total_harga_pokok')::numeric
  FROM unnest(v_details) AS d;

  -- Deduct stock where hitung_stok = true and record AVCO mutation
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    SELECT stok, harga_pokok_avco, nilai_persediaan
    INTO v_prod
    FROM produk
    WHERE id = (v_item->>'id_produk')::integer AND hitung_stok = true;

    IF FOUND THEN
      -- Record into riwayat_avco
      INSERT INTO riwayat_avco (
        id_produk, jenis_mutasi, id_referensi, qty_keluar,
        harga_satuan_transaksi, stok_sebelum, avco_sebelum,
        stok_sesudah, avco_sesudah, nilai_persediaan_sesudah
      ) VALUES (
        (v_item->>'id_produk')::integer,
        'penjualan',
        v_tx_id,
        (v_item->>'qty')::numeric,
        v_prod.harga_pokok_avco,
        v_prod.stok,
        v_prod.harga_pokok_avco,
        v_prod.stok - (v_item->>'qty')::numeric,
        v_prod.harga_pokok_avco,
        (v_prod.stok - (v_item->>'qty')::numeric) * v_prod.harga_pokok_avco
      );

      -- Update product stock and inventory value
      UPDATE produk
      SET stok = stok - (v_item->>'qty')::numeric,
          nilai_persediaan = (stok - (v_item->>'qty')::numeric) * harga_pokok_avco
      WHERE id = (v_item->>'id_produk')::integer;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'success',       true,
    'id',            v_tx_id,
    'no_transaksi',  v_no_transaksi,
    'total',         v_total,
    'kembali',       v_kembali
  );
END;
$$;

GRANT EXECUTE ON FUNCTION process_checkout(jsonb, integer, integer, integer, numeric, numeric, numeric, boolean) TO authenticated;
