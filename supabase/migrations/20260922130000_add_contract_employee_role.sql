BEGIN;

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
  v_requester_level public.pengguna.level%TYPE;
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

  SELECT p.level INTO v_requester_level
  FROM public.pengguna p
  WHERE p.id = NEW.id_pengguna;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profil pegawai tidak ditemukan';
  END IF;

  IF v_requester_level = 'KONTRAK' AND TG_OP = 'INSERT' THEN
    RAISE EXCEPTION 'Pegawai kontrak tidak dapat booking libur; libur diatur oleh owner';
  END IF;

  IF v_requester_level = 'KONTRAK' AND TG_OP = 'UPDATE' THEN
    IF OLD.status = 'MENUNGGU'
       AND NEW.status = 'MENUNGGU'
       AND NEW.tanggal IS DISTINCT FROM OLD.tanggal THEN
      RAISE EXCEPTION 'Pegawai kontrak tidak dapat booking libur; libur diatur oleh owner';
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

  IF NEW.status IN ('MENUNGGU', 'DISETUJUI')
     AND v_requester_level <> 'KONTRAK' THEN
    SELECT COUNT(DISTINCT jk.id_pengguna)::integer INTO v_jumlah_pegawai
    FROM public.jadwal_karyawan jk
    JOIN public.pengguna p ON p.id = jk.id_pengguna
    WHERE jk.id_jadwal_mingguan = NEW.id_jadwal_mingguan
      AND p.level <> 'KONTRAK';

    v_kapasitas := GREATEST(1, CEIL(v_jumlah_pegawai / 7.0)::integer);

    SELECT COUNT(*)::integer INTO v_terpakai
    FROM public.permintaan_libur pl
    JOIN public.pengguna p ON p.id = pl.id_pengguna
    WHERE pl.id_jadwal_mingguan = NEW.id_jadwal_mingguan
      AND pl.tanggal = NEW.tanggal
      AND pl.status IN ('MENUNGGU', 'DISETUJUI')
      AND p.level <> 'KONTRAK'
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

    IF v_tipe NOT IN ('PAGI', 'SORE', 'FULL') THEN
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
    IF OLD.tipe_jadwal_sebelumnya NOT IN ('PAGI', 'SORE', 'FULL')
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

COMMIT;
