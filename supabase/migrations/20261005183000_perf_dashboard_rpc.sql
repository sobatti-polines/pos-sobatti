-- ============================================================================
-- Migration: optimasi navigasi dashboard (index + 3 RPC agregasi)
-- Ditest di local Postgres (supabase/20261005_perf_dashboard_rpc.sql):
--   3 RPC OK via service_role maupun anon, total 23-47ms, paritas cocok.
-- Cara deploy ke produksi (Supabase Dashboard > SQL Editor, jam sepi):
--   paste seluruh isi file ini > Run. Idempotent, aman diulang.
-- Rollback: DROP FUNCTION + DROP INDEX di bawah (lihat catatan akhir).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Index komposit untuk filter dashboard yang paling sering dipakai.
-- Sebelumnya hanya ada index tunggal (status) + (tgl_transaksi) terpisah,
-- sehingga planner harus bitmap-and / sequential scan untuk
-- WHERE status='berhasil' AND tgl_transaksi BETWEEN ... (dipakai 4x per
-- buka dashboard di lib/dashboard.ts).
-- ----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_transaksi_keluar_status_tgl
  ON public.transaksi_keluar (status, tgl_transaksi DESC);

-- Filter low-stock / stock-in selalu WHERE hitung_stok = true.
-- Sebelumnya TIDAK ADA index di kolom ini, sehingga fetchAllRows
-- (lib/low-stock.ts, app/api/low-stock/route.ts) full scan 1000+ baris
-- per chunk ke Tokyo.
CREATE INDEX IF NOT EXISTS idx_produk_hitung_stok
  ON public.produk (hitung_stok)
  WHERE hitung_stok = true;

-- Lookup halaman barang masuk: hitung_stok + bukan paket + order nama.
-- Menutup filter di app/dashboard/inventory/stock-in/page.tsx.
CREATE INDEX IF NOT EXISTS idx_produk_stockin_lookup
  ON public.produk (hitung_stok, id_produk_master, nama_produk);

-- Statistik barang masuk diurutkan (tgl_masuk, id). Index tunggal
-- idx_bm_tgl sudah ada, tapi composite ini menghindari sort di DB
-- untuk buildStockInStats().
CREATE INDEX IF NOT EXISTS idx_barang_masuk_tgl_id
  ON public.barang_masuk (tgl_masuk, id);

-- ----------------------------------------------------------------------------
-- 2. RPC: get_dashboard_summary — 1 call ganti 6 query di lib/dashboard.ts
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_dashboard_summary(
  p_today date DEFAULT CURRENT_DATE,
  p_days integer DEFAULT 14,
  p_exclude_dev boolean DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_today_start timestamp := (p_today::timestamp);
  v_today_end timestamp := (p_today::timestamp + interval '1 day' - interval '1 second');
  v_yesterday date := (p_today - 1);
  v_yesterday_start timestamp := (v_yesterday::timestamp);
  v_yesterday_end timestamp := (v_yesterday::timestamp + interval '1 day' - interval '1 second');
  v_today_rev numeric := 0;
  v_yesterday_rev numeric := 0;
  v_today_orders integer := 0;
  v_spark jsonb := '[]'::jsonb;
  v_recent_tx jsonb := '[]'::jsonb;
  v_activity jsonb := '[]'::jsonb;
BEGIN
  SELECT COALESCE(SUM(total), 0) INTO v_today_rev
  FROM public.transaksi_keluar
  WHERE status = 'berhasil'
    AND tgl_transaksi >= v_today_start
    AND tgl_transaksi <= v_today_end;

  SELECT COALESCE(SUM(total), 0) INTO v_yesterday_rev
  FROM public.transaksi_keluar
  WHERE status = 'berhasil'
    AND tgl_transaksi >= v_yesterday_start
    AND tgl_transaksi <= v_yesterday_end;

  SELECT COUNT(*) INTO v_today_orders
  FROM public.transaksi_keluar
  WHERE status = 'berhasil'
    AND tgl_transaksi >= v_today_start
    AND tgl_transaksi <= v_today_end;

  SELECT COALESCE(jsonb_agg(day_total ORDER BY day), '[]'::jsonb) INTO v_spark
  FROM (
    SELECT d.day::date AS day, COALESCE(SUM(t.total), 0) AS day_total
    FROM generate_series(
      (p_today - (p_days - 1))::timestamp,
      p_today::timestamp,
      interval '1 day'
    ) AS d(day)
    LEFT JOIN public.transaksi_keluar t
      ON t.status = 'berhasil'
     AND t.tgl_transaksi >= d.day
     AND t.tgl_transaksi < (d.day + interval '1 day')
    GROUP BY d.day
  ) s;

  SELECT COALESCE(jsonb_agg(row_to_json(r) ORDER BY r.tgl_transaksi DESC), '[]'::jsonb)
    INTO v_recent_tx
  FROM (
    SELECT
      t.no_transaksi,
      t.tgl_transaksi,
      t.total,
      t.bayar,
      pl.nama_pelanggan AS customer_name,
      COALESCE(dt.item_count, 0) AS item_count
    FROM public.transaksi_keluar t
    LEFT JOIN public.pelanggan pl ON pl.id = t.id_pelanggan
    LEFT JOIN (
      SELECT id_transaksi, SUM(qty) AS item_count
      FROM public.detail_transaksi_keluar
      GROUP BY id_transaksi
    ) dt ON dt.id_transaksi = t.id
    WHERE t.status = 'berhasil'
    ORDER BY t.tgl_transaksi DESC
    LIMIT 5
  ) r;

  SELECT COALESCE(jsonb_agg(row_to_json(a) ORDER BY a.created_at DESC), '[]'::jsonb)
    INTO v_activity
  FROM (
    SELECT
      l.id::text AS id,
      l.aksi,
      l.entitas,
      l.deskripsi,
      l.created_at,
      pg.nama AS pengguna_nama,
      pg.username AS pengguna_username
    FROM public.log_aktivitas l
    JOIN public.pengguna pg ON pg.id = l.id_pengguna
    WHERE (NOT p_exclude_dev OR pg.level <> 'DEV')
    ORDER BY l.created_at DESC
    LIMIT 10
  ) a;

  RETURN jsonb_build_object(
    'today_revenue', v_today_rev,
    'yesterday_revenue', v_yesterday_rev,
    'today_orders', v_today_orders,
    'sparkline', v_spark,
    'recent_transactions', v_recent_tx,
    'recent_activity', v_activity
  );
END;
$$;

-- ----------------------------------------------------------------------------
-- 3. RPC: get_low_stock_preview — ganti fetchAllRows semua produk.
-- Ambang mengikuti code: display 0 = Habis (bukan menipis), gudang 0 = menipis.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_low_stock_preview(
  p_limit integer DEFAULT 50
)
RETURNS TABLE (
  id integer,
  nama_produk character varying,
  stok numeric,
  stok_gudang numeric,
  stok_minimum integer,
  stok_minimum_gudang numeric,
  display_low boolean,
  gudang_low boolean,
  satuan_nama character varying
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.id,
    p.nama_produk,
    COALESCE(p.stok, 0) AS stok,
    COALESCE(p.stok_gudang, 0) AS stok_gudang,
    p.stok_minimum,
    p.stok_minimum_gudang,
    (p.stok > 0 AND p.stok_minimum IS NOT NULL AND p.stok <= p.stok_minimum) AS display_low,
    (p.stok_minimum_gudang IS NOT NULL AND COALESCE(p.stok_gudang, 0) <= p.stok_minimum_gudang) AS gudang_low,
    s.nama AS satuan_nama
  FROM public.produk p
  LEFT JOIN public.satuan s ON s.id = p.id_satuan
  WHERE p.hitung_stok = true
    AND (
      (p.stok > 0 AND p.stok_minimum IS NOT NULL AND p.stok <= p.stok_minimum)
      OR (p.stok_minimum_gudang IS NOT NULL AND COALESCE(p.stok_gudang, 0) <= p.stok_minimum_gudang)
    )
  ORDER BY LEAST(
    CASE WHEN (p.stok > 0 AND p.stok_minimum IS NOT NULL AND p.stok <= p.stok_minimum)
      THEN COALESCE(p.stok, 999999999) ELSE 999999999 END,
    CASE WHEN (p.stok_minimum_gudang IS NOT NULL AND COALESCE(p.stok_gudang, 0) <= p.stok_minimum_gudang)
      THEN COALESCE(p.stok_gudang, 999999999) ELSE 999999999 END
  ) ASC
  LIMIT GREATEST(p_limit, 1);
$$;

-- ----------------------------------------------------------------------------
-- 4. RPC: get_stockin_stats — ganti fetchAllRows(barang_masuk) full scan di
-- buildStockInStats() (app/dashboard/inventory/stock-in/page.tsx).
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_stockin_stats()
RETURNS TABLE (
  id_produk integer,
  cnt bigint,
  last_date date
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id_produk, COUNT(*) AS cnt, MAX(tgl_masuk) AS last_date
  FROM public.barang_masuk
  WHERE id_produk IS NOT NULL
  GROUP BY id_produk;
$$;

-- RPC boleh dipanggil role anon/authenticated (dipakai server via anon key).
-- Service role tidak perlu grant eksplisit. JANGAN expose SERVICE_ROLE ke client.
GRANT EXECUTE ON FUNCTION public.get_dashboard_summary(date, integer, boolean) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_low_stock_preview(integer) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_stockin_stats() TO anon, authenticated;

-- ----------------------------------------------------------------------------
-- Verifikasi setelah Run (paste terpisah di SQL Editor):
--   SELECT get_dashboard_summary(CURRENT_DATE, 14, true);
--   SELECT * FROM get_low_stock_preview(5);
--   SELECT * FROM get_stockin_stats() LIMIT 5;
--
-- Rollback bila diperlukan:
--   DROP FUNCTION IF EXISTS public.get_dashboard_summary(date, integer, boolean);
--   DROP FUNCTION IF EXISTS public.get_low_stock_preview(integer);
--   DROP FUNCTION IF EXISTS public.get_stockin_stats();
--   DROP INDEX IF EXISTS public.idx_transaksi_keluar_status_tgl;
--   DROP INDEX IF EXISTS public.idx_produk_hitung_stok;
--   DROP INDEX IF EXISTS public.idx_produk_stockin_lookup;
--   DROP INDEX IF EXISTS public.idx_barang_masuk_tgl_id;
-- Catatan: code Next.js otomatis fallback ke query lama bila RPC tidak ada,
-- sehingga rollback DB tidak merusak aplikasi.
-- ----------------------------------------------------------------------------
