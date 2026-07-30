-- Migration: 20260729_add_log_aktivitas.sql
-- Tabel log aktivitas untuk semua aksi admin/owner

CREATE TABLE IF NOT EXISTS log_aktivitas (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_pengguna     INTEGER NOT NULL REFERENCES pengguna(id),
  aksi            TEXT NOT NULL CHECK (aksi IN ('CREATE','UPDATE','DELETE')),
  entitas         TEXT NOT NULL,
  id_entitas      INTEGER,
  deskripsi       TEXT NOT NULL,
  data_lama       JSONB,
  data_baru       JSONB,
  ip_address      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_log_aktivitas_created_at
  ON log_aktivitas(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_log_aktivitas_entitas
  ON log_aktivitas(entitas);

CREATE INDEX IF NOT EXISTS idx_log_aktivitas_pengguna
  ON log_aktivitas(id_pengguna);

-- RPC untuk insert log (SECURITY DEFINER agar bisa INSERT lewat RLS)
CREATE OR REPLACE FUNCTION tambah_log_aktivitas(
  p_id_pengguna INTEGER,
  p_aksi TEXT,
  p_entitas TEXT,
  p_id_entitas INTEGER DEFAULT NULL,
  p_deskripsi TEXT DEFAULT '',
  p_data_lama JSONB DEFAULT NULL,
  p_data_baru JSONB DEFAULT NULL,
  p_ip_address TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO log_aktivitas (
    id_pengguna, aksi, entitas, id_entitas,
    deskripsi, data_lama, data_baru, ip_address
  ) VALUES (
    p_id_pengguna, p_aksi, p_entitas, p_id_entitas,
    p_deskripsi, p_data_lama, p_data_baru, p_ip_address
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION tambah_log_aktivitas(
  INTEGER, TEXT, TEXT, INTEGER, TEXT, JSONB, JSONB, TEXT
) TO authenticated;

-- RLS: authenticated users can select
ALTER TABLE log_aktivitas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_can_select_log_aktivitas"
  ON log_aktivitas
  FOR SELECT
  TO authenticated
  USING (true);
