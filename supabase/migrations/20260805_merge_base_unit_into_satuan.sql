-- 20260805_merge_base_unit_into_satuan.sql
-- Gabungkan kolom base_unit (teks bebas) ke dalam id_satuan (FK ke tabel satuan).
-- Sebelumnya dua kolom ini harus selalu sama nilainya; mulai sekarang
-- satuan.nama menjadi satu-satunya sumber "base unit" untuk perhitungan
-- stok/HPP dan label di struk/invoice.

BEGIN;

-- 1) Deduplikasi baris satuan yang sama secara case-insensitive ("Pcs" vs "pcs")
--    karena UNIQUE(nama) bersifat case-sensitive. Pertahankan id terkecil,
--    arahkan ulang produk yang menunjuk ke id lain.
UPDATE produk p
SET id_satuan = d.keep_id
FROM (
  SELECT id, MIN(id) OVER (PARTITION BY LOWER(TRIM(nama))) AS keep_id
  FROM satuan
) d
WHERE p.id_satuan = d.id
  AND d.keep_id <> d.id;

DELETE FROM satuan s
WHERE EXISTS (
  SELECT 1 FROM satuan s2
  WHERE LOWER(TRIM(s2.nama)) = LOWER(TRIM(s.nama))
    AND s2.id < s.id
);

-- 2) Backfill: untuk produk yang id_satuan-nya NULL atau namanya tidak cocok
--    dengan base_unit, set id_satuan ke satuan yang namanya sama dengan
--    base_unit (case-insensitive). Buat baris satuan baru jika belum ada.
DO $$
DECLARE
  p RECORD;
  v_id INTEGER;
  v_bu  TEXT;
BEGIN
  FOR p IN
    SELECT id, COALESCE(NULLIF(TRIM(base_unit), ''), 'pcs') AS bu
    FROM produk
    WHERE id_satuan IS NULL
       OR NOT EXISTS (
         SELECT 1 FROM satuan s
         WHERE s.id = produk.id_satuan
           AND LOWER(TRIM(s.nama)) = LOWER(TRIM(COALESCE(produk.base_unit, 'pcs')))
       )
  LOOP
    v_bu := p.bu;

    SELECT s.id INTO v_id
    FROM satuan s
    WHERE LOWER(TRIM(s.nama)) = LOWER(v_bu)
    LIMIT 1;

    IF v_id IS NULL THEN
      INSERT INTO satuan (nama) VALUES (v_bu) RETURNING id INTO v_id;
    END IF;

    UPDATE produk SET id_satuan = v_id WHERE id = p.id;
  END LOOP;
END $$;

-- 3) Hapus kolom base_unit beserta default-nya
ALTER TABLE produk DROP COLUMN IF EXISTS base_unit;

COMMIT;
