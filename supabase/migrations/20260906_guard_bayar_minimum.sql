-- File: 20260906_guard_bayar_minimum.sql
-- Guard pembayaran kurang di process_checkout():
--   Transaksi NON-DP wajib dibayar lunas (bayar >= total). Sebelumnya, kasir
--   bisa menyelesaikan transaksi dengan bayar kurang dari total — transaksi
--   tersimpan lengkap dengan kolom sisa > 0, padahal piutang sudah dihapus
--   sehingga sisa tersebut tidak pernah tertagih/dipantau.
--
--   Transaksi DP sengaja tetap mengizinkan bayar sebagian (selisih dilacak
--   via kolom sisa) — hanya berlaku untuk metode bayar DP.

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
  v_prefix         text;
  v_last           bigint;
  v_seq            int;
  v_no_transaksi   bigint;
  v_item           jsonb;
  v_subtotal       numeric := 0;
  v_jumlah         numeric;
  v_harga_jual     numeric;
  v_diskon_item    numeric;
  v_profit         numeric;
  v_diskon_nominal numeric;
  v_pajak_nominal  numeric;
  v_total          numeric;
  v_kembali        numeric;
  v_dp             numeric;
  v_sisa           numeric;
  v_tx_id          integer;
  v_details        jsonb[] := '{}';
  v_prod           record;
  v_harga_efektif  record;
  v_type_harga     text;
  v_total_hpp            numeric := 0;
  v_laba_kotor           numeric := 0;
  v_harga_pokok_satuan   numeric;
  v_total_harga_pokok    numeric;
  v_qty                  numeric;
  v_qty_satuan           numeric;
  v_satuan_jual          text;
  v_jual_ratio_snapshot  numeric;
  v_stok_total_sebelum   numeric;
  v_stok_total_sesudah   numeric;
  v_new_stok             numeric;
  v_new_stok_gudang      numeric;
BEGIN
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

    v_type_harga     := upper(COALESCE(v_item->>'type_harga_jual', 'SATUAN'));
    v_diskon_item    := COALESCE((v_item->>'diskon_item')::numeric, 0);
    v_satuan_jual    := NULLIF(TRIM(COALESCE(v_item->>'satuan_jual', '')), '');

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

    v_jumlah  := (v_harga_jual - v_diskon_item) * v_qty_satuan;

    v_harga_pokok_satuan := COALESCE(NULLIF(v_prod.harga_pokok_avco, 0), v_prod.harga_modal);
    v_total_harga_pokok  := v_harga_pokok_satuan * v_qty;

    v_total_hpp    := v_total_hpp + v_total_harga_pokok;
    v_profit       := v_jumlah - v_total_harga_pokok;
    v_laba_kotor   := v_laba_kotor + v_profit;
    v_subtotal     := v_subtotal + v_jumlah;

    v_details := v_details || jsonb_build_object(
      'id_produk',      v_prod.id,
      'type_harga_jual', v_type_harga,
      'harga_modal',    v_prod.harga_modal,
      'harga_jual',     v_harga_jual,
      'diskon_item',    v_diskon_item,
      'qty',            v_qty,
      'qty_satuan',     v_qty_satuan,
      'satuan_jual',    v_satuan_jual,
      'jual_ratio',     v_jual_ratio_snapshot,
      'jumlah',         v_jumlah,
      'kas_masuk',      v_jumlah,
      'profit',         v_profit,
      'harga_pokok_satuan', v_harga_pokok_satuan,
      'total_harga_pokok',  v_total_harga_pokok
    );
  END LOOP;

  v_diskon_nominal := ROUND(v_subtotal * (p_diskon_persen / 100));
  v_pajak_nominal  := ROUND((v_subtotal - v_diskon_nominal) * (p_pajak_persen / 100));
  v_total          := v_subtotal - v_diskon_nominal + v_pajak_nominal;
  v_kembali        := GREATEST(0, p_bayar - v_total);
  v_dp             := CASE WHEN p_is_dp THEN p_bayar ELSE 0 END;
  v_sisa           := CASE WHEN p_bayar < v_total THEN v_total - p_bayar ELSE 0 END;

  -- Guard pembayaran kurang: transaksi NON-DP wajib dibayar lunas (atau lebih).
  -- Transaksi DP sengaja boleh bayar sebagian — selisihnya dilacak via kolom sisa.
  IF NOT p_is_dp AND p_bayar < v_total THEN
    RAISE EXCEPTION 'Jumlah bayar kurang dari total transaksi (total %, dibayar %)',
      v_total, p_bayar;
  END IF;

  IF v_sisa > 0 AND p_id_pelanggan IS NULL THEN
    RAISE EXCEPTION 'Pelanggan harus dipilih untuk transaksi kredit/DP';
  END IF;

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

  INSERT INTO detail_transaksi_keluar (
    id_transaksi, id_produk, type_harga_jual, harga_modal, harga_jual,
    diskon_item, qty, satuan_jual, qty_satuan, jual_ratio,
    jumlah, kas_masuk, profit, harga_pokok_satuan, total_harga_pokok
  )
  SELECT
    v_tx_id,
    (d->>'id_produk')::integer,
    d->>'type_harga_jual',
    (d->>'harga_modal')::numeric,
    (d->>'harga_jual')::numeric,
    (d->>'diskon_item')::numeric,
    (d->>'qty')::numeric,
    d->>'satuan_jual',
    (d->>'qty_satuan')::integer,
    (d->>'jual_ratio')::numeric,
    (d->>'jumlah')::numeric,
    (d->>'kas_masuk')::numeric,
    (d->>'profit')::numeric,
    (d->>'harga_pokok_satuan')::numeric,
    (d->>'total_harga_pokok')::numeric
  FROM unnest(v_details) AS d;

  -- === PASS 2: Kurangi stok (display dulu, lalu gudang) + catat AVCO ===
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    SELECT stok, stok_gudang, harga_pokok_avco, nilai_persediaan
    INTO v_prod
    FROM produk
    WHERE id = (v_item->>'id_produk')::integer AND hitung_stok = true;

    IF FOUND THEN
      v_qty := (v_item->>'qty')::numeric;

      v_stok_total_sebelum := COALESCE(v_prod.stok, 0) + COALESCE(v_prod.stok_gudang, 0);
      v_stok_total_sesudah := v_stok_total_sebelum - v_qty;

      v_new_stok := GREATEST(COALESCE(v_prod.stok, 0) - v_qty, 0);
      v_new_stok_gudang := COALESCE(v_prod.stok_gudang, 0)
        - (v_qty - (COALESCE(v_prod.stok, 0) - v_new_stok));

      INSERT INTO riwayat_avco (
        id_produk, jenis_mutasi, id_referensi, qty_keluar,
        harga_satuan_transaksi, stok_sebelum, avco_sebelum,
        stok_sesudah, avco_sesudah, nilai_persediaan_sesudah
      ) VALUES (
        (v_item->>'id_produk')::integer,
        'penjualan',
        v_tx_id,
        v_qty,
        v_prod.harga_pokok_avco,
        v_stok_total_sebelum,
        v_prod.harga_pokok_avco,
        v_stok_total_sesudah,
        v_prod.harga_pokok_avco,
        v_stok_total_sesudah * v_prod.harga_pokok_avco
      );

      UPDATE produk
      SET stok = v_new_stok,
          stok_gudang = v_new_stok_gudang,
          nilai_persediaan = v_stok_total_sesudah * harga_pokok_avco
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
