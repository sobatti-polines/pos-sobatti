-- 20260902_jenis_paket_actual_weight.sql
-- Tambah jenis_isi_paket: FIXED_RATIO (default) atau ACTUAL_WEIGHT
-- FIXED_RATIO: qty_paket × qty_per_unit dikurangi dari master (seperti sekarang)
-- ACTUAL_WEIGHT: total_berat langsung dikurangi dari master, harga paket = rata-rata

-- 1) Kolom jenis_isi_paket
ALTER TABLE produk ADD COLUMN IF NOT EXISTS jenis_isi_paket TEXT
  CHECK (jenis_isi_paket IN ('FIXED_RATIO', 'ACTUAL_WEIGHT'));

-- Backfill: semua paket existing = FIXED_RATIO
UPDATE produk SET jenis_isi_paket = 'FIXED_RATIO'
WHERE id_produk_master IS NOT NULL AND jenis_isi_paket IS NULL;

-- 2) Update guard trigger: qty_per_unit wajib untuk semua paket (tetap)
--    tapi jenis_isi_paket wajib untuk paket
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

    IF NEW.jenis_isi_paket IS NULL THEN
      RAISE EXCEPTION 'Jenis isi paket wajib dipilih (FIXED_RATIO atau ACTUAL_WEIGHT)';
    END IF;

    IF NOT NEW.hitung_stok THEN
      RAISE EXCEPTION 'Produk paket wajib hitung_stok = true';
    END IF;
  ELSE
    IF NEW.qty_per_unit IS NOT NULL THEN
      RAISE EXCEPTION 'qty_per_unit hanya boleh diisi untuk produk paket';
    END IF;
    IF NEW.jenis_isi_paket IS NOT NULL THEN
      RAISE EXCEPTION 'jenis_isi_paket hanya boleh diisi untuk produk paket';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_produk_paket ON produk;
CREATE TRIGGER trg_guard_produk_paket
BEFORE INSERT OR UPDATE OF id_produk_master, qty_per_unit, hitung_stok, jenis_isi_paket
ON produk
FOR EACH ROW
EXECUTE FUNCTION guard_produk_paket();

-- 3) Update RPC process_isi_stok_paket
--    Tambahan param: p_total_berat (untuk ACTUAL_WEIGHT)
--    ACTUAL_WEIGHT: master dikurangi p_total_berat satuan, harga paket = rata-rata
CREATE OR REPLACE FUNCTION process_isi_stok_paket(
  p_id_paket INT,
  p_qty_paket NUMERIC,
  p_total_berat NUMERIC DEFAULT NULL
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
  v_master_harga_pokok NUMERIC;
  v_nilai_masuk NUMERIC;
  v_avco_baru NUMERIC;
  v_nilai_paket_baru NUMERIC;
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

  -- Tentukan qty total berdasarkan jenis isi paket
  IF v_paket.jenis_isi_paket = 'ACTUAL_WEIGHT' THEN
    IF p_total_berat IS NULL OR p_total_berat <= 0 THEN
      RETURN jsonb_build_object('error', 'Total berat harus lebih dari 0 untuk paket tipe ACTUAL_WEIGHT');
    END IF;
    v_qty_total := p_total_berat;
  ELSE
    -- FIXED_RATIO (default)
    v_qty_total := p_qty_paket * v_qty_per_unit;
  END IF;

  SELECT * INTO v_master FROM produk WHERE id = v_paket.id_produk_master;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Produk master tidak ditemukan');
  END IF;

  IF COALESCE(v_master.stok, 0) + COALESCE(v_master.stok_gudang, 0) < v_qty_total THEN
    IF v_paket.jenis_isi_paket = 'ACTUAL_WEIGHT' THEN
      v_error_text := format(
        'Stok master tidak mencukupi. Diperlukan %s satuan, tersedia %s',
        v_qty_total,
        COALESCE(v_master.stok, 0) + COALESCE(v_master.stok_gudang, 0)
      );
    ELSE
      v_error_text := format(
        'Stok master tidak mencukupi. Diperlukan %s satuan (%s paket x %s), tersedia %s',
        v_qty_total, p_qty_paket, v_qty_per_unit,
        COALESCE(v_master.stok, 0) + COALESCE(v_master.stok_gudang, 0)
      );
    END IF;
    RETURN jsonb_build_object('error', v_error_text);
  END IF;

  -- Kurangi master dari gudang dulu, baru display (Pilihan A)
  v_gudang_taken := LEAST(COALESCE(v_master.stok_gudang, 0), v_qty_total);
  v_display_taken := v_qty_total - v_gudang_taken;

  UPDATE produk SET stok_gudang = COALESCE(stok_gudang, 0) - v_gudang_taken WHERE id = v_master.id;
  IF v_display_taken > 0 THEN
    UPDATE produk SET stok = COALESCE(stok, 0) - v_display_taken WHERE id = v_master.id;
  END IF;

  -- Update nilai_persediaan master (kurangi proporsional)
  v_master_harga_pokok := COALESCE(v_master.harga_pokok_avco, v_master.harga_modal, 0);
  IF COALESCE(v_master.nilai_persediaan, 0) > 0 AND (COALESCE(v_master.stok, 0) + COALESCE(v_master.stok_gudang, 0)) > 0 THEN
    v_master_harga_pokok := v_master.nilai_persediaan / (COALESCE(v_master.stok, 0) + COALESCE(v_master.stok_gudang, 0));
  END IF;
  v_nilai_masuk := v_qty_total * v_master_harga_pokok;

  UPDATE produk SET
    nilai_persediaan = GREATEST(COALESCE(nilai_persediaan, 0) - v_nilai_masuk, 0)
  WHERE id = v_master.id;

  -- Stok paket ditambah ke GUDANG
  UPDATE produk SET stok_gudang = COALESCE(stok_gudang, 0) + p_qty_paket WHERE id = v_paket.id;

  -- Untuk ACTUAL_WEIGHT: update AVCO paket (rata-rata berat)
  IF v_paket.jenis_isi_paket = 'ACTUAL_WEIGHT' THEN
    v_avco_baru := v_qty_total * v_master_harga_pokok / p_qty_paket;
    v_nilai_paket_baru := COALESCE(v_paket.stok_gudang, 0) * COALESCE(v_paket.harga_pokok_avco, 0)
                         + p_qty_paket * v_avco_baru;

    UPDATE produk SET
      harga_pokok_avco = v_avco_baru,
      nilai_persediaan = v_nilai_paket_baru
    WHERE id = v_paket.id;

    -- Catat riwayat AVCO paket
    INSERT INTO riwayat_avco (
      id_produk, jenis_mutasi, qty_masuk,
      harga_satuan_transaksi,
      stok_sebelum, avco_sebelum,
      stok_sesudah, avco_sesudah,
      nilai_persediaan_sesudah
    ) VALUES (
      v_paket.id, 'pembelian', p_qty_paket,
      v_avco_baru,
      COALESCE(v_paket.stok_gudang, 0) - p_qty_paket, COALESCE(v_paket.harga_pokok_avco, 0),
      COALESCE(v_paket.stok_gudang, 0), v_avco_baru,
      v_nilai_paket_baru
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'jenis_isi_paket', v_paket.jenis_isi_paket,
    'paket_stok_gudang_baru', COALESCE(v_paket.stok_gudang, 0) + p_qty_paket,
    'paket_stok_display_baru', COALESCE(v_paket.stok, 0),
    'master_gudang_taken', v_gudang_taken,
    'master_display_taken', v_display_taken,
    'total_master_kurang', v_qty_total,
    'harga_pokok_per_paket', CASE WHEN v_paket.jenis_isi_paket = 'ACTUAL_WEIGHT' THEN v_avco_baru ELSE NULL END
  );
END;
$$;
