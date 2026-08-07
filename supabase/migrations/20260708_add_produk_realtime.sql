-- Fix: tabel yang benar untuk realtime adalah "produk" (sebelumnya typo "publik")
-- Migration asli sudah terlanjur di-apply ke database, jadi file ini diperbaiki
-- dan migrasi korektif dibuat terpisah (20260729_fix_produk_realtime.sql).
ALTER PUBLICATION supabase_realtime ADD TABLE produk;
