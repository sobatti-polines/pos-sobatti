-- 20260810_barang_masuk_void.sql
-- T1-06: Migration void (hapus/batalkan) barang masuk via soft-update.
-- Kolom status menandai logical delete: 'AKTIF' / 'DIVOID'.
-- Kolom voided_* menyimpan metadata siapa & kapan void beserta alasan.
-- Data lama otomatis ber-status 'AKTIF' karena DEFAULT.

ALTER TABLE barang_masuk
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'AKTIF'
    CHECK (status IN ('AKTIF', 'DIVOID'));

ALTER TABLE barang_masuk
  ADD COLUMN IF NOT EXISTS voided_at TIMESTAMPTZ NULL;

ALTER TABLE barang_masuk
  ADD COLUMN IF NOT EXISTS voided_by BIGINT NULL REFERENCES pengguna(id);

ALTER TABLE barang_masuk
  ADD COLUMN IF NOT EXISTS alasan_void TEXT NULL;

COMMENT ON COLUMN barang_masuk.status IS 'Status barang masuk: AKTIF atau DIVOID (logical delete)';
COMMENT ON COLUMN barang_masuk.voided_at IS 'Waktu transaksi di-void';
COMMENT ON COLUMN barang_masuk.voided_by IS 'ID pengguna yang melakukan void';
COMMENT ON COLUMN barang_masuk.alasan_void IS 'Alasan pembatalan (wajib diisi saat void)';

CREATE INDEX IF NOT EXISTS idx_barang_masuk_status ON barang_masuk(status);

-- ============================================================================
-- T1-07: RPC cancel_barang_masuk — batalkan (void) barang masuk dengan
-- jurnal balik (reversal) agar stok & AVCO tetap konsisten.
-- Stok barang masuk selalu masuk ke stok_gudang, jadi void mengembalikan
-- stok_gudang (hanya gudang, bukan display). AVCO dihitung ulang dengan
-- reverse weighted average, nilai_persediaan diupdate, dan mutasi tercatat
-- di riwayat_avco (jenis_mutasi='retur_beli', id_referensi = id barang_masuk).
-- Baris asli dipertahankan (logical delete via status='DIVOID').
-- Menggunakan lock yang sama (987654322) dengan process_barang_masuk.
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