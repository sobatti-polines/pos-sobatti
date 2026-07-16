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
  v_results JSONB[] := '{}';
BEGIN
  -- Serialise concurrent stock-in calls (lock ID differs from process_checkout's 987654321)
  PERFORM pg_advisory_xact_lock(987654322);

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    -- 1. Insert into barang_masuk
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

    -- 2. Lock and read current product row
    SELECT stok, stok_gudang, harga_pokok_avco, nilai_persediaan
    INTO v_prod
    FROM produk
    WHERE id = (v_item->>'id_produk')::integer
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Produk dengan ID % tidak ditemukan', (v_item->>'id_produk')::integer;
    END IF;

    -- 3. Weighted Average Cost calculation
    v_total_stok     := COALESCE(v_prod.stok, 0) + COALESCE(v_prod.stok_gudang, 0);
    v_nilai_sekarang := v_total_stok * COALESCE(v_prod.harga_pokok_avco, 0);
    v_nilai_masuk    := (v_item->>'jumlah')::numeric * (v_item->>'harga_beli')::numeric;
    v_new_stok_gudang := COALESCE(v_prod.stok_gudang, 0) + (v_item->>'jumlah')::numeric;

    IF (v_total_stok + (v_item->>'jumlah')::numeric) > 0 THEN
      v_new_avco := (v_nilai_sekarang + v_nilai_masuk) / (v_total_stok + (v_item->>'jumlah')::numeric);
    ELSE
      v_new_avco := 0;
    END IF;

    v_new_nilai_persediaan := (v_total_stok + (v_item->>'jumlah')::numeric) * v_new_avco;

    -- 4. Insert AVCO history
    INSERT INTO riwayat_avco (
      id_produk, jenis_mutasi, id_referensi,
      qty_masuk, harga_satuan_transaksi,
      stok_sebelum, avco_sebelum,
      stok_sesudah, avco_sesudah, nilai_persediaan_sesudah
    ) VALUES (
      (v_item->>'id_produk')::integer,
      'pembelian',
      v_barang_masuk_id,
      (v_item->>'jumlah')::numeric,
      (v_item->>'harga_beli')::numeric,
      v_total_stok,
      COALESCE(v_prod.harga_pokok_avco, 0),
      v_total_stok + (v_item->>'jumlah')::numeric,
      v_new_avco,
      v_new_nilai_persediaan
    );

    -- 5. Update product
    UPDATE produk
    SET
      stok_gudang      = v_new_stok_gudang,
      harga_pokok_avco = v_new_avco,
      nilai_persediaan = v_new_nilai_persediaan,
      updated_at       = now()
    WHERE id = (v_item->>'id_produk')::integer;

    -- 6. Collect result
    v_results := v_results || jsonb_build_object(
      'id',         v_barang_masuk_id,
      'id_produk',  (v_item->>'id_produk')::integer,
      'jumlah',     (v_item->>'jumlah')::numeric,
      'harga_beli', (v_item->>'harga_beli')::numeric
    );
  END LOOP;

  RETURN jsonb_build_object(
    'success',  true,
    'inserted', to_jsonb(v_results)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION process_barang_masuk(JSONB) TO authenticated;
