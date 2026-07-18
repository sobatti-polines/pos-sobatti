DROP INDEX IF EXISTS produk_nama_produk_key;
ALTER TABLE produk DROP CONSTRAINT IF EXISTS produk_nama_produk_key;
ALTER TABLE produk ADD CONSTRAINT produk_nama_produk_unique UNIQUE (nama_produk, sku);
