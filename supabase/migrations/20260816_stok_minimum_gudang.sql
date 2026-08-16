-- 20260816_stok_minimum_gudang.sql
-- Peringatan stok GUDANG menipis, terpisah dari peringatan display.
--
-- Aturan:
--   * Ambang batas dinyatakan dalam SATUAN INVENTORY (pcs, meter, set, pak, dll)
--     — sama dengan satuan stok_gudang.
--   * Default NULL = peringatan nonaktif sampai admin mengisi ambang batasnya.
--   * Aktif jika stok_minimum_gudang diisi dan stok_gudang <= ambang batas
--     (termasuk stok gudang 0 — gudang kosong = perlu segera diisi).

ALTER TABLE produk
  ADD COLUMN IF NOT EXISTS stok_minimum_gudang NUMERIC;

COMMENT ON COLUMN produk.stok_minimum_gudang IS
  'Ambang batas peringatan stok gudang menipis (satuan inventory). NULL = nonaktif.';
