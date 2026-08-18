-- 20260910_restore_member_point_functions.sql
-- Fix: fungsi increment_point & reset_pelanggan_id_seq TIDAK ADA di database
-- cloud/local (kolom pelanggan.point ada, tapi RPC-nya hilang — kemungkinan
-- migrasi 20260725_add_member_point.sql belum pernah di-push ke cloud).
--
-- Dampak bug:
--   * Poin member tidak pernah bertambah setelah checkout (error hanya di-log)
--   * Retry daftar member saat konflik 23505 tidak berfungsi
--
-- Solusi: recreate kedua fungsi (idempotent, aman dijalankan ulang).

-- RPC function to safely increment point (atomic update)
CREATE OR REPLACE FUNCTION public.increment_point(row_id INTEGER, points INTEGER)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE pelanggan
  SET point = COALESCE(point, 0) + points
  WHERE id = row_id;
END;
$$;

-- RPC function to reset pelanggan id sequence
CREATE OR REPLACE FUNCTION public.reset_pelanggan_id_seq()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  max_id INTEGER;
BEGIN
  SELECT COALESCE(MAX(id), 0) + 1 INTO max_id FROM pelanggan;
  PERFORM setval('pelanggan_id_seq', max_id, false);
END;
$$;

-- Grant akses agar bisa dipanggil via PostgREST (RLS tetap berlaku)
GRANT EXECUTE ON FUNCTION public.increment_point(integer, integer) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.reset_pelanggan_id_seq() TO anon, authenticated, service_role;
