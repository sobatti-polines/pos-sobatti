-- 20260810_fix_retur_wib_rls.sql
-- Perbaikan migrasi retur (T1-14) yang sudah terlanjur dijalankan:
--   1. Timezone: no_retur & tgl_retur memakai WIB (Asia/Jakarta), konsisten
--      dengan process_checkout (sebelumnya pakai now()/CURRENT_DATE UTC —
--      di Supabase bisa selisih 1 hari antara 17:00-07:00 WIB).
--   2. RLS: tambah policy SELECT/INSERT untuk role authenticated pada
--      retur_pembelian & detail_retur_pembelian (standar proyek; tabel ini
--      dibuat tanpa RLS). Pola sama dengan 20260810_fix_rls_stok_opname_sesi.sql.
-- File ini aman dijalankan ulang (CREATE OR REPLACE / DROP POLICY IF EXISTS).

-- ============================================================================
-- 1. Fix timezone WIB di process_retur_pembelian
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

-- ============================================================================
-- 2. RLS: retur_pembelian & detail_retur_pembelian
-- ============================================================================

-- ─── retur_pembelian ─────────────────────────────────────────────────────────
ALTER TABLE retur_pembelian ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated users can select retur_pembelian" ON retur_pembelian;
DROP POLICY IF EXISTS "authenticated users can insert retur_pembelian" ON retur_pembelian;

CREATE POLICY "authenticated users can select retur_pembelian"
  ON retur_pembelian FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "authenticated users can insert retur_pembelian"
  ON retur_pembelian FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- ─── detail_retur_pembelian ──────────────────────────────────────────────────
ALTER TABLE detail_retur_pembelian ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated users can select detail_retur_pembelian" ON detail_retur_pembelian;
DROP POLICY IF EXISTS "authenticated users can insert detail_retur_pembelian" ON detail_retur_pembelian;

CREATE POLICY "authenticated users can select detail_retur_pembelian"
  ON detail_retur_pembelian FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "authenticated users can insert detail_retur_pembelian"
  ON detail_retur_pembelian FOR INSERT
  TO authenticated
  WITH CHECK (true);
