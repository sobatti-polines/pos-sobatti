-- ============================================================
-- STOK OPNAME SESI: draft → review → apply
-- ============================================================

-- 1. Tabel baru: sesi_stok_opname
CREATE TABLE IF NOT EXISTS sesi_stok_opname (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  no_sesi       TEXT UNIQUE NOT NULL,
  tgl_sesi      DATE NOT NULL,
  status        TEXT NOT NULL DEFAULT 'DRAFT'
                CHECK (status IN ('DRAFT','SELESAI','DIBATALKAN')),
  id_pengguna   BIGINT NULL REFERENCES pengguna(id),
  total_item    INT DEFAULT 0,
  total_selisih NUMERIC DEFAULT 0,
  total_nilai   NUMERIC DEFAULT 0,
  keterangan    TEXT,
  created_at    TIMESTAMPTZ DEFAULT now(),
  applied_at    TIMESTAMPTZ NULL
);

-- 2. Kolom baru di stok_opname
ALTER TABLE stok_opname ADD COLUMN IF NOT EXISTS id_sesi UUID NULL
  REFERENCES sesi_stok_opname(id) ON DELETE SET NULL;
ALTER TABLE stok_opname ADD COLUMN IF NOT EXISTS id_pengguna BIGINT NULL
  REFERENCES pengguna(id);
ALTER TABLE stok_opname ADD COLUMN IF NOT EXISTS klasifikasi TEXT NULL
  CHECK (klasifikasi IN ('KELEBIHAN','SALAH_CATAT','RUSAK','HILANG','LAINNYA'));
ALTER TABLE stok_opname ADD COLUMN IF NOT EXISTS harga_pokok_snap NUMERIC NULL;

-- 3. Index
CREATE INDEX IF NOT EXISTS idx_stok_opname_id_sesi ON stok_opname(id_sesi);
CREATE INDEX IF NOT EXISTS idx_stok_opname_klasifikasi ON stok_opname(klasifikasi);
CREATE INDEX IF NOT EXISTS idx_sesi_stok_opname_status ON sesi_stok_opname(status);
CREATE INDEX IF NOT EXISTS idx_sesi_stok_opname_tgl ON sesi_stok_opname(tgl_sesi);

-- 4. RPC: Terapkan sesi stok opname
CREATE OR REPLACE FUNCTION process_stok_opname_apply(
  p_id_sesi UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_sesi RECORD;
  v_item RECORD;
  v_selisih NUMERIC;
  v_total_stok_sebelum NUMERIC;
  v_total_stok_sesudah NUMERIC;
  v_new_nilai NUMERIC;
  v_qty_masuk NUMERIC;
  v_qty_keluar NUMERIC;
  v_total_item INT := 0;
  v_total_selisih NUMERIC := 0;
  v_total_nilai NUMERIC := 0;
BEGIN
  PERFORM pg_advisory_xact_lock(987654323);

  SELECT * INTO v_sesi FROM sesi_stok_opname WHERE id = p_id_sesi;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Sesi opname tidak ditemukan');
  END IF;

  IF v_sesi.status != 'DRAFT' THEN
    RETURN jsonb_build_object('error', 'Sesi ini sudah diproses atau dibatalkan (status: ' || v_sesi.status || ')');
  END IF;

  FOR v_item IN
    SELECT so.*, p.stok, p.stok_gudang, p.harga_pokok_avco, p.nilai_persediaan
    FROM stok_opname so
    JOIN produk p ON p.id = so.id_produk
    WHERE so.id_sesi = p_id_sesi
    FOR UPDATE OF so, p
  LOOP
    v_selisih := COALESCE(v_item.stok_fisik, 0) - COALESCE(v_item.stok_sistem, 0);

    v_total_stok_sebelum := COALESCE(v_item.stok, 0) + COALESCE(v_item.stok_gudang, 0);
    v_total_stok_sesudah := COALESCE(v_item.stok_fisik, 0) + COALESCE(v_item.stok_gudang, 0);

    -- Update stok display = stok_fisik
    UPDATE produk
    SET stok = COALESCE(v_item.stok_fisik, 0),
        updated_at = now()
    WHERE id = v_item.id_produk;

    -- Hitung nilai_persediaan baru
    v_new_nilai := v_total_stok_sesudah * COALESCE(v_item.harga_pokok_snap, v_item.harga_pokok_avco, 0);

    UPDATE produk
    SET nilai_persediaan = v_new_nilai
    WHERE id = v_item.id_produk;

    -- Catat riwayat AVCO jika ada selisih
    IF v_selisih != 0 THEN
      IF v_selisih > 0 THEN
        v_qty_masuk := v_selisih;
        v_qty_keluar := NULL;
      ELSE
        v_qty_masuk := NULL;
        v_qty_keluar := ABS(v_selisih);
      END IF;

      INSERT INTO riwayat_avco (
        id_produk, jenis_mutasi, id_referensi,
        qty_masuk, qty_keluar, harga_satuan_transaksi,
        stok_sebelum, avco_sebelum,
        stok_sesudah, avco_sesudah, nilai_persediaan_sesudah
      ) VALUES (
        v_item.id_produk,
        'koreksi',
        v_item.id,
        v_qty_masuk,
        v_qty_keluar,
        COALESCE(v_item.harga_pokok_snap, v_item.harga_pokok_avco, 0),
        v_total_stok_sebelum,
        COALESCE(v_item.harga_pokok_avco, 0),
        v_total_stok_sesudah,
        COALESCE(v_item.harga_pokok_avco, 0),
        v_new_nilai
      );

      UPDATE stok_opname SET selisih = v_selisih WHERE id = v_item.id;
    END IF;

    v_total_item := v_total_item + 1;
    v_total_selisih := v_total_selisih + v_selisih;
    v_total_nilai := v_total_nilai + (v_selisih * COALESCE(v_item.harga_pokok_snap, v_item.harga_pokok_avco, 0));
  END LOOP;

  UPDATE sesi_stok_opname
  SET status = 'SELESAI',
      applied_at = now(),
      total_item = v_total_item,
      total_selisih = v_total_selisih,
      total_nilai = v_total_nilai
  WHERE id = p_id_sesi;

  RETURN jsonb_build_object(
    'success', true,
    'total_item', v_total_item,
    'total_selisih', v_total_selisih,
    'total_nilai', v_total_nilai
  );
END;
$$;

-- 5. RPC: Batalkan sesi (tidak menyentuh stok)
CREATE OR REPLACE FUNCTION batalkan_sesi_stok_opname(
  p_id_sesi UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_sesi RECORD;
BEGIN
  SELECT * INTO v_sesi FROM sesi_stok_opname WHERE id = p_id_sesi;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Sesi opname tidak ditemukan');
  END IF;

  IF v_sesi.status != 'DRAFT' THEN
    RETURN jsonb_build_object('error', 'Hanya sesi DRAFT yang bisa dibatalkan');
  END IF;

  UPDATE sesi_stok_opname SET status = 'DIBATALKAN' WHERE id = p_id_sesi;
  DELETE FROM stok_opname WHERE id_sesi = p_id_sesi;

  RETURN jsonb_build_object('success', true);
END;
$$;

-- 6. Grant execute
GRANT EXECUTE ON FUNCTION process_stok_opname_apply(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION batalkan_sesi_stok_opname(UUID) TO authenticated;
