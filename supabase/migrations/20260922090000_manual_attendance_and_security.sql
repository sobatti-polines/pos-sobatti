-- Absensi manual owner dan penguatan alur QR.

ALTER TABLE public.absensi
  ADD COLUMN IF NOT EXISTS sumber varchar(10) NOT NULL DEFAULT 'QR',
  ADD COLUMN IF NOT EXISTS dicatat_oleh integer REFERENCES public.pengguna(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS catatan_manual text,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'absensi_sumber_check'
  ) THEN
    ALTER TABLE public.absensi
      ADD CONSTRAINT absensi_sumber_check CHECK (sumber IN ('QR', 'MANUAL'));
  END IF;
END;
$$;

COMMENT ON COLUMN public.absensi.sumber IS 'Sumber pencatatan absensi: QR atau MANUAL.';
COMMENT ON COLUMN public.absensi.dicatat_oleh IS 'Owner/DEV yang mencatat atau mengubah absensi manual.';
COMMENT ON COLUMN public.absensi.catatan_manual IS 'Catatan opsional dari owner untuk absensi manual.';

-- created_at lama menyimpan waktu UTC tanpa informasi zona waktu.
ALTER TABLE public.qr_session
  ALTER COLUMN created_at TYPE timestamptz
  USING created_at AT TIME ZONE 'UTC';
ALTER TABLE public.qr_session
  ALTER COLUMN created_at SET DEFAULT now();

CREATE OR REPLACE FUNCTION private.set_absensi_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_absensi_updated_at ON public.absensi;
CREATE TRIGGER trg_absensi_updated_at
BEFORE UPDATE ON public.absensi
FOR EACH ROW
EXECUTE FUNCTION private.set_absensi_updated_at();

CREATE OR REPLACE FUNCTION private.current_can_manage_attendance()
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
      AND p.level IN ('ADMIN', 'OWNER', 'DEV')
  );
$$;

REVOKE ALL ON FUNCTION private.current_can_manage_attendance() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.current_can_manage_attendance() TO authenticated;

-- Client hanya boleh membaca data yang memang menjadi haknya. Semua mutasi
-- berjalan melalui route/action server dengan service role.
DROP POLICY IF EXISTS "auth_all" ON public.absensi;
DROP POLICY IF EXISTS "absensi_select_self_or_owner" ON public.absensi;
REVOKE ALL ON TABLE public.absensi FROM anon, authenticated;
REVOKE ALL ON SEQUENCE public.absensi_id_seq FROM anon, authenticated;
GRANT SELECT ON TABLE public.absensi TO authenticated;

CREATE POLICY "absensi_select_self_or_owner"
ON public.absensi
FOR SELECT
TO authenticated
USING (
  id_pengguna = (SELECT private.current_pengguna_id())
  OR (SELECT private.current_can_manage_attendance())
);

DROP POLICY IF EXISTS "auth_all" ON public.qr_session;
REVOKE ALL ON TABLE public.qr_session FROM anon, authenticated;
REVOKE ALL ON SEQUENCE public.qr_session_id_seq FROM anon, authenticated;

-- Security invoker + hanya service_role: fungsi tersedia bagi server tanpa
-- memberi jalur mutasi baru kepada anon/authenticated.
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
  v_opened_at timestamptz;
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

  SELECT min(created_at) INTO v_opened_at
  FROM public.qr_session
  WHERE timezone('Asia/Jakarta', created_at)::date = v_today;

  IF v_opened_at IS NULL THEN
    v_opening_minutes := extract(hour FROM p_fallback_start)::integer * 60
      + extract(minute FROM p_fallback_start)::integer;
  ELSE
    v_opening_minutes := extract(hour FROM timezone('Asia/Jakarta', v_opened_at))::integer * 60
      + extract(minute FROM timezone('Asia/Jakarta', v_opened_at))::integer;
  END IF;

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

CREATE OR REPLACE FUNCTION public.process_attendance_checkout(
  p_token text,
  p_id_pengguna integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_qr public.qr_session%ROWTYPE;
  v_attendance public.absensi%ROWTYPE;
  v_now timestamptz := clock_timestamp();
  v_today date := timezone('Asia/Jakarta', v_now)::date;
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

  SELECT * INTO v_attendance
  FROM public.absensi
  WHERE id_pengguna = p_id_pengguna AND tanggal = v_today
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'code', 'NOT_CHECKED_IN', 'error', 'Anda belum melakukan check-in hari ini');
  END IF;

  IF v_attendance.sumber = 'MANUAL' THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'MANUAL_ATTENDANCE_LOCKED',
      'error', 'Absensi hari ini telah dicatat manual oleh owner. Hubungi owner untuk koreksi.'
    );
  END IF;

  IF v_attendance.jam_pulang IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'code', 'ALREADY_CHECKED_OUT', 'error', 'Anda sudah melakukan check-out hari ini');
  END IF;

  UPDATE public.absensi
  SET jam_pulang = timezone('Asia/Jakarta', v_now), updated_at = v_now
  WHERE id = v_attendance.id;

  UPDATE public.qr_session SET is_active = false WHERE id = v_qr.id;

  RETURN jsonb_build_object('success', true, 'message', 'Check-out berhasil');
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
        AND jk.tipe_jadwal IN ('PAGI', 'SORE')
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

REVOKE ALL ON FUNCTION public.process_attendance_checkin(text, integer, text, integer, time) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.process_attendance_checkout(text, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.save_manual_attendance(integer, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.process_attendance_checkin(text, integer, text, integer, time) TO service_role;
GRANT EXECUTE ON FUNCTION public.process_attendance_checkout(text, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.save_manual_attendance(integer, jsonb) TO service_role;
