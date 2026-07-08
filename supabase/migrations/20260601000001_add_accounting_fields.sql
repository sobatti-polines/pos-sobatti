-- File: 20260601000001_add_accounting_fields.sql

-- Tambah kolom HPP ke detail transaksi yang sudah ada
ALTER TABLE detail_transaksi_keluar
  ADD COLUMN harga_pokok_satuan NUMERIC(15,2) DEFAULT 0,
  ADD COLUMN total_harga_pokok  NUMERIC(15,2) DEFAULT 0;

ALTER TABLE transaksi_keluar
  ADD COLUMN total_hpp    NUMERIC(15,2) DEFAULT 0,
  ADD COLUMN laba_kotor   NUMERIC(15,2) DEFAULT 0;

-- Tambah kolom AVCO ke tabel produk
ALTER TABLE produk
  ADD COLUMN harga_pokok_avco    NUMERIC(15,2) DEFAULT 0,
  ADD COLUMN nilai_persediaan    NUMERIC(15,2) DEFAULT 0;
