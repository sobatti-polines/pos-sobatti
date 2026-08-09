-- 20260901_isi_stok_paket_ke_gudang.sql
-- Perubahan process_isi_stok_paket:
--   * Stok paket ditambah di GUDANG (stok_gudang), bukan display (stok)
--   * Master dikurangi dari GUDANG dulu, baru display (Pilihan A)
--   * Return value: paket_stok_gudang_baru + paket_stok_display_baru

CREATE OR REPLACE FUNCTION process_isi_stok_paket(
  p_id_paket INT,
  p_qty_paket NUMERIC
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_paket RECORD;
  v_master RECORD;
  v_qty_total NUMERIC;
  v_display_taken NUMERIC;
  v_gudang_taken NUMERIC;
  v_qty_per_unit NUMERIC;
  v_error_text TEXT;
BEGIN
  PERFORM pg_advisory_xact_lock(987654325);

  IF p_qty_paket IS NULL OR p_qty_paket <= 0 THEN
    RETURN jsonb_build_object('error', 'Jumlah paket harus lebih dari 0');
  END IF;

  SELECT * INTO v_paket FROM produk WHERE id = p_id_paket;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Produk paket tidak ditemukan');
  END IF;

  IF v_paket.id_produk_master IS NULL THEN
    RETURN jsonb_build_object('error', 'Produk bukan produk paket');
  END IF;

  v_qty_per_unit := v_paket.qty_per_unit;
  v_qty_total := p_qty_paket * v_qty_per_unit;

  SELECT * INTO v_master FROM produk WHERE id = v_paket.id_produk_master;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Produk master tidak ditemukan');
  END IF;

  IF COALESCE(v_master.stok, 0) + COALESCE(v_master.stok_gudang, 0) < v_qty_total THEN
    v_error_text := format(
      'Stok master tidak mencukupi. Diperlukan %s satuan (%s paket x %s), tersedia %s',
      v_qty_total, p_qty_paket, v_qty_per_unit,
      COALESCE(v_master.stok, 0) + COALESCE(v_master.stok_gudang, 0)
    );
    RETURN jsonb_build_object('error', v_error_text);
  END IF;

  -- Master dikurangi dari gudang dulu, baru display (Pilihan A)
  v_gudang_taken := LEAST(COALESCE(v_master.stok_gudang, 0), v_qty_total);
  v_display_taken := v_qty_total - v_gudang_taken;

  UPDATE produk SET stok_gudang = COALESCE(stok_gudang, 0) - v_gudang_taken WHERE id = v_master.id;
  IF v_display_taken > 0 THEN
    UPDATE produk SET stok = COALESCE(stok, 0) - v_display_taken WHERE id = v_master.id;
  END IF;

  -- Stok paket ditambah ke GUDANG (bukan display)
  UPDATE produk SET stok_gudang = COALESCE(stok_gudang, 0) + p_qty_paket WHERE id = v_paket.id;

  RETURN jsonb_build_object(
    'success', true,
    'paket_stok_gudang_baru', COALESCE(v_paket.stok_gudang, 0) + p_qty_paket,
    'paket_stok_display_baru', COALESCE(v_paket.stok, 0),
    'master_gudang_taken', v_gudang_taken,
    'master_display_taken', v_display_taken
  );
END;
$$;
