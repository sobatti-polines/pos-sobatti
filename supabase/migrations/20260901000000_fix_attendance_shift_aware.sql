-- Fix: Use the SPECIFIC QR session that the employee scanned (v_qr.created_at)
-- as the "opening time" for late calculation, instead of min(created_at) of ALL
-- QR sessions created today.
--
-- Root cause: The old logic used min(created_at) which picks the FIRST QR of the
-- entire day. If owner creates QR at 07:38 (for morning) and another at 12:20
-- (for afternoon), the system still used 07:38 — making afternoon employees
-- appear 287 minutes late even when they checked in at 12:25.
--
-- New logic: Use the QR session that the employee actually scanned (v_qr).
-- Late = check-in time > v_qr.created_at + tolerance.

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
  v_qr_minutes integer;
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

  -- Use the QR session that the employee actually scanned as the reference.
  -- This way, if owner opens QR at 12:20, the late threshold is 12:30 —
  -- regardless of any other QR sessions created earlier that day.
  v_qr_minutes := extract(hour FROM timezone('Asia/Jakarta', v_qr.created_at))::integer * 60
    + extract(minute FROM timezone('Asia/Jakarta', v_qr.created_at))::integer;

  v_opening_minutes := v_qr_minutes;

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
