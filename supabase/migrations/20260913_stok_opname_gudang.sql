-- ============================================================
-- 1. Tambah kolom gudang di stok_opname
-- ============================================================
ALTER TABLE stok_opname ADD COLUMN IF NOT EXISTS stok_sistem_gudang NUMERIC NULL DEFAULT 0;
ALTER TABLE stok_opname ADD COLUMN IF NOT EXISTS stok_fisik_gudang NUMERIC NULL;
ALTER TABLE stok_opname ADD COLUMN IF NOT EXISTS selisih_gudang NUMERIC NULL;

-- ============================================================
-- 2. Update RPC process_stok_opname_apply
-- ============================================================
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
  v_selisih_display NUMERIC;
  v_selisih_gudang NUMERIC;
  v_total_selisih NUMERIC;
  v_total_stok_sebelum NUMERIC;
  v_total_stok_sesudah NUMERIC;
  v_new_nilai NUMERIC;
  v_qty_masuk NUMERIC;
  v_qty_keluar NUMERIC;
  v_total_item INT := 0;
  v_sesi_selisih NUMERIC := 0;
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
    -- Selisih dihitung per lokasi, jika fisik null maka dianggap 0, tapi biasanya di UI dikirim sesuai form
    v_selisih_display := COALESCE(v_item.stok_fisik, 0) - COALESCE(v_item.stok_sistem, 0);
    v_selisih_gudang := COALESCE(v_item.stok_fisik_gudang, 0) - COALESCE(v_item.stok_sistem_gudang, 0);
    v_total_selisih := v_selisih_display + v_selisih_gudang;

    v_total_stok_sebelum := COALESCE(v_item.stok, 0) + COALESCE(v_item.stok_gudang, 0);
    v_total_stok_sesudah := COALESCE(v_item.stok_fisik, 0) + COALESCE(v_item.stok_fisik_gudang, 0);

    -- Update stok display dan gudang = stok_fisik yang baru
    UPDATE produk
    SET stok = COALESCE(v_item.stok_fisik, 0),
        stok_gudang = COALESCE(v_item.stok_fisik_gudang, 0),
        updated_at = now()
    WHERE id = v_item.id_produk;

    -- Hitung nilai_persediaan baru
    v_new_nilai := v_total_stok_sesudah * COALESCE(v_item.harga_pokok_snap, v_item.harga_pokok_avco, 0);

    UPDATE produk
    SET nilai_persediaan = v_new_nilai
    WHERE id = v_item.id_produk;

    -- Catat riwayat AVCO jika ada total selisih
    IF v_total_selisih != 0 THEN
      IF v_total_selisih > 0 THEN
        v_qty_masuk := v_total_selisih;
        v_qty_keluar := NULL;
      ELSE
        v_qty_masuk := NULL;
        v_qty_keluar := ABS(v_total_selisih);
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

      UPDATE stok_opname 
      SET selisih = v_selisih_display, 
          selisih_gudang = v_selisih_gudang 
      WHERE id = v_item.id;
    END IF;

    v_total_item := v_total_item + 1;
    v_sesi_selisih := v_sesi_selisih + v_total_selisih;
    v_total_nilai := v_total_nilai + (v_total_selisih * COALESCE(v_item.harga_pokok_snap, v_item.harga_pokok_avco, 0));
  END LOOP;

  UPDATE sesi_stok_opname
  SET status = 'SELESAI',
      applied_at = now(),
      total_item = v_total_item,
      total_selisih = v_sesi_selisih,
      total_nilai = v_total_nilai
  WHERE id = p_id_sesi;

  RETURN jsonb_build_object(
    'success', true,
    'total_item', v_total_item,
    'total_selisih', v_sesi_selisih,
    'total_nilai', v_total_nilai
  );
END;
$$;
