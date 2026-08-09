-- 20260901_add_lokasi_area.sql
-- Tabel lokasi_area + FK di produk + RLS + index.

-- 1) Tabel lokasi_area
CREATE TABLE IF NOT EXISTS lokasi_area (
  id SERIAL PRIMARY KEY,
  nama VARCHAR NOT NULL UNIQUE
);

-- 2) Kolom FK di produk
ALTER TABLE produk ADD COLUMN IF NOT EXISTS id_lokasi_area INT REFERENCES lokasi_area(id);

-- 3) Index untuk performa filter
CREATE INDEX IF NOT EXISTS idx_produk_id_lokasi_area ON produk(id_lokasi_area);

-- 4) RLS — full access untuk authenticated users
ALTER TABLE lokasi_area ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated users can select lokasi_area"
  ON lokasi_area FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "authenticated users can insert lokasi_area"
  ON lokasi_area FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "authenticated users can update lokasi_area"
  ON lokasi_area FOR UPDATE
  USING (auth.role() = 'authenticated');

CREATE POLICY "authenticated users can delete lokasi_area"
  ON lokasi_area FOR DELETE
  USING (auth.role() = 'authenticated');
