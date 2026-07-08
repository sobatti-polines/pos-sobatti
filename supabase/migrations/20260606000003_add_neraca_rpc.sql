-- File: 20260606000003_add_neraca_rpc.sql

CREATE OR REPLACE FUNCTION get_inventory_value_at_date(p_date DATE)
RETURNS NUMERIC AS $$
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
$$ LANGUAGE plpgsql;
