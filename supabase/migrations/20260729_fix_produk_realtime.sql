-- Fix: 20260729_fix_produk_realtime.sql
-- Migration 20260708_add_produk_realtime.sql memiliki typo: "ADD TABLE publik"
-- (harusnya "produk"), sehingga publikasi realtime untuk tabel produk tidak aktif
-- dan hook useLowStockRealtime() tidak menerima event postgres_changes.

-- Hapus tabel "publik" dari publikasi jika ada
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'publik'
  ) THEN
    ALTER PUBLICATION supabase_realtime DROP TABLE publik;
  END IF;
END $$;

-- Tambahkan tabel produk yang benar ke publikasi realtime (jika belum ada)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'produk'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE produk;
  END IF;
END $$;
