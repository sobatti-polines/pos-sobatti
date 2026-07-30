-- Migration: 20260728_add_bulk_stock_opname.sql
-- RPC untuk bulk stock opname: insert opname + update stok + catat AVCO

CREATE OR REPLACE FUNCTION process_stock_opname(
  p_items JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_item JSONB;
  v_opname_id INTEGER;
  v_prod RECORD;
  v_selisih NUMERIC;
  v_total_stok_sebelum NUMERIC;
  v_total_stok_sesudah NUMERIC;
  v_new_nilai_persediaan NUMERIC;
  v_qty_masuk NUMERIC;
  v_qty_keluar NUMERIC;
  v_results JSONB[] := '{}';
BEGIN
  -- Serialise concurrent stock opname calls (lock ID 987654323)
  PERFORM pg_advisory_xact_lock(987654323);

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    -- Lock and read current product row
    SELECT id, stok, stok_gudang, harga_pokok_avco, nilai_persediaan
    INTO v_prod
    FROM produk
    WHERE id = (v_item->>'id_produk')::integer
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Produk dengan ID % tidak ditemukan', (v_item->>'id_produk')::integer;
    END IF;

    -- Calculate values
    v_selisih := (v_item->>'stok_fisik')::numeric - COALESCE(v_prod.stok, 0);
    v_total_stok_sebelum := COALESCE(v_prod.stok, 0) + COALESCE(v_prod.stok_gudang, 0);
    v_total_stok_sesudah := (v_item->>'stok_fisik')::numeric + COALESCE(v_prod.stok_gudang, 0);
    v_new_nilai_persediaan := v_total_stok_sesudah * COALESCE(v_prod.harga_pokok_avco, 0);

    -- Determine qty_masuk/qty_keluar for AVCO history
    IF v_selisih > 0 THEN
      v_qty_masuk := v_selisih;
      v_qty_keluar := NULL;
    ELSIF v_selisih < 0 THEN
      v_qty_masuk := NULL;
      v_qty_keluar := ABS(v_selisih);
    ELSE
      v_qty_masuk := NULL;
      v_qty_keluar := NULL;
    END IF;

    -- Insert into stok_opname
    INSERT INTO stok_opname (
      tgl_opname, id_produk, stok_sistem, stok_fisik, selisih, keterangan
    ) VALUES (
      (v_item->>'tgl_opname')::date,
      (v_item->>'id_produk')::integer,
      COALESCE(v_prod.stok, 0),
      (v_item->>'stok_fisik')::numeric,
      v_selisih,
      NULLIF(v_item->>'keterangan', '')
    )
    RETURNING id INTO v_opname_id;

    -- Insert AVCO history only if there's a difference
    IF v_selisih != 0 THEN
      INSERT INTO riwayat_avco (
        id_produk, jenis_mutasi, id_referensi,
        qty_masuk, qty_keluar, harga_satuan_transaksi,
        stok_sebelum, avco_sebelum,
        stok_sesudah, avco_sesudah, nilai_persediaan_sesudah
      ) VALUES (
        (v_item->>'id_produk')::integer,
        'koreksi',
        v_opname_id,
        v_qty_masuk,
        v_qty_keluar,
        COALESCE(v_prod.harga_pokok_avco, 0),
        v_total_stok_sebelum,
        COALESCE(v_prod.harga_pokok_avco, 0),
        v_total_stok_sesudah,
        COALESCE(v_prod.harga_pokok_avco, 0),
        v_new_nilai_persediaan
      );
    END IF;

    -- Update product display stock and nilai_persediaan
    UPDATE produk
    SET
      stok = (v_item->>'stok_fisik')::numeric,
      nilai_persediaan = v_new_nilai_persediaan,
      updated_at = now()
    WHERE id = (v_item->>'id_produk')::integer;

    -- Collect result
    v_results := v_results || jsonb_build_object(
      'id',        v_opname_id,
      'id_produk', (v_item->>'id_produk')::integer,
      'selisih',   v_selisih
    );
  END LOOP;

  RETURN jsonb_build_object(
    'success',  true,
    'inserted', to_jsonb(v_results)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION process_stock_opname(JSONB) TO authenticated;
