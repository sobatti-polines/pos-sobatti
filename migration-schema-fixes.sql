-- ============================================================
-- Schema fixes to align database with POS spec v3.0.5
-- Run this in Supabase Dashboard > SQL Editor
-- ============================================================

BEGIN;

-- 1. Add 'nama' column to pengguna (display name for cashier)
ALTER TABLE pengguna ADD COLUMN IF NOT EXISTS nama TEXT;

-- Set initial values from usernames
UPDATE pengguna SET nama = INITCAP(username) WHERE nama IS NULL;

-- 2. Add missing columns to pengaturan
ALTER TABLE pengaturan ADD COLUMN IF NOT EXISTS pajak_persen NUMERIC DEFAULT 0;
ALTER TABLE pengaturan ADD COLUMN IF NOT EXISTS jenis_nota TEXT DEFAULT 'Invoice';
ALTER TABLE pengaturan ADD COLUMN IF NOT EXISTS metode_cetak TEXT DEFAULT 'Preview';
ALTER TABLE pengaturan ADD COLUMN IF NOT EXISTS logo_nota BOOLEAN DEFAULT false;
ALTER TABLE pengaturan ADD COLUMN IF NOT EXISTS hormat_kami_nama TEXT;

-- 3. Fix auth security: move roles from user_metadata to app_metadata
-- This moves the role claim to app_metadata where it can't be modified by users
UPDATE auth.users 
SET raw_app_meta_data = raw_app_meta_data || jsonb_build_object('role', raw_user_meta_data->>'role')
WHERE raw_user_meta_data->>'role' IS NOT NULL
  AND (raw_app_meta_data->>'role' IS NULL OR raw_app_meta_data->>'role' != raw_user_meta_data->>'role');

COMMIT;
