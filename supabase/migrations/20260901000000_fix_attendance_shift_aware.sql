-- Fix: Use employee's shift schedule (jadwal_karyawan + shift_kerja) to determine
-- "opening time" for late calculation instead of the first QR session of the day.
--
-- Root cause: The old logic used a single global "opening time" (first QR created
-- by owner that day) for ALL employees. A SORE shift employee (jam_mulai 12:30)
-- checking in at 12:25 was marked TELAT because the first QR was created at ~07:38
-- for PAGI shift employees.
--
-- New logic: Look up the employee's scheduled shift for today. Use the shift's
-- jam_mulai as the opening time. Fall back to first QR / env fallback only if
-- no published schedule exists for the employee today.

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
  v_shift_start_minutes integer;
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

  -- Priority 1: Use the employee's scheduled shift start time for today.
  -- This ensures each employee is compared against their own shift, not a
  -- global "opening time" based on the first QR session.
  SELECT (extract(hour FROM sk.jam_mulai)::integer * 60
        + extract(minute FROM sk.jam_mulai)::integer)
    INTO v_shift_start_minutes
  FROM public.jadwal_karyawan jk
  JOIN public.jadwal_mingguan jm ON jm.id = jk.id_jadwal_mingguan
  JOIN public.shift_kerja sk ON sk.id = jk.id_shift
  WHERE jk.id_pengguna = p_id_pengguna
    AND jk.tanggal = v_today
    AND jk.tipe_jadwal IN ('PAGI', 'SORE')
    AND jm.status = 'TERBIT'
  LIMIT 1;

  IF v_shift_start_minutes IS NOT NULL THEN
    v_opening_minutes := v_shift_start_minutes;
  ELSE
    -- Priority 2 (fallback): No published schedule for this employee today.
    -- Use the first QR session created today (legacy behavior).
    SELECT min(created_at) INTO v_opened_at
    FROM public.qr_session
    WHERE timezone('Asia/Jakarta', created_at)::date = v_today;

    IF v_opened_at IS NULL THEN
      -- Priority 3 (last resort): Use env fallback start time.
      v_opening_minutes := extract(hour FROM p_fallback_start)::integer * 60
        + extract(minute FROM p_fallback_start)::integer;
    ELSE
      v_opening_minutes := extract(hour FROM timezone('Asia/Jakarta', v_opened_at))::integer * 60
        + extract(minute FROM timezone('Asia/Jakarta', v_opened_at))::integer;
    END IF;
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
