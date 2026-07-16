-- Migration: Add RLS policies for hutang_dagang, pembayaran_hutang,
--            piutang_dagang, pembayaran_piutang
-- Semua tabel ini dapat diakses oleh user yang sudah login (authenticated).

-- ─── hutang_dagang ───────────────────────────────────────────────────────────
ALTER TABLE hutang_dagang ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated users can select hutang_dagang"
  ON hutang_dagang FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "authenticated users can insert hutang_dagang"
  ON hutang_dagang FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "authenticated users can update hutang_dagang"
  ON hutang_dagang FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- ─── pembayaran_hutang ───────────────────────────────────────────────────────
ALTER TABLE pembayaran_hutang ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated users can select pembayaran_hutang"
  ON pembayaran_hutang FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "authenticated users can insert pembayaran_hutang"
  ON pembayaran_hutang FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- ─── piutang_dagang ──────────────────────────────────────────────────────────
ALTER TABLE piutang_dagang ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated users can select piutang_dagang"
  ON piutang_dagang FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "authenticated users can insert piutang_dagang"
  ON piutang_dagang FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "authenticated users can update piutang_dagang"
  ON piutang_dagang FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- ─── pembayaran_piutang ──────────────────────────────────────────────────────
ALTER TABLE pembayaran_piutang ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated users can select pembayaran_piutang"
  ON pembayaran_piutang FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "authenticated users can insert pembayaran_piutang"
  ON pembayaran_piutang FOR INSERT
  TO authenticated
  WITH CHECK (true);
