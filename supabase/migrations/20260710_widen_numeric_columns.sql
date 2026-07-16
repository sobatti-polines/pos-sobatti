ALTER TABLE produk
  ALTER COLUMN harga_pokok_avco  TYPE numeric,
  ALTER COLUMN nilai_persediaan  TYPE numeric;

ALTER TABLE riwayat_avco
  ALTER COLUMN harga_satuan_transaksi   TYPE numeric,
  ALTER COLUMN avco_sebelum             TYPE numeric,
  ALTER COLUMN avco_sesudah             TYPE numeric,
  ALTER COLUMN nilai_persediaan_sesudah TYPE numeric;
