-- Migration: Add poin_min_pembelian to pengaturan
-- Description: Menambahkan konfigurasi minimal pembelian untuk mendapatkan 1 poin member
-- Default: 100000 (Rp 100.000)

ALTER TABLE pengaturan
ADD COLUMN poin_min_pembelian NUMERIC NOT NULL DEFAULT 100000;
