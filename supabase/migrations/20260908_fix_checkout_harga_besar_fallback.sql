-- 20260908_fix_checkout_harga_besar_fallback.sql
-- Perbaikan bug: POS/kasir membaca kolom harga_jual_besar_* langsung dari DB.
-- Untuk data lama (produk dibuat sebelum migration 20260816 atau kolom NULL),
-- harga besar tampil 0/salah di kasir, padahal admin menampilkan hitungan live
-- (harga kecil × conversion_ratio).
--
-- Solusi:
--  1) Backfill semua produk yang jual_satuan terisi tapi harga besar NULL/0.
--  2) Update get_harga_efektif_produk: fallback hitung ROUND(harga kecil × ratio)
--     bila kolom harga besar NULL/0 (aman untuk data lama & event promo).

-- ============================================================
-- 1) Backfill — isi harga besar yang NULL/0 dari harga kecil × rasio
-- ============================================================
UPDATE produk
SET
  harga_jual_besar_satuan = ROUND(harga_jual_satuan * conversion_ratio),
  harga_jual_besar_grosir = ROUND(harga_jual_grosir * conversion_ratio),
  harga_jual_besar_promo  = CASE
                              WHEN harga_jual_promo IS NOT NULL
                                THEN ROUND(harga_jual_promo * conversion_ratio)
                              ELSE NULL
                            END
WHERE jual_satuan IS NOT NULL
  AND COALESCE(conversion_ratio, 0) > 0
  AND (COALESCE(harga_jual_besar_satuan, 0) <= 0
    OR COALESCE(harga_jual_besar_grosir, 0) <= 0);

-- ============================================================
-- 2) get_harga_efektif_produk — fallback hitung live bila NULL/0
-- ============================================================
CREATE OR REPLACE FUNCTION get_harga_efektif_produk(p_id_produk int4, p_tanggal date DEFAULT current_date)
RETURNS TABLE (
    harga_jual_satuan numeric,
    harga_jual_grosir numeric,
    harga_jual_promo numeric,
    harga_jual_besar_satuan numeric,
    harga_jual_besar_grosir numeric,
    harga_jual_besar_promo numeric,
    id_event_promo uuid,
    nama_event varchar
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_tipe text;
    v_nilai numeric;
    v_id_event uuid;
    v_nama varchar;
    v_prod record;
    -- harga besar yang sudah di-fallback (harga kecil × rasio)
    v_besar_satuan numeric;
    v_besar_grosir numeric;
    v_besar_promo  numeric;
BEGIN
    -- Ambil event aktif
    SELECT ep.id, ep.nama, ep.tipe_diskon, ep.nilai_diskon
    INTO v_id_event, v_nama, v_tipe, v_nilai
    FROM event_promo_produk epp
    JOIN event_promo ep ON ep.id = epp.id_event_promo
    WHERE epp.id_produk = p_id_produk
      AND ep.aktif = true
      AND p_tanggal BETWEEN ep.tanggal_mulai AND ep.tanggal_selesai
    LIMIT 1;

    -- Ambil harga asli produk
    SELECT p.harga_jual_satuan, p.harga_jual_grosir, p.harga_jual_promo,
           p.harga_jual_besar_satuan, p.harga_jual_besar_grosir, p.harga_jual_besar_promo,
           p.jual_satuan, p.conversion_ratio
    INTO v_prod
    FROM produk p
    WHERE p.id = p_id_produk;

    IF NOT FOUND THEN
      RETURN;
    END IF;

    -- Harga besar OTOMATIS = harga kecil × rasio (aturan 20260816).
    -- Gunakan kolom DB bila valid, selain itu hitung live dari harga kecil.
    IF v_prod.jual_satuan IS NOT NULL AND COALESCE(v_prod.conversion_ratio, 0) > 0 THEN
      v_besar_satuan := CASE
                          WHEN COALESCE(v_prod.harga_jual_besar_satuan, 0) > 0 THEN v_prod.harga_jual_besar_satuan
                          ELSE ROUND(v_prod.harga_jual_satuan * v_prod.conversion_ratio)
                        END;
      v_besar_grosir := CASE
                          WHEN COALESCE(v_prod.harga_jual_besar_grosir, 0) > 0 THEN v_prod.harga_jual_besar_grosir
                          ELSE ROUND(v_prod.harga_jual_grosir * v_prod.conversion_ratio)
                        END;
      v_besar_promo  := CASE
                          WHEN v_prod.harga_jual_promo IS NULL THEN NULL
                          WHEN COALESCE(v_prod.harga_jual_besar_promo, 0) > 0 THEN v_prod.harga_jual_besar_promo
                          ELSE ROUND(v_prod.harga_jual_promo * v_prod.conversion_ratio)
                        END;
    ELSE
      v_besar_satuan := NULL;
      v_besar_grosir := NULL;
      v_besar_promo  := NULL;
    END IF;

    IF v_id_event IS NOT NULL THEN
        IF v_tipe = 'persen' THEN
            harga_jual_satuan := GREATEST(v_prod.harga_jual_satuan * (1 - v_nilai/100), 0);
            harga_jual_grosir := GREATEST(v_prod.harga_jual_grosir * (1 - v_nilai/100), 0);
            harga_jual_promo := GREATEST(v_prod.harga_jual_promo * (1 - v_nilai/100), 0);
            harga_jual_besar_satuan := GREATEST(v_besar_satuan * (1 - v_nilai/100), 0);
            harga_jual_besar_grosir := GREATEST(v_besar_grosir * (1 - v_nilai/100), 0);
            harga_jual_besar_promo := GREATEST(v_besar_promo * (1 - v_nilai/100), 0);
        ELSE
            harga_jual_satuan := GREATEST(v_prod.harga_jual_satuan - v_nilai, 0);
            harga_jual_grosir := GREATEST(v_prod.harga_jual_grosir - v_nilai, 0);
            harga_jual_promo := GREATEST(v_prod.harga_jual_promo - v_nilai, 0);
            harga_jual_besar_satuan := GREATEST(v_besar_satuan - v_nilai, 0);
            harga_jual_besar_grosir := GREATEST(v_besar_grosir - v_nilai, 0);
            harga_jual_besar_promo := GREATEST(v_besar_promo - v_nilai, 0);
        END IF;
        id_event_promo := v_id_event;
        nama_event := v_nama;
    ELSE
        harga_jual_satuan := v_prod.harga_jual_satuan;
        harga_jual_grosir := v_prod.harga_jual_grosir;
        harga_jual_promo := v_prod.harga_jual_promo;
        harga_jual_besar_satuan := v_besar_satuan;
        harga_jual_besar_grosir := v_besar_grosir;
        harga_jual_besar_promo := v_besar_promo;
        id_event_promo := NULL;
        nama_event := NULL;
    END IF;
    RETURN NEXT;
END;
$$;
