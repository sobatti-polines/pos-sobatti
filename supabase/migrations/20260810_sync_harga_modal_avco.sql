-- 20260810_sync_harga_modal_avco.sql
-- T1-19: Sinkronkan `harga_modal` dari AVCO pada saat barang masuk / void / retur.
--
-- Kebijakan (keputusan owner): `harga_modal` HANYA di-set dari AVCO bila nilai
-- saat ini IS NULL atau = 0. Manual override di form produk / import tetap
-- dipertahankan dan TIDAK ditimpa oleh RPC. Alasan: `harga_modal` dipakai
-- sebagai fallback HPP di process_checkout
-- (COALESCE(NULLIF(harga_pokok_avco,0), harga_modal)), jadi mengisi harga_modal
-- yang masih kosong menjaga konsistensi tanpa menghapus nilai yang diinput manual.
--
-- Prinsip additive: CREATE OR REPLACE FUNCTION — logika inti (AVCO, UoM,
-- dual-stok, void, retur) TIDAK diubah. Aman dijalankan ulang.
-- Dua UPDATE produk ditambahkan ke masing-masing fungsi: kolom `harga_modal`
-- dengan ekspresi CASE (NULL/0 → v_new_avco, selain itu pertahankan).

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
           COALESCE(conversion_ratio, 1) AS conversion_ratio,
           hitung_stok INTO v_prod
    FROM produk
    WHERE id = (v_item->>'id_produk')::integer
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Produk dengan ID % tidak ditemukan', (v_item->>'id_produk')::integer;
    END IF;

    -- Guard hitung_stok: tolak produk non-tracked (jasa/paket master)
    IF NOT COALESCE(v_prod.hitung_stok, true) THEN
      RAISE EXCEPTION 'Produk dengan ID % tidak terhitung stoknya — barang masuk ditolak', (v_item->>'id_produk')::integer;
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
      harga_modal      = CASE WHEN COALESCE(harga_modal, 0) = 0 THEN v_new_avco ELSE harga_modal END,
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

-- ============================================================================
-- T1-19: sync harga_modal di cancel_barang_masuk (void)
-- ============================================================================

CREATE OR REPLACE FUNCTION cancel_barang_masuk(
  p_id_barang_masuk BIGINT,
  p_id_pengguna BIGINT,
  p_alasan       TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_bm RECORD;
  v_produk RECORD;
  v_base_qty      NUMERIC;
  v_per_piece     NUMERIC;
  v_total_sebelum NUMERIC;
  v_total_sesudah NUMERIC;
  v_new_nilai     NUMERIC;
  v_new_avco      NUMERIC;
  v_avco_sebelum  NUMERIC;
  v_qty_keluar    NUMERIC;
BEGIN
  PERFORM pg_advisory_xact_lock(987654322);

  SELECT * INTO v_bm
  FROM barang_masuk
  WHERE id = p_id_barang_masuk
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Barang masuk tidak ditemukan');
  END IF;

  IF v_bm.status = 'DIVOID' THEN
    RETURN jsonb_build_object('error', 'Barang masuk ini sudah di-void');
  END IF;

  SELECT * INTO v_produk
  FROM produk
  WHERE id = v_bm.id_produk
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Produk tidak ditemukan');
  END IF;

  v_base_qty  := COALESCE(v_bm.base_qty_added, v_bm.jumlah, 0);
  v_per_piece := COALESCE(v_bm.base_cost_per_piece, v_bm.harga_beli, 0);

  v_total_sebelum := COALESCE(v_produk.stok, 0) + COALESCE(v_produk.stok_gudang, 0);
  v_avco_sebelum  := COALESCE(v_produk.harga_pokok_avco, 0);
  v_qty_keluar    := v_base_qty;
  v_total_sesudah := v_total_sebelum - v_base_qty;

  IF v_total_sesudah <= 0 THEN
    v_new_avco := 0;
  ELSE
    v_new_avco := ((v_total_sebelum * v_avco_sebelum) - (v_base_qty * v_per_piece)) / v_total_sesudah;
    IF v_new_avco < 0 THEN
      v_new_avco := 0;
    END IF;
  END IF;

  v_new_nilai := v_total_sesudah * v_new_avco;

  UPDATE produk
  SET stok_gudang      = GREATEST(COALESCE(v_produk.stok_gudang, 0) - v_base_qty, 0),
      harga_pokok_avco = v_new_avco,
      nilai_persediaan = v_new_nilai,
      harga_modal      = CASE WHEN COALESCE(harga_modal, 0) = 0 THEN v_new_avco ELSE harga_modal END,
      updated_at       = now()
  WHERE id = v_produk.id;

  INSERT INTO riwayat_avco (
    id_produk, jenis_mutasi, id_referensi,
    qty_masuk, qty_keluar, harga_satuan_transaksi,
    stok_sebelum, avco_sebelum,
    stok_sesudah, avco_sesudah, nilai_persediaan_sesudah
  ) VALUES (
    v_produk.id, 'retur_beli', v_bm.id,
    NULL, v_qty_keluar, v_per_piece,
    v_total_sebelum, v_avco_sebelum,
    v_total_sesudah, v_new_avco, v_new_nilai
  );

  UPDATE barang_masuk
  SET status      = 'DIVOID',
      voided_at   = now(),
      voided_by   = p_id_pengguna,
      alasan_void = p_alasan
  WHERE id = v_bm.id;

  RETURN jsonb_build_object('success', true, 'id', v_bm.id);
END;
$$;

GRANT EXECUTE ON FUNCTION cancel_barang_masuk(BIGINT, BIGINT, TEXT) TO authenticated;

-- ============================================================================
-- T1-19: sync harga_modal di process_retur_pembelian (retur)
-- Versi dasar dari 20260810_fix_retur_wib_rls.sql (WIB + RLS tetap dipertahankan).
-- ============================================================================

CREATE OR REPLACE FUNCTION process_retur_pembelian(
  p_id_barang_masuk BIGINT,
  p_id_pengguna     BIGINT,
  p_items           JSONB,
  p_keterangan      TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_bm  RECORD;
  v_item JSONB;
  v_produk RECORD;
  v_retur_id UUID;
  v_no_retur TEXT;
  v_tgl_wib DATE;
  v_count   INT;
  v_total   NUMERIC := 0;
  v_qty     NUMERIC;
  v_hpp     NUMERIC;
  v_avco_sebelum NUMERIC;
  v_total_stok_sebelum NUMERIC;
  v_new_avco NUMERIC;
  v_new_nilai NUMERIC;
BEGIN
  PERFORM pg_advisory_xact_lock(987654322);

  -- Tanggal retur mengikuti WIB (Asia/Jakarta), bukan UTC server
  v_tgl_wib := (now() AT TIME ZONE 'Asia/Jakarta')::date;

  SELECT * INTO v_bm
  FROM barang_masuk
  WHERE id = p_id_barang_masuk
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Barang masuk tidak ditemukan');
  END IF;

  IF v_bm.status = 'DIVOID' THEN
    RETURN jsonb_build_object('error', 'Barang masuk sudah dibatalkan — tidak bisa dibuat retur');
  END IF;

  IF p_items IS NULL OR jsonb_typeof(p_items) != 'array' OR jsonb_array_length(p_items) = 0 THEN
    RETURN jsonb_build_object('error', 'Item retur tidak boleh kosong');
  END IF;

  -- Pass 1: validasi semua item sebelum menulis apapun (hindari header parsial)
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    SELECT * INTO v_produk
    FROM produk
    WHERE id = (v_item->>'id_produk')::BIGINT
    FOR UPDATE;

    IF NOT FOUND THEN
      RETURN jsonb_build_object('error', 'Produk tidak ditemukan');
    END IF;

    v_qty := (v_item->>'qty_retur')::NUMERIC;

    IF v_qty <= 0 THEN
      RETURN jsonb_build_object('error', 'Qty retur harus lebih dari 0 untuk produk: ' || v_produk.nama_produk);
    END IF;

    IF COALESCE(v_produk.stok_gudang, 0) < v_qty THEN
      RETURN jsonb_build_object('error', 'Stok gudang tidak mencukupi untuk produk: ' || v_produk.nama_produk);
    END IF;
  END LOOP;

  -- no_retur: RB-YYYYMMDD-NN (urutan per hari WIB)
  SELECT COALESCE(count(*), 0) + 1 INTO v_count
  FROM retur_pembelian
  WHERE tgl_retur = v_tgl_wib;

  v_no_retur := 'RB-' || to_char(v_tgl_wib, 'YYYYMMDD') || '-' || lpad(v_count::text, 2, '0');

  INSERT INTO retur_pembelian (
    no_retur, tgl_retur, id_barang_masuk, id_supplier, id_pengguna, keterangan
  ) VALUES (
    v_no_retur, v_tgl_wib, v_bm.id, v_bm.id_supplier, p_id_pengguna, p_keterangan
  )
  RETURNING id INTO v_retur_id;

  -- Pass 2: proses tiap item — reverse AVCO, update stok gudang, catat detail & riwayat
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    SELECT * INTO v_produk
    FROM produk
    WHERE id = (v_item->>'id_produk')::BIGINT
    FOR UPDATE;

    v_qty := (v_item->>'qty_retur')::NUMERIC;
    v_hpp := COALESCE(v_produk.harga_pokok_avco, v_produk.harga_modal, 0);

    v_total_stok_sebelum := COALESCE(v_produk.stok, 0) + COALESCE(v_produk.stok_gudang, 0);
    v_avco_sebelum       := COALESCE(v_produk.harga_pokok_avco, 0);

    IF (v_total_stok_sebelum - v_qty) <= 0 THEN
      v_new_avco := 0;
    ELSE
      v_new_avco := ((v_total_stok_sebelum * v_avco_sebelum) - (v_qty * v_hpp)) / (v_total_stok_sebelum - v_qty);
      IF v_new_avco < 0 THEN
        v_new_avco := 0;
      END IF;
    END IF;

    v_new_nilai := (v_total_stok_sebelum - v_qty) * v_new_avco;

    UPDATE produk
    SET stok_gudang      = GREATEST(COALESCE(v_produk.stok_gudang, 0) - v_qty, 0),
        harga_pokok_avco = v_new_avco,
        nilai_persediaan = v_new_nilai,
        harga_modal      = CASE WHEN COALESCE(harga_modal, 0) = 0 THEN v_new_avco ELSE harga_modal END,
        updated_at       = now()
    WHERE id = v_produk.id;

    INSERT INTO detail_retur_pembelian (
      id_retur, id_produk, qty_retur, harga_pokok, jumlah, keterangan
    ) VALUES (
      v_retur_id, v_produk.id, v_qty, v_hpp, v_qty * v_hpp, v_item->>'keterangan'
    );

    INSERT INTO riwayat_avco (
      id_produk, jenis_mutasi, id_referensi, id_referensi_uuid,
      qty_masuk, qty_keluar, harga_satuan_transaksi,
      stok_sebelum, avco_sebelum,
      stok_sesudah, avco_sesudah, nilai_persediaan_sesudah
    ) VALUES (
      v_produk.id, 'retur_beli', NULL, v_retur_id,
      NULL, v_qty, v_hpp,
      v_total_stok_sebelum, v_avco_sebelum,
      v_total_stok_sebelum - v_qty, v_new_avco, v_new_nilai
    );

    v_total := v_total + (v_qty * v_hpp);
  END LOOP;

  UPDATE retur_pembelian
  SET total_nilai = v_total
  WHERE id = v_retur_id;

  RETURN jsonb_build_object('success', true, 'no_retur', v_no_retur, 'id', v_retur_id);
END;
$$;

GRANT EXECUTE ON FUNCTION process_retur_pembelian(BIGINT, BIGINT, JSONB, TEXT) TO authenticated;
