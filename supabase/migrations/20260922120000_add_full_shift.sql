BEGIN;

ALTER TABLE public.shift_kerja
  DROP CONSTRAINT IF EXISTS shift_kerja_kode_check;
ALTER TABLE public.shift_kerja
  ADD CONSTRAINT shift_kerja_kode_check CHECK (kode IN ('PAGI', 'SORE', 'FULL'));

INSERT INTO public.shift_kerja (kode, nama, jam_mulai, jam_selesai, aktif, urutan)
VALUES (
  'FULL',
  'Shift Full',
  COALESCE((SELECT jam_mulai FROM public.shift_kerja WHERE kode = 'PAGI'), '08:00'::time),
  COALESCE((SELECT jam_selesai FROM public.shift_kerja WHERE kode = 'SORE'), '22:00'::time),
  true,
  3
)
ON CONFLICT (kode) DO UPDATE
SET nama = EXCLUDED.nama,
    jam_mulai = EXCLUDED.jam_mulai,
    jam_selesai = EXCLUDED.jam_selesai,
    aktif = EXCLUDED.aktif,
    urutan = EXCLUDED.urutan;

ALTER TABLE public.jadwal_karyawan
  DROP CONSTRAINT IF EXISTS jadwal_karyawan_tipe_check,
  DROP CONSTRAINT IF EXISTS jadwal_karyawan_shift_check;
ALTER TABLE public.jadwal_karyawan
  ADD CONSTRAINT jadwal_karyawan_tipe_check
    CHECK (tipe_jadwal IN ('PAGI', 'SORE', 'FULL', 'LIBUR')),
  ADD CONSTRAINT jadwal_karyawan_shift_check CHECK (
    (tipe_jadwal = 'LIBUR' AND id_shift IS NULL)
    OR (tipe_jadwal IN ('PAGI', 'SORE', 'FULL') AND id_shift IS NOT NULL)
  );

ALTER TABLE public.permintaan_libur
  DROP CONSTRAINT IF EXISTS permintaan_libur_tipe_sebelumnya_check;
ALTER TABLE public.permintaan_libur
  ADD CONSTRAINT permintaan_libur_tipe_sebelumnya_check
    CHECK (tipe_jadwal_sebelumnya IS NULL OR tipe_jadwal_sebelumnya IN ('PAGI', 'SORE', 'FULL'));

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

CREATE OR REPLACE FUNCTION public.process_attendance_checkin(
  p_token text,
  p_id_pengguna integer,
  p_device_info text DEFAULT NULL,
  p_tolerance_minutes integer DEFAULT 10,
  p_fallback_start time DEFAULT '09:00'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_qr public.qr_session%ROWTYPE;
  v_existing public.absensi%ROWTYPE;
  v_now timestamptz := clock_timestamp();
  v_today date := timezone('Asia/Jakarta', v_now)::date;
  v_now_wib timestamp := timezone('Asia/Jakarta', v_now);
  v_opening_minutes integer;
  v_now_minutes integer;
  v_status varchar(20) := 'HADIR';
  v_telat integer := 0;
BEGIN
  IF COALESCE(btrim(p_token), '') = '' THEN
    RETURN jsonb_build_object('success', false, 'code', 'INVALID_TOKEN', 'error', 'Kode QR tidak valid atau sudah digunakan');
  END IF;

  SELECT * INTO v_qr
  FROM public.qr_session
  WHERE token = p_token
  FOR UPDATE;

  IF NOT FOUND OR NOT COALESCE(v_qr.is_active, false) THEN
    RETURN jsonb_build_object('success', false, 'code', 'INVALID_TOKEN', 'error', 'Kode QR tidak valid atau sudah digunakan');
  END IF;

  IF v_qr.expired_at <= v_now THEN
    UPDATE public.qr_session SET is_active = false WHERE id = v_qr.id;
    RETURN jsonb_build_object('success', false, 'code', 'TOKEN_EXPIRED', 'error', 'Kode QR sudah kedaluwarsa');
  END IF;

  SELECT * INTO v_existing
  FROM public.absensi
  WHERE id_pengguna = p_id_pengguna AND tanggal = v_today
  FOR UPDATE;

  IF FOUND THEN
    IF v_existing.sumber = 'MANUAL' THEN
      RETURN jsonb_build_object(
        'success', false,
        'code', 'MANUAL_ATTENDANCE_LOCKED',
        'error', 'Absensi hari ini telah dicatat manual oleh owner. Hubungi owner untuk koreksi.'
      );
    END IF;
    RETURN jsonb_build_object('success', false, 'code', 'ALREADY_CHECKED_IN', 'error', 'Anda sudah melakukan check-in hari ini');
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.jadwal_karyawan jk
    JOIN public.jadwal_mingguan jm ON jm.id = jk.id_jadwal_mingguan
    WHERE jk.id_pengguna = p_id_pengguna
      AND jk.tanggal = v_today
      AND jk.tipe_jadwal IN ('PAGI', 'SORE', 'FULL')
      AND jm.status = 'TERBIT'
  ) THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'NO_WORK_SCHEDULE',
      'error', 'Anda tidak memiliki jadwal kerja terbit hari ini'
    );
  END IF;

  v_opening_minutes := extract(hour FROM timezone('Asia/Jakarta', v_qr.created_at))::integer * 60
    + extract(minute FROM timezone('Asia/Jakarta', v_qr.created_at))::integer;
  v_now_minutes := extract(hour FROM v_now_wib)::integer * 60
    + extract(minute FROM v_now_wib)::integer;

  IF v_now_minutes > v_opening_minutes + GREATEST(COALESCE(p_tolerance_minutes, 10), 0) THEN
    v_status := 'TELAT';
    v_telat := GREATEST(v_now_minutes - v_opening_minutes, 0);
  END IF;

  BEGIN
    INSERT INTO public.absensi (
      id_pengguna, tanggal, jam_masuk, status, telat_menit,
      device_info, sumber, dicatat_oleh, catatan_manual, updated_at
    ) VALUES (
      p_id_pengguna, v_today, v_now_wib, v_status, v_telat,
      NULLIF(left(COALESCE(p_device_info, ''), 500), ''), 'QR', NULL, NULL, v_now
    );
  EXCEPTION WHEN unique_violation THEN
    SELECT * INTO v_existing
    FROM public.absensi
    WHERE id_pengguna = p_id_pengguna AND tanggal = v_today;

    IF v_existing.sumber = 'MANUAL' THEN
      RETURN jsonb_build_object(
        'success', false,
        'code', 'MANUAL_ATTENDANCE_LOCKED',
        'error', 'Absensi hari ini telah dicatat manual oleh owner. Hubungi owner untuk koreksi.'
      );
    END IF;
    RETURN jsonb_build_object('success', false, 'code', 'ALREADY_CHECKED_IN', 'error', 'Anda sudah melakukan check-in hari ini');
  END;

  UPDATE public.qr_session SET is_active = false WHERE id = v_qr.id;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Check-in berhasil',
    'status', v_status,
    'telat_menit', v_telat
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.save_manual_attendance(
  p_actor_id integer,
  p_rows jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_item jsonb;
  v_today date := timezone('Asia/Jakarta', clock_timestamp())::date;
  v_employee_id integer;
  v_status varchar(20);
  v_entry_source varchar(10);
  v_jam_masuk_text text;
  v_jam_pulang_text text;
  v_jam_masuk time;
  v_jam_pulang time;
  v_telat integer;
  v_catatan text;
  v_existing public.absensi%ROWTYPE;
  v_saved_id bigint;
  v_count integer := 0;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.pengguna
    WHERE id = p_actor_id AND aktif = true AND level IN ('OWNER', 'DEV')
  ) THEN
    RAISE EXCEPTION 'Hanya owner yang dapat mencatat absensi manual';
  END IF;

  IF p_rows IS NULL OR jsonb_typeof(p_rows) <> 'array' OR jsonb_array_length(p_rows) = 0 THEN
    RAISE EXCEPTION 'Tidak ada perubahan absensi untuk disimpan';
  END IF;

  IF jsonb_array_length(p_rows) > 500 THEN
    RAISE EXCEPTION 'Jumlah perubahan absensi terlalu banyak';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(p_rows) AS row_item
    GROUP BY row_item->>'id_pengguna'
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Pegawai yang sama tidak boleh dikirim lebih dari sekali';
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_rows)
  LOOP
    IF COALESCE(v_item->>'id_pengguna', '') !~ '^[0-9]+$' THEN
      RAISE EXCEPTION 'ID pegawai tidak valid';
    END IF;

    v_employee_id := (v_item->>'id_pengguna')::integer;
    v_status := upper(btrim(COALESCE(v_item->>'status', '')));
    v_entry_source := upper(btrim(COALESCE(v_item->>'sumber', 'MANUAL')));
    v_jam_masuk_text := NULLIF(btrim(COALESCE(v_item->>'jam_masuk', '')), '');
    v_jam_pulang_text := NULLIF(btrim(COALESCE(v_item->>'jam_pulang', '')), '');
    v_catatan := NULLIF(left(btrim(COALESCE(v_item->>'catatan_manual', '')), 500), '');

    IF v_entry_source <> 'MANUAL' THEN
      RAISE EXCEPTION 'Sumber absensi manual tidak valid';
    END IF;

    IF v_status NOT IN ('HADIR', 'TELAT', 'TIDAK_HADIR') THEN
      RAISE EXCEPTION 'Status absensi manual tidak valid';
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM public.jadwal_karyawan jk
      JOIN public.jadwal_mingguan jm ON jm.id = jk.id_jadwal_mingguan
      WHERE jk.id_pengguna = v_employee_id
        AND jk.tanggal = v_today
        AND jk.tipe_jadwal IN ('PAGI', 'SORE', 'FULL')
        AND jm.status = 'TERBIT'
    ) THEN
      RAISE EXCEPTION 'Pegawai tidak memiliki jadwal kerja terbit hari ini';
    END IF;

    IF v_status = 'TIDAK_HADIR' THEN
      v_jam_masuk := NULL;
      v_jam_pulang := NULL;
      v_telat := 0;
    ELSE
      IF v_jam_masuk_text IS NULL OR v_jam_masuk_text !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' THEN
        RAISE EXCEPTION 'Jam masuk wajib diisi dengan format HH:mm';
      END IF;
      v_jam_masuk := v_jam_masuk_text::time;

      IF v_jam_pulang_text IS NOT NULL THEN
        IF v_jam_pulang_text !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' THEN
          RAISE EXCEPTION 'Jam pulang harus menggunakan format HH:mm';
        END IF;
        v_jam_pulang := v_jam_pulang_text::time;
        IF v_jam_pulang < v_jam_masuk THEN
          RAISE EXCEPTION 'Jam pulang tidak boleh lebih awal dari jam masuk';
        END IF;
      ELSE
        v_jam_pulang := NULL;
      END IF;

      IF v_status = 'TELAT' THEN
        IF COALESCE(v_item->>'telat_menit', '') !~ '^[0-9]+$' THEN
          RAISE EXCEPTION 'Menit terlambat wajib berupa angka';
        END IF;
        v_telat := (v_item->>'telat_menit')::integer;
        IF v_telat < 1 THEN
          RAISE EXCEPTION 'Menit terlambat minimal 1 menit';
        END IF;
      ELSE
        v_telat := 0;
      END IF;
    END IF;

    SELECT * INTO v_existing
    FROM public.absensi
    WHERE id_pengguna = v_employee_id AND tanggal = v_today
    FOR UPDATE;

    IF FOUND AND v_existing.sumber = 'QR' THEN
      RAISE EXCEPTION 'Absensi QR tidak dapat diubah dari halaman absen manual';
    END IF;

    v_saved_id := NULL;
    INSERT INTO public.absensi (
      id_pengguna, tanggal, jam_masuk, jam_pulang, status, telat_menit,
      device_info, sumber, dicatat_oleh, catatan_manual, updated_at
    ) VALUES (
      v_employee_id,
      v_today,
      CASE WHEN v_jam_masuk IS NULL THEN NULL ELSE v_today + v_jam_masuk END,
      CASE WHEN v_jam_pulang IS NULL THEN NULL ELSE v_today + v_jam_pulang END,
      v_status,
      v_telat,
      NULL,
      'MANUAL',
      p_actor_id,
      v_catatan,
      now()
    )
    ON CONFLICT (id_pengguna, tanggal) DO UPDATE
    SET jam_masuk = EXCLUDED.jam_masuk,
        jam_pulang = EXCLUDED.jam_pulang,
        status = EXCLUDED.status,
        telat_menit = EXCLUDED.telat_menit,
        device_info = NULL,
        sumber = 'MANUAL',
        dicatat_oleh = EXCLUDED.dicatat_oleh,
        catatan_manual = EXCLUDED.catatan_manual,
        updated_at = now()
    WHERE public.absensi.sumber = 'MANUAL'
    RETURNING id INTO v_saved_id;

    IF v_saved_id IS NULL THEN
      RAISE EXCEPTION 'Absensi QR tidak dapat diubah dari halaman absen manual';
    END IF;

    v_count := v_count + 1;
  END LOOP;

  RETURN jsonb_build_object('success', true, 'count', v_count, 'tanggal', v_today);
END;
$$;

COMMENT ON TABLE public.shift_kerja IS 'Definisi shift kerja Pagi, Sore, dan Full untuk jadwal karyawan.';

COMMIT;
