-- Histori perubahan harga master produk untuk laporan pergerakan harga.
-- Harga promo event dan harga custom POS tidak dicatat di sini; keduanya tetap
-- terlihat dari snapshot detail_transaksi_keluar pada laporan.

CREATE TABLE IF NOT EXISTS public.riwayat_harga_produk (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  id_produk integer NOT NULL REFERENCES public.produk(id) ON DELETE CASCADE,
  effective_from timestamptz NOT NULL DEFAULT now(),
  source text NOT NULL DEFAULT 'trigger'
    CHECK (source IN ('trigger', 'backfill_log', 'initial')),
  id_pengguna integer REFERENCES public.pengguna(id),
  harga_jual_satuan numeric(15,2) NOT NULL DEFAULT 0,
  harga_jual_grosir numeric(15,2),
  harga_jual_promo numeric(15,2),
  jual_satuan text,
  conversion_ratio numeric NOT NULL DEFAULT 1,
  harga_jual_besar_satuan numeric(15,2),
  harga_jual_besar_grosir numeric(15,2),
  harga_jual_besar_promo numeric(15,2),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_riwayat_harga_produk_produk_tanggal
  ON public.riwayat_harga_produk(id_produk, effective_from DESC);

ALTER TABLE public.riwayat_harga_produk ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "riwayat_harga_produk_select_authenticated" ON public.riwayat_harga_produk;
CREATE POLICY "riwayat_harga_produk_select_authenticated"
  ON public.riwayat_harga_produk
  FOR SELECT
  TO authenticated
  USING (true);

GRANT SELECT ON public.riwayat_harga_produk TO authenticated;
GRANT ALL ON public.riwayat_harga_produk TO service_role;

CREATE OR REPLACE FUNCTION public.snapshot_harga_produk(
  p_produk public.produk,
  p_source text DEFAULT 'trigger',
  p_effective_from timestamptz DEFAULT now()
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ratio numeric := COALESCE(NULLIF(p_produk.conversion_ratio, 0), 1);
BEGIN
  INSERT INTO public.riwayat_harga_produk (
    id_produk,
    effective_from,
    source,
    harga_jual_satuan,
    harga_jual_grosir,
    harga_jual_promo,
    jual_satuan,
    conversion_ratio,
    harga_jual_besar_satuan,
    harga_jual_besar_grosir,
    harga_jual_besar_promo
  )
  VALUES (
    p_produk.id,
    COALESCE(p_effective_from, now()),
    COALESCE(p_source, 'trigger'),
    COALESCE(p_produk.harga_jual_satuan, 0),
    p_produk.harga_jual_grosir,
    p_produk.harga_jual_promo,
    p_produk.jual_satuan,
    v_ratio,
    CASE
      WHEN p_produk.jual_satuan IS NOT NULL
        THEN round(COALESCE(p_produk.harga_jual_satuan, 0) * v_ratio)
      ELSE NULL
    END,
    CASE
      WHEN p_produk.jual_satuan IS NOT NULL
        THEN round(COALESCE(p_produk.harga_jual_grosir, 0) * v_ratio)
      ELSE NULL
    END,
    CASE
      WHEN p_produk.jual_satuan IS NOT NULL AND p_produk.harga_jual_promo IS NOT NULL
        THEN round(p_produk.harga_jual_promo * v_ratio)
      ELSE NULL
    END
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
    OLD.conversion_ratio IS DISTINCT FROM NEW.conversion_ratio
  ) THEN
    PERFORM public.snapshot_harga_produk(NEW, 'trigger', now());
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_snapshot_harga_produk ON public.produk;
CREATE TRIGGER trg_snapshot_harga_produk
AFTER INSERT OR UPDATE ON public.produk
FOR EACH ROW
EXECUTE FUNCTION public.trg_snapshot_harga_produk();

-- Backfill awal dari data produk saat ini.
INSERT INTO public.riwayat_harga_produk (
  id_produk,
  effective_from,
  source,
  harga_jual_satuan,
  harga_jual_grosir,
  harga_jual_promo,
  jual_satuan,
  conversion_ratio,
  harga_jual_besar_satuan,
  harga_jual_besar_grosir,
  harga_jual_besar_promo
)
SELECT
  p.id,
  COALESCE(p.created_at, now())::timestamptz,
  'initial',
  COALESCE(p.harga_jual_satuan, 0),
  p.harga_jual_grosir,
  p.harga_jual_promo,
  p.jual_satuan,
  COALESCE(NULLIF(p.conversion_ratio, 0), 1),
  CASE
    WHEN p.jual_satuan IS NOT NULL
      THEN round(COALESCE(p.harga_jual_satuan, 0) * COALESCE(NULLIF(p.conversion_ratio, 0), 1))
    ELSE NULL
  END,
  CASE
    WHEN p.jual_satuan IS NOT NULL
      THEN round(COALESCE(p.harga_jual_grosir, 0) * COALESCE(NULLIF(p.conversion_ratio, 0), 1))
    ELSE NULL
  END,
  CASE
    WHEN p.jual_satuan IS NOT NULL AND p.harga_jual_promo IS NOT NULL
      THEN round(p.harga_jual_promo * COALESCE(NULLIF(p.conversion_ratio, 0), 1))
    ELSE NULL
  END
FROM public.produk p
WHERE NOT EXISTS (
  SELECT 1
  FROM public.riwayat_harga_produk rhp
  WHERE rhp.id_produk = p.id
);

-- Backfill dari log aktivitas lama jika log menyimpan perubahan harga produk.
WITH price_logs AS (
  SELECT
    la.id,
    la.id_entitas AS id_produk,
    la.created_at,
    la.data_lama,
    la.data_baru
  FROM public.log_aktivitas la
  WHERE la.entitas = 'produk'
    AND la.aksi = 'UPDATE'
    AND la.id_entitas IS NOT NULL
    AND (
      COALESCE(la.data_lama->>'harga_jual_satuan', '') IS DISTINCT FROM COALESCE(la.data_baru->>'harga_jual_satuan', '') OR
      COALESCE(la.data_lama->>'harga_jual_grosir', '') IS DISTINCT FROM COALESCE(la.data_baru->>'harga_jual_grosir', '') OR
      COALESCE(la.data_lama->>'harga_jual_promo', '') IS DISTINCT FROM COALESCE(la.data_baru->>'harga_jual_promo', '') OR
      COALESCE(la.data_lama->>'jual_satuan', '') IS DISTINCT FROM COALESCE(la.data_baru->>'jual_satuan', '') OR
      COALESCE(la.data_lama->>'conversion_ratio', '') IS DISTINCT FROM COALESCE(la.data_baru->>'conversion_ratio', '')
    )
),
first_logs AS (
  SELECT DISTINCT ON (id_produk)
    id_produk,
    created_at,
    data_lama
  FROM price_logs
  ORDER BY id_produk, created_at ASC
),
initial_from_log AS (
  SELECT
    p.id AS id_produk,
    COALESCE(p.created_at, fl.created_at, now())::timestamptz AS effective_from,
    'backfill_log'::text AS source,
    COALESCE(NULLIF(fl.data_lama->>'harga_jual_satuan', '')::numeric, p.harga_jual_satuan, 0) AS harga_jual_satuan,
    COALESCE(NULLIF(fl.data_lama->>'harga_jual_grosir', '')::numeric, p.harga_jual_grosir) AS harga_jual_grosir,
    COALESCE(NULLIF(fl.data_lama->>'harga_jual_promo', '')::numeric, p.harga_jual_promo) AS harga_jual_promo,
    COALESCE(NULLIF(fl.data_lama->>'jual_satuan', ''), p.jual_satuan) AS jual_satuan,
    COALESCE(NULLIF(fl.data_lama->>'conversion_ratio', '')::numeric, NULLIF(p.conversion_ratio, 0), 1) AS conversion_ratio
  FROM first_logs fl
  JOIN public.produk p ON p.id = fl.id_produk
),
changes_from_log AS (
  SELECT
    p.id AS id_produk,
    pl.created_at::timestamptz AS effective_from,
    'backfill_log'::text AS source,
    COALESCE(NULLIF(pl.data_baru->>'harga_jual_satuan', '')::numeric, p.harga_jual_satuan, 0) AS harga_jual_satuan,
    COALESCE(NULLIF(pl.data_baru->>'harga_jual_grosir', '')::numeric, p.harga_jual_grosir) AS harga_jual_grosir,
    COALESCE(NULLIF(pl.data_baru->>'harga_jual_promo', '')::numeric, p.harga_jual_promo) AS harga_jual_promo,
    COALESCE(NULLIF(pl.data_baru->>'jual_satuan', ''), p.jual_satuan) AS jual_satuan,
    COALESCE(NULLIF(pl.data_baru->>'conversion_ratio', '')::numeric, NULLIF(p.conversion_ratio, 0), 1) AS conversion_ratio
  FROM price_logs pl
  JOIN public.produk p ON p.id = pl.id_produk
),
log_snapshots AS (
  SELECT * FROM initial_from_log
  UNION ALL
  SELECT * FROM changes_from_log
)
INSERT INTO public.riwayat_harga_produk (
  id_produk,
  effective_from,
  source,
  harga_jual_satuan,
  harga_jual_grosir,
  harga_jual_promo,
  jual_satuan,
  conversion_ratio,
  harga_jual_besar_satuan,
  harga_jual_besar_grosir,
  harga_jual_besar_promo
)
SELECT
  ls.id_produk,
  ls.effective_from,
  ls.source,
  ls.harga_jual_satuan,
  ls.harga_jual_grosir,
  ls.harga_jual_promo,
  ls.jual_satuan,
  ls.conversion_ratio,
  CASE WHEN ls.jual_satuan IS NOT NULL THEN round(ls.harga_jual_satuan * ls.conversion_ratio) ELSE NULL END,
  CASE WHEN ls.jual_satuan IS NOT NULL THEN round(COALESCE(ls.harga_jual_grosir, 0) * ls.conversion_ratio) ELSE NULL END,
  CASE WHEN ls.jual_satuan IS NOT NULL AND ls.harga_jual_promo IS NOT NULL THEN round(ls.harga_jual_promo * ls.conversion_ratio) ELSE NULL END
FROM log_snapshots ls;

-- Snapshot kondisi terkini sebagai penutup histori. Laporan akan menggabungkan
-- snapshot berurutan yang identik agar update non-harga tidak tampak sebagai perubahan.
INSERT INTO public.riwayat_harga_produk (
  id_produk,
  effective_from,
  source,
  harga_jual_satuan,
  harga_jual_grosir,
  harga_jual_promo,
  jual_satuan,
  conversion_ratio,
  harga_jual_besar_satuan,
  harga_jual_besar_grosir,
  harga_jual_besar_promo
)
SELECT
  p.id,
  COALESCE(p.updated_at, p.created_at, now())::timestamptz,
  'initial',
  COALESCE(p.harga_jual_satuan, 0),
  p.harga_jual_grosir,
  p.harga_jual_promo,
  p.jual_satuan,
  COALESCE(NULLIF(p.conversion_ratio, 0), 1),
  CASE
    WHEN p.jual_satuan IS NOT NULL
      THEN round(COALESCE(p.harga_jual_satuan, 0) * COALESCE(NULLIF(p.conversion_ratio, 0), 1))
    ELSE NULL
  END,
  CASE
    WHEN p.jual_satuan IS NOT NULL
      THEN round(COALESCE(p.harga_jual_grosir, 0) * COALESCE(NULLIF(p.conversion_ratio, 0), 1))
    ELSE NULL
  END,
  CASE
    WHEN p.jual_satuan IS NOT NULL AND p.harga_jual_promo IS NOT NULL
      THEN round(p.harga_jual_promo * COALESCE(NULLIF(p.conversion_ratio, 0), 1))
    ELSE NULL
  END
FROM public.produk p;

