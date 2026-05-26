-- Cleanup orphan transactions (no details)
DELETE FROM transaksi_keluar WHERE id NOT IN (SELECT DISTINCT id_transaksi FROM detail_transaksi_keluar);

-- Reset sequence for clean inserts
ALTER SEQUENCE transaksi_keluar_id_seq RESTART WITH 1;

-- Add missing satuan (building material units)
INSERT INTO satuan (nama) VALUES
  ('Sak'),     -- 6
  ('Batang'),  -- 7
  ('Lembar'),  -- 8
  ('Meter'),   -- 9
  ('Dus'),     -- 10
  ('Buah'),    -- 11
  ('Kaleng'),  -- 12
  ('Rol'),     -- 13
  ('Kotak'),   -- 14
  ('Set')      -- 15
ON CONFLICT (nama) DO NOTHING;

-- Add missing payment methods (if not existing, get current IDs)
INSERT INTO metode_bayar (nama) VALUES ('Transfer') ON CONFLICT (nama) DO NOTHING;
INSERT INTO metode_bayar (nama) VALUES ('Debit') ON CONFLICT (nama) DO NOTHING;

-- Update store settings
UPDATE pengaturan SET
  nama_toko = 'Toko Bangunan Sobat',
  alamat = 'Jl. Raya Pasar No 123, Jakarta',
  telepon = '021-12345678',
  email = 'toko@sobats.com',
  nama_kasir_aktif = 'Kasir',
  footer_struk_1 = 'Terima kasih telah berbelanja',
  footer_struk_2 = 'Barang yang sudah dibeli tidak dapat dikembalikan',
  footer_struk_3 = 'Layanan konsumen: 0812-3456-7890',
  footer_invoice_1 = 'Pembayaran via transfer ke BCA 1234567890 a.n. Toko Sobat',
  footer_invoice_2 = 'Pembayaran via QRIS tersedia',
  footer_invoice_3 = 'Terima kasih atas kepercayaan Anda'
WHERE id = 1;
