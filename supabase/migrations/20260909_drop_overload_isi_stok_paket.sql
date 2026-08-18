-- 20260909_drop_overload_isi_stok_paket.sql
-- Fix error: "Could not choose the best candidate function between:
--   public.process_isi_stok_paket(integer, numeric)
--   public.process_isi_stok_paket(integer, numeric, numeric)"
--
-- Penyebab: migrasi 20260902 menambah parameter p_total_berat dengan
-- CREATE OR REPLACE FUNCTION + signature BARU (3 arg). Di PostgreSQL,
-- CREATE OR REPLACE dengan argument list berbeda TIDAK menggantikan fungsi
-- lama — ia membuat overload baru. Fungsi 2-arg dari 20260901 tetap ada,
-- sehingga PostgREST tidak bisa memilih kandidat saat aplikasi memanggil
-- RPC dengan 2 argumen (p_id_paket, p_qty_paket).
--
-- Solusi: drop overload 2-arg. Versi 3-arg punya DEFAULT NULL untuk
-- p_total_berat, jadi panggilan 2-arg tetap valid dan berperilaku sama
-- (FIXED_RATIO).

DROP FUNCTION IF EXISTS public.process_isi_stok_paket(
  p_id_paket integer,
  p_qty_paket numeric
);
