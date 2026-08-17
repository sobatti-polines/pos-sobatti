


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE OR REPLACE FUNCTION "public"."batalkan_sesi_stok_opname"("p_id_sesi" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_sesi RECORD;
BEGIN
  SELECT * INTO v_sesi FROM sesi_stok_opname WHERE id = p_id_sesi;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Sesi opname tidak ditemukan');
  END IF;

  IF v_sesi.status != 'DRAFT' THEN
    RETURN jsonb_build_object('error', 'Hanya sesi DRAFT yang bisa dibatalkan');
  END IF;

  UPDATE sesi_stok_opname SET status = 'DIBATALKAN' WHERE id = p_id_sesi;
  DELETE FROM stok_opname WHERE id_sesi = p_id_sesi;

  RETURN jsonb_build_object('success', true);
END;
$$;


ALTER FUNCTION "public"."batalkan_sesi_stok_opname"("p_id_sesi" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."cancel_barang_masuk"("p_id_barang_masuk" bigint, "p_id_pengguna" bigint, "p_alasan" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_bm RECORD;
  v_produk RECORD;
  v_base_qty      NUMERIC;
  v_per_piece     NUMERIC;
  v_total_sebelum NUMERIC;
  v_total_sesudah NUMERIC;
  v_new_nilai     NUMERIC;
  v_new_avco      NUMERIC;
  v_avco_sebelum  NUMERIC;
  v_qty_keluar    NUMERIC;
BEGIN
  PERFORM pg_advisory_xact_lock(987654322);

  SELECT * INTO v_bm
  FROM barang_masuk
  WHERE id = p_id_barang_masuk
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Barang masuk tidak ditemukan');
  END IF;

  IF v_bm.status = 'DIVOID' THEN
    RETURN jsonb_build_object('error', 'Barang masuk ini sudah di-void');
  END IF;

  SELECT * INTO v_produk
  FROM produk
  WHERE id = v_bm.id_produk
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Produk tidak ditemukan');
  END IF;

  v_base_qty  := COALESCE(v_bm.base_qty_added, v_bm.jumlah, 0);
  v_per_piece := COALESCE(v_bm.base_cost_per_piece, v_bm.harga_beli, 0);

  v_total_sebelum := COALESCE(v_produk.stok, 0) + COALESCE(v_produk.stok_gudang, 0);
  v_avco_sebelum  := COALESCE(v_produk.harga_pokok_avco, 0);
  v_qty_keluar    := v_base_qty;
  v_total_sesudah := v_total_sebelum - v_base_qty;

  IF v_total_sesudah <= 0 THEN
    v_new_avco := 0;
  ELSE
    v_new_avco := ((v_total_sebelum * v_avco_sebelum) - (v_base_qty * v_per_piece)) / v_total_sesudah;
    IF v_new_avco < 0 THEN
      v_new_avco := 0;
    END IF;
  END IF;

  v_new_nilai := v_total_sesudah * v_new_avco;

  UPDATE produk
  SET stok_gudang      = GREATEST(COALESCE(v_produk.stok_gudang, 0) - v_base_qty, 0),
      harga_pokok_avco = v_new_avco,
      nilai_persediaan = v_new_nilai,
      harga_modal      = CASE WHEN COALESCE(harga_modal, 0) = 0 THEN v_new_avco ELSE harga_modal END,
      updated_at       = now()
  WHERE id = v_produk.id;

  INSERT INTO riwayat_avco (
    id_produk, jenis_mutasi, id_referensi,
    qty_masuk, qty_keluar, harga_satuan_transaksi,
    stok_sebelum, avco_sebelum,
    stok_sesudah, avco_sesudah, nilai_persediaan_sesudah
  ) VALUES (
    v_produk.id, 'retur_beli', v_bm.id,
    NULL, v_qty_keluar, v_per_piece,
    v_total_sebelum, v_avco_sebelum,
    v_total_sesudah, v_new_avco, v_new_nilai
  );

  UPDATE barang_masuk
  SET status      = 'DIVOID',
      voided_at   = now(),
      voided_by   = p_id_pengguna,
      alasan_void = p_alasan
  WHERE id = v_bm.id;

  RETURN jsonb_build_object('success', true, 'id', v_bm.id);
END;
$$;


ALTER FUNCTION "public"."cancel_barang_masuk"("p_id_barang_masuk" bigint, "p_id_pengguna" bigint, "p_alasan" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."cek_overlap_event_promo"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    v_tanggal_mulai date;
    v_tanggal_selesai date;
BEGIN
    SELECT tanggal_mulai, tanggal_selesai INTO v_tanggal_mulai, v_tanggal_selesai
    FROM event_promo WHERE id = NEW.id_event_promo;

    IF EXISTS (
        SELECT 1 FROM event_promo_produk epp
        JOIN event_promo ep ON ep.id = epp.id_event_promo
        WHERE epp.id_produk = NEW.id_produk
          AND epp.id_event_promo != NEW.id_event_promo
          AND ep.aktif = true
          AND (v_tanggal_mulai <= ep.tanggal_selesai AND v_tanggal_selesai >= ep.tanggal_mulai)
    ) THEN
        RAISE EXCEPTION 'Produk ini sudah terdaftar di event promo lain yang aktif pada tanggal yang sama';
    END IF;
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."cek_overlap_event_promo"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_hitung_selisih_opname"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.selisih := NEW.stok_fisik - NEW.stok_sistem;
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."fn_hitung_selisih_opname"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."generate_no_transaksi"() RETURNS bigint
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_prefix text;
  v_last   bigint;
  v_seq    int;
  v_result bigint;
BEGIN
  -- Acquire an advisory lock so only one call runs at a time
  PERFORM pg_advisory_xact_lock(12345678);

  v_prefix := to_char(now() AT TIME ZONE 'Asia/Jakarta', 'YYYYMM');

  SELECT COALESCE(MAX(no_transaksi), 0) INTO v_last
  FROM transaksi_keluar
  WHERE no_transaksi::text LIKE v_prefix || '%';

  IF v_last = 0 THEN
    v_seq := 1;
  ELSE
    v_seq := (v_last % 10000)::int + 1;
  END IF;

  v_result := (v_prefix || lpad(v_seq::text, 4, '0'))::bigint;
  RETURN v_result;
END;
$$;


ALTER FUNCTION "public"."generate_no_transaksi"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_harga_efektif_produk"("p_id_produk" integer, "p_tanggal" "date" DEFAULT CURRENT_DATE) RETURNS TABLE("harga_jual_satuan" numeric, "harga_jual_grosir" numeric, "harga_jual_promo" numeric, "harga_jual_besar_satuan" numeric, "harga_jual_besar_grosir" numeric, "harga_jual_besar_promo" numeric, "id_event_promo" "uuid", "nama_event" character varying)
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    v_tipe text;
    v_nilai numeric;
    v_id_event uuid;
    v_nama varchar;
    v_prod record;
BEGIN
    -- Ambil event aktif
    SELECT ep.id, ep.nama, ep.tipe_diskon, ep.nilai_diskon
    INTO v_id_event, v_nama, v_tipe, v_nilai
    FROM event_promo_produk epp
    JOIN event_promo ep ON ep.id = epp.id_event_promo
    WHERE epp.id_produk = p_id_produk
      AND ep.aktif = true
      AND p_tanggal BETWEEN ep.tanggal_mulai AND ep.tanggal_selesai
    LIMIT 1;

    -- Ambil harga asli produk
    SELECT p.harga_jual_satuan, p.harga_jual_grosir, p.harga_jual_promo,
           p.harga_jual_besar_satuan, p.harga_jual_besar_grosir, p.harga_jual_besar_promo
    INTO v_prod
    FROM produk p
    WHERE p.id = p_id_produk;

    IF FOUND AND v_id_event IS NOT NULL THEN
        IF v_tipe = 'persen' THEN
            harga_jual_satuan := GREATEST(v_prod.harga_jual_satuan * (1 - v_nilai/100), 0);
            harga_jual_grosir := GREATEST(v_prod.harga_jual_grosir * (1 - v_nilai/100), 0);
            harga_jual_promo := GREATEST(v_prod.harga_jual_promo * (1 - v_nilai/100), 0);
            harga_jual_besar_satuan := GREATEST(v_prod.harga_jual_besar_satuan * (1 - v_nilai/100), 0);
            harga_jual_besar_grosir := GREATEST(v_prod.harga_jual_besar_grosir * (1 - v_nilai/100), 0);
            harga_jual_besar_promo := GREATEST(v_prod.harga_jual_besar_promo * (1 - v_nilai/100), 0);
        ELSE
            harga_jual_satuan := GREATEST(v_prod.harga_jual_satuan - v_nilai, 0);
            harga_jual_grosir := GREATEST(v_prod.harga_jual_grosir - v_nilai, 0);
            harga_jual_promo := GREATEST(v_prod.harga_jual_promo - v_nilai, 0);
            harga_jual_besar_satuan := GREATEST(v_prod.harga_jual_besar_satuan - v_nilai, 0);
            harga_jual_besar_grosir := GREATEST(v_prod.harga_jual_besar_grosir - v_nilai, 0);
            harga_jual_besar_promo := GREATEST(v_prod.harga_jual_besar_promo - v_nilai, 0);
        END IF;
        id_event_promo := v_id_event;
        nama_event := v_nama;
    ELSE
        harga_jual_satuan := v_prod.harga_jual_satuan;
        harga_jual_grosir := v_prod.harga_jual_grosir;
        harga_jual_promo := v_prod.harga_jual_promo;
        harga_jual_besar_satuan := v_prod.harga_jual_besar_satuan;
        harga_jual_besar_grosir := v_prod.harga_jual_besar_grosir;
        harga_jual_besar_promo := v_prod.harga_jual_besar_promo;
        id_event_promo := NULL;
        nama_event := NULL;
    END IF;
    RETURN NEXT;
END;
$$;


ALTER FUNCTION "public"."get_harga_efektif_produk"("p_id_produk" integer, "p_tanggal" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_inventory_value_at_date"("p_date" "date") RETURNS numeric
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_total NUMERIC;
BEGIN
  -- Ambil nilai persediaan terakhir untuk setiap produk pada atau sebelum tanggal tersebut
  SELECT SUM(nilai_persediaan_sesudah) INTO v_total
  FROM (
    SELECT DISTINCT ON (id_produk) nilai_persediaan_sesudah
    FROM riwayat_avco
    WHERE tanggal <= (p_date + interval '1 day') -- Mengcover seluruh hari pada p_date
    ORDER BY id_produk, tanggal DESC
  ) AS latest_values;
  
  RETURN COALESCE(v_total, 0);
END;
$$;


ALTER FUNCTION "public"."get_inventory_value_at_date"("p_date" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."guard_produk_paket"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  IF NEW.id_produk_master IS NOT NULL THEN
    IF NEW.id_produk_master = NEW.id THEN
      RAISE EXCEPTION 'Produk tidak boleh menjadi master dirinya sendiri';
    END IF;

    IF EXISTS (SELECT 1 FROM produk WHERE id = NEW.id_produk_master AND id_produk_master IS NOT NULL) THEN
      RAISE EXCEPTION 'Master tidak boleh berupa produk paket';
    END IF;

    IF NEW.qty_per_unit IS NULL OR NEW.qty_per_unit <= 0 THEN
      RAISE EXCEPTION 'qty_per_unit wajib diisi dan lebih dari 0 untuk produk paket';
    END IF;

    IF NEW.jenis_isi_paket IS NULL THEN
      RAISE EXCEPTION 'Jenis isi paket wajib dipilih (FIXED_RATIO atau ACTUAL_WEIGHT)';
    END IF;

    IF NOT NEW.hitung_stok THEN
      RAISE EXCEPTION 'Produk paket wajib hitung_stok = true';
    END IF;
  ELSE
    IF NEW.qty_per_unit IS NOT NULL THEN
      RAISE EXCEPTION 'qty_per_unit hanya boleh diisi untuk produk paket';
    END IF;
    IF NEW.jenis_isi_paket IS NOT NULL THEN
      RAISE EXCEPTION 'jenis_isi_paket hanya boleh diisi untuk produk paket';
    END IF;
    IF NEW.isi_satuan IS NOT NULL THEN
      RAISE EXCEPTION 'isi_satuan hanya boleh diisi untuk produk paket';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."guard_produk_paket"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."process_barang_masuk"("p_items" "jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_item JSONB;
  v_barang_masuk_id INTEGER;
  v_prod RECORD;
  v_total_stok NUMERIC;
  v_nilai_sekarang NUMERIC;
  v_nilai_masuk NUMERIC;
  v_new_avco NUMERIC;
  v_new_nilai_persediaan NUMERIC;
  v_new_stok_gudang NUMERIC;

  -- UoM conversion vars
  v_is_uom           BOOLEAN;
  v_conversion_ratio NUMERIC;
  v_supplied_qty     NUMERIC;
  v_supplied_unit    VARCHAR;
  v_base_qty         NUMERIC;
  v_total_cost       NUMERIC;
  v_per_piece_cost   NUMERIC;

  v_results JSONB[] := '{}';
BEGIN
  PERFORM pg_advisory_xact_lock(987654322);

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_is_uom := (v_item ? 'supplied_qty') AND (v_item->>'supplied_qty') IS NOT NULL;

    SELECT stok, stok_gudang, harga_pokok_avco, nilai_persediaan,
           COALESCE(conversion_ratio, 1) AS conversion_ratio,
           hitung_stok INTO v_prod
    FROM produk
    WHERE id = (v_item->>'id_produk')::integer
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Produk dengan ID % tidak ditemukan', (v_item->>'id_produk')::integer;
    END IF;

    -- Guard hitung_stok: tolak produk non-tracked (jasa/paket master)
    IF NOT COALESCE(v_prod.hitung_stok, true) THEN
      RAISE EXCEPTION 'Produk dengan ID % tidak terhitung stoknya — barang masuk ditolak', (v_item->>'id_produk')::integer;
    END IF;

    IF v_is_uom THEN
      v_supplied_qty     := (v_item->>'supplied_qty')::numeric;
      v_supplied_unit    := v_item->>'supplied_unit';
      v_conversion_ratio := v_prod.conversion_ratio;
      v_total_cost       := (v_item->>'total_cost')::numeric;

      v_base_qty := v_supplied_qty * v_conversion_ratio;

      IF v_base_qty > 0 THEN
        v_per_piece_cost := v_total_cost / v_base_qty;
      ELSE
        v_per_piece_cost := 0;
      END IF;

      INSERT INTO barang_masuk (
        tgl_masuk, id_supplier, id_produk,
        harga_beli, jumlah, total,
        supplied_unit, supplied_qty, applied_conversion_ratio,
        base_qty_added, total_cost, base_cost_per_piece,
        keterangan, no_surat
      ) VALUES (
        (v_item->>'tgl_masuk')::date,
        (v_item->>'id_supplier')::integer,
        (v_item->>'id_produk')::integer,
        v_per_piece_cost,
        v_base_qty,
        v_total_cost,
        v_supplied_unit,
        v_supplied_qty,
        v_conversion_ratio,
        v_base_qty,
        v_total_cost,
        v_per_piece_cost,
        NULLIF(v_item->>'keterangan', ''),
        NULLIF(v_item->>'no_surat', '')
      )
      RETURNING id INTO v_barang_masuk_id;

      v_nilai_masuk    := v_total_cost;
      v_new_stok_gudang := COALESCE(v_prod.stok_gudang, 0) + v_base_qty;

      IF (COALESCE(v_prod.stok, 0) + COALESCE(v_prod.stok_gudang, 0) + v_base_qty) > 0 THEN
        v_new_avco := (
          ((COALESCE(v_prod.stok, 0) + COALESCE(v_prod.stok_gudang, 0)) * COALESCE(v_prod.harga_pokok_avco, 0))
          + v_total_cost
        ) / (COALESCE(v_prod.stok, 0) + COALESCE(v_prod.stok_gudang, 0) + v_base_qty);
      ELSE
        v_new_avco := 0;
      END IF;

      v_new_nilai_persediaan := (COALESCE(v_prod.stok, 0) + v_new_stok_gudang) * v_new_avco;

    ELSE
      INSERT INTO barang_masuk (
        tgl_masuk, id_supplier, id_produk, harga_beli, jumlah, total, keterangan
      ) VALUES (
        (v_item->>'tgl_masuk')::date,
        (v_item->>'id_supplier')::integer,
        (v_item->>'id_produk')::integer,
        (v_item->>'harga_beli')::numeric,
        (v_item->>'jumlah')::numeric,
        (v_item->>'total')::numeric,
        NULLIF(v_item->>'keterangan', '')
      )
      RETURNING id INTO v_barang_masuk_id;

      v_total_stok     := COALESCE(v_prod.stok, 0) + COALESCE(v_prod.stok_gudang, 0);
      v_nilai_masuk    := (v_item->>'jumlah')::numeric * (v_item->>'harga_beli')::numeric;
      v_new_stok_gudang := COALESCE(v_prod.stok_gudang, 0) + (v_item->>'jumlah')::numeric;

      IF (v_total_stok + (v_item->>'jumlah')::numeric) > 0 THEN
        v_new_avco := (
          (v_total_stok * COALESCE(v_prod.harga_pokok_avco, 0))
          + v_nilai_masuk
        ) / (v_total_stok + (v_item->>'jumlah')::numeric);
      ELSE
        v_new_avco := 0;
      END IF;

      v_new_nilai_persediaan := (v_total_stok + (v_item->>'jumlah')::numeric) * v_new_avco;
    END IF;

    INSERT INTO riwayat_avco (
      id_produk, jenis_mutasi, id_referensi,
      qty_masuk, harga_satuan_transaksi,
      stok_sebelum, avco_sebelum,
      stok_sesudah, avco_sesudah, nilai_persediaan_sesudah
    ) VALUES (
      (v_item->>'id_produk')::integer,
      'pembelian',
      v_barang_masuk_id,
      COALESCE(v_base_qty, (v_item->>'jumlah')::numeric),
      CASE WHEN v_is_uom THEN v_per_piece_cost ELSE (v_item->>'harga_beli')::numeric END,
      COALESCE(v_prod.stok, 0) + COALESCE(v_prod.stok_gudang, 0),
      COALESCE(v_prod.harga_pokok_avco, 0),
      COALESCE(v_prod.stok, 0) + v_new_stok_gudang,
      v_new_avco,
      v_new_nilai_persediaan
    );

    UPDATE produk
    SET
      stok_gudang      = v_new_stok_gudang,
      harga_pokok_avco = v_new_avco,
      nilai_persediaan = v_new_nilai_persediaan,
      harga_modal      = CASE WHEN COALESCE(harga_modal, 0) = 0 THEN v_new_avco ELSE harga_modal END,
      updated_at       = now()
    WHERE id = (v_item->>'id_produk')::integer;

    v_results := v_results || jsonb_build_object(
      'id',         v_barang_masuk_id,
      'id_produk',  (v_item->>'id_produk')::integer,
      'jumlah',     COALESCE(v_base_qty, (v_item->>'jumlah')::numeric),
      'harga_beli', CASE WHEN v_is_uom THEN v_per_piece_cost ELSE (v_item->>'harga_beli')::numeric END
    );
  END LOOP;

  RETURN jsonb_build_object(
    'success',  true,
    'inserted', to_jsonb(v_results)
  );
END;
$$;


ALTER FUNCTION "public"."process_barang_masuk"("p_items" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."process_checkout"("p_items" "jsonb", "p_id_kasir" integer, "p_id_pelanggan" integer DEFAULT NULL::integer, "p_id_metode_bayar" integer DEFAULT NULL::integer, "p_diskon_persen" numeric DEFAULT 0, "p_bayar" numeric DEFAULT 0, "p_pajak_persen" numeric DEFAULT 0, "p_is_dp" boolean DEFAULT false) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_prefix         text;
  v_last           bigint;
  v_seq            int;
  v_no_transaksi   bigint;
  v_item           jsonb;
  v_subtotal       numeric := 0;
  v_jumlah         numeric;
  v_harga_jual     numeric;
  v_diskon_item    numeric;
  v_profit         numeric;
  v_diskon_nominal numeric;
  v_pajak_nominal  numeric;
  v_total          numeric;
  v_kembali        numeric;
  v_dp             numeric;
  v_sisa           numeric;
  v_tx_id          integer;
  v_details        jsonb[] := '{}';
  v_prod           record;
  v_harga_efektif  record;
  v_type_harga     text;
  v_total_hpp            numeric := 0;
  v_laba_kotor           numeric := 0;
  v_harga_pokok_satuan   numeric;
  v_total_harga_pokok    numeric;
  v_qty                  numeric;
  v_qty_satuan           numeric;
  v_satuan_jual          text;
  v_jual_ratio_snapshot  numeric;
  v_stok_total_sebelum   numeric;
  v_stok_total_sesudah   numeric;
  v_new_stok             numeric;
  v_new_stok_gudang      numeric;
BEGIN
  PERFORM pg_advisory_xact_lock(987654321);

  v_prefix := to_char(now() AT TIME ZONE 'Asia/Jakarta', 'YYYYMM');

  SELECT COALESCE(MAX(no_transaksi), 0) INTO v_last
  FROM transaksi_keluar
  WHERE no_transaksi::text LIKE v_prefix || '%';

  IF v_last = 0 THEN
    v_seq := 1;
  ELSE
    v_seq := (v_last % 10000)::int + 1;
  END IF;

  v_no_transaksi := (v_prefix || lpad(v_seq::text, 4, '0'))::bigint;

  -- === PASS 1: Validasi stok & hitung subtotal ===
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    SELECT id, nama_produk, harga_modal,
           harga_jual_satuan, harga_jual_grosir, harga_jual_promo,
           harga_jual_besar_satuan, harga_jual_besar_grosir, harga_jual_besar_promo,
           hitung_stok, stok, stok_gudang, harga_pokok_avco, nilai_persediaan,
           jual_satuan, conversion_ratio
    INTO v_prod
    FROM produk
    WHERE id = (v_item->>'id_produk')::integer;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Produk dengan ID % tidak ditemukan', (v_item->>'id_produk')::integer;
    END IF;

    SELECT * INTO v_harga_efektif FROM get_harga_efektif_produk(v_prod.id, current_date);

    v_type_harga     := upper(COALESCE(v_item->>'type_harga_jual', 'SATUAN'));
    v_diskon_item    := COALESCE((v_item->>'diskon_item')::numeric, 0);
    v_satuan_jual    := NULLIF(TRIM(COALESCE(v_item->>'satuan_jual', '')), '');

    v_qty_satuan := (v_item->>'qty_satuan')::numeric;

    IF v_qty_satuan IS NULL OR v_qty_satuan <= 0 THEN
      v_qty_satuan := (v_item->>'qty')::numeric;
    END IF;

    IF v_qty_satuan <= 0 THEN
      RAISE EXCEPTION 'Qty tidak valid untuk produk "%"', v_prod.nama_produk;
    END IF;

    IF v_satuan_jual IS NOT NULL AND v_prod.jual_satuan IS NOT NULL
       AND UPPER(v_satuan_jual) = UPPER(v_prod.jual_satuan)
    THEN
      v_jual_ratio_snapshot := COALESCE(v_prod.conversion_ratio, 1);
      v_qty := v_qty_satuan * v_jual_ratio_snapshot;
    ELSE
      v_jual_ratio_snapshot := 1;
      v_qty_satuan := v_qty;
      v_qty := (v_item->>'qty')::numeric;
      IF v_qty IS NULL OR v_qty <= 0 THEN
        v_qty := v_qty_satuan;
      END IF;
      v_qty_satuan := v_qty;
      v_satuan_jual := NULL;
    END IF;

    IF v_qty <= 0 THEN
      RAISE EXCEPTION 'Qty tidak valid untuk produk "%"', v_prod.nama_produk;
    END IF;

    IF v_prod.hitung_stok THEN
      IF v_qty > COALESCE(v_prod.stok, 0) + COALESCE(v_prod.stok_gudang, 0) THEN
        RAISE EXCEPTION 'Stok tidak mencukupi untuk produk "%" (tersedia %, diminta %)',
          v_prod.nama_produk,
          COALESCE(v_prod.stok, 0) + COALESCE(v_prod.stok_gudang, 0),
          v_qty;
      END IF;
    END IF;

    IF v_satuan_jual IS NOT NULL AND UPPER(v_satuan_jual) = UPPER(v_prod.jual_satuan) THEN
      v_harga_jual := COALESCE(v_harga_efektif.harga_jual_besar_satuan, 0);
      IF v_type_harga = 'GROSIR' AND v_harga_efektif.harga_jual_besar_grosir IS NOT NULL THEN
        v_harga_jual := v_harga_efektif.harga_jual_besar_grosir;
      END IF;
      IF v_type_harga = 'PROMO' AND v_harga_efektif.harga_jual_besar_promo IS NOT NULL THEN
        v_harga_jual := v_harga_efektif.harga_jual_besar_promo;
      END IF;
    ELSE
      v_harga_jual := v_harga_efektif.harga_jual_satuan;
      IF v_type_harga = 'GROSIR' THEN v_harga_jual := v_harga_efektif.harga_jual_grosir; END IF;
      IF v_type_harga = 'PROMO' AND v_harga_efektif.harga_jual_promo IS NOT NULL THEN
        v_harga_jual := v_harga_efektif.harga_jual_promo;
      END IF;
    END IF;

    v_jumlah  := (v_harga_jual - v_diskon_item) * v_qty_satuan;

    v_harga_pokok_satuan := COALESCE(NULLIF(v_prod.harga_pokok_avco, 0), v_prod.harga_modal);
    v_total_harga_pokok  := v_harga_pokok_satuan * v_qty;

    v_total_hpp    := v_total_hpp + v_total_harga_pokok;
    v_profit       := v_jumlah - v_total_harga_pokok;
    v_laba_kotor   := v_laba_kotor + v_profit;
    v_subtotal     := v_subtotal + v_jumlah;

    v_details := v_details || jsonb_build_object(
      'id_produk',      v_prod.id,
      'type_harga_jual', v_type_harga,
      'harga_modal',    v_prod.harga_modal,
      'harga_jual',     v_harga_jual,
      'diskon_item',    v_diskon_item,
      'qty',            v_qty,
      'qty_satuan',     v_qty_satuan,
      'satuan_jual',    v_satuan_jual,
      'jual_ratio',     v_jual_ratio_snapshot,
      'jumlah',         v_jumlah,
      'kas_masuk',      v_jumlah,
      'profit',         v_profit,
      'harga_pokok_satuan', v_harga_pokok_satuan,
      'total_harga_pokok',  v_total_harga_pokok
    );
  END LOOP;

  v_diskon_nominal := ROUND(v_subtotal * (p_diskon_persen / 100));
  v_pajak_nominal  := ROUND((v_subtotal - v_diskon_nominal) * (p_pajak_persen / 100));
  v_total          := v_subtotal - v_diskon_nominal + v_pajak_nominal;
  v_kembali        := GREATEST(0, p_bayar - v_total);
  v_dp             := CASE WHEN p_is_dp THEN p_bayar ELSE 0 END;
  v_sisa           := CASE WHEN p_bayar < v_total THEN v_total - p_bayar ELSE 0 END;

  IF v_sisa > 0 AND p_id_pelanggan IS NULL THEN
    RAISE EXCEPTION 'Pelanggan harus dipilih untuk transaksi kredit/DP';
  END IF;

  INSERT INTO transaksi_keluar (
    no_transaksi, tgl_transaksi, id_kasir, id_pelanggan, id_metode_bayar,
    subtotal, diskon_persen, diskon_nominal, pajak_persen, pajak_nominal,
    total, bayar, kembali, dp, sisa, total_hpp, laba_kotor
  ) VALUES (
    v_no_transaksi, now(), p_id_kasir, p_id_pelanggan, p_id_metode_bayar,
    v_subtotal, p_diskon_persen, v_diskon_nominal, p_pajak_persen, v_pajak_nominal,
    v_total, p_bayar, v_kembali, v_dp, v_sisa, v_total_hpp, v_laba_kotor
  )
  RETURNING id INTO v_tx_id;

  INSERT INTO detail_transaksi_keluar (
    id_transaksi, id_produk, type_harga_jual, harga_modal, harga_jual,
    diskon_item, qty, satuan_jual, qty_satuan, jual_ratio,
    jumlah, kas_masuk, profit, harga_pokok_satuan, total_harga_pokok
  )
  SELECT
    v_tx_id,
    (d->>'id_produk')::integer,
    d->>'type_harga_jual',
    (d->>'harga_modal')::numeric,
    (d->>'harga_jual')::numeric,
    (d->>'diskon_item')::numeric,
    (d->>'qty')::numeric,
    d->>'satuan_jual',
    (d->>'qty_satuan')::integer,
    (d->>'jual_ratio')::numeric,
    (d->>'jumlah')::numeric,
    (d->>'kas_masuk')::numeric,
    (d->>'profit')::numeric,
    (d->>'harga_pokok_satuan')::numeric,
    (d->>'total_harga_pokok')::numeric
  FROM unnest(v_details) AS d;

  -- === PASS 2: Kurangi stok (display dulu, lalu gudang) + catat AVCO ===
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    SELECT stok, stok_gudang, harga_pokok_avco, nilai_persediaan
    INTO v_prod
    FROM produk
    WHERE id = (v_item->>'id_produk')::integer AND hitung_stok = true;

    IF FOUND THEN
      v_qty := (v_item->>'qty')::numeric;

      v_stok_total_sebelum := COALESCE(v_prod.stok, 0) + COALESCE(v_prod.stok_gudang, 0);
      v_stok_total_sesudah := v_stok_total_sebelum - v_qty;

      v_new_stok := GREATEST(COALESCE(v_prod.stok, 0) - v_qty, 0);
      v_new_stok_gudang := COALESCE(v_prod.stok_gudang, 0)
        - (v_qty - (COALESCE(v_prod.stok, 0) - v_new_stok));

      INSERT INTO riwayat_avco (
        id_produk, jenis_mutasi, id_referensi, qty_keluar,
        harga_satuan_transaksi, stok_sebelum, avco_sebelum,
        stok_sesudah, avco_sesudah, nilai_persediaan_sesudah
      ) VALUES (
        (v_item->>'id_produk')::integer,
        'penjualan',
        v_tx_id,
        v_qty,
        v_prod.harga_pokok_avco,
        v_stok_total_sebelum,
        v_prod.harga_pokok_avco,
        v_stok_total_sesudah,
        v_prod.harga_pokok_avco,
        v_stok_total_sesudah * v_prod.harga_pokok_avco
      );

      UPDATE produk
      SET stok = v_new_stok,
          stok_gudang = v_new_stok_gudang,
          nilai_persediaan = v_stok_total_sesudah * harga_pokok_avco
      WHERE id = (v_item->>'id_produk')::integer;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'success',       true,
    'id',            v_tx_id,
    'no_transaksi',  v_no_transaksi,
    'total',         v_total,
    'kembali',       v_kembali
  );
END;
$$;


ALTER FUNCTION "public"."process_checkout"("p_items" "jsonb", "p_id_kasir" integer, "p_id_pelanggan" integer, "p_id_metode_bayar" integer, "p_diskon_persen" numeric, "p_bayar" numeric, "p_pajak_persen" numeric, "p_is_dp" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."process_isi_stok_paket"("p_id_paket" integer, "p_qty_paket" numeric) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_paket RECORD;
  v_master RECORD;
  v_qty_total NUMERIC;
  v_display_taken NUMERIC;
  v_gudang_taken NUMERIC;
  v_qty_per_unit NUMERIC;
  v_error_text TEXT;
BEGIN
  PERFORM pg_advisory_xact_lock(987654325);

  IF p_qty_paket IS NULL OR p_qty_paket <= 0 THEN
    RETURN jsonb_build_object('error', 'Jumlah paket harus lebih dari 0');
  END IF;

  SELECT * INTO v_paket FROM produk WHERE id = p_id_paket;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Produk paket tidak ditemukan');
  END IF;

  IF v_paket.id_produk_master IS NULL THEN
    RETURN jsonb_build_object('error', 'Produk bukan produk paket');
  END IF;

  v_qty_per_unit := v_paket.qty_per_unit;
  v_qty_total := p_qty_paket * v_qty_per_unit;

  SELECT * INTO v_master FROM produk WHERE id = v_paket.id_produk_master;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Produk master tidak ditemukan');
  END IF;

  IF COALESCE(v_master.stok, 0) + COALESCE(v_master.stok_gudang, 0) < v_qty_total THEN
    v_error_text := format(
      'Stok master tidak mencukupi. Diperlukan %s satuan (%s paket x %s), tersedia %s',
      v_qty_total, p_qty_paket, v_qty_per_unit,
      COALESCE(v_master.stok, 0) + COALESCE(v_master.stok_gudang, 0)
    );
    RETURN jsonb_build_object('error', v_error_text);
  END IF;

  -- Master dikurangi dari gudang dulu, baru display (Pilihan A)
  v_gudang_taken := LEAST(COALESCE(v_master.stok_gudang, 0), v_qty_total);
  v_display_taken := v_qty_total - v_gudang_taken;

  UPDATE produk SET stok_gudang = COALESCE(stok_gudang, 0) - v_gudang_taken WHERE id = v_master.id;
  IF v_display_taken > 0 THEN
    UPDATE produk SET stok = COALESCE(stok, 0) - v_display_taken WHERE id = v_master.id;
  END IF;

  -- Stok paket ditambah ke GUDANG (bukan display)
  UPDATE produk SET stok_gudang = COALESCE(stok_gudang, 0) + p_qty_paket WHERE id = v_paket.id;

  RETURN jsonb_build_object(
    'success', true,
    'paket_stok_gudang_baru', COALESCE(v_paket.stok_gudang, 0) + p_qty_paket,
    'paket_stok_display_baru', COALESCE(v_paket.stok, 0),
    'master_gudang_taken', v_gudang_taken,
    'master_display_taken', v_display_taken
  );
END;
$$;


ALTER FUNCTION "public"."process_isi_stok_paket"("p_id_paket" integer, "p_qty_paket" numeric) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."process_isi_stok_paket"("p_id_paket" integer, "p_qty_paket" numeric, "p_total_berat" numeric DEFAULT NULL::numeric) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_paket RECORD;
  v_master RECORD;
  v_qty_total NUMERIC;
  v_display_taken NUMERIC;
  v_gudang_taken NUMERIC;
  v_qty_per_unit NUMERIC;
  v_error_text TEXT;
  v_master_harga_pokok NUMERIC;
  v_nilai_masuk NUMERIC;
  v_avco_baru NUMERIC;
  v_nilai_paket_baru NUMERIC;
BEGIN
  PERFORM pg_advisory_xact_lock(987654325);

  IF p_qty_paket IS NULL OR p_qty_paket <= 0 THEN
    RETURN jsonb_build_object('error', 'Jumlah paket harus lebih dari 0');
  END IF;

  SELECT * INTO v_paket FROM produk WHERE id = p_id_paket;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Produk paket tidak ditemukan');
  END IF;

  IF v_paket.id_produk_master IS NULL THEN
    RETURN jsonb_build_object('error', 'Produk bukan produk paket');
  END IF;

  v_qty_per_unit := v_paket.qty_per_unit;

  -- Tentukan qty total berdasarkan jenis isi paket
  IF v_paket.jenis_isi_paket = 'ACTUAL_WEIGHT' THEN
    IF p_total_berat IS NULL OR p_total_berat <= 0 THEN
      RETURN jsonb_build_object('error', 'Total berat harus lebih dari 0 untuk paket tipe ACTUAL_WEIGHT');
    END IF;
    v_qty_total := p_total_berat;
  ELSE
    -- FIXED_RATIO (default)
    v_qty_total := p_qty_paket * v_qty_per_unit;
  END IF;

  SELECT * INTO v_master FROM produk WHERE id = v_paket.id_produk_master;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Produk master tidak ditemukan');
  END IF;

  IF COALESCE(v_master.stok, 0) + COALESCE(v_master.stok_gudang, 0) < v_qty_total THEN
    IF v_paket.jenis_isi_paket = 'ACTUAL_WEIGHT' THEN
      v_error_text := format(
        'Stok master tidak mencukupi. Diperlukan %s satuan, tersedia %s',
        v_qty_total,
        COALESCE(v_master.stok, 0) + COALESCE(v_master.stok_gudang, 0)
      );
    ELSE
      v_error_text := format(
        'Stok master tidak mencukupi. Diperlukan %s satuan (%s paket x %s), tersedia %s',
        v_qty_total, p_qty_paket, v_qty_per_unit,
        COALESCE(v_master.stok, 0) + COALESCE(v_master.stok_gudang, 0)
      );
    END IF;
    RETURN jsonb_build_object('error', v_error_text);
  END IF;

  -- Kurangi master dari gudang dulu, baru display (Pilihan A)
  v_gudang_taken := LEAST(COALESCE(v_master.stok_gudang, 0), v_qty_total);
  v_display_taken := v_qty_total - v_gudang_taken;

  UPDATE produk SET stok_gudang = COALESCE(stok_gudang, 0) - v_gudang_taken WHERE id = v_master.id;
  IF v_display_taken > 0 THEN
    UPDATE produk SET stok = COALESCE(stok, 0) - v_display_taken WHERE id = v_master.id;
  END IF;

  -- Update nilai_persediaan master (kurangi proporsional)
  v_master_harga_pokok := COALESCE(v_master.harga_pokok_avco, v_master.harga_modal, 0);
  IF COALESCE(v_master.nilai_persediaan, 0) > 0 AND (COALESCE(v_master.stok, 0) + COALESCE(v_master.stok_gudang, 0)) > 0 THEN
    v_master_harga_pokok := v_master.nilai_persediaan / (COALESCE(v_master.stok, 0) + COALESCE(v_master.stok_gudang, 0));
  END IF;
  v_nilai_masuk := v_qty_total * v_master_harga_pokok;

  UPDATE produk SET
    nilai_persediaan = GREATEST(COALESCE(nilai_persediaan, 0) - v_nilai_masuk, 0)
  WHERE id = v_master.id;

  -- Stok paket ditambah ke GUDANG
  UPDATE produk SET stok_gudang = COALESCE(stok_gudang, 0) + p_qty_paket WHERE id = v_paket.id;

  -- Untuk ACTUAL_WEIGHT: update AVCO paket (rata-rata berat)
  IF v_paket.jenis_isi_paket = 'ACTUAL_WEIGHT' THEN
    v_avco_baru := v_qty_total * v_master_harga_pokok / p_qty_paket;
    v_nilai_paket_baru := COALESCE(v_paket.stok_gudang, 0) * COALESCE(v_paket.harga_pokok_avco, 0)
                         + p_qty_paket * v_avco_baru;

    UPDATE produk SET
      harga_pokok_avco = v_avco_baru,
      nilai_persediaan = v_nilai_paket_baru
    WHERE id = v_paket.id;

    -- Catat riwayat AVCO paket
    INSERT INTO riwayat_avco (
      id_produk, jenis_mutasi, qty_masuk,
      harga_satuan_transaksi,
      stok_sebelum, avco_sebelum,
      stok_sesudah, avco_sesudah,
      nilai_persediaan_sesudah
    ) VALUES (
      v_paket.id, 'pembelian', p_qty_paket,
      v_avco_baru,
      COALESCE(v_paket.stok_gudang, 0) - p_qty_paket, COALESCE(v_paket.harga_pokok_avco, 0),
      COALESCE(v_paket.stok_gudang, 0), v_avco_baru,
      v_nilai_paket_baru
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'jenis_isi_paket', v_paket.jenis_isi_paket,
    'paket_stok_gudang_baru', COALESCE(v_paket.stok_gudang, 0) + p_qty_paket,
    'paket_stok_display_baru', COALESCE(v_paket.stok, 0),
    'master_gudang_taken', v_gudang_taken,
    'master_display_taken', v_display_taken,
    'total_master_kurang', v_qty_total,
    'harga_pokok_per_paket', CASE WHEN v_paket.jenis_isi_paket = 'ACTUAL_WEIGHT' THEN v_avco_baru ELSE NULL END
  );
END;
$$;


ALTER FUNCTION "public"."process_isi_stok_paket"("p_id_paket" integer, "p_qty_paket" numeric, "p_total_berat" numeric) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."process_retur_pembelian"("p_id_barang_masuk" bigint, "p_id_pengguna" bigint, "p_items" "jsonb", "p_keterangan" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_bm  RECORD;
  v_item JSONB;
  v_produk RECORD;
  v_retur_id UUID;
  v_no_retur TEXT;
  v_tgl_wib DATE;
  v_count   INT;
  v_total   NUMERIC := 0;
  v_qty     NUMERIC;
  v_hpp     NUMERIC;
  v_avco_sebelum NUMERIC;
  v_total_stok_sebelum NUMERIC;
  v_new_avco NUMERIC;
  v_new_nilai NUMERIC;
BEGIN
  PERFORM pg_advisory_xact_lock(987654322);

  -- Tanggal retur mengikuti WIB (Asia/Jakarta), bukan UTC server
  v_tgl_wib := (now() AT TIME ZONE 'Asia/Jakarta')::date;

  SELECT * INTO v_bm
  FROM barang_masuk
  WHERE id = p_id_barang_masuk
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Barang masuk tidak ditemukan');
  END IF;

  IF v_bm.status = 'DIVOID' THEN
    RETURN jsonb_build_object('error', 'Barang masuk sudah dibatalkan — tidak bisa dibuat retur');
  END IF;

  IF p_items IS NULL OR jsonb_typeof(p_items) != 'array' OR jsonb_array_length(p_items) = 0 THEN
    RETURN jsonb_build_object('error', 'Item retur tidak boleh kosong');
  END IF;

  -- Pass 1: validasi semua item sebelum menulis apapun (hindari header parsial)
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    SELECT * INTO v_produk
    FROM produk
    WHERE id = (v_item->>'id_produk')::BIGINT
    FOR UPDATE;

    IF NOT FOUND THEN
      RETURN jsonb_build_object('error', 'Produk tidak ditemukan');
    END IF;

    v_qty := (v_item->>'qty_retur')::NUMERIC;

    IF v_qty <= 0 THEN
      RETURN jsonb_build_object('error', 'Qty retur harus lebih dari 0 untuk produk: ' || v_produk.nama_produk);
    END IF;

    IF COALESCE(v_produk.stok_gudang, 0) < v_qty THEN
      RETURN jsonb_build_object('error', 'Stok gudang tidak mencukupi untuk produk: ' || v_produk.nama_produk);
    END IF;
  END LOOP;

  -- no_retur: RB-YYYYMMDD-NN (urutan per hari WIB)
  SELECT COALESCE(count(*), 0) + 1 INTO v_count
  FROM retur_pembelian
  WHERE tgl_retur = v_tgl_wib;

  v_no_retur := 'RB-' || to_char(v_tgl_wib, 'YYYYMMDD') || '-' || lpad(v_count::text, 2, '0');

  INSERT INTO retur_pembelian (
    no_retur, tgl_retur, id_barang_masuk, id_supplier, id_pengguna, keterangan
  ) VALUES (
    v_no_retur, v_tgl_wib, v_bm.id, v_bm.id_supplier, p_id_pengguna, p_keterangan
  )
  RETURNING id INTO v_retur_id;

  -- Pass 2: proses tiap item — reverse AVCO, update stok gudang, catat detail & riwayat
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    SELECT * INTO v_produk
    FROM produk
    WHERE id = (v_item->>'id_produk')::BIGINT
    FOR UPDATE;

    v_qty := (v_item->>'qty_retur')::NUMERIC;
    v_hpp := COALESCE(v_produk.harga_pokok_avco, v_produk.harga_modal, 0);

    v_total_stok_sebelum := COALESCE(v_produk.stok, 0) + COALESCE(v_produk.stok_gudang, 0);
    v_avco_sebelum       := COALESCE(v_produk.harga_pokok_avco, 0);

    IF (v_total_stok_sebelum - v_qty) <= 0 THEN
      v_new_avco := 0;
    ELSE
      v_new_avco := ((v_total_stok_sebelum * v_avco_sebelum) - (v_qty * v_hpp)) / (v_total_stok_sebelum - v_qty);
      IF v_new_avco < 0 THEN
        v_new_avco := 0;
      END IF;
    END IF;

    v_new_nilai := (v_total_stok_sebelum - v_qty) * v_new_avco;

    UPDATE produk
    SET stok_gudang      = GREATEST(COALESCE(v_produk.stok_gudang, 0) - v_qty, 0),
        harga_pokok_avco = v_new_avco,
        nilai_persediaan = v_new_nilai,
        harga_modal      = CASE WHEN COALESCE(harga_modal, 0) = 0 THEN v_new_avco ELSE harga_modal END,
        updated_at       = now()
    WHERE id = v_produk.id;

    INSERT INTO detail_retur_pembelian (
      id_retur, id_produk, qty_retur, harga_pokok, jumlah, keterangan
    ) VALUES (
      v_retur_id, v_produk.id, v_qty, v_hpp, v_qty * v_hpp, v_item->>'keterangan'
    );

    INSERT INTO riwayat_avco (
      id_produk, jenis_mutasi, id_referensi, id_referensi_uuid,
      qty_masuk, qty_keluar, harga_satuan_transaksi,
      stok_sebelum, avco_sebelum,
      stok_sesudah, avco_sesudah, nilai_persediaan_sesudah
    ) VALUES (
      v_produk.id, 'retur_beli', NULL, v_retur_id,
      NULL, v_qty, v_hpp,
      v_total_stok_sebelum, v_avco_sebelum,
      v_total_stok_sebelum - v_qty, v_new_avco, v_new_nilai
    );

    v_total := v_total + (v_qty * v_hpp);
  END LOOP;

  UPDATE retur_pembelian
  SET total_nilai = v_total
  WHERE id = v_retur_id;

  RETURN jsonb_build_object('success', true, 'no_retur', v_no_retur, 'id', v_retur_id);
END;
$$;


ALTER FUNCTION "public"."process_retur_pembelian"("p_id_barang_masuk" bigint, "p_id_pengguna" bigint, "p_items" "jsonb", "p_keterangan" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."process_stock_opname"("p_items" "jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_item JSONB;
  v_opname_id INTEGER;
  v_prod RECORD;
  v_selisih NUMERIC;
  v_total_stok_sebelum NUMERIC;
  v_total_stok_sesudah NUMERIC;
  v_new_nilai_persediaan NUMERIC;
  v_qty_masuk NUMERIC;
  v_qty_keluar NUMERIC;
  v_results JSONB[] := '{}';
BEGIN
  -- Serialise concurrent stock opname calls (lock ID 987654323)
  PERFORM pg_advisory_xact_lock(987654323);

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    -- Lock and read current product row
    SELECT id, stok, stok_gudang, harga_pokok_avco, nilai_persediaan
    INTO v_prod
    FROM produk
    WHERE id = (v_item->>'id_produk')::integer
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Produk dengan ID % tidak ditemukan', (v_item->>'id_produk')::integer;
    END IF;

    -- Calculate values
    v_selisih := (v_item->>'stok_fisik')::numeric - COALESCE(v_prod.stok, 0);
    v_total_stok_sebelum := COALESCE(v_prod.stok, 0) + COALESCE(v_prod.stok_gudang, 0);
    v_total_stok_sesudah := (v_item->>'stok_fisik')::numeric + COALESCE(v_prod.stok_gudang, 0);
    v_new_nilai_persediaan := v_total_stok_sesudah * COALESCE(v_prod.harga_pokok_avco, 0);

    -- Determine qty_masuk/qty_keluar for AVCO history
    IF v_selisih > 0 THEN
      v_qty_masuk := v_selisih;
      v_qty_keluar := NULL;
    ELSIF v_selisih < 0 THEN
      v_qty_masuk := NULL;
      v_qty_keluar := ABS(v_selisih);
    ELSE
      v_qty_masuk := NULL;
      v_qty_keluar := NULL;
    END IF;

    -- Insert into stok_opname
    INSERT INTO stok_opname (
      tgl_opname, id_produk, stok_sistem, stok_fisik, selisih, keterangan
    ) VALUES (
      (v_item->>'tgl_opname')::date,
      (v_item->>'id_produk')::integer,
      COALESCE(v_prod.stok, 0),
      (v_item->>'stok_fisik')::numeric,
      v_selisih,
      NULLIF(v_item->>'keterangan', '')
    )
    RETURNING id INTO v_opname_id;

    -- Insert AVCO history only if there's a difference
    IF v_selisih != 0 THEN
      INSERT INTO riwayat_avco (
        id_produk, jenis_mutasi, id_referensi,
        qty_masuk, qty_keluar, harga_satuan_transaksi,
        stok_sebelum, avco_sebelum,
        stok_sesudah, avco_sesudah, nilai_persediaan_sesudah
      ) VALUES (
        (v_item->>'id_produk')::integer,
        'koreksi',
        v_opname_id,
        v_qty_masuk,
        v_qty_keluar,
        COALESCE(v_prod.harga_pokok_avco, 0),
        v_total_stok_sebelum,
        COALESCE(v_prod.harga_pokok_avco, 0),
        v_total_stok_sesudah,
        COALESCE(v_prod.harga_pokok_avco, 0),
        v_new_nilai_persediaan
      );
    END IF;

    -- Update product display stock and nilai_persediaan
    UPDATE produk
    SET
      stok = (v_item->>'stok_fisik')::numeric,
      nilai_persediaan = v_new_nilai_persediaan,
      updated_at = now()
    WHERE id = (v_item->>'id_produk')::integer;

    -- Collect result
    v_results := v_results || jsonb_build_object(
      'id',        v_opname_id,
      'id_produk', (v_item->>'id_produk')::integer,
      'selisih',   v_selisih
    );
  END LOOP;

  RETURN jsonb_build_object(
    'success',  true,
    'inserted', to_jsonb(v_results)
  );
END;
$$;


ALTER FUNCTION "public"."process_stock_opname"("p_items" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."process_stok_opname_apply"("p_id_sesi" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_sesi RECORD;
  v_item RECORD;
  v_selisih NUMERIC;
  v_total_stok_sebelum NUMERIC;
  v_total_stok_sesudah NUMERIC;
  v_new_nilai NUMERIC;
  v_qty_masuk NUMERIC;
  v_qty_keluar NUMERIC;
  v_total_item INT := 0;
  v_total_selisih NUMERIC := 0;
  v_total_nilai NUMERIC := 0;
BEGIN
  PERFORM pg_advisory_xact_lock(987654323);

  SELECT * INTO v_sesi FROM sesi_stok_opname WHERE id = p_id_sesi;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Sesi opname tidak ditemukan');
  END IF;

  IF v_sesi.status != 'DRAFT' THEN
    RETURN jsonb_build_object('error', 'Sesi ini sudah diproses atau dibatalkan (status: ' || v_sesi.status || ')');
  END IF;

  FOR v_item IN
    SELECT so.*, p.stok, p.stok_gudang, p.harga_pokok_avco, p.nilai_persediaan
    FROM stok_opname so
    JOIN produk p ON p.id = so.id_produk
    WHERE so.id_sesi = p_id_sesi
    FOR UPDATE OF so, p
  LOOP
    v_selisih := COALESCE(v_item.stok_fisik, 0) - COALESCE(v_item.stok_sistem, 0);

    v_total_stok_sebelum := COALESCE(v_item.stok, 0) + COALESCE(v_item.stok_gudang, 0);
    v_total_stok_sesudah := COALESCE(v_item.stok_fisik, 0) + COALESCE(v_item.stok_gudang, 0);

    -- Update stok display = stok_fisik
    UPDATE produk
    SET stok = COALESCE(v_item.stok_fisik, 0),
        updated_at = now()
    WHERE id = v_item.id_produk;

    -- Hitung nilai_persediaan baru
    v_new_nilai := v_total_stok_sesudah * COALESCE(v_item.harga_pokok_snap, v_item.harga_pokok_avco, 0);

    UPDATE produk
    SET nilai_persediaan = v_new_nilai
    WHERE id = v_item.id_produk;

    -- Catat riwayat AVCO jika ada selisih
    IF v_selisih != 0 THEN
      IF v_selisih > 0 THEN
        v_qty_masuk := v_selisih;
        v_qty_keluar := NULL;
      ELSE
        v_qty_masuk := NULL;
        v_qty_keluar := ABS(v_selisih);
      END IF;

      INSERT INTO riwayat_avco (
        id_produk, jenis_mutasi, id_referensi,
        qty_masuk, qty_keluar, harga_satuan_transaksi,
        stok_sebelum, avco_sebelum,
        stok_sesudah, avco_sesudah, nilai_persediaan_sesudah
      ) VALUES (
        v_item.id_produk,
        'koreksi',
        v_item.id,
        v_qty_masuk,
        v_qty_keluar,
        COALESCE(v_item.harga_pokok_snap, v_item.harga_pokok_avco, 0),
        v_total_stok_sebelum,
        COALESCE(v_item.harga_pokok_avco, 0),
        v_total_stok_sesudah,
        COALESCE(v_item.harga_pokok_avco, 0),
        v_new_nilai
      );

      UPDATE stok_opname SET selisih = v_selisih WHERE id = v_item.id;
    END IF;

    v_total_item := v_total_item + 1;
    v_total_selisih := v_total_selisih + v_selisih;
    v_total_nilai := v_total_nilai + (v_selisih * COALESCE(v_item.harga_pokok_snap, v_item.harga_pokok_avco, 0));
  END LOOP;

  UPDATE sesi_stok_opname
  SET status = 'SELESAI',
      applied_at = now(),
      total_item = v_total_item,
      total_selisih = v_total_selisih,
      total_nilai = v_total_nilai
  WHERE id = p_id_sesi;

  RETURN jsonb_build_object(
    'success', true,
    'total_item', v_total_item,
    'total_selisih', v_total_selisih,
    'total_nilai', v_total_nilai
  );
END;
$$;


ALTER FUNCTION "public"."process_stok_opname_apply"("p_id_sesi" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rls_auto_enable"() RETURNS "event_trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog'
    AS $$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$$;


ALTER FUNCTION "public"."rls_auto_enable"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."tambah_log_aktivitas"("p_id_pengguna" integer, "p_aksi" "text", "p_entitas" "text", "p_id_entitas" integer DEFAULT NULL::integer, "p_deskripsi" "text" DEFAULT ''::"text", "p_data_lama" "jsonb" DEFAULT NULL::"jsonb", "p_data_baru" "jsonb" DEFAULT NULL::"jsonb", "p_ip_address" "text" DEFAULT NULL::"text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO log_aktivitas (
    id_pengguna, aksi, entitas, id_entitas,
    deskripsi, data_lama, data_baru, ip_address
  ) VALUES (
    p_id_pengguna, p_aksi, p_entitas, p_id_entitas,
    p_deskripsi, p_data_lama, p_data_baru, p_ip_address
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;


ALTER FUNCTION "public"."tambah_log_aktivitas"("p_id_pengguna" integer, "p_aksi" "text", "p_entitas" "text", "p_id_entitas" integer, "p_deskripsi" "text", "p_data_lama" "jsonb", "p_data_baru" "jsonb", "p_ip_address" "text") OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."absensi" (
    "id" bigint NOT NULL,
    "id_pengguna" integer NOT NULL,
    "tanggal" "date" NOT NULL,
    "jam_masuk" timestamp without time zone,
    "jam_pulang" timestamp without time zone,
    "status" character varying(20) DEFAULT 'HADIR'::character varying NOT NULL,
    "telat_menit" integer DEFAULT 0,
    "latitude" numeric(10,7),
    "longitude" numeric(10,7),
    "foto_masuk" "text",
    "foto_pulang" "text",
    "device_info" "text",
    "created_at" timestamp without time zone DEFAULT "now"()
);


ALTER TABLE "public"."absensi" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."absensi_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."absensi_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."absensi_id_seq" OWNED BY "public"."absensi"."id";



CREATE TABLE IF NOT EXISTS "public"."barang_masuk" (
    "id" integer NOT NULL,
    "tgl_masuk" "date" DEFAULT CURRENT_DATE NOT NULL,
    "id_supplier" integer,
    "id_produk" integer NOT NULL,
    "harga_beli" numeric(15,2) DEFAULT 0 NOT NULL,
    "jumlah" numeric(15,3) DEFAULT 0 NOT NULL,
    "total" numeric(15,2) DEFAULT 0 NOT NULL,
    "created_at" timestamp without time zone DEFAULT "now"() NOT NULL,
    "keterangan" "text",
    "supplied_unit" character varying,
    "supplied_qty" numeric,
    "applied_conversion_ratio" numeric,
    "base_qty_added" numeric,
    "total_cost" numeric,
    "base_cost_per_piece" numeric,
    "no_surat" "text",
    "status" "text" DEFAULT 'AKTIF'::"text" NOT NULL,
    "voided_at" timestamp with time zone,
    "voided_by" bigint,
    "alasan_void" "text",
    CONSTRAINT "barang_masuk_status_check" CHECK (("status" = ANY (ARRAY['AKTIF'::"text", 'DIVOID'::"text"])))
);


ALTER TABLE "public"."barang_masuk" OWNER TO "postgres";


COMMENT ON COLUMN "public"."barang_masuk"."supplied_unit" IS 'Satuan saat barang diterima (contoh: lusin)';



COMMENT ON COLUMN "public"."barang_masuk"."supplied_qty" IS 'Jumlah dalam satuan suplai';



COMMENT ON COLUMN "public"."barang_masuk"."applied_conversion_ratio" IS 'Rasio konversi yg dipakai saat transaksi (snapshot)';



COMMENT ON COLUMN "public"."barang_masuk"."base_qty_added" IS 'supplied_qty * applied_conversion_ratio';



COMMENT ON COLUMN "public"."barang_masuk"."total_cost" IS 'Total harga beli dari supplier';



COMMENT ON COLUMN "public"."barang_masuk"."base_cost_per_piece" IS 'HPP per base_unit = total_cost / base_qty_added';



COMMENT ON COLUMN "public"."barang_masuk"."no_surat" IS 'No. faktur/nota/DO dari supplier (opsional)';



COMMENT ON COLUMN "public"."barang_masuk"."status" IS 'Status barang masuk: AKTIF atau DIVOID (logical delete)';



COMMENT ON COLUMN "public"."barang_masuk"."voided_at" IS 'Waktu transaksi di-void';



COMMENT ON COLUMN "public"."barang_masuk"."voided_by" IS 'ID pengguna yang melakukan void';



COMMENT ON COLUMN "public"."barang_masuk"."alasan_void" IS 'Alasan pembatalan (wajib diisi saat void)';



CREATE SEQUENCE IF NOT EXISTS "public"."barang_masuk_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."barang_masuk_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."barang_masuk_id_seq" OWNED BY "public"."barang_masuk"."id";



CREATE TABLE IF NOT EXISTS "public"."detail_retur_pembelian" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "id_retur" "uuid" NOT NULL,
    "id_produk" bigint NOT NULL,
    "qty_retur" numeric NOT NULL,
    "harga_pokok" numeric NOT NULL,
    "jumlah" numeric NOT NULL,
    "keterangan" "text",
    CONSTRAINT "detail_retur_pembelian_qty_retur_check" CHECK (("qty_retur" > (0)::numeric))
);


ALTER TABLE "public"."detail_retur_pembelian" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."detail_transaksi_keluar" (
    "id" integer NOT NULL,
    "id_transaksi" integer NOT NULL,
    "id_produk" integer NOT NULL,
    "type_harga_jual" character varying(20),
    "harga_modal" numeric(15,2) DEFAULT 0 NOT NULL,
    "harga_jual" numeric(15,2) DEFAULT 0 NOT NULL,
    "diskon_item" numeric(5,2) DEFAULT 0 NOT NULL,
    "qty" numeric(15,3) DEFAULT 0 NOT NULL,
    "jumlah" numeric(15,2) DEFAULT 0 NOT NULL,
    "kas_masuk" numeric(15,2) DEFAULT 0 NOT NULL,
    "profit" numeric(15,2) DEFAULT 0 NOT NULL,
    "harga_pokok_satuan" numeric(15,2) DEFAULT 0,
    "total_harga_pokok" numeric(15,2) DEFAULT 0,
    "satuan_jual" "text",
    "qty_satuan" integer,
    "jual_ratio" numeric
);


ALTER TABLE "public"."detail_transaksi_keluar" OWNER TO "postgres";


COMMENT ON COLUMN "public"."detail_transaksi_keluar"."satuan_jual" IS 'Satuan yang dipilih saat menjual (METER/ROLL)';



COMMENT ON COLUMN "public"."detail_transaksi_keluar"."qty_satuan" IS 'Jumlah dalam satuan jual (mis: 2 roll)';



COMMENT ON COLUMN "public"."detail_transaksi_keluar"."jual_ratio" IS 'Snapshot rasio jual saat transaksi';



CREATE SEQUENCE IF NOT EXISTS "public"."detail_transaksi_keluar_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."detail_transaksi_keluar_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."detail_transaksi_keluar_id_seq" OWNED BY "public"."detail_transaksi_keluar"."id";



CREATE TABLE IF NOT EXISTS "public"."event_promo" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "nama" character varying NOT NULL,
    "tanggal_mulai" "date" NOT NULL,
    "tanggal_selesai" "date" NOT NULL,
    "tipe_diskon" "text" NOT NULL,
    "nilai_diskon" numeric NOT NULL,
    "aktif" boolean DEFAULT true NOT NULL,
    "keterangan" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "event_promo_nilai_persen_check" CHECK (((("tipe_diskon" = 'persen'::"text") AND ("nilai_diskon" > (0)::numeric) AND ("nilai_diskon" <= (100)::numeric)) OR (("tipe_diskon" = 'nominal'::"text") AND ("nilai_diskon" > (0)::numeric)))),
    CONSTRAINT "event_promo_tanggal_check" CHECK (("tanggal_selesai" >= "tanggal_mulai")),
    CONSTRAINT "event_promo_tipe_diskon_check" CHECK (("tipe_diskon" = ANY (ARRAY['persen'::"text", 'nominal'::"text"])))
);


ALTER TABLE "public"."event_promo" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."event_promo_produk" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "id_event_promo" "uuid" NOT NULL,
    "id_produk" integer NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."event_promo_produk" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."kas_admin_topup" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tanggal" "date" NOT NULL,
    "jumlah" numeric(15,2) NOT NULL,
    "keterangan" "text",
    "id_pengguna" integer,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "kas_admin_topup_jumlah_check" CHECK (("jumlah" > (0)::numeric))
);


ALTER TABLE "public"."kas_admin_topup" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."kategori" (
    "id" integer NOT NULL,
    "nama" character varying(100) NOT NULL
);


ALTER TABLE "public"."kategori" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."kategori_beban" (
    "id" integer NOT NULL,
    "nama" character varying NOT NULL,
    "kelompok" "text"
);


ALTER TABLE "public"."kategori_beban" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."kategori_beban_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."kategori_beban_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."kategori_beban_id_seq" OWNED BY "public"."kategori_beban"."id";



CREATE SEQUENCE IF NOT EXISTS "public"."kategori_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."kategori_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."kategori_id_seq" OWNED BY "public"."kategori"."id";



CREATE TABLE IF NOT EXISTS "public"."log_aktivitas" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "id_pengguna" integer NOT NULL,
    "aksi" "text" NOT NULL,
    "entitas" "text" NOT NULL,
    "id_entitas" integer,
    "deskripsi" "text" NOT NULL,
    "data_lama" "jsonb",
    "data_baru" "jsonb",
    "ip_address" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "log_aktivitas_aksi_check" CHECK (("aksi" = ANY (ARRAY['CREATE'::"text", 'UPDATE'::"text", 'DELETE'::"text"])))
);


ALTER TABLE "public"."log_aktivitas" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."lokasi_area" (
    "id" integer NOT NULL,
    "nama" character varying NOT NULL
);


ALTER TABLE "public"."lokasi_area" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."lokasi_area_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."lokasi_area_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."lokasi_area_id_seq" OWNED BY "public"."lokasi_area"."id";



CREATE TABLE IF NOT EXISTS "public"."merk" (
    "id" integer NOT NULL,
    "nama" character varying NOT NULL,
    "kode" character varying(4) NOT NULL
);


ALTER TABLE "public"."merk" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."merk_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."merk_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."merk_id_seq" OWNED BY "public"."merk"."id";



CREATE TABLE IF NOT EXISTS "public"."metode_bayar" (
    "id" integer NOT NULL,
    "nama" character varying(50) NOT NULL
);


ALTER TABLE "public"."metode_bayar" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."metode_bayar_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."metode_bayar_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."metode_bayar_id_seq" OWNED BY "public"."metode_bayar"."id";



CREATE TABLE IF NOT EXISTS "public"."pelanggan" (
    "id" integer NOT NULL,
    "nama_pelanggan" character varying(200) NOT NULL,
    "alamat" "text",
    "no_hp" character varying(30),
    "email" character varying(150),
    "keterangan" "text",
    "created_at" timestamp without time zone DEFAULT "now"() NOT NULL,
    "point" integer DEFAULT 0 NOT NULL
);


ALTER TABLE "public"."pelanggan" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."pelanggan_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."pelanggan_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."pelanggan_id_seq" OWNED BY "public"."pelanggan"."id";



CREATE TABLE IF NOT EXISTS "public"."pengaturan" (
    "id" integer DEFAULT 1 NOT NULL,
    "nama_toko" character varying(200),
    "alamat" "text",
    "telepon" character varying(30),
    "email" character varying(150),
    "nama_kasir_aktif" character varying(100),
    "metode_diskon" character varying(20) DEFAULT 'Nominal'::character varying,
    "bank1_nama" character varying(100),
    "bank1_rekening" character varying(50),
    "bank1_atas_nama" character varying(100),
    "bank2_nama" character varying(100),
    "bank2_rekening" character varying(50),
    "bank2_atas_nama" character varying(100),
    "footer_struk_1" character varying(255),
    "footer_struk_2" character varying(255),
    "footer_struk_3" character varying(255),
    "footer_invoice_1" character varying(255),
    "footer_invoice_2" character varying(255),
    "footer_invoice_3" character varying(255),
    "updated_at" timestamp without time zone DEFAULT "now"() NOT NULL,
    "pajak_persen" numeric DEFAULT 0,
    "jenis_nota" "text" DEFAULT 'Invoice'::"text",
    "metode_cetak" "text" DEFAULT 'Preview'::"text",
    "logo_nota" boolean DEFAULT false,
    "hormat_kami_nama" "text",
    "poin_min_pembelian" numeric DEFAULT 100000 NOT NULL,
    CONSTRAINT "pengaturan_id_check" CHECK (("id" = 1))
);


ALTER TABLE "public"."pengaturan" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."pengaturan_keuangan" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "modal_awal" numeric(15,2) DEFAULT 0 NOT NULL,
    "tanggal_mulai" "date" NOT NULL,
    "nama_pemilik" "text",
    "npwp" "text",
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."pengaturan_keuangan" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."pengeluaran" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tanggal" "date" NOT NULL,
    "id_kategori_beban" integer NOT NULL,
    "nama_pengeluaran" "text" NOT NULL,
    "jumlah" numeric NOT NULL,
    "metode_bayar" "text" DEFAULT 'Tunai'::"text" NOT NULL,
    "id_pengguna" integer NOT NULL,
    "keterangan" "text",
    "status" "text" DEFAULT 'AKTIF'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "voided_at" timestamp with time zone,
    "voided_by" integer,
    "alasan_void" "text",
    CONSTRAINT "pengeluaran_jumlah_check" CHECK (("jumlah" > (0)::numeric)),
    CONSTRAINT "pengeluaran_metode_bayar_check" CHECK (("metode_bayar" = ANY (ARRAY['Tunai'::"text", 'Transfer'::"text", 'QRIS'::"text"]))),
    CONSTRAINT "pengeluaran_status_check" CHECK (("status" = ANY (ARRAY['AKTIF'::"text", 'DIVOID'::"text"])))
);


ALTER TABLE "public"."pengeluaran" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."pengguna" (
    "id" integer NOT NULL,
    "username" character varying(100) NOT NULL,
    "password" character varying(255) NOT NULL,
    "level" character varying(50) DEFAULT 'KASIR'::character varying NOT NULL,
    "aktif" boolean DEFAULT true NOT NULL,
    "created_at" timestamp without time zone DEFAULT "now"() NOT NULL,
    "nama" "text"
);


ALTER TABLE "public"."pengguna" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."pengguna_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."pengguna_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."pengguna_id_seq" OWNED BY "public"."pengguna"."id";



CREATE TABLE IF NOT EXISTS "public"."produk" (
    "id" integer NOT NULL,
    "nama_produk" character varying(200) NOT NULL,
    "id_kategori" integer,
    "id_satuan" integer,
    "hitung_stok" boolean DEFAULT true NOT NULL,
    "harga_modal" numeric(15,2) DEFAULT 0 NOT NULL,
    "harga_jual_satuan" numeric(15,2) DEFAULT 0 NOT NULL,
    "harga_jual_grosir" numeric(15,2),
    "harga_jual_promo" numeric(15,2),
    "diskon" numeric(5,2) DEFAULT 0 NOT NULL,
    "created_at" timestamp without time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp without time zone DEFAULT "now"() NOT NULL,
    "stok_minimum" integer DEFAULT 10 NOT NULL,
    "barcode" "text",
    "stok" numeric DEFAULT 0,
    "harga_pokok_avco" numeric DEFAULT 0,
    "nilai_persediaan" numeric DEFAULT 0,
    "stok_gudang" numeric DEFAULT 0,
    "sku" character varying,
    "id_merk" integer,
    "default_purchase_unit" character varying,
    "conversion_ratio" numeric DEFAULT 1 NOT NULL,
    "jual_satuan" "text",
    "harga_jual_besar_satuan" numeric,
    "harga_jual_besar_grosir" numeric,
    "harga_jual_besar_promo" numeric,
    "id_produk_master" integer,
    "qty_per_unit" numeric,
    "id_lokasi_area" integer,
    "jenis_isi_paket" "text",
    "isi_satuan" "text",
    "stok_minimum_gudang" numeric,
    CONSTRAINT "produk_jenis_isi_paket_check" CHECK (("jenis_isi_paket" = ANY (ARRAY['FIXED_RATIO'::"text", 'ACTUAL_WEIGHT'::"text"])))
);


ALTER TABLE "public"."produk" OWNER TO "postgres";


COMMENT ON COLUMN "public"."produk"."default_purchase_unit" IS 'Satuan pembelian default dari supplier (contoh: lusin, roll)';



COMMENT ON COLUMN "public"."produk"."conversion_ratio" IS 'Jumlah base_unit dalam 1 purchase_unit (contoh: 12 untuk lusin)';



COMMENT ON COLUMN "public"."produk"."jual_satuan" IS 'Nama satuan jual besar (contoh: ROLL). NULL = hanya base unit.';



COMMENT ON COLUMN "public"."produk"."harga_jual_besar_satuan" IS 'Harga jual per satuan besar — tier Satuan';



COMMENT ON COLUMN "public"."produk"."harga_jual_besar_grosir" IS 'Harga jual per satuan besar — tier Grosir';



COMMENT ON COLUMN "public"."produk"."harga_jual_besar_promo" IS 'Harga jual per satuan besar — tier Promo';



COMMENT ON COLUMN "public"."produk"."id_produk_master" IS 'ID produk master. NULL = produk normal. Terisi = produk paket/turunan.';



COMMENT ON COLUMN "public"."produk"."qty_per_unit" IS 'Jumlah satuan master dalam 1 satuan paket (mis: 3 pcs per bungkus)';



COMMENT ON COLUMN "public"."produk"."stok_minimum_gudang" IS 'Ambang batas peringatan stok gudang menipis (satuan inventory). NULL = nonaktif.';



CREATE SEQUENCE IF NOT EXISTS "public"."produk_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."produk_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."produk_id_seq" OWNED BY "public"."produk"."id";



CREATE TABLE IF NOT EXISTS "public"."qr_session" (
    "id" bigint NOT NULL,
    "token" "text" NOT NULL,
    "expired_at" timestamp with time zone NOT NULL,
    "is_active" boolean DEFAULT true,
    "created_by" integer,
    "created_at" timestamp without time zone DEFAULT "now"()
);


ALTER TABLE "public"."qr_session" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."qr_session_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."qr_session_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."qr_session_id_seq" OWNED BY "public"."qr_session"."id";



CREATE TABLE IF NOT EXISTS "public"."retur_pembelian" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "no_retur" "text" NOT NULL,
    "tgl_retur" "date" NOT NULL,
    "id_barang_masuk" bigint NOT NULL,
    "id_supplier" bigint,
    "id_pengguna" bigint,
    "total_nilai" numeric DEFAULT 0,
    "keterangan" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."retur_pembelian" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."riwayat_avco" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "id_produk" integer NOT NULL,
    "tanggal" timestamp with time zone DEFAULT "now"() NOT NULL,
    "jenis_mutasi" "text" NOT NULL,
    "id_referensi" integer,
    "qty_masuk" numeric(12,3),
    "qty_keluar" numeric(12,3),
    "harga_satuan_transaksi" numeric,
    "stok_sebelum" numeric(12,3) NOT NULL,
    "avco_sebelum" numeric NOT NULL,
    "stok_sesudah" numeric(12,3) NOT NULL,
    "avco_sesudah" numeric NOT NULL,
    "nilai_persediaan_sesudah" numeric NOT NULL,
    "id_referensi_uuid" "uuid",
    CONSTRAINT "riwayat_avco_jenis_mutasi_check" CHECK (("jenis_mutasi" = ANY (ARRAY['pembelian'::"text", 'penjualan'::"text", 'koreksi'::"text", 'retur_beli'::"text", 'retur_jual'::"text"])))
);


ALTER TABLE "public"."riwayat_avco" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."saldo_kas_harian" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tanggal" "date" NOT NULL,
    "saldo_awal" numeric(15,2) DEFAULT 0 NOT NULL,
    "total_masuk" numeric(15,2) DEFAULT 0 NOT NULL,
    "total_keluar" numeric(15,2) DEFAULT 0 NOT NULL,
    "saldo_akhir" numeric(15,2) GENERATED ALWAYS AS ((("saldo_awal" + "total_masuk") - "total_keluar")) STORED,
    "uang_aktual" numeric(15,2),
    "selisih" numeric(15,2),
    "dikonfirmasi" boolean DEFAULT false,
    "id_pengguna" integer,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "uang_awal" numeric(15,2)
);


ALTER TABLE "public"."saldo_kas_harian" OWNER TO "postgres";


COMMENT ON COLUMN "public"."saldo_kas_harian"."uang_awal" IS 'Uang awal (float) kas kasir yang dimasukkan saat buka sesi untuk kembalian';



CREATE TABLE IF NOT EXISTS "public"."satuan" (
    "id" integer NOT NULL,
    "nama" character varying(50) NOT NULL
);


ALTER TABLE "public"."satuan" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."satuan_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."satuan_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."satuan_id_seq" OWNED BY "public"."satuan"."id";



CREATE TABLE IF NOT EXISTS "public"."sesi_stok_opname" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "no_sesi" "text" NOT NULL,
    "tgl_sesi" "date" NOT NULL,
    "status" "text" DEFAULT 'DRAFT'::"text" NOT NULL,
    "id_pengguna" bigint,
    "total_item" integer DEFAULT 0,
    "total_selisih" numeric DEFAULT 0,
    "total_nilai" numeric DEFAULT 0,
    "keterangan" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "applied_at" timestamp with time zone,
    CONSTRAINT "sesi_stok_opname_status_check" CHECK (("status" = ANY (ARRAY['DRAFT'::"text", 'SELESAI'::"text", 'DIBATALKAN'::"text"])))
);


ALTER TABLE "public"."sesi_stok_opname" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."stok_opname" (
    "id" integer NOT NULL,
    "tgl_opname" "date" DEFAULT CURRENT_DATE NOT NULL,
    "id_produk" integer NOT NULL,
    "stok_sistem" numeric(15,3) DEFAULT 0 NOT NULL,
    "stok_fisik" numeric(15,3) DEFAULT 0 NOT NULL,
    "selisih" numeric(15,3) DEFAULT 0 NOT NULL,
    "keterangan" "text",
    "created_at" timestamp without time zone DEFAULT "now"() NOT NULL,
    "id_sesi" "uuid",
    "id_pengguna" bigint,
    "klasifikasi" "text",
    "harga_pokok_snap" numeric,
    CONSTRAINT "stok_opname_klasifikasi_check" CHECK (("klasifikasi" = ANY (ARRAY['KELEBIHAN'::"text", 'SALAH_CATAT'::"text", 'RUSAK'::"text", 'HILANG'::"text", 'LAINNYA'::"text"])))
);


ALTER TABLE "public"."stok_opname" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."stok_opname_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."stok_opname_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."stok_opname_id_seq" OWNED BY "public"."stok_opname"."id";



CREATE TABLE IF NOT EXISTS "public"."supplier" (
    "id" integer NOT NULL,
    "nama_supplier" character varying(200) NOT NULL,
    "alamat" "text",
    "telepon" character varying(30),
    "email" character varying(150),
    "keterangan" "text",
    "created_at" timestamp without time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."supplier" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."supplier_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."supplier_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."supplier_id_seq" OWNED BY "public"."supplier"."id";



CREATE TABLE IF NOT EXISTS "public"."transaksi_keluar" (
    "id" integer NOT NULL,
    "no_transaksi" bigint NOT NULL,
    "tgl_transaksi" timestamp without time zone DEFAULT "now"() NOT NULL,
    "id_kasir" integer NOT NULL,
    "id_pelanggan" integer,
    "id_metode_bayar" integer,
    "subtotal" numeric(15,2) DEFAULT 0 NOT NULL,
    "diskon_persen" numeric(5,2) DEFAULT 0 NOT NULL,
    "diskon_nominal" numeric(15,2) DEFAULT 0 NOT NULL,
    "pajak_persen" numeric(5,2) DEFAULT 0 NOT NULL,
    "pajak_nominal" numeric(15,2) DEFAULT 0 NOT NULL,
    "total" numeric(15,2) DEFAULT 0 NOT NULL,
    "bayar" numeric(15,2) DEFAULT 0 NOT NULL,
    "kembali" numeric(15,2) DEFAULT 0 NOT NULL,
    "dp" numeric(15,2) DEFAULT 0 NOT NULL,
    "sisa" numeric(15,2) DEFAULT 0 NOT NULL,
    "created_at" timestamp without time zone DEFAULT "now"() NOT NULL,
    "total_hpp" numeric(15,2) DEFAULT 0,
    "laba_kotor" numeric(15,2) DEFAULT 0
);


ALTER TABLE "public"."transaksi_keluar" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."transaksi_keluar_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."transaksi_keluar_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."transaksi_keluar_id_seq" OWNED BY "public"."transaksi_keluar"."id";



CREATE OR REPLACE VIEW "public"."v_stok_produk" WITH ("security_invoker"='on') AS
 SELECT "p"."id",
    "p"."nama_produk",
    "p"."hitung_stok",
    "p"."harga_modal",
    COALESCE("sum"("bm"."jumlah"), (0)::numeric) AS "total_masuk",
    COALESCE("sum"("dtk"."qty"), (0)::numeric) AS "total_keluar",
    COALESCE("sum"("so"."selisih"), (0)::numeric) AS "koreksi_opname",
        CASE
            WHEN ("p"."hitung_stok" = false) THEN (0)::numeric
            ELSE ((COALESCE("sum"("bm"."jumlah"), (0)::numeric) - COALESCE("sum"("dtk"."qty"), (0)::numeric)) + COALESCE("sum"("so"."selisih"), (0)::numeric))
        END AS "stok_saat_ini",
    ("p"."harga_modal" *
        CASE
            WHEN ("p"."hitung_stok" = false) THEN (0)::numeric
            ELSE ((COALESCE("sum"("bm"."jumlah"), (0)::numeric) - COALESCE("sum"("dtk"."qty"), (0)::numeric)) + COALESCE("sum"("so"."selisih"), (0)::numeric))
        END) AS "nilai_stok"
   FROM ((("public"."produk" "p"
     LEFT JOIN "public"."barang_masuk" "bm" ON (("bm"."id_produk" = "p"."id")))
     LEFT JOIN "public"."detail_transaksi_keluar" "dtk" ON (("dtk"."id_produk" = "p"."id")))
     LEFT JOIN "public"."stok_opname" "so" ON (("so"."id_produk" = "p"."id")))
  GROUP BY "p"."id", "p"."nama_produk", "p"."hitung_stok", "p"."harga_modal";


ALTER VIEW "public"."v_stok_produk" OWNER TO "postgres";


ALTER TABLE ONLY "public"."absensi" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."absensi_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."barang_masuk" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."barang_masuk_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."detail_transaksi_keluar" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."detail_transaksi_keluar_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."kategori" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."kategori_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."kategori_beban" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."kategori_beban_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."lokasi_area" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."lokasi_area_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."merk" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."merk_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."metode_bayar" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."metode_bayar_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."pelanggan" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."pelanggan_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."pengguna" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."pengguna_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."produk" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."produk_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."qr_session" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."qr_session_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."satuan" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."satuan_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."stok_opname" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."stok_opname_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."supplier" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."supplier_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."transaksi_keluar" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."transaksi_keluar_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."absensi"
    ADD CONSTRAINT "absensi_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."barang_masuk"
    ADD CONSTRAINT "barang_masuk_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."detail_retur_pembelian"
    ADD CONSTRAINT "detail_retur_pembelian_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."detail_transaksi_keluar"
    ADD CONSTRAINT "detail_transaksi_keluar_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."event_promo"
    ADD CONSTRAINT "event_promo_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."event_promo_produk"
    ADD CONSTRAINT "event_promo_produk_id_event_promo_id_produk_key" UNIQUE ("id_event_promo", "id_produk");



ALTER TABLE ONLY "public"."event_promo_produk"
    ADD CONSTRAINT "event_promo_produk_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."kas_admin_topup"
    ADD CONSTRAINT "kas_admin_topup_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."kategori_beban"
    ADD CONSTRAINT "kategori_beban_nama_key" UNIQUE ("nama");



ALTER TABLE ONLY "public"."kategori_beban"
    ADD CONSTRAINT "kategori_beban_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."kategori"
    ADD CONSTRAINT "kategori_nama_key" UNIQUE ("nama");



ALTER TABLE ONLY "public"."kategori"
    ADD CONSTRAINT "kategori_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."log_aktivitas"
    ADD CONSTRAINT "log_aktivitas_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."lokasi_area"
    ADD CONSTRAINT "lokasi_area_nama_key" UNIQUE ("nama");



ALTER TABLE ONLY "public"."lokasi_area"
    ADD CONSTRAINT "lokasi_area_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."merk"
    ADD CONSTRAINT "merk_kode_key" UNIQUE ("kode");



ALTER TABLE ONLY "public"."merk"
    ADD CONSTRAINT "merk_nama_key" UNIQUE ("nama");



ALTER TABLE ONLY "public"."merk"
    ADD CONSTRAINT "merk_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."metode_bayar"
    ADD CONSTRAINT "metode_bayar_nama_key" UNIQUE ("nama");



ALTER TABLE ONLY "public"."metode_bayar"
    ADD CONSTRAINT "metode_bayar_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pelanggan"
    ADD CONSTRAINT "pelanggan_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pengaturan_keuangan"
    ADD CONSTRAINT "pengaturan_keuangan_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pengaturan"
    ADD CONSTRAINT "pengaturan_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pengeluaran"
    ADD CONSTRAINT "pengeluaran_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pengguna"
    ADD CONSTRAINT "pengguna_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pengguna"
    ADD CONSTRAINT "pengguna_username_key" UNIQUE ("username");



ALTER TABLE ONLY "public"."produk"
    ADD CONSTRAINT "produk_barcode_key" UNIQUE ("barcode");



ALTER TABLE ONLY "public"."produk"
    ADD CONSTRAINT "produk_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."produk"
    ADD CONSTRAINT "produk_sku_key" UNIQUE ("sku");



ALTER TABLE ONLY "public"."qr_session"
    ADD CONSTRAINT "qr_session_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."qr_session"
    ADD CONSTRAINT "qr_session_token_key" UNIQUE ("token");



ALTER TABLE ONLY "public"."retur_pembelian"
    ADD CONSTRAINT "retur_pembelian_no_retur_key" UNIQUE ("no_retur");



ALTER TABLE ONLY "public"."retur_pembelian"
    ADD CONSTRAINT "retur_pembelian_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."riwayat_avco"
    ADD CONSTRAINT "riwayat_avco_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."saldo_kas_harian"
    ADD CONSTRAINT "saldo_kas_harian_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."saldo_kas_harian"
    ADD CONSTRAINT "saldo_kas_harian_tanggal_key" UNIQUE ("tanggal");



ALTER TABLE ONLY "public"."satuan"
    ADD CONSTRAINT "satuan_nama_key" UNIQUE ("nama");



ALTER TABLE ONLY "public"."satuan"
    ADD CONSTRAINT "satuan_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sesi_stok_opname"
    ADD CONSTRAINT "sesi_stok_opname_no_sesi_key" UNIQUE ("no_sesi");



ALTER TABLE ONLY "public"."sesi_stok_opname"
    ADD CONSTRAINT "sesi_stok_opname_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."stok_opname"
    ADD CONSTRAINT "stok_opname_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."supplier"
    ADD CONSTRAINT "supplier_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."transaksi_keluar"
    ADD CONSTRAINT "transaksi_keluar_no_transaksi_key" UNIQUE ("no_transaksi");



ALTER TABLE ONLY "public"."transaksi_keluar"
    ADD CONSTRAINT "transaksi_keluar_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."absensi"
    ADD CONSTRAINT "unique_absensi_per_hari" UNIQUE ("id_pengguna", "tanggal");



CREATE INDEX "idx_absensi_pengguna" ON "public"."absensi" USING "btree" ("id_pengguna");



CREATE INDEX "idx_absensi_tanggal" ON "public"."absensi" USING "btree" ("tanggal");



CREATE INDEX "idx_barang_masuk_no_surat" ON "public"."barang_masuk" USING "btree" ("no_surat");



CREATE INDEX "idx_barang_masuk_status" ON "public"."barang_masuk" USING "btree" ("status");



CREATE INDEX "idx_bm_produk" ON "public"."barang_masuk" USING "btree" ("id_produk");



CREATE INDEX "idx_bm_tgl" ON "public"."barang_masuk" USING "btree" ("tgl_masuk");



CREATE INDEX "idx_detail_produk" ON "public"."detail_transaksi_keluar" USING "btree" ("id_produk");



CREATE INDEX "idx_detail_trx" ON "public"."detail_transaksi_keluar" USING "btree" ("id_transaksi");



CREATE INDEX "idx_event_promo_aktif" ON "public"."event_promo" USING "btree" ("aktif");



CREATE INDEX "idx_event_promo_produk_id_produk" ON "public"."event_promo_produk" USING "btree" ("id_produk");



CREATE INDEX "idx_event_promo_tanggal" ON "public"."event_promo" USING "btree" ("tanggal_mulai", "tanggal_selesai");



CREATE INDEX "idx_kas_admin_topup_tanggal" ON "public"."kas_admin_topup" USING "btree" ("tanggal" DESC);



CREATE INDEX "idx_log_aktivitas_created_at" ON "public"."log_aktivitas" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_log_aktivitas_entitas" ON "public"."log_aktivitas" USING "btree" ("entitas");



CREATE INDEX "idx_log_aktivitas_pengguna" ON "public"."log_aktivitas" USING "btree" ("id_pengguna");



CREATE INDEX "idx_opname_produk" ON "public"."stok_opname" USING "btree" ("id_produk");



CREATE INDEX "idx_pengeluaran_created_at" ON "public"."pengeluaran" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_pengeluaran_kategori" ON "public"."pengeluaran" USING "btree" ("id_kategori_beban");



CREATE INDEX "idx_pengeluaran_status" ON "public"."pengeluaran" USING "btree" ("status");



CREATE INDEX "idx_pengeluaran_tanggal" ON "public"."pengeluaran" USING "btree" ("tanggal" DESC);



CREATE INDEX "idx_produk_id_lokasi_area" ON "public"."produk" USING "btree" ("id_lokasi_area");



CREATE INDEX "idx_produk_id_merk" ON "public"."produk" USING "btree" ("id_merk");



CREATE INDEX "idx_produk_kategori" ON "public"."produk" USING "btree" ("id_kategori");



CREATE INDEX "idx_produk_satuan" ON "public"."produk" USING "btree" ("id_satuan");



CREATE INDEX "idx_produk_sku" ON "public"."produk" USING "btree" ("sku");



CREATE INDEX "idx_qr_session_expired" ON "public"."qr_session" USING "btree" ("expired_at");



CREATE INDEX "idx_qr_session_token" ON "public"."qr_session" USING "btree" ("token");



CREATE INDEX "idx_retur_pembelian_supplier" ON "public"."retur_pembelian" USING "btree" ("id_supplier");



CREATE INDEX "idx_retur_pembelian_tgl" ON "public"."retur_pembelian" USING "btree" ("tgl_retur");



CREATE INDEX "idx_riwayat_avco_produk" ON "public"."riwayat_avco" USING "btree" ("id_produk", "tanggal" DESC);



CREATE INDEX "idx_sesi_stok_opname_status" ON "public"."sesi_stok_opname" USING "btree" ("status");



CREATE INDEX "idx_sesi_stok_opname_tgl" ON "public"."sesi_stok_opname" USING "btree" ("tgl_sesi");



CREATE INDEX "idx_stok_opname_id_sesi" ON "public"."stok_opname" USING "btree" ("id_sesi");



CREATE INDEX "idx_stok_opname_klasifikasi" ON "public"."stok_opname" USING "btree" ("klasifikasi");



CREATE INDEX "idx_trx_kasir" ON "public"."transaksi_keluar" USING "btree" ("id_kasir");



CREATE INDEX "idx_trx_tgl" ON "public"."transaksi_keluar" USING "btree" ("tgl_transaksi");



CREATE OR REPLACE TRIGGER "trg_cek_overlap_event_promo" BEFORE INSERT OR UPDATE ON "public"."event_promo_produk" FOR EACH ROW EXECUTE FUNCTION "public"."cek_overlap_event_promo"();



CREATE OR REPLACE TRIGGER "trg_guard_produk_paket" BEFORE INSERT OR UPDATE OF "id_produk_master", "qty_per_unit", "hitung_stok", "jenis_isi_paket", "isi_satuan" ON "public"."produk" FOR EACH ROW EXECUTE FUNCTION "public"."guard_produk_paket"();



CREATE OR REPLACE TRIGGER "trg_selisih_opname" BEFORE INSERT OR UPDATE ON "public"."stok_opname" FOR EACH ROW EXECUTE FUNCTION "public"."fn_hitung_selisih_opname"();



ALTER TABLE ONLY "public"."absensi"
    ADD CONSTRAINT "absensi_id_pengguna_fkey" FOREIGN KEY ("id_pengguna") REFERENCES "public"."pengguna"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."barang_masuk"
    ADD CONSTRAINT "barang_masuk_id_produk_fkey" FOREIGN KEY ("id_produk") REFERENCES "public"."produk"("id");



ALTER TABLE ONLY "public"."barang_masuk"
    ADD CONSTRAINT "barang_masuk_id_supplier_fkey" FOREIGN KEY ("id_supplier") REFERENCES "public"."supplier"("id");



ALTER TABLE ONLY "public"."barang_masuk"
    ADD CONSTRAINT "barang_masuk_voided_by_fkey" FOREIGN KEY ("voided_by") REFERENCES "public"."pengguna"("id");



ALTER TABLE ONLY "public"."detail_retur_pembelian"
    ADD CONSTRAINT "detail_retur_pembelian_id_produk_fkey" FOREIGN KEY ("id_produk") REFERENCES "public"."produk"("id");



ALTER TABLE ONLY "public"."detail_retur_pembelian"
    ADD CONSTRAINT "detail_retur_pembelian_id_retur_fkey" FOREIGN KEY ("id_retur") REFERENCES "public"."retur_pembelian"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."detail_transaksi_keluar"
    ADD CONSTRAINT "detail_transaksi_keluar_id_produk_fkey" FOREIGN KEY ("id_produk") REFERENCES "public"."produk"("id");



ALTER TABLE ONLY "public"."detail_transaksi_keluar"
    ADD CONSTRAINT "detail_transaksi_keluar_id_transaksi_fkey" FOREIGN KEY ("id_transaksi") REFERENCES "public"."transaksi_keluar"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."event_promo_produk"
    ADD CONSTRAINT "event_promo_produk_id_event_promo_fkey" FOREIGN KEY ("id_event_promo") REFERENCES "public"."event_promo"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."event_promo_produk"
    ADD CONSTRAINT "event_promo_produk_id_produk_fkey" FOREIGN KEY ("id_produk") REFERENCES "public"."produk"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."produk"
    ADD CONSTRAINT "fk_produk_id_produk_master" FOREIGN KEY ("id_produk_master") REFERENCES "public"."produk"("id");



ALTER TABLE ONLY "public"."kas_admin_topup"
    ADD CONSTRAINT "kas_admin_topup_id_pengguna_fkey" FOREIGN KEY ("id_pengguna") REFERENCES "public"."pengguna"("id");



ALTER TABLE ONLY "public"."log_aktivitas"
    ADD CONSTRAINT "log_aktivitas_id_pengguna_fkey" FOREIGN KEY ("id_pengguna") REFERENCES "public"."pengguna"("id");



ALTER TABLE ONLY "public"."pengeluaran"
    ADD CONSTRAINT "pengeluaran_id_kategori_beban_fkey" FOREIGN KEY ("id_kategori_beban") REFERENCES "public"."kategori_beban"("id");



ALTER TABLE ONLY "public"."pengeluaran"
    ADD CONSTRAINT "pengeluaran_id_pengguna_fkey" FOREIGN KEY ("id_pengguna") REFERENCES "public"."pengguna"("id");



ALTER TABLE ONLY "public"."pengeluaran"
    ADD CONSTRAINT "pengeluaran_voided_by_fkey" FOREIGN KEY ("voided_by") REFERENCES "public"."pengguna"("id");



ALTER TABLE ONLY "public"."produk"
    ADD CONSTRAINT "produk_id_kategori_fkey" FOREIGN KEY ("id_kategori") REFERENCES "public"."kategori"("id");



ALTER TABLE ONLY "public"."produk"
    ADD CONSTRAINT "produk_id_lokasi_area_fkey" FOREIGN KEY ("id_lokasi_area") REFERENCES "public"."lokasi_area"("id");



ALTER TABLE ONLY "public"."produk"
    ADD CONSTRAINT "produk_id_merk_fkey" FOREIGN KEY ("id_merk") REFERENCES "public"."merk"("id");



ALTER TABLE ONLY "public"."produk"
    ADD CONSTRAINT "produk_id_satuan_fkey" FOREIGN KEY ("id_satuan") REFERENCES "public"."satuan"("id");



ALTER TABLE ONLY "public"."qr_session"
    ADD CONSTRAINT "qr_session_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."pengguna"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."retur_pembelian"
    ADD CONSTRAINT "retur_pembelian_id_barang_masuk_fkey" FOREIGN KEY ("id_barang_masuk") REFERENCES "public"."barang_masuk"("id");



ALTER TABLE ONLY "public"."retur_pembelian"
    ADD CONSTRAINT "retur_pembelian_id_pengguna_fkey" FOREIGN KEY ("id_pengguna") REFERENCES "public"."pengguna"("id");



ALTER TABLE ONLY "public"."retur_pembelian"
    ADD CONSTRAINT "retur_pembelian_id_supplier_fkey" FOREIGN KEY ("id_supplier") REFERENCES "public"."supplier"("id");



ALTER TABLE ONLY "public"."riwayat_avco"
    ADD CONSTRAINT "riwayat_avco_id_produk_fkey" FOREIGN KEY ("id_produk") REFERENCES "public"."produk"("id");



ALTER TABLE ONLY "public"."saldo_kas_harian"
    ADD CONSTRAINT "saldo_kas_harian_id_pengguna_fkey" FOREIGN KEY ("id_pengguna") REFERENCES "public"."pengguna"("id");



ALTER TABLE ONLY "public"."sesi_stok_opname"
    ADD CONSTRAINT "sesi_stok_opname_id_pengguna_fkey" FOREIGN KEY ("id_pengguna") REFERENCES "public"."pengguna"("id");



ALTER TABLE ONLY "public"."stok_opname"
    ADD CONSTRAINT "stok_opname_id_pengguna_fkey" FOREIGN KEY ("id_pengguna") REFERENCES "public"."pengguna"("id");



ALTER TABLE ONLY "public"."stok_opname"
    ADD CONSTRAINT "stok_opname_id_produk_fkey" FOREIGN KEY ("id_produk") REFERENCES "public"."produk"("id");



ALTER TABLE ONLY "public"."stok_opname"
    ADD CONSTRAINT "stok_opname_id_sesi_fkey" FOREIGN KEY ("id_sesi") REFERENCES "public"."sesi_stok_opname"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."transaksi_keluar"
    ADD CONSTRAINT "transaksi_keluar_id_kasir_fkey" FOREIGN KEY ("id_kasir") REFERENCES "public"."pengguna"("id");



ALTER TABLE ONLY "public"."transaksi_keluar"
    ADD CONSTRAINT "transaksi_keluar_id_metode_bayar_fkey" FOREIGN KEY ("id_metode_bayar") REFERENCES "public"."metode_bayar"("id");



ALTER TABLE ONLY "public"."transaksi_keluar"
    ADD CONSTRAINT "transaksi_keluar_id_pelanggan_fkey" FOREIGN KEY ("id_pelanggan") REFERENCES "public"."pelanggan"("id");



CREATE POLICY "Authenticated users can insert riwayat_avco" ON "public"."riwayat_avco" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Authenticated users can select riwayat_avco" ON "public"."riwayat_avco" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Enable DELETE on event_promo" ON "public"."event_promo" FOR DELETE TO "authenticated" USING (true);



CREATE POLICY "Enable DELETE on event_promo_produk" ON "public"."event_promo_produk" FOR DELETE TO "authenticated" USING (true);



CREATE POLICY "Enable INSERT on event_promo" ON "public"."event_promo" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Enable INSERT on event_promo_produk" ON "public"."event_promo_produk" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Enable SELECT on event_promo" ON "public"."event_promo" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Enable SELECT on event_promo_produk" ON "public"."event_promo_produk" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Enable UPDATE on event_promo" ON "public"."event_promo" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Enable UPDATE on event_promo_produk" ON "public"."event_promo_produk" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);



ALTER TABLE "public"."absensi" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "auth_all" ON "public"."absensi" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "auth_all" ON "public"."barang_masuk" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "auth_all" ON "public"."detail_transaksi_keluar" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "auth_all" ON "public"."kategori" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "auth_all" ON "public"."metode_bayar" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "auth_all" ON "public"."pelanggan" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "auth_all" ON "public"."pengaturan" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "auth_all" ON "public"."pengguna" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "auth_all" ON "public"."produk" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "auth_all" ON "public"."qr_session" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "auth_all" ON "public"."satuan" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "auth_all" ON "public"."stok_opname" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "auth_all" ON "public"."supplier" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "auth_all" ON "public"."transaksi_keluar" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "auth_can_select_log_aktivitas" ON "public"."log_aktivitas" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "authenticated users can delete kas_admin_topup" ON "public"."kas_admin_topup" FOR DELETE TO "authenticated" USING (true);



CREATE POLICY "authenticated users can delete kategori_beban" ON "public"."kategori_beban" FOR DELETE TO "authenticated" USING (true);



CREATE POLICY "authenticated users can delete lokasi_area" ON "public"."lokasi_area" FOR DELETE TO "authenticated" USING (true);



CREATE POLICY "authenticated users can delete merk" ON "public"."merk" FOR DELETE TO "authenticated" USING (true);



CREATE POLICY "authenticated users can delete pengaturan_keuangan" ON "public"."pengaturan_keuangan" FOR DELETE TO "authenticated" USING (true);



CREATE POLICY "authenticated users can delete pengeluaran" ON "public"."pengeluaran" FOR DELETE TO "authenticated" USING (true);



CREATE POLICY "authenticated users can delete saldo_kas_harian" ON "public"."saldo_kas_harian" FOR DELETE TO "authenticated" USING (true);



CREATE POLICY "authenticated users can delete sesi_stok_opname" ON "public"."sesi_stok_opname" FOR DELETE TO "authenticated" USING (true);



CREATE POLICY "authenticated users can delete stok_opname" ON "public"."stok_opname" FOR DELETE TO "authenticated" USING (true);



CREATE POLICY "authenticated users can insert detail_retur_pembelian" ON "public"."detail_retur_pembelian" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "authenticated users can insert kas_admin_topup" ON "public"."kas_admin_topup" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "authenticated users can insert kategori_beban" ON "public"."kategori_beban" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "authenticated users can insert lokasi_area" ON "public"."lokasi_area" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "authenticated users can insert merk" ON "public"."merk" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "authenticated users can insert pengaturan_keuangan" ON "public"."pengaturan_keuangan" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "authenticated users can insert pengeluaran" ON "public"."pengeluaran" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "authenticated users can insert retur_pembelian" ON "public"."retur_pembelian" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "authenticated users can insert saldo_kas_harian" ON "public"."saldo_kas_harian" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "authenticated users can insert sesi_stok_opname" ON "public"."sesi_stok_opname" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "authenticated users can insert stok_opname" ON "public"."stok_opname" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "authenticated users can select detail_retur_pembelian" ON "public"."detail_retur_pembelian" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "authenticated users can select kas_admin_topup" ON "public"."kas_admin_topup" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "authenticated users can select kategori_beban" ON "public"."kategori_beban" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "authenticated users can select lokasi_area" ON "public"."lokasi_area" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "authenticated users can select merk" ON "public"."merk" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "authenticated users can select pengaturan_keuangan" ON "public"."pengaturan_keuangan" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "authenticated users can select pengeluaran" ON "public"."pengeluaran" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "authenticated users can select retur_pembelian" ON "public"."retur_pembelian" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "authenticated users can select saldo_kas_harian" ON "public"."saldo_kas_harian" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "authenticated users can select sesi_stok_opname" ON "public"."sesi_stok_opname" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "authenticated users can select stok_opname" ON "public"."stok_opname" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "authenticated users can update kas_admin_topup" ON "public"."kas_admin_topup" FOR UPDATE TO "authenticated" USING (true);



CREATE POLICY "authenticated users can update kategori_beban" ON "public"."kategori_beban" FOR UPDATE TO "authenticated" USING (true);



CREATE POLICY "authenticated users can update lokasi_area" ON "public"."lokasi_area" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "authenticated users can update merk" ON "public"."merk" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "authenticated users can update pengaturan_keuangan" ON "public"."pengaturan_keuangan" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "authenticated users can update pengeluaran" ON "public"."pengeluaran" FOR UPDATE TO "authenticated" USING (true);



CREATE POLICY "authenticated users can update saldo_kas_harian" ON "public"."saldo_kas_harian" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "authenticated users can update sesi_stok_opname" ON "public"."sesi_stok_opname" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "authenticated users can update stok_opname" ON "public"."stok_opname" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);



ALTER TABLE "public"."barang_masuk" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."detail_retur_pembelian" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."detail_transaksi_keluar" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."event_promo" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."event_promo_produk" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."kas_admin_topup" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."kategori" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."kategori_beban" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."log_aktivitas" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."lokasi_area" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."merk" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."metode_bayar" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."pelanggan" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."pengaturan" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."pengaturan_keuangan" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."pengeluaran" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."pengguna" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."produk" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."qr_session" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."retur_pembelian" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."riwayat_avco" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."saldo_kas_harian" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."satuan" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."sesi_stok_opname" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."stok_opname" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."supplier" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."transaksi_keluar" ENABLE ROW LEVEL SECURITY;


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT ALL ON FUNCTION "public"."batalkan_sesi_stok_opname"("p_id_sesi" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."batalkan_sesi_stok_opname"("p_id_sesi" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."batalkan_sesi_stok_opname"("p_id_sesi" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."cancel_barang_masuk"("p_id_barang_masuk" bigint, "p_id_pengguna" bigint, "p_alasan" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."cancel_barang_masuk"("p_id_barang_masuk" bigint, "p_id_pengguna" bigint, "p_alasan" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."cancel_barang_masuk"("p_id_barang_masuk" bigint, "p_id_pengguna" bigint, "p_alasan" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."cek_overlap_event_promo"() TO "anon";
GRANT ALL ON FUNCTION "public"."cek_overlap_event_promo"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."cek_overlap_event_promo"() TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_hitung_selisih_opname"() TO "anon";
GRANT ALL ON FUNCTION "public"."fn_hitung_selisih_opname"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_hitung_selisih_opname"() TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_no_transaksi"() TO "anon";
GRANT ALL ON FUNCTION "public"."generate_no_transaksi"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_no_transaksi"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_harga_efektif_produk"("p_id_produk" integer, "p_tanggal" "date") TO "anon";
GRANT ALL ON FUNCTION "public"."get_harga_efektif_produk"("p_id_produk" integer, "p_tanggal" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_harga_efektif_produk"("p_id_produk" integer, "p_tanggal" "date") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_inventory_value_at_date"("p_date" "date") TO "anon";
GRANT ALL ON FUNCTION "public"."get_inventory_value_at_date"("p_date" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_inventory_value_at_date"("p_date" "date") TO "service_role";



GRANT ALL ON FUNCTION "public"."guard_produk_paket"() TO "anon";
GRANT ALL ON FUNCTION "public"."guard_produk_paket"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."guard_produk_paket"() TO "service_role";



GRANT ALL ON FUNCTION "public"."process_barang_masuk"("p_items" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."process_barang_masuk"("p_items" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."process_barang_masuk"("p_items" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."process_checkout"("p_items" "jsonb", "p_id_kasir" integer, "p_id_pelanggan" integer, "p_id_metode_bayar" integer, "p_diskon_persen" numeric, "p_bayar" numeric, "p_pajak_persen" numeric, "p_is_dp" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."process_checkout"("p_items" "jsonb", "p_id_kasir" integer, "p_id_pelanggan" integer, "p_id_metode_bayar" integer, "p_diskon_persen" numeric, "p_bayar" numeric, "p_pajak_persen" numeric, "p_is_dp" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."process_checkout"("p_items" "jsonb", "p_id_kasir" integer, "p_id_pelanggan" integer, "p_id_metode_bayar" integer, "p_diskon_persen" numeric, "p_bayar" numeric, "p_pajak_persen" numeric, "p_is_dp" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."process_isi_stok_paket"("p_id_paket" integer, "p_qty_paket" numeric) TO "anon";
GRANT ALL ON FUNCTION "public"."process_isi_stok_paket"("p_id_paket" integer, "p_qty_paket" numeric) TO "authenticated";
GRANT ALL ON FUNCTION "public"."process_isi_stok_paket"("p_id_paket" integer, "p_qty_paket" numeric) TO "service_role";



GRANT ALL ON FUNCTION "public"."process_isi_stok_paket"("p_id_paket" integer, "p_qty_paket" numeric, "p_total_berat" numeric) TO "anon";
GRANT ALL ON FUNCTION "public"."process_isi_stok_paket"("p_id_paket" integer, "p_qty_paket" numeric, "p_total_berat" numeric) TO "authenticated";
GRANT ALL ON FUNCTION "public"."process_isi_stok_paket"("p_id_paket" integer, "p_qty_paket" numeric, "p_total_berat" numeric) TO "service_role";



GRANT ALL ON FUNCTION "public"."process_retur_pembelian"("p_id_barang_masuk" bigint, "p_id_pengguna" bigint, "p_items" "jsonb", "p_keterangan" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."process_retur_pembelian"("p_id_barang_masuk" bigint, "p_id_pengguna" bigint, "p_items" "jsonb", "p_keterangan" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."process_retur_pembelian"("p_id_barang_masuk" bigint, "p_id_pengguna" bigint, "p_items" "jsonb", "p_keterangan" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."process_stock_opname"("p_items" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."process_stock_opname"("p_items" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."process_stock_opname"("p_items" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."process_stok_opname_apply"("p_id_sesi" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."process_stok_opname_apply"("p_id_sesi" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."process_stok_opname_apply"("p_id_sesi" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "anon";
GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "service_role";



GRANT ALL ON FUNCTION "public"."tambah_log_aktivitas"("p_id_pengguna" integer, "p_aksi" "text", "p_entitas" "text", "p_id_entitas" integer, "p_deskripsi" "text", "p_data_lama" "jsonb", "p_data_baru" "jsonb", "p_ip_address" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."tambah_log_aktivitas"("p_id_pengguna" integer, "p_aksi" "text", "p_entitas" "text", "p_id_entitas" integer, "p_deskripsi" "text", "p_data_lama" "jsonb", "p_data_baru" "jsonb", "p_ip_address" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."tambah_log_aktivitas"("p_id_pengguna" integer, "p_aksi" "text", "p_entitas" "text", "p_id_entitas" integer, "p_deskripsi" "text", "p_data_lama" "jsonb", "p_data_baru" "jsonb", "p_ip_address" "text") TO "service_role";



GRANT ALL ON TABLE "public"."absensi" TO "anon";
GRANT ALL ON TABLE "public"."absensi" TO "authenticated";
GRANT ALL ON TABLE "public"."absensi" TO "service_role";



GRANT ALL ON SEQUENCE "public"."absensi_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."absensi_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."absensi_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."barang_masuk" TO "anon";
GRANT ALL ON TABLE "public"."barang_masuk" TO "authenticated";
GRANT ALL ON TABLE "public"."barang_masuk" TO "service_role";



GRANT ALL ON SEQUENCE "public"."barang_masuk_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."barang_masuk_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."barang_masuk_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."detail_retur_pembelian" TO "anon";
GRANT ALL ON TABLE "public"."detail_retur_pembelian" TO "authenticated";
GRANT ALL ON TABLE "public"."detail_retur_pembelian" TO "service_role";



GRANT ALL ON TABLE "public"."detail_transaksi_keluar" TO "anon";
GRANT ALL ON TABLE "public"."detail_transaksi_keluar" TO "authenticated";
GRANT ALL ON TABLE "public"."detail_transaksi_keluar" TO "service_role";



GRANT ALL ON SEQUENCE "public"."detail_transaksi_keluar_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."detail_transaksi_keluar_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."detail_transaksi_keluar_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."event_promo" TO "anon";
GRANT ALL ON TABLE "public"."event_promo" TO "authenticated";
GRANT ALL ON TABLE "public"."event_promo" TO "service_role";



GRANT ALL ON TABLE "public"."event_promo_produk" TO "anon";
GRANT ALL ON TABLE "public"."event_promo_produk" TO "authenticated";
GRANT ALL ON TABLE "public"."event_promo_produk" TO "service_role";



GRANT ALL ON TABLE "public"."kas_admin_topup" TO "anon";
GRANT ALL ON TABLE "public"."kas_admin_topup" TO "authenticated";
GRANT ALL ON TABLE "public"."kas_admin_topup" TO "service_role";



GRANT ALL ON TABLE "public"."kategori" TO "anon";
GRANT ALL ON TABLE "public"."kategori" TO "authenticated";
GRANT ALL ON TABLE "public"."kategori" TO "service_role";



GRANT ALL ON TABLE "public"."kategori_beban" TO "anon";
GRANT ALL ON TABLE "public"."kategori_beban" TO "authenticated";
GRANT ALL ON TABLE "public"."kategori_beban" TO "service_role";



GRANT ALL ON SEQUENCE "public"."kategori_beban_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."kategori_beban_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."kategori_beban_id_seq" TO "service_role";



GRANT ALL ON SEQUENCE "public"."kategori_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."kategori_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."kategori_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."log_aktivitas" TO "anon";
GRANT ALL ON TABLE "public"."log_aktivitas" TO "authenticated";
GRANT ALL ON TABLE "public"."log_aktivitas" TO "service_role";



GRANT ALL ON TABLE "public"."lokasi_area" TO "anon";
GRANT ALL ON TABLE "public"."lokasi_area" TO "authenticated";
GRANT ALL ON TABLE "public"."lokasi_area" TO "service_role";



GRANT ALL ON SEQUENCE "public"."lokasi_area_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."lokasi_area_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."lokasi_area_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."merk" TO "anon";
GRANT ALL ON TABLE "public"."merk" TO "authenticated";
GRANT ALL ON TABLE "public"."merk" TO "service_role";



GRANT ALL ON SEQUENCE "public"."merk_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."merk_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."merk_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."metode_bayar" TO "anon";
GRANT ALL ON TABLE "public"."metode_bayar" TO "authenticated";
GRANT ALL ON TABLE "public"."metode_bayar" TO "service_role";



GRANT ALL ON SEQUENCE "public"."metode_bayar_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."metode_bayar_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."metode_bayar_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."pelanggan" TO "anon";
GRANT ALL ON TABLE "public"."pelanggan" TO "authenticated";
GRANT ALL ON TABLE "public"."pelanggan" TO "service_role";



GRANT ALL ON SEQUENCE "public"."pelanggan_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."pelanggan_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."pelanggan_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."pengaturan" TO "anon";
GRANT ALL ON TABLE "public"."pengaturan" TO "authenticated";
GRANT ALL ON TABLE "public"."pengaturan" TO "service_role";



GRANT ALL ON TABLE "public"."pengaturan_keuangan" TO "anon";
GRANT ALL ON TABLE "public"."pengaturan_keuangan" TO "authenticated";
GRANT ALL ON TABLE "public"."pengaturan_keuangan" TO "service_role";



GRANT ALL ON TABLE "public"."pengeluaran" TO "anon";
GRANT ALL ON TABLE "public"."pengeluaran" TO "authenticated";
GRANT ALL ON TABLE "public"."pengeluaran" TO "service_role";



GRANT ALL ON TABLE "public"."pengguna" TO "anon";
GRANT ALL ON TABLE "public"."pengguna" TO "authenticated";
GRANT ALL ON TABLE "public"."pengguna" TO "service_role";



GRANT ALL ON SEQUENCE "public"."pengguna_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."pengguna_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."pengguna_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."produk" TO "anon";
GRANT ALL ON TABLE "public"."produk" TO "authenticated";
GRANT ALL ON TABLE "public"."produk" TO "service_role";



GRANT ALL ON SEQUENCE "public"."produk_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."produk_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."produk_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."qr_session" TO "anon";
GRANT ALL ON TABLE "public"."qr_session" TO "authenticated";
GRANT ALL ON TABLE "public"."qr_session" TO "service_role";



GRANT ALL ON SEQUENCE "public"."qr_session_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."qr_session_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."qr_session_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."retur_pembelian" TO "anon";
GRANT ALL ON TABLE "public"."retur_pembelian" TO "authenticated";
GRANT ALL ON TABLE "public"."retur_pembelian" TO "service_role";



GRANT ALL ON TABLE "public"."riwayat_avco" TO "anon";
GRANT ALL ON TABLE "public"."riwayat_avco" TO "authenticated";
GRANT ALL ON TABLE "public"."riwayat_avco" TO "service_role";



GRANT ALL ON TABLE "public"."saldo_kas_harian" TO "anon";
GRANT ALL ON TABLE "public"."saldo_kas_harian" TO "authenticated";
GRANT ALL ON TABLE "public"."saldo_kas_harian" TO "service_role";



GRANT ALL ON TABLE "public"."satuan" TO "anon";
GRANT ALL ON TABLE "public"."satuan" TO "authenticated";
GRANT ALL ON TABLE "public"."satuan" TO "service_role";



GRANT ALL ON SEQUENCE "public"."satuan_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."satuan_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."satuan_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."sesi_stok_opname" TO "anon";
GRANT ALL ON TABLE "public"."sesi_stok_opname" TO "authenticated";
GRANT ALL ON TABLE "public"."sesi_stok_opname" TO "service_role";



GRANT ALL ON TABLE "public"."stok_opname" TO "anon";
GRANT ALL ON TABLE "public"."stok_opname" TO "authenticated";
GRANT ALL ON TABLE "public"."stok_opname" TO "service_role";



GRANT ALL ON SEQUENCE "public"."stok_opname_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."stok_opname_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."stok_opname_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."supplier" TO "anon";
GRANT ALL ON TABLE "public"."supplier" TO "authenticated";
GRANT ALL ON TABLE "public"."supplier" TO "service_role";



GRANT ALL ON SEQUENCE "public"."supplier_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."supplier_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."supplier_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."transaksi_keluar" TO "anon";
GRANT ALL ON TABLE "public"."transaksi_keluar" TO "authenticated";
GRANT ALL ON TABLE "public"."transaksi_keluar" TO "service_role";



GRANT ALL ON SEQUENCE "public"."transaksi_keluar_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."transaksi_keluar_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."transaksi_keluar_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."v_stok_produk" TO "anon";
GRANT ALL ON TABLE "public"."v_stok_produk" TO "authenticated";
GRANT ALL ON TABLE "public"."v_stok_produk" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";







