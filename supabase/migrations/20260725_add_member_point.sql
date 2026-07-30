-- Migration: Add member point column to pelanggan
-- Description: Menambahkan kolom point untuk sistem member poin pelanggan
-- 1 poin per Rp 100.000 total transaksi

ALTER TABLE pelanggan
ADD COLUMN point INTEGER NOT NULL DEFAULT 0;

-- Update existing customers to have 0 point explicitly
UPDATE pelanggan SET point = 0 WHERE point IS NULL;

-- RPC function to safely increment point (atomic update)
CREATE OR REPLACE FUNCTION increment_point(row_id INTEGER, points INTEGER)
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
CREATE OR REPLACE FUNCTION reset_pelanggan_id_seq()
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
