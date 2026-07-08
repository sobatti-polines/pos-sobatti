-- File: 20260601000003_create_avco_tracking.sql

CREATE TABLE riwayat_avco (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_produk                 INTEGER NOT NULL REFERENCES produk(id),
  tanggal                   TIMESTAMPTZ NOT NULL DEFAULT now(),
  jenis_mutasi              TEXT NOT NULL
                              CHECK (jenis_mutasi IN ('pembelian','penjualan','koreksi','retur_beli','retur_jual')),
  id_referensi              INTEGER,
  qty_masuk                 NUMERIC(12,3),
  qty_keluar                NUMERIC(12,3),
  harga_satuan_transaksi    NUMERIC(15,2),
  stok_sebelum              NUMERIC(12,3) NOT NULL,
  avco_sebelum              NUMERIC(15,2) NOT NULL,
  stok_sesudah              NUMERIC(12,3) NOT NULL,
  avco_sesudah              NUMERIC(15,2) NOT NULL,
  nilai_persediaan_sesudah  NUMERIC(15,2) NOT NULL
);

CREATE INDEX idx_riwayat_avco_produk ON riwayat_avco(id_produk, tanggal DESC);
