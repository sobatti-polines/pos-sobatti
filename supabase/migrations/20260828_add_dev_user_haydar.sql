-- Migration: Add dev user 'haydar' with DEV role
-- Role DEV tidak terlihat oleh OWNER di halaman Manajemen Pengguna
-- dan aktivitas DEV tidak terekam di Log Aktivitas (sudah di-handle oleh code)

-- 1. Insert ke tabel pengguna (auth user harus dibuat manual di Supabase Dashboard)
INSERT INTO public.pengguna (username, password, level, aktif, nama)
VALUES ('haydar', 'auth-managed', 'DEV', true, 'Haydar')
ON CONFLICT DO NOTHING;

-- 2. Pastikan sequence pengguna_id_seq tetap benar (next id tidak konflik)
SELECT setval('public.pengguna_id_seq', COALESCE((SELECT MAX(id) FROM public.pengguna), 1));
