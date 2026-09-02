CREATE OR REPLACE FUNCTION public.bulk_adjust_product_prices(
  p_id_merk integer,
  p_jenis_barang text DEFAULT 'ALL',
  p_direction text DEFAULT 'NAIK',
  p_percentage numeric DEFAULT 0,
  p_rounding numeric DEFAULT 500,
  p_update_retail boolean DEFAULT false,
  p_update_grosir boolean DEFAULT false,
  p_update_promo boolean DEFAULT false,
  p_update_big_retail boolean DEFAULT false,
  p_update_big_grosir boolean DEFAULT false,
  p_update_big_promo boolean DEFAULT false,
  p_apply boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text;
  v_username text;
  v_jenis text := upper(coalesce(p_jenis_barang, 'ALL'));
  v_direction text := upper(coalesce(p_direction, 'NAIK'));
  v_multiplier numeric;
  v_count integer := 0;
  v_sample jsonb := '[]'::jsonb;
  v_updated integer := 0;
BEGIN
  v_username := split_part(coalesce(auth.jwt() ->> 'email', ''), '@', 1);

  SELECT level INTO v_role
  FROM pengguna
  WHERE username = v_username
  LIMIT 1;

  IF v_role NOT IN ('OWNER', 'DEV') THEN
    RAISE EXCEPTION 'Hanya owner yang dapat mengubah harga massal';
  END IF;

  IF p_id_merk IS NULL OR p_id_merk <= 0 THEN
    RAISE EXCEPTION 'Merk wajib dipilih';
  END IF;

  IF v_jenis NOT IN ('ALL', 'MASTER', 'PAKET') THEN
    RAISE EXCEPTION 'Jenis barang tidak valid';
  END IF;

  IF v_direction NOT IN ('NAIK', 'TURUN') THEN
    RAISE EXCEPTION 'Arah perubahan harga tidak valid';
  END IF;

  IF p_percentage IS NULL OR p_percentage < 0 THEN
    RAISE EXCEPTION 'Persentase harus 0 atau lebih';
  END IF;

  IF p_rounding IS NULL OR p_rounding <= 0 THEN
    RAISE EXCEPTION 'Pembulatan harus lebih dari 0';
  END IF;

  IF NOT (
    p_update_retail OR p_update_grosir OR p_update_promo OR
    p_update_big_retail OR p_update_big_grosir OR p_update_big_promo
  ) THEN
    RAISE EXCEPTION 'Pilih minimal satu harga yang ingin diubah';
  END IF;

  v_multiplier := CASE
    WHEN v_direction = 'NAIK' THEN 1 + (p_percentage / 100)
    ELSE 1 - (p_percentage / 100)
  END;

  DROP TABLE IF EXISTS pg_temp.bulk_price_calc;

  CREATE TEMP TABLE bulk_price_calc ON COMMIT DROP AS
  SELECT
    p.id,
    p.nama_produk,
    p.sku,
    p.jual_satuan,
    p.harga_jual_satuan AS old_retail,
    p.harga_jual_grosir AS old_grosir,
    p.harga_jual_promo AS old_promo,
    p.harga_jual_besar_satuan AS old_big_retail,
    p.harga_jual_besar_grosir AS old_big_grosir,
    p.harga_jual_besar_promo AS old_big_promo,
    CASE
      WHEN p.harga_jual_satuan IS NULL THEN NULL
      WHEN p.harga_jual_satuan = 0 THEN 0
      ELSE ceil(greatest(p.harga_jual_satuan * v_multiplier, 0) / p_rounding) * p_rounding
    END AS new_retail,
    CASE
      WHEN p.harga_jual_grosir IS NULL THEN NULL
      WHEN p.harga_jual_grosir = 0 THEN 0
      ELSE ceil(greatest(p.harga_jual_grosir * v_multiplier, 0) / p_rounding) * p_rounding
    END AS new_grosir,
    CASE
      WHEN p.harga_jual_promo IS NULL THEN NULL
      WHEN p.harga_jual_promo = 0 THEN 0
      ELSE ceil(greatest(p.harga_jual_promo * v_multiplier, 0) / p_rounding) * p_rounding
    END AS new_promo,
    CASE
      WHEN p.harga_jual_besar_satuan IS NULL THEN NULL
      WHEN p.harga_jual_besar_satuan = 0 THEN 0
      ELSE ceil(greatest(p.harga_jual_besar_satuan * v_multiplier, 0) / p_rounding) * p_rounding
    END AS new_big_retail,
    CASE
      WHEN p.harga_jual_besar_grosir IS NULL THEN NULL
      WHEN p.harga_jual_besar_grosir = 0 THEN 0
      ELSE ceil(greatest(p.harga_jual_besar_grosir * v_multiplier, 0) / p_rounding) * p_rounding
    END AS new_big_grosir,
    CASE
      WHEN p.harga_jual_besar_promo IS NULL THEN NULL
      WHEN p.harga_jual_besar_promo = 0 THEN 0
      ELSE ceil(greatest(p.harga_jual_besar_promo * v_multiplier, 0) / p_rounding) * p_rounding
    END AS new_big_promo
  FROM produk p
  WHERE p.id_merk = p_id_merk
    AND (
      v_jenis = 'ALL'
      OR (v_jenis = 'MASTER' AND p.id_produk_master IS NULL)
      OR (v_jenis = 'PAKET' AND p.id_produk_master IS NOT NULL)
    );

  SELECT count(*) INTO v_count FROM bulk_price_calc;

  SELECT coalesce(jsonb_agg(item), '[]'::jsonb) INTO v_sample
  FROM (
    SELECT jsonb_build_object(
      'id', id,
      'nama_produk', nama_produk,
      'sku', sku,
      'old_retail', old_retail,
      'new_retail', CASE WHEN p_update_retail THEN new_retail ELSE old_retail END,
      'old_grosir', old_grosir,
      'new_grosir', CASE WHEN p_update_grosir THEN new_grosir ELSE old_grosir END,
      'old_promo', old_promo,
      'new_promo', CASE WHEN p_update_promo THEN new_promo ELSE old_promo END,
      'old_big_retail', old_big_retail,
      'new_big_retail', CASE WHEN p_update_big_retail THEN new_big_retail ELSE old_big_retail END,
      'old_big_grosir', old_big_grosir,
      'new_big_grosir', CASE WHEN p_update_big_grosir THEN new_big_grosir ELSE old_big_grosir END,
      'old_big_promo', old_big_promo,
      'new_big_promo', CASE WHEN p_update_big_promo THEN new_big_promo ELSE old_big_promo END
    ) AS item
    FROM bulk_price_calc
    ORDER BY nama_produk, id
    LIMIT 10
  ) s;

  IF p_apply THEN
    UPDATE produk p
    SET
      harga_jual_satuan = CASE WHEN p_update_retail THEN c.new_retail ELSE p.harga_jual_satuan END,
      harga_jual_grosir = CASE WHEN p_update_grosir THEN c.new_grosir ELSE p.harga_jual_grosir END,
      harga_jual_promo = CASE WHEN p_update_promo THEN c.new_promo ELSE p.harga_jual_promo END,
      harga_jual_besar_satuan = CASE
        WHEN p_update_big_retail THEN c.new_big_retail
        WHEN p.jual_satuan IS NOT NULL AND (p_update_retail OR p_update_grosir OR p_update_promo) THEN c.old_big_retail
        ELSE p.harga_jual_besar_satuan
      END,
      harga_jual_besar_grosir = CASE
        WHEN p_update_big_grosir THEN c.new_big_grosir
        WHEN p.jual_satuan IS NOT NULL AND (p_update_retail OR p_update_grosir OR p_update_promo) THEN c.old_big_grosir
        ELSE p.harga_jual_besar_grosir
      END,
      harga_jual_besar_promo = CASE
        WHEN p_update_big_promo THEN c.new_big_promo
        WHEN p.jual_satuan IS NOT NULL AND (p_update_retail OR p_update_grosir OR p_update_promo) THEN c.old_big_promo
        ELSE p.harga_jual_besar_promo
      END,
      harga_jual_besar_manual = CASE
        WHEN p.jual_satuan IS NOT NULL AND (
          p_update_big_retail OR p_update_big_grosir OR p_update_big_promo OR
          p_update_retail OR p_update_grosir OR p_update_promo
        ) THEN true
        ELSE p.harga_jual_besar_manual
      END,
      updated_at = now()
    FROM bulk_price_calc c
    WHERE p.id = c.id;

    GET DIAGNOSTICS v_updated = ROW_COUNT;
  END IF;

  RETURN jsonb_build_object(
    'affected_count', v_count,
    'updated_count', v_updated,
    'sample', v_sample
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.bulk_adjust_product_prices(
  integer, text, text, numeric, numeric, boolean, boolean, boolean, boolean, boolean, boolean, boolean
) TO authenticated;

NOTIFY pgrst, 'reload schema';
