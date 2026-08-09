-- ============================================================
-- FIX RLS: Tambah policy untuk sesi_stok_opname & stok_opname
-- ============================================================

-- ─── sesi_stok_opname ───────────────────────────────────────────────────────
ALTER TABLE sesi_stok_opname ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated users can select sesi_stok_opname"
  ON sesi_stok_opname FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "authenticated users can insert sesi_stok_opname"
  ON sesi_stok_opname FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "authenticated users can update sesi_stok_opname"
  ON sesi_stok_opname FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "authenticated users can delete sesi_stok_opname"
  ON sesi_stok_opname FOR DELETE
  TO authenticated
  USING (true);

-- ─── stok_opname (pastikan RLS aktif + policy lengkap) ──────────────────────
ALTER TABLE stok_opname ENABLE ROW LEVEL SECURITY;

-- Drop policy lama jika ada (supaya tidak duplikat)
DROP POLICY IF EXISTS "authenticated users can select stok_opname" ON stok_opname;
DROP POLICY IF EXISTS "authenticated users can insert stok_opname" ON stok_opname;
DROP POLICY IF EXISTS "authenticated users can update stok_opname" ON stok_opname;
DROP POLICY IF EXISTS "authenticated users can delete stok_opname" ON stok_opname;

CREATE POLICY "authenticated users can select stok_opname"
  ON stok_opname FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "authenticated users can insert stok_opname"
  ON stok_opname FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "authenticated users can update stok_opname"
  ON stok_opname FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "authenticated users can delete stok_opname"
  ON stok_opname FOR DELETE
  TO authenticated
  USING (true);
