-- 20260810_barang_masuk_no_surat.sql
-- T1-01: Tambah kolom no_surat (no. faktur/nota/DO dari supplier) di barang_masuk.
-- Referensi dokumen fisik dari supplier untuk keperluan audit & pelacakan.
-- Column nullable agar data lama tetap valid; tidak UNIQUE (bisa ada beberapa
-- barang masuk dengan faktur yang sama di supplier yang sama).

ALTER TABLE barang_masuk
  ADD COLUMN IF NOT EXISTS no_surat TEXT NULL;

COMMENT ON COLUMN barang_masuk.no_surat IS 'No. faktur/nota/DO dari supplier (opsional)';

CREATE INDEX IF NOT EXISTS idx_barang_masuk_no_surat ON barang_masuk(no_surat);