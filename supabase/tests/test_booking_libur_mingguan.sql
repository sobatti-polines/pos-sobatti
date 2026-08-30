BEGIN;

INSERT INTO public.pengguna (username, password, level, aktif, nama)
SELECT
  'test_booking_' || nomor,
  'test-only',
  'KARYAWAN',
  true,
  'Pegawai Booking ' || nomor
FROM generate_series(1, 8) AS nomor;

INSERT INTO public.jadwal_mingguan (
  minggu_mulai, kebutuhan_pagi, kebutuhan_sore, status, created_by, updated_by
)
SELECT
  date_trunc('week', CURRENT_DATE)::date + 14,
  1,
  1,
  'DRAFT',
  (SELECT id FROM public.pengguna WHERE username = 'owner'),
  (SELECT id FROM public.pengguna WHERE username = 'owner');

INSERT INTO public.jadwal_karyawan (
  id_jadwal_mingguan, tanggal, id_pengguna, tipe_jadwal, id_shift
)
SELECT
  jm.id,
  jm.minggu_mulai + hari.nomor,
  p.id,
  'PAGI',
  sk.id
FROM public.jadwal_mingguan jm
CROSS JOIN generate_series(0, 6) AS hari(nomor)
CROSS JOIN public.pengguna p
CROSS JOIN public.shift_kerja sk
WHERE jm.minggu_mulai = date_trunc('week', CURRENT_DATE)::date + 14
  AND p.username LIKE 'test_booking_%'
  AND sk.kode = 'PAGI';

SET LOCAL ROLE authenticated;

SELECT set_config('request.jwt.claims', '{"email":"test_booking_1@sobats.com"}', true);
INSERT INTO public.permintaan_libur (id_jadwal_mingguan, id_pengguna, tanggal)
SELECT jm.id, p.id, jm.minggu_mulai
FROM public.jadwal_mingguan jm
JOIN public.pengguna p ON p.username = 'test_booking_1'
WHERE jm.minggu_mulai = date_trunc('week', CURRENT_DATE)::date + 14;

SELECT set_config('request.jwt.claims', '{"email":"test_booking_2@sobats.com"}', true);
INSERT INTO public.permintaan_libur (id_jadwal_mingguan, id_pengguna, tanggal)
SELECT jm.id, p.id, jm.minggu_mulai
FROM public.jadwal_mingguan jm
JOIN public.pengguna p ON p.username = 'test_booking_2'
WHERE jm.minggu_mulai = date_trunc('week', CURRENT_DATE)::date + 14;

SELECT set_config('request.jwt.claims', '{"email":"test_booking_3@sobats.com"}', true);
DO $$
BEGIN
  BEGIN
    INSERT INTO public.permintaan_libur (id_jadwal_mingguan, id_pengguna, tanggal)
    SELECT jm.id, p.id, jm.minggu_mulai
    FROM public.jadwal_mingguan jm
    JOIN public.pengguna p ON p.username = 'test_booking_3'
    WHERE jm.minggu_mulai = date_trunc('week', CURRENT_DATE)::date + 14;
    RAISE EXCEPTION 'Booking ketiga seharusnya ditolak untuk kapasitas dua';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'Slot libur pada tanggal ini sudah penuh' THEN
      RAISE;
    END IF;
  END;
END;
$$;

SELECT set_config('request.jwt.claims', '{"email":"test_booking_1@sobats.com"}', true);
UPDATE public.permintaan_libur pl
SET tanggal = jm.minggu_mulai + 1
FROM public.jadwal_mingguan jm
WHERE pl.id_jadwal_mingguan = jm.id
  AND pl.id_pengguna = (SELECT id FROM public.pengguna WHERE username = 'test_booking_1')
  AND pl.status = 'MENUNGGU';

SELECT set_config('request.jwt.claims', '{"email":"test_booking_3@sobats.com"}', true);
INSERT INTO public.permintaan_libur (id_jadwal_mingguan, id_pengguna, tanggal)
SELECT jm.id, p.id, jm.minggu_mulai
FROM public.jadwal_mingguan jm
JOIN public.pengguna p ON p.username = 'test_booking_3'
WHERE jm.minggu_mulai = date_trunc('week', CURRENT_DATE)::date + 14;

SELECT set_config('request.jwt.claims', '{"email":"owner@sobats.com"}', true);
UPDATE public.permintaan_libur
SET status = 'DISETUJUI'
WHERE id_pengguna = (SELECT id FROM public.pengguna WHERE username = 'test_booking_2')
  AND status = 'MENUNGGU';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.jadwal_karyawan jk
    JOIN public.pengguna p ON p.id = jk.id_pengguna
    WHERE p.username = 'test_booking_2'
      AND jk.tanggal = date_trunc('week', CURRENT_DATE)::date + 14
      AND jk.tipe_jadwal = 'LIBUR'
      AND jk.id_shift IS NULL
  ) THEN
    RAISE EXCEPTION 'ACC tidak mengubah shift menjadi LIBUR';
  END IF;
END;
$$;

UPDATE public.permintaan_libur
SET status = 'DITOLAK'
WHERE id_pengguna = (SELECT id FROM public.pengguna WHERE username = 'test_booking_2')
  AND status = 'DISETUJUI';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.jadwal_karyawan jk
    JOIN public.pengguna p ON p.id = jk.id_pengguna
    JOIN public.shift_kerja sk ON sk.id = jk.id_shift
    WHERE p.username = 'test_booking_2'
      AND jk.tanggal = date_trunc('week', CURRENT_DATE)::date + 14
      AND jk.tipe_jadwal = 'PAGI'
      AND sk.kode = 'PAGI'
  ) THEN
    RAISE EXCEPTION 'Batalkan ACC tidak mengembalikan shift awal';
  END IF;
END;
$$;

RESET ROLE;

DO $$
DECLARE
  v_capacity integer;
BEGIN
  SELECT GREATEST(1, CEIL(COUNT(DISTINCT id_pengguna) / 7.0)::integer)
    INTO v_capacity
  FROM public.jadwal_karyawan jk
  JOIN public.jadwal_mingguan jm ON jm.id = jk.id_jadwal_mingguan
  WHERE jm.minggu_mulai = date_trunc('week', CURRENT_DATE)::date + 14;

  IF v_capacity <> 2 THEN
    RAISE EXCEPTION 'Kapasitas 8 pegawai seharusnya 2, hasil %', v_capacity;
  END IF;

  RAISE NOTICE 'Semua pemeriksaan booking libur lulus';
END;
$$;

ROLLBACK;
