-- Fix sequences out of sync after manual data reset/re-import.
-- Data dimasukkan dengan ID eksplisit sehingga sequence tidak maju,
-- menyebabkan error 23505 (duplicate key) saat insert baru.
-- Jalankan via Supabase Dashboard → SQL Editor.

DO $$
DECLARE
    r record;
    seq_name text;
    max_id bigint;
BEGIN
    FOR r IN (
        SELECT table_name
        FROM information_schema.columns
        WHERE table_schema = 'public' AND column_name = 'id'
          AND data_type IN ('integer', 'bigint')
          AND table_name NOT IN ('transaksi_keluar', 'detail_transaksi_keluar')
    )
    LOOP
        seq_name := pg_get_serial_sequence('public.' || quote_ident(r.table_name), 'id');
        IF seq_name IS NOT NULL THEN
            EXECUTE format('SELECT COALESCE(MAX(id), 0) + 1 FROM public.%I', r.table_name) INTO max_id;
            PERFORM setval(seq_name, max_id, false);
            RAISE NOTICE 'Fixed % sequence to %', r.table_name, max_id;
        END IF;
    END LOOP;

    -- Khusus transaksi_keluar (no_transaksi bukan PK), hanya set id
    seq_name := pg_get_serial_sequence('public.transaksi_keluar', 'id');
    IF seq_name IS NOT NULL THEN
        EXECUTE 'SELECT COALESCE(MAX(id), 0) + 1 FROM public.transaksi_keluar' INTO max_id;
        PERFORM setval(seq_name, max_id, false);
        RAISE NOTICE 'Fixed transaksi_keluar sequence to %', max_id;
    END IF;
END $$;