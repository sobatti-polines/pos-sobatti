-- Migration: 20260812_keuangan_pengeluaran.sql
-- Tabel kategori beban dan pengeluaran operasional

-- 1. Tabel kategori beban
CREATE TABLE IF NOT EXISTS kategori_beban (
  id              SERIAL PRIMARY KEY,
  nama            VARCHAR NOT NULL UNIQUE,
  kelompok        TEXT
);

-- Seed data default kategori beban
INSERT INTO kategori_beban (nama, kelompok) VALUES
  ('Gaji', 'Gaji & Tunjangan'),
  ('Sewa', 'Sewa & Tempat Usaha'),
  ('Listrik & Air', 'Utilitas'),
  ('Transport', 'Transport & Perjalanan'),
  ('Lain-lain', 'Lain-lain')
ON CONFLICT (nama) DO NOTHING;

-- 2. Tabel pengeluaran
CREATE TABLE IF NOT EXISTS pengeluaran (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tanggal           DATE NOT NULL,
  id_kategori_beban INTEGER NOT NULL REFERENCES kategori_beban(id),
  nama_pengeluaran  TEXT NOT NULL,
  jumlah            NUMERIC NOT NULL CHECK (jumlah > 0),
  metode_bayar      TEXT NOT NULL DEFAULT 'Tunai' CHECK (metode_bayar IN ('Tunai', 'Transfer', 'QRIS')),
  id_pengguna       INTEGER NOT NULL REFERENCES pengguna(id),
  keterangan        TEXT,
  status            TEXT NOT NULL DEFAULT 'AKTIF' CHECK (status IN ('AKTIF', 'DIVOID')),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  voided_at         TIMESTAMPTZ,
  voided_by         INTEGER REFERENCES pengguna(id),
  alasan_void       TEXT
);

-- 3. Indexes
CREATE INDEX IF NOT EXISTS idx_pengeluaran_tanggal
  ON pengeluaran(tanggal DESC);

CREATE INDEX IF NOT EXISTS idx_pengeluaran_kategori
  ON pengeluaran(id_kategori_beban);

CREATE INDEX IF NOT EXISTS idx_pengeluaran_status
  ON pengeluaran(status);

CREATE INDEX IF NOT EXISTS idx_pengeluaran_created_at
  ON pengeluaran(created_at DESC);

-- 4. RLS policies
-- Konvensi repo: semua tabel memakai pola "authenticated users can <aksi>" dgn
-- USING/CHECK (true). Pembatasan role ADMIN/OWNER dilakukan di layer aplikasi
-- (server actions). JANGAN pakai auth.uid()::int karena pengguna.id bertipe
-- integer sedangkan auth.uid() uuid — tidak bisa di-cast (error 42846).
ALTER TABLE kategori_beban ENABLE ROW LEVEL SECURITY;
ALTER TABLE pengeluaran ENABLE ROW LEVEL SECURITY;

-- Idempotent guards (amankan bila migration pernah dijalankan sebagian)
DROP POLICY IF EXISTS "auth_can_select_kategori_beban" ON kategori_beban;
DROP POLICY IF EXISTS "admin_owner_can_insert_kategori_beban" ON kategori_beban;
DROP POLICY IF EXISTS "admin_owner_can_update_kategori_beban" ON kategori_beban;
DROP POLICY IF EXISTS "auth_can_select_pengeluaran" ON pengeluaran;
DROP POLICY IF EXISTS "admin_owner_can_insert_pengeluaran" ON pengeluaran;
DROP POLICY IF EXISTS "admin_owner_can_update_pengeluaran" ON pengeluaran;

-- kategori_beban
DROP POLICY IF EXISTS "authenticated users can select kategori_beban" ON kategori_beban;
DROP POLICY IF EXISTS "authenticated users can insert kategori_beban" ON kategori_beban;
DROP POLICY IF EXISTS "authenticated users can update kategori_beban" ON kategori_beban;
DROP POLICY IF EXISTS "authenticated users can delete kategori_beban" ON kategori_beban;

CREATE POLICY "authenticated users can select kategori_beban"
  ON kategori_beban
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "authenticated users can insert kategori_beban"
  ON kategori_beban
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "authenticated users can update kategori_beban"
  ON kategori_beban
  FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "authenticated users can delete kategori_beban"
  ON kategori_beban
  FOR DELETE
  TO authenticated
  USING (true);

-- pengeluaran
DROP POLICY IF EXISTS "authenticated users can select pengeluaran" ON pengeluaran;
DROP POLICY IF EXISTS "authenticated users can insert pengeluaran" ON pengeluaran;
DROP POLICY IF EXISTS "authenticated users can update pengeluaran" ON pengeluaran;
DROP POLICY IF EXISTS "authenticated users can delete pengeluaran" ON pengeluaran;

CREATE POLICY "authenticated users can select pengeluaran"
  ON pengeluaran
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "authenticated users can insert pengeluaran"
  ON pengeluaran
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "authenticated users can update pengeluaran"
  ON pengeluaran
  FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "authenticated users can delete pengeluaran"
  ON pengeluaran
  FOR DELETE
  TO authenticated
  USING (true);
