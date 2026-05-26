ALTER TABLE produk ADD COLUMN IF NOT EXISTS barcode TEXT;

-- Generate unique barcodes (Indonesia EAN-13 prefix + padded ID)
UPDATE produk SET barcode = '899' || LPAD(id::TEXT, 10, '0') WHERE barcode IS NULL;

ALTER TABLE produk ADD CONSTRAINT produk_barcode_key UNIQUE (barcode);
