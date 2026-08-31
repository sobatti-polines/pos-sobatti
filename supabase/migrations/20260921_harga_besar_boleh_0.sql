-- Migration: Harga satuan besar BOLEH 0 atau kosong
-- Sebelumnya trigger menolak harga besar <= 0 saat mode manual.
-- Sekarang harga besar bersifat opsional — boleh 0 atau kosong.

CREATE OR REPLACE FUNCTION public.sync_harga_jual_besar()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.jual_satuan IS NULL THEN
    NEW.harga_jual_besar_manual := false;
    NEW.harga_jual_besar_satuan := NULL;
    NEW.harga_jual_besar_grosir := NULL;
    NEW.harga_jual_besar_promo := NULL;
  ELSIF COALESCE(NEW.conversion_ratio, 0) <= 0 THEN
    RAISE EXCEPTION 'Rasio satuan besar harus lebih dari 0';
  ELSIF COALESCE(NEW.harga_jual_besar_manual, false) THEN
    -- Mode manual: harga besar opsional, boleh 0 atau kosong
    -- Tidak ada validasi harga > 0
    IF NEW.harga_jual_promo IS NULL THEN
      NEW.harga_jual_besar_promo := NULL;
    END IF;
  ELSE
    -- Mode otomatis: harga besar = harga kecil × conversion_ratio
    NEW.harga_jual_besar_satuan := ROUND(NEW.harga_jual_satuan * NEW.conversion_ratio);
    NEW.harga_jual_besar_grosir := ROUND(NEW.harga_jual_grosir * NEW.conversion_ratio);
    NEW.harga_jual_besar_promo := CASE
      WHEN NEW.harga_jual_promo IS NOT NULL
        THEN ROUND(NEW.harga_jual_promo * NEW.conversion_ratio)
      ELSE NULL
    END;
  END IF;
  RETURN NEW;
END;
$$;
