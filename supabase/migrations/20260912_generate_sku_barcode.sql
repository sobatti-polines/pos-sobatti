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
  is_falsey BOOLEAN;
BEGIN
  -- Kumpulkan semua SKU yang sudah ada
  SELECT COALESCE(array_agg(sku), '{}') INTO existing_skus
  FROM produk
  WHERE sku IS NOT NULL
    AND trim(sku) NOT IN ('', '-', '--', '—', 'null', 'undefined', 'n/a', '#n/a');

  -- Inisialisasi set SKU existing
  sku_set := existing_skus;

  -- Loop semua produk
  FOR r IN SELECT p.id, p.nama_produk, p.sku, p.barcode, p.id_merk
             FROM produk p
             ORDER BY p.id
  LOOP
    -- Cek apakah SKU existing valid
    is_falsey := (r.sku IS NULL OR trim(r.sku) IN ('', '-', '--', '—', 'null', 'undefined', 'n/a', '#n/a'));

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

    -- Generate SKU: gunakan counter unik
    IF NOT is_falsey THEN
      -- SKU sudah ada → pertahankan
      new_sku := r.sku;
    ELSE
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

    -- Update: SKU (jika baru) + Barcode SELALU di-generate (= SKU)
    UPDATE produk
    SET barcode = new_sku,
        sku = CASE WHEN is_falsey THEN new_sku ELSE sku END
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
  length(sku) AS sku_len,
  CASE WHEN length(sku) = 8 THEN 'OK' ELSE 'WARN' END AS sku_status
FROM produk
ORDER BY id
LIMIT 20;
