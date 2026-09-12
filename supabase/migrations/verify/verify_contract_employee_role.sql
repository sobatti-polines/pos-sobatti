BEGIN;

DO $$
DECLARE
  v_week date := DATE '2099-01-05';
  v_schedule_id bigint;
  v_shift_id bigint;
  v_employee_id integer;
  v_regular_ids integer[] := ARRAY[]::integer[];
  v_legacy_contract_id integer;
  v_contract_id integer;
  v_legacy_request_id bigint;
  v_move_rejected boolean := false;
  v_booking_rejected boolean := false;
  v_full_rejected boolean := false;
BEGIN
  SELECT id INTO v_shift_id FROM public.shift_kerja WHERE kode = 'PAGI';
  IF v_shift_id IS NULL THEN
    RAISE EXCEPTION 'Data shift PAGI tidak ditemukan';
  END IF;

  FOR i IN 1..7 LOOP
    INSERT INTO public.pengguna (username, password, level, aktif, nama)
    VALUES ('__verify_contract_regular_' || i, 'auth-managed', 'KARYAWAN', true, 'Verifikasi Reguler ' || i)
    RETURNING id INTO v_employee_id;
    v_regular_ids := array_append(v_regular_ids, v_employee_id);
  END LOOP;

  INSERT INTO public.pengguna (username, password, level, aktif, nama)
  VALUES ('__verify_contract_legacy', 'auth-managed', 'KARYAWAN', true, 'Verifikasi Kontrak Lama')
  RETURNING id INTO v_legacy_contract_id;

  INSERT INTO public.pengguna (username, password, level, aktif, nama)
  VALUES ('__verify_contract_new', 'auth-managed', 'KONTRAK', true, 'Verifikasi Kontrak Baru')
  RETURNING id INTO v_contract_id;

  INSERT INTO public.jadwal_mingguan (minggu_mulai, kebutuhan_pagi, kebutuhan_sore, status)
  VALUES (v_week, 1, 1, 'DRAFT')
  RETURNING id INTO v_schedule_id;

  FOREACH v_employee_id IN ARRAY v_regular_ids || ARRAY[v_legacy_contract_id, v_contract_id]
  LOOP
    INSERT INTO public.jadwal_karyawan (
      id_jadwal_mingguan,
      tanggal,
      id_pengguna,
      tipe_jadwal,
      id_shift
    )
    SELECT v_schedule_id, v_week + day_offset, v_employee_id, 'PAGI', v_shift_id
    FROM generate_series(0, 6) AS day_offset;
  END LOOP;

  INSERT INTO public.permintaan_libur (id_jadwal_mingguan, id_pengguna, tanggal)
  VALUES (v_schedule_id, v_legacy_contract_id, v_week)
  RETURNING id INTO v_legacy_request_id;

  UPDATE public.pengguna SET level = 'KONTRAK' WHERE id = v_legacy_contract_id;

  BEGIN
    UPDATE public.permintaan_libur SET tanggal = v_week + 1 WHERE id = v_legacy_request_id;
  EXCEPTION WHEN OTHERS THEN
    IF position('Pegawai kontrak tidak dapat booking libur' IN SQLERRM) = 0 THEN
      RAISE;
    END IF;
    v_move_rejected := true;
  END;

  INSERT INTO public.permintaan_libur (id_jadwal_mingguan, id_pengguna, tanggal)
  VALUES (v_schedule_id, v_regular_ids[1], v_week);

  BEGIN
    INSERT INTO public.permintaan_libur (id_jadwal_mingguan, id_pengguna, tanggal)
    VALUES (v_schedule_id, v_regular_ids[2], v_week);
  EXCEPTION WHEN OTHERS THEN
    IF position('Slot libur pada tanggal ini sudah penuh' IN SQLERRM) = 0 THEN
      RAISE;
    END IF;
    v_full_rejected := true;
  END;

  BEGIN
    INSERT INTO public.permintaan_libur (id_jadwal_mingguan, id_pengguna, tanggal)
    VALUES (v_schedule_id, v_contract_id, v_week);
  EXCEPTION WHEN OTHERS THEN
    IF position('Pegawai kontrak tidak dapat booking libur' IN SQLERRM) = 0 THEN
      RAISE;
    END IF;
    v_booking_rejected := true;
  END;

  UPDATE public.permintaan_libur
  SET status = 'DISETUJUI'
  WHERE id = v_legacy_request_id;

  UPDATE public.jadwal_karyawan
  SET tipe_jadwal = 'LIBUR', id_shift = NULL
  WHERE id_jadwal_mingguan = v_schedule_id
    AND id_pengguna = v_contract_id
    AND tanggal = v_week;

  IF NOT v_move_rejected OR NOT v_booking_rejected OR NOT v_full_rejected THEN
    RAISE EXCEPTION 'Validasi booking pegawai kontrak tidak berjalan lengkap';
  END IF;

  IF (
    SELECT COUNT(*)
    FROM public.jadwal_karyawan
    WHERE id_jadwal_mingguan = v_schedule_id
      AND tanggal = v_week
      AND id_pengguna IN (v_legacy_contract_id, v_contract_id)
      AND tipe_jadwal = 'LIBUR'
  ) <> 2 THEN
    RAISE EXCEPTION 'Libur pegawai kontrak tidak dapat berimpit seperti yang diharapkan';
  END IF;

  RAISE NOTICE 'Verifikasi pegawai kontrak berhasil';
END;
$$;

ROLLBACK;
