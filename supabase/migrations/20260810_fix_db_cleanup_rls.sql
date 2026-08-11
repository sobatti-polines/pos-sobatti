-- 20260810_fix_db_cleanup_rls.sql
-- Pembersihan & penyelarasan database berdasarkan audit database.MD:
--
--   1. DROP tabel hutang/piutang yang masih tersisa (fitur sudah dihapus dari
--      kode & migrasi 20260721/20260904; butuh dieksekusi di Supabase).
--      Migrasi tersebut dibuat dengan CREATE OR REPLACE (tidak idempotent 100%
--      untuk keperluan migrasi online), jadi di sini kita eksekusi ulang bagian
--      DROP saja secara idempotent.
--
--   2. RLS saldo_kas_harian & pengaturan_keuangan: tabel dibuat tanpa RLS
--      (tidak ada policy, tidak ada ENABLE ROW LEVEL SECURITY). Ditambahkan
--      policy SELECT/INSERT/UPDATE/DELETE untuk authenticated (pola proyek).
--
--   3. Seragamkan policy merk & lokasi_area ke role authenticated (sebelumnya
--      +merk pakai TO public (auth_all), lokasi_area pakai TO public dgn
--      auth.role() check). Keduanya diakses hanya oleh authenticated.
--
-- File ini idempotent & aman dijalankan ulang.

-- ============================================================================
-- 1) Drop tabel hutang/piutang sisa (idempotent, CASCADE hapus RLS-nya)
-- ============================================================================

DROP TABLE IF EXISTS pembayaran_piutang CASCADE;
DROP TABLE IF EXISTS piutang_dagang CASCADE;
DROP TABLE IF EXISTS pembayaran_hutang CASCADE;
DROP TABLE IF EXISTS hutang_dagang CASCADE;

-- ============================================================================
-- 2) RLS: saldo_kas_harian & pengaturan_keuangan
-- ============================================================================

-- ─── saldo_kas_harian ───────────────────────────────────────────────────────
ALTER TABLE saldo_kas_harian ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated users can select saldo_kas_harian" ON saldo_kas_harian;
DROP POLICY IF EXISTS "authenticated users can insert saldo_kas_harian" ON saldo_kas_harian;
DROP POLICY IF EXISTS "authenticated users can update saldo_kas_harian" ON saldo_kas_harian;
DROP POLICY IF EXISTS "authenticated users can delete saldo_kas_harian" ON saldo_kas_harian;

CREATE POLICY "authenticated users can select saldo_kas_harian"
  ON saldo_kas_harian FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "authenticated users can insert saldo_kas_harian"
  ON saldo_kas_harian FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "authenticated users can update saldo_kas_harian"
  ON saldo_kas_harian FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "authenticated users can delete saldo_kas_harian"
  ON saldo_kas_harian FOR DELETE
  TO authenticated
  USING (true);

-- ─── pengaturan_keuangan ────────────────────────────────────────────────────
ALTER TABLE pengaturan_keuangan ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated users can select pengaturan_keuangan" ON pengaturan_keuangan;
DROP POLICY IF EXISTS "authenticated users can insert pengaturan_keuangan" ON pengaturan_keuangan;
DROP POLICY IF EXISTS "authenticated users can update pengaturan_keuangan" ON pengaturan_keuangan;
DROP POLICY IF EXISTS "authenticated users can delete pengaturan_keuangan" ON pengaturan_keuangan;

CREATE POLICY "authenticated users can select pengaturan_keuangan"
  ON pengaturan_keuangan FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "authenticated users can insert pengaturan_keuangan"
  ON pengaturan_keuangan FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "authenticated users can update pengaturan_keuangan"
  ON pengaturan_keuangan FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "authenticated users can delete pengaturan_keuangan"
  ON pengaturan_keuangan FOR DELETE
  TO authenticated
  USING (true);

-- ============================================================================
-- 3) Seragamkan policy merk & lokasi_area ke role authenticated
-- ============================================================================

-- ─── merk ───────────────────────────────────────────────────────────────────
-- Policy lama (via dashboard): "auth_all" ALL TO public USING true.
ALTER TABLE merk ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth_all" ON merk;
DROP POLICY IF EXISTS "authenticated users can select merk" ON merk;
DROP POLICY IF EXISTS "authenticated users can insert merk" ON merk;
DROP POLICY IF EXISTS "authenticated users can update merk" ON merk;
DROP POLICY IF EXISTS "authenticated users can delete merk" ON merk;

CREATE POLICY "authenticated users can select merk"
  ON merk FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "authenticated users can insert merk"
  ON merk FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "authenticated users can update merk"
  ON merk FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "authenticated users can delete merk"
  ON merk FOR DELETE
  TO authenticated
  USING (true);

-- ─── lokasi_area ────────────────────────────────────────────────────────────
-- Policy lama: TO public dgn USING auth.role()='authenticated' — diganti TO authenticated.
ALTER TABLE lokasi_area ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated users can select lokasi_area" ON lokasi_area;
DROP POLICY IF EXISTS "authenticated users can insert lokasi_area" ON lokasi_area;
DROP POLICY IF EXISTS "authenticated users can update lokasi_area" ON lokasi_area;
DROP POLICY IF EXISTS "authenticated users can delete lokasi_area" ON lokasi_area;

CREATE POLICY "authenticated users can select lokasi_area"
  ON lokasi_area FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "authenticated users can insert lokasi_area"
  ON lokasi_area FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "authenticated users can update lokasi_area"
  ON lokasi_area FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "authenticated users can delete lokasi_area"
  ON lokasi_area FOR DELETE
  TO authenticated
  USING (true);