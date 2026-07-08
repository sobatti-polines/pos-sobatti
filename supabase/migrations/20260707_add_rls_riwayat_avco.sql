-- Add RLS policies for riwayat_avco so authenticated users can insert/select

ALTER TABLE riwayat_avco ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can insert riwayat_avco"
  ON riwayat_avco
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can select riwayat_avco"
  ON riwayat_avco
  FOR SELECT
  TO authenticated
  USING (true);
