-- ============================================================
-- 20260906_kas_admin_dan_uang_awal.sql
-- Fitur dua kas: Kas Admin (operasional owner) + Kas Kasir (laci).
--
-- 1. saldo_kas_harian  : tambah kolom `uang_awal` (float kas kasir per sesi).
--    Kasir input uang awal saat Buka Sesi; saldo_awal = uang_awal.
-- 2. kas_admin_topup   : pencatatan "uang masuk" kas admin (penambahan saldo
--    oleh owner kapan saja dibutuhkan). Pengeluaran operasional Tunai
--    (tabel `pengeluaran` status AKTIF) otomatis menjadi "uang keluar".
--    Saldo kas admin = Σ topup + Σ refund retur − Σ pengeluaran Tunai AKTIF.
-- ============================================================

-- 1. Uang awal sesi kas kasir
ALTER TABLE saldo_kas_harian
  ADD COLUMN IF NOT EXISTS uang_awal NUMERIC(15,2) NULL;

COMMENT ON COLUMN saldo_kas_harian.uang_awal IS
  'Uang awal (float) kas kasir yang dimasukkan saat buka sesi untuk kembalian';

-- 2. Tabel penambahan saldo kas admin
CREATE TABLE IF NOT EXISTS kas_admin_topup (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tanggal     DATE NOT NULL,
  jumlah      NUMERIC(15,2) NOT NULL CHECK (jumlah > 0),
  keterangan  TEXT,
  id_pengguna INTEGER REFERENCES pengguna(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_kas_admin_topup_tanggal
  ON kas_admin_topup(tanggal DESC);

-- 3. RLS (pola konvensi repo: authenticated users dapat akses; pembatasan
--    role ADMIN/OWNER dilakukan di layer aplikasi / server actions)
ALTER TABLE kas_admin_topup ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated users can select kas_admin_topup" ON kas_admin_topup;
DROP POLICY IF EXISTS "authenticated users can insert kas_admin_topup" ON kas_admin_topup;
DROP POLICY IF EXISTS "authenticated users can update kas_admin_topup" ON kas_admin_topup;
DROP POLICY IF EXISTS "authenticated users can delete kas_admin_topup" ON kas_admin_topup;

CREATE POLICY "authenticated users can select kas_admin_topup"
  ON kas_admin_topup FOR SELECT TO authenticated USING (true);

CREATE POLICY "authenticated users can insert kas_admin_topup"
  ON kas_admin_topup FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "authenticated users can update kas_admin_topup"
  ON kas_admin_topup FOR UPDATE TO authenticated USING (true);

CREATE POLICY "authenticated users can delete kas_admin_topup"
  ON kas_admin_topup FOR DELETE TO authenticated USING (true);
