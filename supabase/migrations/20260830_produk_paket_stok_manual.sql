-- 20260830_produk_paket_stok_manual.sql
-- Produk paket kini mengelola stok SENDIRI (model terpisah):
--   * stok paket TIDAK diturunkan otomatis dari master
--   * stok paket diisi MANUAL lewat RPC process_isi_stok_paket (konversi dari stok master)
--   * barang masuk & stok opname tidak lagi menarget paket (filter di aplikasi)

-- 1) Backfill: semua paket yang sudah ada menjadi hitung_stok = true
UPDATE produk
SET hitung_stok = TRUE
WHERE id_produk_master IS NOT NULL
  AND hitung_stok = FALSE;

-- 2) Guard trigger: cegah paket bertingkat, qty_per_unit invalid, dan
--    hitung_stok = false pada paket
CREATE OR REPLACE FUNCTION guard_produk_paket()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.id_produk_master IS NOT NULL THEN
    IF NEW.id_produk_master = NEW.id THEN
      RAISE EXCEPTION 'Produk tidak boleh menjadi master dirinya sendiri';
    END IF;

    IF EXISTS (SELECT 1 FROM produk WHERE id = NEW.id_produk_master AND id_produk_master IS NOT NULL) THEN
      RAISE EXCEPTION 'Master tidak boleh berupa produk paket';
    END IF;

    IF NEW.qty_per_unit IS NULL OR NEW.qty_per_unit <= 0 THEN
      RAISE EXCEPTION 'qty_per_unit wajib diisi dan lebih dari 0 untuk produk paket';
    END IF;

    IF NOT NEW.hitung_stok THEN
      RAISE EXCEPTION 'Produk paket wajib hitung_stok = true';
    END IF;
  ELSE
    IF NEW.qty_per_unit IS NOT NULL THEN
      RAISE EXCEPTION 'qty_per_unit hanya boleh diisi untuk produk paket';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_produk_paket ON produk;
CREATE TRIGGER trg_guard_produk_paket
BEFORE INSERT OR UPDATE OF id_produk_master, qty_per_unit, hitung_stok
ON produk
FOR EACH ROW
EXECUTE FUNCTION guard_produk_paket();

-- 3) RPC process_isi_stok_paket
--    Konversi stok master -> stok paket (kurangi stok master, tambah stok paket).
--    Stok paket bertambah di display (stok); stok master dikurangi dari display dulu, lalu gudang.
--    pg_advisory_xact_lock(987654325) mencegah race dengan checkout/barang masuk/opname.
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
  SELECT pg_advisory_xact_lock(987654325);

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

  v_display_taken := LEAST(COALESCE(v_master.stok, 0), v_qty_total);
  v_gudang_taken := v_qty_total - v_display_taken;

  UPDATE produk SET stok = COALESCE(stok, 0) - v_display_taken WHERE id = v_master.id;
  IF v_gudang_taken > 0 THEN
    UPDATE produk SET stok_gudang = COALESCE(stok_gudang, 0) - v_gudang_taken WHERE id = v_master.id;
  END IF;

  UPDATE produk SET stok = COALESCE(stok, 0) + p_qty_paket WHERE id = v_paket.id;

  RETURN jsonb_build_object(
    'success', true,
    'paket_stok_baru', COALESCE(v_paket.stok, 0) + p_qty_paket,
    'master_display_taken', v_display_taken,
    'master_gudang_taken', v_gudang_taken
  );
END;
$$;
