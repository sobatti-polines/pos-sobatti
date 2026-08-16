-- Migration: 20260816_metode_bayar_bank_dinamis.sql
-- Tipe pembayaran dinamis: Tunai, QRIS, Bank 1, Bank 2 (sesuai pengaturan toko)
-- menggantikan trio statis 'Tunai'/'Transfer'/'QRIS'.

-- 1. Hapus CHECK constraint pada pengeluaran.metode_bayar agar nilai metode
--    pembayaran bisa dinamis (nama bank dari tabel pengaturan).
ALTER TABLE pengeluaran DROP CONSTRAINT IF EXISTS pengeluaran_metode_bayar_check;

-- 2. Pastikan metode bayar dasar (Tunai & QRIS) selalu ada di tabel metode_bayar.
INSERT INTO metode_bayar (nama) VALUES ('Tunai'), ('QRIS')
ON CONFLICT (nama) DO NOTHING;

-- 3. Backfill metode bayar bank dari pengaturan toko (bank1_nama & bank2_nama).
--    Sinkronisasi selanjutnya dilakukan otomatis saat pengaturan toko disimpan.
INSERT INTO metode_bayar (nama)
SELECT DISTINCT b.nama
FROM (
  SELECT NULLIF(bank1_nama, '') AS nama FROM pengaturan WHERE id = 1
  UNION
  SELECT NULLIF(bank2_nama, '') FROM pengaturan WHERE id = 1
) b
WHERE b.nama IS NOT NULL
ON CONFLICT (nama) DO NOTHING;
