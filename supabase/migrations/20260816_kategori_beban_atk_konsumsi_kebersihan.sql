-- Migration: 20260816_kategori_beban_atk_konsumsi_kebersihan.sql
-- Ubah kategori beban pengeluaran menjadi hanya: ATK, Konsumsi, Kebersihan

-- 1. Tambahkan 3 kategori baru (aman jika sudah ada)
INSERT INTO kategori_beban (nama, kelompok) VALUES
  ('ATK', 'ATK'),
  ('Konsumsi', 'Konsumsi'),
  ('Kebersihan', 'Kebersihan')
ON CONFLICT (nama) DO NOTHING;

-- 2. Hapus kategori lama (Gaji, Sewa, Listrik & Air, Transport, Lain-lain)
--    HANYA jika belum dipakai oleh data pengeluaran (hindari error FK).
DELETE FROM kategori_beban
WHERE nama IN ('Gaji', 'Sewa', 'Listrik & Air', 'Transport', 'Lain-lain')
  AND NOT EXISTS (
    SELECT 1 FROM pengeluaran p WHERE p.id_kategori_beban = kategori_beban.id
  );
