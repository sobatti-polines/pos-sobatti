-- Modul jadwal karyawan mingguan.
-- Apply setelah 20260916_finalize_po_custom_transaction.sql.

CREATE TABLE IF NOT EXISTS public.shift_kerja (
  id BIGSERIAL PRIMARY KEY,
  kode TEXT NOT NULL UNIQUE,
  nama TEXT NOT NULL,
  jam_mulai TIME NOT NULL,
  jam_selesai TIME NOT NULL,
  aktif BOOLEAN NOT NULL DEFAULT true,
  urutan INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT shift_kerja_kode_check CHECK (kode IN ('PAGI', 'SORE'))
);

CREATE TABLE IF NOT EXISTS public.jadwal_mingguan (
  id BIGSERIAL PRIMARY KEY,
  minggu_mulai DATE NOT NULL UNIQUE,
  kebutuhan_pagi INTEGER NOT NULL DEFAULT 1,
  kebutuhan_sore INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'DRAFT',
  created_by INTEGER REFERENCES public.pengguna(id),
  updated_by INTEGER REFERENCES public.pengguna(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT jadwal_mingguan_status_check CHECK (status IN ('DRAFT', 'TERBIT')),
  CONSTRAINT jadwal_mingguan_kebutuhan_pagi_check CHECK (kebutuhan_pagi >= 0),
  CONSTRAINT jadwal_mingguan_kebutuhan_sore_check CHECK (kebutuhan_sore >= 0)
);

CREATE TABLE IF NOT EXISTS public.jadwal_karyawan (
  id BIGSERIAL PRIMARY KEY,
  id_jadwal_mingguan BIGINT NOT NULL REFERENCES public.jadwal_mingguan(id) ON DELETE CASCADE,
  tanggal DATE NOT NULL,
  id_pengguna INTEGER NOT NULL REFERENCES public.pengguna(id) ON DELETE CASCADE,
  tipe_jadwal TEXT NOT NULL,
  id_shift BIGINT REFERENCES public.shift_kerja(id),
  catatan TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT jadwal_karyawan_tipe_check CHECK (tipe_jadwal IN ('PAGI', 'SORE', 'LIBUR')),
  CONSTRAINT jadwal_karyawan_shift_check CHECK (
    (tipe_jadwal = 'LIBUR' AND id_shift IS NULL)
    OR (tipe_jadwal IN ('PAGI', 'SORE') AND id_shift IS NOT NULL)
  ),
  CONSTRAINT jadwal_karyawan_unique_pengguna_tanggal UNIQUE (id_pengguna, tanggal),
  CONSTRAINT jadwal_karyawan_unique_detail UNIQUE (id_jadwal_mingguan, id_pengguna, tanggal)
);

CREATE INDEX IF NOT EXISTS idx_jadwal_karyawan_mingguan
  ON public.jadwal_karyawan(id_jadwal_mingguan);

CREATE INDEX IF NOT EXISTS idx_jadwal_karyawan_pengguna_tanggal
  ON public.jadwal_karyawan(id_pengguna, tanggal);

CREATE INDEX IF NOT EXISTS idx_jadwal_karyawan_tanggal
  ON public.jadwal_karyawan(tanggal);

CREATE OR REPLACE FUNCTION public.set_jadwal_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_shift_kerja_updated_at ON public.shift_kerja;
CREATE TRIGGER trg_shift_kerja_updated_at
BEFORE UPDATE ON public.shift_kerja
FOR EACH ROW
EXECUTE FUNCTION public.set_jadwal_updated_at();

DROP TRIGGER IF EXISTS trg_jadwal_mingguan_updated_at ON public.jadwal_mingguan;
CREATE TRIGGER trg_jadwal_mingguan_updated_at
BEFORE UPDATE ON public.jadwal_mingguan
FOR EACH ROW
EXECUTE FUNCTION public.set_jadwal_updated_at();

DROP TRIGGER IF EXISTS trg_jadwal_karyawan_updated_at ON public.jadwal_karyawan;
CREATE TRIGGER trg_jadwal_karyawan_updated_at
BEFORE UPDATE ON public.jadwal_karyawan
FOR EACH ROW
EXECUTE FUNCTION public.set_jadwal_updated_at();

INSERT INTO public.shift_kerja (kode, nama, jam_mulai, jam_selesai, aktif, urutan)
VALUES
  ('PAGI', 'Shift Pagi', '08:00', '15:00', true, 1),
  ('SORE', 'Shift Sore', '15:00', '22:00', true, 2)
ON CONFLICT (kode) DO UPDATE
SET nama = EXCLUDED.nama,
    aktif = EXCLUDED.aktif,
    urutan = EXCLUDED.urutan;

ALTER TABLE public.shift_kerja ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jadwal_mingguan ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jadwal_karyawan ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth_all" ON public.shift_kerja;
CREATE POLICY "auth_all" ON public.shift_kerja
  TO authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "auth_all" ON public.jadwal_mingguan;
CREATE POLICY "auth_all" ON public.jadwal_mingguan
  TO authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "auth_all" ON public.jadwal_karyawan;
CREATE POLICY "auth_all" ON public.jadwal_karyawan
  TO authenticated
  USING (true)
  WITH CHECK (true);

GRANT ALL ON TABLE public.shift_kerja TO anon, authenticated, service_role;
GRANT ALL ON SEQUENCE public.shift_kerja_id_seq TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.jadwal_mingguan TO anon, authenticated, service_role;
GRANT ALL ON SEQUENCE public.jadwal_mingguan_id_seq TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.jadwal_karyawan TO anon, authenticated, service_role;
GRANT ALL ON SEQUENCE public.jadwal_karyawan_id_seq TO anon, authenticated, service_role;

COMMENT ON TABLE public.shift_kerja IS 'Definisi shift kerja Pagi/Sore untuk jadwal karyawan.';
COMMENT ON TABLE public.jadwal_mingguan IS 'Header jadwal karyawan per minggu.';
COMMENT ON TABLE public.jadwal_karyawan IS 'Detail jadwal karyawan per tanggal dalam minggu tertentu.';
