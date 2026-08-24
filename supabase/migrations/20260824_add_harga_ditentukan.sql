-- 20260824_add_harga_ditentukan.sql
-- Menambah kolom harga_ditentukan ke tabel barang_masuk
-- Digunakan untuk menandai apakah harga beli sudah ditentukan oleh owner

ALTER TABLE barang_masuk 
ADD COLUMN IF NOT EXISTS harga_ditentukan BOOLEAN DEFAULT FALSE;

-- Update data existing: jika total_cost > 0, tandai sebagai sudah ditentukan
UPDATE barang_masuk 
SET harga_ditentukan = TRUE 
WHERE total_cost > 0 AND status = 'AKTIF';

-- Index untuk query cepat
CREATE INDEX IF NOT EXISTS idx_barang_masuk_harga_ditentukan 
ON barang_masuk(harga_ditentukan) 
WHERE status = 'AKTIF';
