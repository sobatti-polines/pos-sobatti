-- 20260816_harga_jual_besar_otomatis.sql
-- Harga jual satuan besar (ROLL, LUSIN, dll) TIDAK lagi diinput manual.
-- Aturan baru: harga besar = harga jual satuan kecil × conversion_ratio.
--   Contoh: 1 roll = 50 m, 1 m = 6.500 → 1 roll = 6.500 × 50 = 325.000
--           1 lusin = 12 pcs, 1 pcs = 10.000 → 1 lusin = 120.000
-- Berlaku untuk ketiga tier: Satuan, Grosir, dan Promo.

-- ============================================================
-- 1) Backfill data lama — hitung ulang semua harga besar
--    dari harga kecil × rasio (keputusan: timpa semua).
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
  AND COALESCE(conversion_ratio, 0) > 0;

-- Produk tanpa satuan jual besar → pastikan harga besar kosong.
UPDATE produk
SET
  harga_jual_besar_satuan = NULL,
  harga_jual_besar_grosir = NULL,
  harga_jual_besar_promo  = NULL
WHERE jual_satuan IS NULL
  AND (harga_jual_besar_satuan IS NOT NULL
    OR harga_jual_besar_grosir IS NOT NULL
    OR harga_jual_besar_promo  IS NOT NULL);

-- ============================================================
-- 2) Trigger — jaga harga besar SELALU sinkron dengan
--    harga kecil × rasio di semua jalur tulis (form, import, RPC).
-- ============================================================
CREATE OR REPLACE FUNCTION sync_harga_jual_besar()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.jual_satuan IS NOT NULL AND COALESCE(NEW.conversion_ratio, 0) > 0 THEN
    NEW.harga_jual_besar_satuan := ROUND(NEW.harga_jual_satuan * NEW.conversion_ratio);
    NEW.harga_jual_besar_grosir := ROUND(NEW.harga_jual_grosir * NEW.conversion_ratio);
    NEW.harga_jual_besar_promo  := CASE
                                     WHEN NEW.harga_jual_promo IS NOT NULL
                                       THEN ROUND(NEW.harga_jual_promo * NEW.conversion_ratio)
                                     ELSE NULL
                                   END;
  ELSE
    NEW.harga_jual_besar_satuan := NULL;
    NEW.harga_jual_besar_grosir := NULL;
    NEW.harga_jual_besar_promo  := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_harga_jual_besar ON produk;
CREATE TRIGGER trg_sync_harga_jual_besar
BEFORE INSERT OR UPDATE OF harga_jual_satuan, harga_jual_grosir, harga_jual_promo,
                           conversion_ratio, jual_satuan
ON produk
FOR EACH ROW
EXECUTE FUNCTION sync_harga_jual_besar();
