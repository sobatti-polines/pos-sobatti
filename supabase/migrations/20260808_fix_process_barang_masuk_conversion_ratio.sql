-- 20260808_fix_process_barang_masuk_conversion_ratio.sql
-- Fix: COALESCE(conversion_ratio, 1) tidak punya alias → PostgreSQL menamainya "coalesce"
-- sehingga v_prod.conversion_ratio gagal dengan "record has no field conversion_ratio"

CREATE OR REPLACE FUNCTION process_barang_masuk(
  p_items JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_item JSONB;
  v_barang_masuk_id INTEGER;
  v_prod RECORD;
  v_total_stok NUMERIC;
  v_nilai_sekarang NUMERIC;
  v_nilai_masuk NUMERIC;
  v_new_avco NUMERIC;
  v_new_nilai_persediaan NUMERIC;
  v_new_stok_gudang NUMERIC;

  -- UoM conversion vars
  v_is_uom           BOOLEAN;
  v_conversion_ratio NUMERIC;
  v_supplied_qty     NUMERIC;
  v_supplied_unit    VARCHAR;
  v_base_qty         NUMERIC;
  v_total_cost       NUMERIC;
  v_per_piece_cost   NUMERIC;

  v_results JSONB[] := '{}';
BEGIN
  PERFORM pg_advisory_xact_lock(987654322);

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_is_uom := (v_item ? 'supplied_qty') AND (v_item->>'supplied_qty') IS NOT NULL;

    SELECT stok, stok_gudang, harga_pokok_avco, nilai_persediaan,
           COALESCE(conversion_ratio, 1) AS conversion_ratio INTO v_prod
    FROM produk
    WHERE id = (v_item->>'id_produk')::integer
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Produk dengan ID % tidak ditemukan', (v_item->>'id_produk')::integer;
    END IF;

    IF v_is_uom THEN
      v_supplied_qty     := (v_item->>'supplied_qty')::numeric;
      v_supplied_unit    := v_item->>'supplied_unit';
      v_conversion_ratio := v_prod.conversion_ratio;
      v_total_cost       := (v_item->>'total_cost')::numeric;

      v_base_qty := v_supplied_qty * v_conversion_ratio;

      IF v_base_qty > 0 THEN
        v_per_piece_cost := v_total_cost / v_base_qty;
      ELSE
        v_per_piece_cost := 0;
      END IF;

      INSERT INTO barang_masuk (
        tgl_masuk, id_supplier, id_produk,
        harga_beli, jumlah, total,
        supplied_unit, supplied_qty, applied_conversion_ratio,
        base_qty_added, total_cost, base_cost_per_piece,
        keterangan
      ) VALUES (
        (v_item->>'tgl_masuk')::date,
        (v_item->>'id_supplier')::integer,
        (v_item->>'id_produk')::integer,
        v_per_piece_cost,
        v_base_qty,
        v_total_cost,
        v_supplied_unit,
        v_supplied_qty,
        v_conversion_ratio,
        v_base_qty,
        v_total_cost,
        v_per_piece_cost,
        NULLIF(v_item->>'keterangan', '')
      )
      RETURNING id INTO v_barang_masuk_id;

      v_nilai_masuk    := v_total_cost;
      v_new_stok_gudang := COALESCE(v_prod.stok_gudang, 0) + v_base_qty;

      IF (COALESCE(v_prod.stok, 0) + COALESCE(v_prod.stok_gudang, 0) + v_base_qty) > 0 THEN
        v_new_avco := (
          ((COALESCE(v_prod.stok, 0) + COALESCE(v_prod.stok_gudang, 0)) * COALESCE(v_prod.harga_pokok_avco, 0))
          + v_total_cost
        ) / (COALESCE(v_prod.stok, 0) + COALESCE(v_prod.stok_gudang, 0) + v_base_qty);
      ELSE
        v_new_avco := 0;
      END IF;

      v_new_nilai_persediaan := (COALESCE(v_prod.stok, 0) + v_new_stok_gudang) * v_new_avco;

    ELSE
      INSERT INTO barang_masuk (
        tgl_masuk, id_supplier, id_produk, harga_beli, jumlah, total, keterangan
      ) VALUES (
        (v_item->>'tgl_masuk')::date,
        (v_item->>'id_supplier')::integer,
        (v_item->>'id_produk')::integer,
        (v_item->>'harga_beli')::numeric,
        (v_item->>'jumlah')::numeric,
        (v_item->>'total')::numeric,
        NULLIF(v_item->>'keterangan', '')
      )
      RETURNING id INTO v_barang_masuk_id;

      v_total_stok     := COALESCE(v_prod.stok, 0) + COALESCE(v_prod.stok_gudang, 0);
      v_nilai_masuk    := (v_item->>'jumlah')::numeric * (v_item->>'harga_beli')::numeric;
      v_new_stok_gudang := COALESCE(v_prod.stok_gudang, 0) + (v_item->>'jumlah')::numeric;

      IF (v_total_stok + (v_item->>'jumlah')::numeric) > 0 THEN
        v_new_avco := (
          (v_total_stok * COALESCE(v_prod.harga_pokok_avco, 0))
          + v_nilai_masuk
        ) / (v_total_stok + (v_item->>'jumlah')::numeric);
      ELSE
        v_new_avco := 0;
      END IF;

      v_new_nilai_persediaan := (v_total_stok + (v_item->>'jumlah')::numeric) * v_new_avco;
    END IF;

    INSERT INTO riwayat_avco (
      id_produk, jenis_mutasi, id_referensi,
      qty_masuk, harga_satuan_transaksi,
      stok_sebelum, avco_sebelum,
      stok_sesudah, avco_sesudah, nilai_persediaan_sesudah
    ) VALUES (
      (v_item->>'id_produk')::integer,
      'pembelian',
      v_barang_masuk_id,
      COALESCE(v_base_qty, (v_item->>'jumlah')::numeric),
      CASE WHEN v_is_uom THEN v_per_piece_cost ELSE (v_item->>'harga_beli')::numeric END,
      COALESCE(v_prod.stok, 0) + COALESCE(v_prod.stok_gudang, 0),
      COALESCE(v_prod.harga_pokok_avco, 0),
      COALESCE(v_prod.stok, 0) + v_new_stok_gudang,
      v_new_avco,
      v_new_nilai_persediaan
    );

    UPDATE produk
    SET
      stok_gudang      = v_new_stok_gudang,
      harga_pokok_avco = v_new_avco,
      nilai_persediaan = v_new_nilai_persediaan,
      updated_at       = now()
    WHERE id = (v_item->>'id_produk')::integer;

    v_results := v_results || jsonb_build_object(
      'id',         v_barang_masuk_id,
      'id_produk',  (v_item->>'id_produk')::integer,
      'jumlah',     COALESCE(v_base_qty, (v_item->>'jumlah')::numeric),
      'harga_beli', CASE WHEN v_is_uom THEN v_per_piece_cost ELSE (v_item->>'harga_beli')::numeric END
    );
  END LOOP;

  RETURN jsonb_build_object(
    'success',  true,
    'inserted', to_jsonb(v_results)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION process_barang_masuk(JSONB) TO authenticated;
