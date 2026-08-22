-- Migration: Menambahkan kolom status pada transaksi_keluar untuk Soft Delete

ALTER TABLE transaksi_keluar 
ADD COLUMN IF NOT EXISTS status VARCHAR DEFAULT 'berhasil';

CREATE INDEX IF NOT EXISTS idx_transaksi_keluar_status ON transaksi_keluar(status);
