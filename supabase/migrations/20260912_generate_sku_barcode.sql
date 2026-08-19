-- Migration: Generate SKU & Barcode untuk semua produk
-- Format: M(1) + Merk(2) + Nama(3) + Counter(2) = 8 karakter
-- SKU existing dipertahankan, Barcode di-generate ulang (= SKU)

DO $$
DECLARE
  r RECORD;
  merk_code TEXT;
  merk_nama TEXT;
  nama_clean TEXT;
  nama_letters TEXT;
  base TEXT;
  counter INT;
  new_sku TEXT;
  existing_skus TEXT[];
  sku_set TEXT[];
  is_sku_falsey BOOLEAN;
  is_barcode_falsey BOOLEAN;
BEGIN
  -- Kumpulkan semua SKU dan Barcode yang sudah ada agar tidak bentrok
  SELECT COALESCE(array_agg(DISTINCT code), '{}') INTO existing_skus
  FROM (
    SELECT sku AS code FROM produk WHERE sku IS NOT NULL AND trim(sku) !~ '^[-–—_]+$'
    UNION
    SELECT barcode AS code FROM produk WHERE barcode IS NOT NULL AND trim(barcode) !~ '^[-–—_]+$'
  ) sub;

  -- Inisialisasi set SKU existing
  sku_set := existing_skus;

  -- Loop semua produk
  FOR r IN SELECT p.id, p.nama_produk, p.sku, p.barcode, p.id_merk
             FROM produk p
             ORDER BY p.id
  LOOP
    -- Cek apakah SKU atau Barcode existing valid
    is_sku_falsey := (r.sku IS NULL OR trim(r.sku) IN ('', '-', '--', '—', 'null', 'undefined', 'n/a', '#n/a') OR trim(r.sku) ~ '^[-–—_]+$');
    is_barcode_falsey := (r.barcode IS NULL OR trim(r.barcode) IN ('', '-', '--', '—', 'null', 'undefined', 'n/a', '#n/a') OR trim(r.barcode) ~ '^[-–—_]+$');

    -- Ambil kode & nama merk
    IF r.id_merk IS NOT NULL THEN
      SELECT kode, nama INTO merk_code, merk_nama
      FROM merk WHERE id = r.id_merk;

      -- Ambil 2 huruf pertama kode merk (uppercase), pad jika kurang
      merk_code := upper(COALESCE(regexp_replace(trim(merk_code), '[^A-Za-z0-9]', '', 'g'), 'NO'));
      IF length(merk_code) < 2 THEN
        merk_code := rpad(merk_code, 2, 'X');
      END IF;
      merk_code := left(merk_code, 2);
      merk_nama := COALESCE(merk_nama, '');
    ELSE
      merk_code := 'NO';
      merk_nama := '';
    END IF;

    -- Bersihkan nama: uppercase, hapus nama merk
    nama_clean := upper(trim(r.nama_produk));
    IF merk_nama != '' THEN
      nama_clean := regexp_replace(nama_clean, upper(trim(merk_nama)), '', 'g');
    END IF;

    -- Ambil hanya huruf (hapus angka, spasi, simbol)
    nama_letters := regexp_replace(nama_clean, '[^A-Z]', '', 'g');
    IF length(nama_letters) < 3 THEN
      nama_letters := rpad(nama_letters, 3, 'X');
    ELSE
      nama_letters := left(nama_letters, 3);
    END IF;

    -- Base SKU: M + Merk(2) + Nama(3) = 6 karakter
    base := 'M' || merk_code || nama_letters;

    -- Generate format M baru JIKA DIBUTUHKAN
    -- Butuh jika SKU kosong, ATAU barcode kosong/tidak diawali M, atau panjangnya bukan 8
    IF is_sku_falsey OR is_barcode_falsey OR NOT (upper(trim(r.barcode)) LIKE 'M%' AND length(trim(r.barcode)) = 8) THEN
      -- Cari counter yang belum dipakai
      FOR counter IN 1..99 LOOP
        new_sku := base || lpad(counter::text, 2, '0');
        IF NOT (new_sku = ANY(sku_set)) THEN
          EXIT; -- Counter ini unik
        END IF;
      END LOOP;

      -- Tambahkan ke set agar tidak bentrok
      sku_set := array_append(sku_set, new_sku);
    END IF;

    -- Update:
    -- 1. Barcode: Kalau sudah diawali M dan 8 karakter, BIAYARKAN SAJA. Kalau tidak (atau kosong), UPDATE ulang.
    -- 2. SKU: Kalau sudah ada (valid), BIAYARKAN SAJA. Kalau kosong, pakai format M baru (new_sku).
    UPDATE produk
    SET barcode = CASE WHEN (NOT is_barcode_falsey AND upper(trim(r.barcode)) LIKE 'M%' AND length(trim(r.barcode)) = 8) THEN r.barcode ELSE new_sku END,
        sku = CASE WHEN is_sku_falsey THEN new_sku ELSE r.sku END
    WHERE id = r.id;
  END LOOP;

  RAISE NOTICE 'SKU & Barcode generation selesai!';
END $$;

-- Verifikasi hasil
SELECT
  id,
  nama_produk,
  sku,
  barcode,
  length(barcode) AS barcode_len,
  CASE WHEN length(trim(barcode)) = 8 AND upper(barcode) LIKE 'M%' THEN 'OK' ELSE 'WARN' END AS barcode_status
FROM produk
ORDER BY id
LIMIT 20;
