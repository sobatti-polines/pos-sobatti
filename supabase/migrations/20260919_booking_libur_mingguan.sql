-- Booking hari libur mingguan untuk draft jadwal karyawan.

CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC;
GRANT USAGE ON SCHEMA private TO authenticated;

CREATE OR REPLACE FUNCTION private.current_pengguna_id()
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT p.id
  FROM public.pengguna p
  WHERE p.username = split_part(COALESCE((SELECT auth.jwt() ->> 'email'), ''), '@', 1)
    AND p.aktif = true
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION private.current_is_owner()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.pengguna p
    WHERE p.username = split_part(COALESCE((SELECT auth.jwt() ->> 'email'), ''), '@', 1)
      AND p.aktif = true
      AND p.level IN ('OWNER', 'DEV')
  );
$$;

REVOKE ALL ON FUNCTION private.current_pengguna_id() FROM PUBLIC;
REVOKE ALL ON FUNCTION private.current_is_owner() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.current_pengguna_id() TO authenticated;
GRANT EXECUTE ON FUNCTION private.current_is_owner() TO authenticated;

CREATE TABLE IF NOT EXISTS public.permintaan_libur (
  id BIGSERIAL PRIMARY KEY,
  id_jadwal_mingguan BIGINT NOT NULL REFERENCES public.jadwal_mingguan(id) ON DELETE CASCADE,
  id_pengguna INTEGER NOT NULL REFERENCES public.pengguna(id) ON DELETE CASCADE,
  tanggal DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'MENUNGGU',
  tipe_jadwal_sebelumnya TEXT,
  id_shift_sebelumnya BIGINT REFERENCES public.shift_kerja(id),
  ditinjau_oleh INTEGER REFERENCES public.pengguna(id),
  ditinjau_pada TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT permintaan_libur_status_check
    CHECK (status IN ('MENUNGGU', 'DISETUJUI', 'DITOLAK', 'DIBATALKAN')),
  CONSTRAINT permintaan_libur_tipe_sebelumnya_check
    CHECK (tipe_jadwal_sebelumnya IS NULL OR tipe_jadwal_sebelumnya IN ('PAGI', 'SORE'))
);

CREATE UNIQUE INDEX IF NOT EXISTS permintaan_libur_unique_aktif
  ON public.permintaan_libur(id_jadwal_mingguan, id_pengguna)
  WHERE status IN ('MENUNGGU', 'DISETUJUI');

CREATE INDEX IF NOT EXISTS idx_permintaan_libur_jadwal_tanggal
  ON public.permintaan_libur(id_jadwal_mingguan, tanggal)
  WHERE status IN ('MENUNGGU', 'DISETUJUI');

DROP FUNCTION IF EXISTS public.validasi_permintaan_libur();

CREATE OR REPLACE FUNCTION private.validasi_permintaan_libur()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_jadwal public.jadwal_mingguan%ROWTYPE;
  v_jumlah_pegawai integer;
  v_kapasitas integer;
  v_terpakai integer;
  v_tipe public.jadwal_karyawan.tipe_jadwal%TYPE;
  v_id_shift public.jadwal_karyawan.id_shift%TYPE;
  v_actor_id integer := private.current_pengguna_id();
  v_actor_owner boolean := private.current_is_owner();
BEGIN
  IF TG_OP = 'INSERT' AND NEW.status <> 'MENUNGGU' THEN
    RAISE EXCEPTION 'Request baru harus berstatus MENUNGGU';
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF NEW.id_jadwal_mingguan <> OLD.id_jadwal_mingguan
       OR NEW.id_pengguna <> OLD.id_pengguna THEN
      RAISE EXCEPTION 'Pegawai dan periode request tidak dapat diubah';
    END IF;

    IF OLD.status IN ('DITOLAK', 'DIBATALKAN') THEN
      RAISE EXCEPTION 'Request yang sudah selesai tidak dapat diubah';
    END IF;

    IF OLD.status = 'DISETUJUI'
       AND (NEW.tanggal <> OLD.tanggal OR NEW.status NOT IN ('DISETUJUI', 'DITOLAK')) THEN
      RAISE EXCEPTION 'Persetujuan hanya dapat dibatalkan oleh owner';
    END IF;

    IF OLD.status = 'MENUNGGU'
       AND NEW.status NOT IN ('MENUNGGU', 'DISETUJUI', 'DITOLAK', 'DIBATALKAN') THEN
      RAISE EXCEPTION 'Perubahan status request tidak valid';
    END IF;
  END IF;

  SELECT * INTO v_jadwal
  FROM public.jadwal_mingguan
  WHERE id = NEW.id_jadwal_mingguan
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Draft jadwal tidak ditemukan';
  END IF;

  IF v_jadwal.status <> 'DRAFT' THEN
    RAISE EXCEPTION 'Booking ditutup karena jadwal sudah diterbitkan';
  END IF;

  IF NEW.tanggal < v_jadwal.minggu_mulai
     OR NEW.tanggal > v_jadwal.minggu_mulai + 6 THEN
    RAISE EXCEPTION 'Tanggal libur harus berada dalam periode jadwal';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.jadwal_karyawan jk
    WHERE jk.id_jadwal_mingguan = NEW.id_jadwal_mingguan
      AND jk.id_pengguna = NEW.id_pengguna
  ) THEN
    RAISE EXCEPTION 'Pegawai tidak terdaftar dalam draft jadwal ini';
  END IF;

  IF NOT v_actor_owner
     AND timezone('Asia/Jakarta', now())::date >= v_jadwal.minggu_mulai THEN
    RAISE EXCEPTION 'Booking libur untuk minggu ini sudah ditutup';
  END IF;

  IF NEW.status IN ('MENUNGGU', 'DISETUJUI') THEN
    SELECT COUNT(DISTINCT jk.id_pengguna)::integer INTO v_jumlah_pegawai
    FROM public.jadwal_karyawan jk
    WHERE jk.id_jadwal_mingguan = NEW.id_jadwal_mingguan;

    v_kapasitas := GREATEST(1, CEIL(v_jumlah_pegawai / 7.0)::integer);

    SELECT COUNT(*)::integer INTO v_terpakai
    FROM public.permintaan_libur pl
    WHERE pl.id_jadwal_mingguan = NEW.id_jadwal_mingguan
      AND pl.tanggal = NEW.tanggal
      AND pl.status IN ('MENUNGGU', 'DISETUJUI')
      AND pl.id <> COALESCE(NEW.id, -1);

    IF v_terpakai >= v_kapasitas THEN
      RAISE EXCEPTION 'Slot libur pada tanggal ini sudah penuh';
    END IF;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.status = 'MENUNGGU' AND NEW.status = 'DISETUJUI' THEN
    SELECT jk.tipe_jadwal, jk.id_shift
      INTO v_tipe, v_id_shift
    FROM public.jadwal_karyawan jk
    WHERE jk.id_jadwal_mingguan = NEW.id_jadwal_mingguan
      AND jk.id_pengguna = NEW.id_pengguna
      AND jk.tanggal = NEW.tanggal
    FOR UPDATE;

    IF v_tipe NOT IN ('PAGI', 'SORE') THEN
      RAISE EXCEPTION 'Pegawai sudah memiliki libur atau jadwal belum lengkap pada tanggal ini';
    END IF;

    IF EXISTS (
      SELECT 1
      FROM public.jadwal_karyawan jk
      WHERE jk.id_jadwal_mingguan = NEW.id_jadwal_mingguan
        AND jk.id_pengguna = NEW.id_pengguna
        AND jk.tipe_jadwal = 'LIBUR'
        AND jk.tanggal <> NEW.tanggal
    ) THEN
      RAISE EXCEPTION 'Pegawai sudah memiliki hari libur lain';
    END IF;

    NEW.tipe_jadwal_sebelumnya := v_tipe;
    NEW.id_shift_sebelumnya := v_id_shift;
    NEW.ditinjau_oleh := v_actor_id;
    NEW.ditinjau_pada := now();

    UPDATE public.jadwal_karyawan
    SET tipe_jadwal = 'LIBUR', id_shift = NULL
    WHERE id_jadwal_mingguan = NEW.id_jadwal_mingguan
      AND id_pengguna = NEW.id_pengguna
      AND tanggal = NEW.tanggal;
  ELSIF TG_OP = 'UPDATE' AND OLD.status = 'DISETUJUI' AND NEW.status = 'DITOLAK' THEN
    IF OLD.tipe_jadwal_sebelumnya NOT IN ('PAGI', 'SORE')
       OR OLD.id_shift_sebelumnya IS NULL THEN
      RAISE EXCEPTION 'Shift awal request tidak lengkap';
    END IF;

    UPDATE public.jadwal_karyawan
    SET tipe_jadwal = OLD.tipe_jadwal_sebelumnya,
        id_shift = OLD.id_shift_sebelumnya
    WHERE id_jadwal_mingguan = NEW.id_jadwal_mingguan
      AND id_pengguna = NEW.id_pengguna
      AND tanggal = OLD.tanggal
      AND tipe_jadwal = 'LIBUR';

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Jadwal libur yang disetujui tidak ditemukan';
    END IF;

    NEW.ditinjau_oleh := v_actor_id;
    NEW.ditinjau_pada := now();
  ELSIF TG_OP = 'UPDATE' AND OLD.status = 'MENUNGGU' AND NEW.status = 'DITOLAK' THEN
    NEW.ditinjau_oleh := v_actor_id;
    NEW.ditinjau_pada := now();
  ELSIF TG_OP = 'UPDATE' AND NEW.status = 'MENUNGGU' THEN
    NEW.ditinjau_oleh := NULL;
    NEW.ditinjau_pada := NULL;
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.validasi_permintaan_libur() FROM PUBLIC;
REVOKE ALL ON FUNCTION private.validasi_permintaan_libur() FROM authenticated;

DROP TRIGGER IF EXISTS trg_validasi_permintaan_libur ON public.permintaan_libur;
CREATE TRIGGER trg_validasi_permintaan_libur
BEFORE INSERT OR UPDATE ON public.permintaan_libur
FOR EACH ROW
EXECUTE FUNCTION private.validasi_permintaan_libur();

ALTER TABLE public.permintaan_libur ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.permintaan_libur FROM anon, authenticated;
REVOKE ALL ON SEQUENCE public.permintaan_libur_id_seq FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.permintaan_libur TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.permintaan_libur_id_seq TO authenticated;

CREATE POLICY "permintaan_libur_select_owner"
  ON public.permintaan_libur FOR SELECT TO authenticated
  USING ((SELECT private.current_is_owner()));

CREATE POLICY "permintaan_libur_select_sendiri"
  ON public.permintaan_libur FOR SELECT TO authenticated
  USING (id_pengguna = (SELECT private.current_pengguna_id()));

CREATE POLICY "permintaan_libur_select_booking_aktif"
  ON public.permintaan_libur FOR SELECT TO authenticated
  USING (
    status IN ('MENUNGGU', 'DISETUJUI')
    AND EXISTS (
      SELECT 1
      FROM public.jadwal_karyawan jk
      WHERE jk.id_jadwal_mingguan = permintaan_libur.id_jadwal_mingguan
        AND jk.id_pengguna = (SELECT private.current_pengguna_id())
    )
  );

CREATE POLICY "permintaan_libur_insert_sendiri"
  ON public.permintaan_libur FOR INSERT TO authenticated
  WITH CHECK (
    id_pengguna = (SELECT private.current_pengguna_id())
    AND status = 'MENUNGGU'
  );

CREATE POLICY "permintaan_libur_update_sendiri"
  ON public.permintaan_libur FOR UPDATE TO authenticated
  USING (
    id_pengguna = (SELECT private.current_pengguna_id())
    AND status = 'MENUNGGU'
  )
  WITH CHECK (
    id_pengguna = (SELECT private.current_pengguna_id())
    AND status IN ('MENUNGGU', 'DIBATALKAN')
  );

CREATE POLICY "permintaan_libur_update_owner"
  ON public.permintaan_libur FOR UPDATE TO authenticated
  USING ((SELECT private.current_is_owner()))
  WITH CHECK ((SELECT private.current_is_owner()));

-- Jadwal dapat dibaca seluruh staf, tetapi hanya owner yang boleh mengubahnya.
DROP POLICY IF EXISTS "auth_all" ON public.shift_kerja;
DROP POLICY IF EXISTS "auth_all" ON public.jadwal_mingguan;
DROP POLICY IF EXISTS "auth_all" ON public.jadwal_karyawan;

CREATE POLICY "shift_kerja_select_authenticated"
  ON public.shift_kerja FOR SELECT TO authenticated USING (true);
CREATE POLICY "shift_kerja_insert_owner"
  ON public.shift_kerja FOR INSERT TO authenticated
  WITH CHECK ((SELECT private.current_is_owner()));
CREATE POLICY "shift_kerja_update_owner"
  ON public.shift_kerja FOR UPDATE TO authenticated
  USING ((SELECT private.current_is_owner()))
  WITH CHECK ((SELECT private.current_is_owner()));
CREATE POLICY "shift_kerja_delete_owner"
  ON public.shift_kerja FOR DELETE TO authenticated
  USING ((SELECT private.current_is_owner()));

CREATE POLICY "jadwal_mingguan_select_authenticated"
  ON public.jadwal_mingguan FOR SELECT TO authenticated USING (true);
CREATE POLICY "jadwal_mingguan_insert_owner"
  ON public.jadwal_mingguan FOR INSERT TO authenticated
  WITH CHECK ((SELECT private.current_is_owner()));
CREATE POLICY "jadwal_mingguan_update_owner"
  ON public.jadwal_mingguan FOR UPDATE TO authenticated
  USING ((SELECT private.current_is_owner()))
  WITH CHECK ((SELECT private.current_is_owner()));
CREATE POLICY "jadwal_mingguan_delete_owner"
  ON public.jadwal_mingguan FOR DELETE TO authenticated
  USING ((SELECT private.current_is_owner()));

CREATE POLICY "jadwal_karyawan_select_authenticated"
  ON public.jadwal_karyawan FOR SELECT TO authenticated USING (true);
CREATE POLICY "jadwal_karyawan_insert_owner"
  ON public.jadwal_karyawan FOR INSERT TO authenticated
  WITH CHECK ((SELECT private.current_is_owner()));
CREATE POLICY "jadwal_karyawan_update_owner"
  ON public.jadwal_karyawan FOR UPDATE TO authenticated
  USING ((SELECT private.current_is_owner()))
  WITH CHECK ((SELECT private.current_is_owner()));
CREATE POLICY "jadwal_karyawan_delete_owner"
  ON public.jadwal_karyawan FOR DELETE TO authenticated
  USING ((SELECT private.current_is_owner()));

REVOKE ALL ON TABLE public.shift_kerja, public.jadwal_mingguan, public.jadwal_karyawan
  FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE
  ON TABLE public.shift_kerja, public.jadwal_mingguan, public.jadwal_karyawan
  TO authenticated;
GRANT USAGE, SELECT
  ON SEQUENCE public.shift_kerja_id_seq, public.jadwal_mingguan_id_seq, public.jadwal_karyawan_id_seq
  TO authenticated;

GRANT ALL ON TABLE public.permintaan_libur TO service_role;
GRANT ALL ON SEQUENCE public.permintaan_libur_id_seq TO service_role;

COMMENT ON TABLE public.permintaan_libur IS
  'Booking satu hari libur pegawai pada draft jadwal mingguan.';
