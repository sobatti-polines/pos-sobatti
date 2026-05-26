-- Restrict all tables to authenticated users only
-- Drop permissive "allow all" policies

DO $$
DECLARE
  tbl TEXT;
  pol TEXT;
BEGIN
  FOR tbl IN
    SELECT tablename FROM pg_tables WHERE schemaname = 'public'
  LOOP
    FOR pol IN
      SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = tbl
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON %I', pol, tbl);
    END LOOP;
  END LOOP;
END $$;

-- Create authenticated-only policies for each table
CREATE POLICY "auth_all" ON barang_masuk FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all" ON detail_transaksi_keluar FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all" ON kategori FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all" ON metode_bayar FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all" ON pelanggan FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all" ON pengaturan FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all" ON pengguna FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all" ON produk FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all" ON satuan FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all" ON stok_opname FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all" ON supplier FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all" ON transaksi_keluar FOR ALL TO authenticated USING (true) WITH CHECK (true);
