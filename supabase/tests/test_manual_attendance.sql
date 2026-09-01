BEGIN;

INSERT INTO public.pengguna (username, password, level, aktif, nama)
VALUES
  ('test_manual_owner', 'test-only', 'OWNER', true, 'Owner Test Manual'),
  ('test_manual_employee', 'test-only', 'KARYAWAN', true, 'Pegawai Manual'),
  ('test_qr_employee', 'test-only', 'KARYAWAN', true, 'Pegawai QR');

INSERT INTO public.jadwal_mingguan (
  minggu_mulai, kebutuhan_pagi, kebutuhan_sore, status, created_by, updated_by
)
VALUES (
  date_trunc('week', timezone('Asia/Jakarta', now()))::date,
  1,
  1,
  'TERBIT',
  (SELECT id FROM public.pengguna WHERE username = 'test_manual_owner'),
  (SELECT id FROM public.pengguna WHERE username = 'test_manual_owner')
)
ON CONFLICT (minggu_mulai) DO UPDATE SET status = 'TERBIT';

INSERT INTO public.jadwal_karyawan (
  id_jadwal_mingguan, tanggal, id_pengguna, tipe_jadwal, id_shift
)
SELECT
  jm.id,
  timezone('Asia/Jakarta', now())::date,
  p.id,
  'PAGI',
  sk.id
FROM public.jadwal_mingguan jm
CROSS JOIN public.pengguna p
CROSS JOIN public.shift_kerja sk
WHERE jm.minggu_mulai = date_trunc('week', timezone('Asia/Jakarta', now()))::date
  AND p.username IN ('test_manual_employee', 'test_qr_employee')
  AND sk.kode = 'PAGI';

SET LOCAL ROLE service_role;

DO $$
DECLARE
  v_result jsonb;
BEGIN
  SELECT public.save_manual_attendance(
    (SELECT id FROM public.pengguna WHERE username = 'test_manual_owner'),
    jsonb_build_array(jsonb_build_object(
      'id_pengguna', (SELECT id FROM public.pengguna WHERE username = 'test_manual_employee'),
      'status', 'TELAT',
      'jam_masuk', '08:15',
      'jam_pulang', NULL,
      'telat_menit', 15,
      'catatan_manual', 'Kendala pemindaian QR',
      'sumber', 'MANUAL'
    ))
  ) INTO v_result;

  IF COALESCE((v_result->>'success')::boolean, false) IS NOT TRUE THEN
    RAISE EXCEPTION 'Simpan manual seharusnya berhasil: %', v_result;
  END IF;
END;
$$;

INSERT INTO public.qr_session (token, expired_at, is_active, created_by)
VALUES (
  'test-manual-lock-token',
  now() + interval '5 minutes',
  true,
  (SELECT id FROM public.pengguna WHERE username = 'test_manual_owner')
), (
  'test-qr-checkin-token',
  now() + interval '5 minutes',
  true,
  (SELECT id FROM public.pengguna WHERE username = 'test_manual_owner')
);

DO $$
DECLARE
  v_result jsonb;
BEGIN
  SELECT public.process_attendance_checkin(
    'test-manual-lock-token',
    (SELECT id FROM public.pengguna WHERE username = 'test_manual_employee'),
    'test',
    10,
    '09:00'
  ) INTO v_result;

  IF v_result->>'code' <> 'MANUAL_ATTENDANCE_LOCKED' THEN
    RAISE EXCEPTION 'QR harus ditolak untuk absensi manual: %', v_result;
  END IF;

  SELECT public.process_attendance_checkin(
    'test-qr-checkin-token',
    (SELECT id FROM public.pengguna WHERE username = 'test_qr_employee'),
    'test',
    10,
    '09:00'
  ) INTO v_result;

  IF COALESCE((v_result->>'success')::boolean, false) IS NOT TRUE THEN
    RAISE EXCEPTION 'Check-in QR seharusnya berhasil: %', v_result;
  END IF;
END;
$$;

DO $$
BEGIN
  BEGIN
    PERFORM public.save_manual_attendance(
      (SELECT id FROM public.pengguna WHERE username = 'test_manual_owner'),
      jsonb_build_array(jsonb_build_object(
        'id_pengguna', (SELECT id FROM public.pengguna WHERE username = 'test_qr_employee'),
        'status', 'HADIR',
        'jam_masuk', '08:00',
        'telat_menit', 0,
        'sumber', 'MANUAL'
      ))
    );
    RAISE EXCEPTION 'Absensi QR seharusnya tidak dapat ditimpa manual';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%Absensi QR tidak dapat diubah%' THEN
      RAISE;
    END IF;
  END;
END;
$$;

RESET ROLE;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"email":"test_manual_employee@sobats.com"}', true);

DO $$
DECLARE
  v_count integer;
BEGIN
  SELECT count(*) INTO v_count FROM public.absensi;
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'Pegawai hanya boleh membaca absensinya sendiri, hasil %', v_count;
  END IF;

  BEGIN
    UPDATE public.absensi SET status = 'HADIR';
    RAISE EXCEPTION 'Pegawai seharusnya tidak dapat mengubah absensi langsung';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;
END;
$$;

RESET ROLE;
DO $$ BEGIN RAISE NOTICE 'Semua pemeriksaan absensi manual lulus'; END $$;
ROLLBACK;
