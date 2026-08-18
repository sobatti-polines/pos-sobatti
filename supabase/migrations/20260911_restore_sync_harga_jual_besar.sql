-- 20260911_restore_sync_harga_jual_besar.sql
-- Fix: fungsi sync_harga_jual_besar() + trigger trg_sync_harga_jual_besar
-- TIDAK ADA di database cloud/local (migrasi 20260816_harga_jual_besar_otomatis.sql
-- tidak pernah dijalankan di cloud — pola sama dengan increment_point).
--
-- Dampak bug:
--   * Harga jual satuan besar TIDAK otomatis tersinkron = harga kecil × conversion_ratio
--     saat produk diubah via form/import/RPC di cloud
--   * Data lama yang backfill-nya tidak pernah jalan → harga besar bisa 0/NULL/stale
--
-- Solusi: recreate fungsi + trigger (idempotent, aman dijalankan ulang).

-- 1) Fungsi trigger: jaga harga besar SELALU sinkron dengan harga kecil × rasio
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

-- 2) Trigger
DROP TRIGGER IF EXISTS trg_sync_harga_jual_besar ON produk;
CREATE TRIGGER trg_sync_harga_jual_besar
BEFORE INSERT OR UPDATE OF harga_jual_satuan, harga_jual_grosir, harga_jual_promo,
                           conversion_ratio, jual_satuan
ON produk
FOR EACH ROW
EXECUTE FUNCTION sync_harga_jual_besar();

-- 3) Backfill data lama — hitung ulang semua harga besar dari harga kecil × rasio
--    (keputusan sama dengan migrasi asli 20260816: timpa semua).
UPDATE produk
SET
  harga_jual_besar_satuan = ROUND(COALESCE(harga_jual_satuan, 0) * COALESCE(conversion_ratio, 0)),
  harga_jual_besar_grosir = ROUND(COALESCE(harga_jual_grosir, 0) * COALESCE(conversion_ratio, 0)),
  harga_jual_besar_promo  = CASE
                              WHEN harga_jual_promo IS NOT NULL
                                THEN ROUND(harga_jual_promo * COALESCE(conversion_ratio, 0))
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
