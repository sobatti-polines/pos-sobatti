ALTER TABLE public.produk
ADD COLUMN IF NOT EXISTS harga_jual_besar_manual boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.produk.harga_jual_besar_manual
IS 'false = harga kecil x rasio; true = gunakan harga_jual_besar_* manual';

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
    IF COALESCE(NEW.harga_jual_besar_satuan, 0) <= 0 THEN
      RAISE EXCEPTION 'Harga Retail satuan besar harus lebih dari 0';
    END IF;
    IF COALESCE(NEW.harga_jual_besar_grosir, 0) <= 0 THEN
      RAISE EXCEPTION 'Harga Grosir satuan besar harus lebih dari 0';
    END IF;
    IF NEW.harga_jual_promo IS NULL THEN
      NEW.harga_jual_besar_promo := NULL;
    ELSIF COALESCE(NEW.harga_jual_besar_promo, 0) <= 0 THEN
      RAISE EXCEPTION 'Harga Promo satuan besar harus lebih dari 0';
    END IF;
  ELSE
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

DROP TRIGGER IF EXISTS trg_sync_harga_jual_besar ON public.produk;
CREATE TRIGGER trg_sync_harga_jual_besar
BEFORE INSERT OR UPDATE OF harga_jual_satuan, harga_jual_grosir, harga_jual_promo,
  conversion_ratio, jual_satuan, harga_jual_besar_manual,
  harga_jual_besar_satuan, harga_jual_besar_grosir, harga_jual_besar_promo
ON public.produk
FOR EACH ROW
EXECUTE FUNCTION public.sync_harga_jual_besar();

-- Semua data lama yang valid berasal dari mode otomatis. Baris legacy dengan
-- rasio <= 0 dibiarkan agar tidak menebak rasio bisnis; form akan meminta koreksi.
UPDATE public.produk
SET harga_jual_besar_manual = false
WHERE jual_satuan IS NULL OR COALESCE(conversion_ratio, 0) > 0;

-- Snapshot laporan harus menyimpan harga besar aktual, termasuk harga manual.
CREATE OR REPLACE FUNCTION public.snapshot_harga_produk(
  p_produk public.produk,
  p_source text DEFAULT 'trigger',
  p_effective_from timestamptz DEFAULT now()
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.riwayat_harga_produk (
    id_produk, effective_from, source,
    harga_jual_satuan, harga_jual_grosir, harga_jual_promo,
    jual_satuan, conversion_ratio,
    harga_jual_besar_satuan, harga_jual_besar_grosir, harga_jual_besar_promo
  ) VALUES (
    p_produk.id,
    COALESCE(p_effective_from, now()),
    COALESCE(p_source, 'trigger'),
    COALESCE(p_produk.harga_jual_satuan, 0),
    p_produk.harga_jual_grosir,
    p_produk.harga_jual_promo,
    p_produk.jual_satuan,
    COALESCE(NULLIF(p_produk.conversion_ratio, 0), 1),
    p_produk.harga_jual_besar_satuan,
    p_produk.harga_jual_besar_grosir,
    p_produk.harga_jual_besar_promo
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_snapshot_harga_produk()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.snapshot_harga_produk(NEW, 'initial', COALESCE(NEW.created_at, now())::timestamptz);
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND (
    OLD.harga_jual_satuan IS DISTINCT FROM NEW.harga_jual_satuan OR
    OLD.harga_jual_grosir IS DISTINCT FROM NEW.harga_jual_grosir OR
    OLD.harga_jual_promo IS DISTINCT FROM NEW.harga_jual_promo OR
    OLD.jual_satuan IS DISTINCT FROM NEW.jual_satuan OR
    OLD.conversion_ratio IS DISTINCT FROM NEW.conversion_ratio OR
    OLD.harga_jual_besar_manual IS DISTINCT FROM NEW.harga_jual_besar_manual OR
    OLD.harga_jual_besar_satuan IS DISTINCT FROM NEW.harga_jual_besar_satuan OR
    OLD.harga_jual_besar_grosir IS DISTINCT FROM NEW.harga_jual_besar_grosir OR
    OLD.harga_jual_besar_promo IS DISTINCT FROM NEW.harga_jual_besar_promo
  ) THEN
    PERFORM public.snapshot_harga_produk(NEW, 'trigger', now());
  END IF;

  RETURN NEW;
END;
$$;
