-- UoM (Unit of Measure) Conversion System
-- Allows inbound stock to be received in bulk units (Lusin, Roll, Set)
-- and automatically converted to base unit (Pcs) for inventory.

-- 1. Add UoM columns to produk table
ALTER TABLE produk
  ADD COLUMN IF NOT EXISTS base_unit              VARCHAR NOT NULL DEFAULT 'pcs',
  ADD COLUMN IF NOT EXISTS default_purchase_unit  VARCHAR,
  ADD COLUMN IF NOT EXISTS conversion_ratio       NUMERIC NOT NULL DEFAULT 1;

COMMENT ON COLUMN produk.base_unit IS 'Satuan dasar inventori (contoh: pcs)';
COMMENT ON COLUMN produk.default_purchase_unit IS 'Satuan pembelian default dari supplier (contoh: lusin, roll)';
COMMENT ON COLUMN produk.conversion_ratio IS 'Jumlah base_unit dalam 1 purchase_unit (contoh: 12 untuk lusin)';

-- 2. Add audit-trail columns to barang_masuk
ALTER TABLE barang_masuk
  ADD COLUMN IF NOT EXISTS supplied_unit              VARCHAR,
  ADD COLUMN IF NOT EXISTS supplied_qty               NUMERIC,
  ADD COLUMN IF NOT EXISTS applied_conversion_ratio   NUMERIC,
  ADD COLUMN IF NOT EXISTS base_qty_added             NUMERIC,
  ADD COLUMN IF NOT EXISTS total_cost                 NUMERIC,
  ADD COLUMN IF NOT EXISTS base_cost_per_piece        NUMERIC;

COMMENT ON COLUMN barang_masuk.supplied_unit IS 'Satuan saat barang diterima (contoh: lusin)';
COMMENT ON COLUMN barang_masuk.supplied_qty IS 'Jumlah dalam satuan suplai';
COMMENT ON COLUMN barang_masuk.applied_conversion_ratio IS 'Rasio konversi yg dipakai saat transaksi (snapshot)';
COMMENT ON COLUMN barang_masuk.base_qty_added IS 'supplied_qty * applied_conversion_ratio';
COMMENT ON COLUMN barang_masuk.total_cost IS 'Total harga beli dari supplier';
COMMENT ON COLUMN barang_masuk.base_cost_per_piece IS 'HPP per base_unit = total_cost / base_qty_added';
