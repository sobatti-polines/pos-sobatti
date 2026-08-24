-- ============================================================================
-- MIGRATION LENGKAP: Admin Stock-In Tanpa Harga
-- Jalankan ini di Supabase SQL Editor (1 file saja, semua sudah digabung)
-- ============================================================================

-- LANGKAH 1: Tambah kolom harga_ditentukan
ALTER TABLE barang_masuk 
ADD COLUMN IF NOT EXISTS harga_ditentukan BOOLEAN DEFAULT FALSE;

-- Update data existing: jika total_cost > 0, tandai sebagai sudah ditentukan
UPDATE barang_masuk 
SET harga_ditentukan = TRUE 
WHERE total_cost > 0 AND status = 'AKTIF';

-- Index untuk query cepat
CREATE INDEX IF NOT EXISTS idx_barang_masuk_harga_ditentukan 
ON barang_masuk(harga_ditentukan) 
WHERE status = 'AKTIF';

-- LANGKAH 2: Update RPC process_barang_masuk
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

  v_is_uom           BOOLEAN;
  v_conversion_ratio NUMERIC;
  v_supplied_qty     NUMERIC;
  v_supplied_unit    VARCHAR;
  v_base_qty         NUMERIC;
  v_total_cost       NUMERIC;
  v_per_piece_cost   NUMERIC;
  v_has_cost         BOOLEAN;

  v_results JSONB[] := '{}';
BEGIN
  PERFORM pg_advisory_xact_lock(987654322);

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_is_uom := (v_item ? 'supplied_qty') AND (v_item->>'supplied_qty') IS NOT NULL;

    SELECT stok, stok_gudang, harga_pokok_avco, nilai_persediaan,
           COALESCE(conversion_ratio, 1) AS conversion_ratio,
           hitung_stok INTO v_prod
    FROM produk
    WHERE id = (v_item->>'id_produk')::integer
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Produk dengan ID % tidak ditemukan', (v_item->>'id_produk')::integer;
    END IF;

    IF NOT COALESCE(v_prod.hitung_stok, true) THEN
      RAISE EXCEPTION 'Produk dengan ID % tidak terhitung stoknya — barang masuk ditolak', (v_item->>'id_produk')::integer;
    END IF;

    IF v_is_uom THEN
      v_supplied_qty     := (v_item->>'supplied_qty')::numeric;
      v_supplied_unit    := v_item->>'supplied_unit';
      v_conversion_ratio := v_prod.conversion_ratio;
      v_total_cost       := COALESCE((v_item->>'total_cost')::numeric, 0);

      v_base_qty := v_supplied_qty * v_conversion_ratio;
      v_has_cost := v_total_cost > 0;

      IF v_base_qty > 0 AND v_has_cost THEN
        v_per_piece_cost := v_total_cost / v_base_qty;
      ELSE
        v_per_piece_cost := 0;
      END IF;

      INSERT INTO barang_masuk (
        tgl_masuk, id_supplier, id_produk,
        harga_beli, jumlah, total,
        supplied_unit, supplied_qty, applied_conversion_ratio,
        base_qty_added, total_cost, base_cost_per_piece,
        keterangan, no_surat
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
        NULLIF(v_item->>'keterangan', ''),
        NULLIF(v_item->>'no_surat', '')
      )
      RETURNING id INTO v_barang_masuk_id;

      v_new_stok_gudang := COALESCE(v_prod.stok_gudang, 0) + v_base_qty;

      IF v_has_cost THEN
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
        v_new_avco := COALESCE(v_prod.harga_pokok_avco, 0);
        v_new_nilai_persediaan := COALESCE(v_prod.nilai_persediaan, 0);
      END IF;

    ELSE
      v_total_cost := COALESCE((v_item->>'harga_beli')::numeric, 0) * COALESCE((v_item->>'jumlah')::numeric, 0);
      v_has_cost := v_total_cost > 0;

      INSERT INTO barang_masuk (
        tgl_masuk, id_supplier, id_produk, harga_beli, jumlah, total, keterangan
      ) VALUES (
        (v_item->>'tgl_masuk')::date,
        (v_item->>'id_supplier')::integer,
        (v_item->>'id_produk')::integer,
        CASE WHEN v_has_cost THEN (v_item->>'harga_beli')::numeric ELSE 0 END,
        (v_item->>'jumlah')::numeric,
        v_total_cost,
        NULLIF(v_item->>'keterangan', '')
      )
      RETURNING id INTO v_barang_masuk_id;

      v_total_stok     := COALESCE(v_prod.stok, 0) + COALESCE(v_prod.stok_gudang, 0);
      v_new_stok_gudang := COALESCE(v_prod.stok_gudang, 0) + (v_item->>'jumlah')::numeric;

      IF v_has_cost THEN
        v_nilai_masuk := (v_item->>'jumlah')::numeric * (v_item->>'harga_beli')::numeric;

        IF (v_total_stok + (v_item->>'jumlah')::numeric) > 0 THEN
          v_new_avco := (
            (v_total_stok * COALESCE(v_prod.harga_pokok_avco, 0))
            + v_nilai_masuk
          ) / (v_total_stok + (v_item->>'jumlah')::numeric);
        ELSE
          v_new_avco := 0;
        END IF;
        v_new_nilai_persediaan := (v_total_stok + (v_item->>'jumlah')::numeric) * v_new_avco;
      ELSE
        v_new_avco := COALESCE(v_prod.harga_pokok_avco, 0);
        v_new_nilai_persediaan := COALESCE(v_prod.nilai_persediaan, 0);
      END IF;
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
      harga_pokok_avco = CASE WHEN v_has_cost THEN v_new_avco ELSE COALESCE(harga_pokok_avco, 0) END,
      nilai_persediaan = CASE WHEN v_has_cost THEN v_new_nilai_persediaan ELSE COALESCE(nilai_persediaan, 0) END,
      harga_modal      = CASE WHEN v_has_cost AND COALESCE(harga_modal, 0) = 0 THEN v_new_avco ELSE harga_modal END,
      updated_at       = now()
    WHERE id = (v_item->>'id_produk')::integer;

    UPDATE barang_masuk
    SET harga_ditentukan = v_has_cost
    WHERE id = v_barang_masuk_id;

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

-- ============================================================================
-- LANGKAH 3: Verifikasi
-- ============================================================================

-- Cek kolom harga_ditentukan
SELECT 
  column_name, 
  data_type,
  column_default
FROM information_schema.columns 
WHERE table_name = 'barang_masuk' 
AND column_name = 'harga_ditentukan';

-- Cek fungsi sudah update (harus ada v_has_cost)
SELECT 
  CASE 
    WHEN prosrc LIKE '%v_has_cost%' THEN '✅ Migration berhasil!'
    ELSE '❌ Migration belum dijalankan'
  END as status
FROM pg_proc 
WHERE proname = 'process_barang_masuk';
