-- 20260810_retur_pembelian.sql
-- T1-13: Tabel retur pembelian ke supplier.
-- retur_pembelian      : header retur (no_retur unik RB-YYYYMMDD-NN)
-- detail_retur_pembelian : item retur (qty dalam base unit / satuan inventori)
-- Retur mengurangi stok (stok_gudang) & merekalkulasi AVCO (T1-14).

CREATE TABLE IF NOT EXISTS retur_pembelian (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  no_retur        TEXT UNIQUE NOT NULL,             -- format: RB-YYYYMMDD-NN
  tgl_retur       DATE NOT NULL,
  id_barang_masuk BIGINT NOT NULL REFERENCES barang_masuk(id),
  id_supplier     BIGINT REFERENCES supplier(id),
  id_pengguna     BIGINT REFERENCES pengguna(id),
  total_nilai     NUMERIC DEFAULT 0,
  keterangan      TEXT,
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS detail_retur_pembelian (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_retur      UUID NOT NULL REFERENCES retur_pembelian(id) ON DELETE CASCADE,
  id_produk     BIGINT NOT NULL REFERENCES produk(id),
  qty_retur     NUMERIC NOT NULL CHECK (qty_retur > 0),   -- base unit (satuan inventori)
  harga_pokok   NUMERIC NOT NULL,                          -- snapshot AVCO saat retur
  jumlah        NUMERIC NOT NULL,                          -- qty_retur × harga_pokok
  keterangan    TEXT
);

CREATE INDEX IF NOT EXISTS idx_retur_pembelian_tgl ON retur_pembelian(tgl_retur);
CREATE INDEX IF NOT EXISTS idx_retur_pembelian_supplier ON retur_pembelian(id_supplier);

-- ============================================================================
-- T1-14: RPC process_retur_pembelian — catat pengembalian barang ke supplier.
-- Retur mengurangi stok_gudang & merekalkulasi AVCO (reverse weighted average,
-- clamp >= 0, rumus sama dengan cancel_barang_masuk). Barang masuk asli tetap
-- AKTIF (retur berbeda dari void).
--
-- Kolom id_referensi di riwayat_avco bertipe INTEGER (dipakai untuk id/nomor
-- referensi angka: barang_masuk, transaksi, stok_opname). Retur memakai UUID,
-- jadi disimpan di kolom baru id_referensi_uuid (UUID) — riwayat_avco diperluas
-- secara additive; id_referensi dibiarkan NULL untuk baris retur.
-- ============================================================================

ALTER TABLE riwayat_avco
  ADD COLUMN IF NOT EXISTS id_referensi_uuid UUID NULL;

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

  -- no_retur: RB-YYYYMMDD-NN (urutan per hari)
  SELECT COALESCE(count(*), 0) + 1 INTO v_count
  FROM retur_pembelian
  WHERE tgl_retur = CURRENT_DATE;

  v_no_retur := 'RB-' || to_char(now(), 'YYYYMMDD') || '-' || lpad(v_count::text, 2, '0');

  INSERT INTO retur_pembelian (
    no_retur, tgl_retur, id_barang_masuk, id_supplier, id_pengguna, keterangan
  ) VALUES (
    v_no_retur, CURRENT_DATE, v_bm.id, v_bm.id_supplier, p_id_pengguna, p_keterangan
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