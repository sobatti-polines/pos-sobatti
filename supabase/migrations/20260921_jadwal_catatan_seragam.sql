-- Migration: Tambah kolom catatan seragam per hari di jadwal mingguan
-- Format JSONB: { "2026-09-01": "Batik", "2026-09-02": "Kemeja", ... }
-- NULL atau {} = tidak ada catatan seragam

ALTER TABLE public.jadwal_mingguan
ADD COLUMN IF NOT EXISTS catatan_seragam jsonb;

COMMENT ON COLUMN public.jadwal_mingguan.catatan_seragam
IS 'Catatan seragam per hari dalam format JSONB: { tanggal: "jenis seragam" }. Contoh: {"2026-09-01":"Batik","2026-09-02":"Kemeja"}';
