-- Hapus produk duplikat Modern yang baru di-insert (id_kategori & id_satuan = NULL)
-- Jalankan ini DULU sebelum UPDATE merk!

DELETE FROM produk
WHERE id_merk = 385
  AND id_kategori IS NULL
  AND id_satuan IS NULL;

-- Cek hasil: seharusnya hanya tersisa produk asli (yang punya kategori & satuan)
-- SELECT id, nama_produk, id_kategori, id_satuan, id_merk FROM produk WHERE id_merk = 385;

-- Baru jalankan UPDATE merk:
-- UPDATE produk SET id_merk = 385 WHERE nama_produk IN ('...');
