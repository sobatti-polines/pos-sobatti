-- ============================================================
-- DUMMY DATA: Toko Bangunan (Building Materials Store)
-- ============================================================

-- 1. KATEGORI (Categories)
INSERT INTO kategori (nama) VALUES
  ('Semen & Mortar'),
  ('Cat & Pelapis'),
  ('Besi & Baja'),
  ('Kayu & Triplek'),
  ('Pipa & Sambungan'),
  ('Atap & Plafon'),
  ('Keramik & Lantai'),
  ('Alat Listrik'),
  ('Alat Pertukangan'),
  ('Mur & Baut'),
  ('Peralatan Kamar Mandi'),
  ('Lem & Perekat');

-- 2. SATUAN (Units)
INSERT INTO satuan (nama) VALUES
  ('Sak'),
  ('Kg'),
  ('Batang'),
  ('Lembar'),
  ('Liter'),
  ('Meter'),
  ('Dus'),
  ('Buah'),
  ('Kaleng'),
  ('Rol'),
  ('Kotak'),
  ('Set');

-- 3. METODE BAYAR (Payment Methods)
INSERT INTO metode_bayar (nama) VALUES
  ('Tunai'),
  ('Debit'),
  ('Transfer'),
  ('QRIS');

-- 4. SUPPLIER (Suppliers)
INSERT INTO supplier (nama_supplier, alamat, telepon, email, keterangan) VALUES
  ('PT Semen Indonesia Tbk', 'Jl. Raya Narogong Km 26, Bekasi', '021-12345678', 'sales@semenindonesia.co.id', 'Supplier semen dan mortar'),
  ('PT Nippon Paint Indonesia', 'Jl. Gatot Subroto Kav 56, Jakarta', '021-23456789', 'sales@nipponpaint.co.id', 'Supplier cat tembok dan kayu'),
  ('PT Krakatau Steel', 'Jl. Industri No 5, Cilegon', '0254-123456', 'sales@krakatausteel.co.id', 'Supplier besi dan baja'),
  ('CV Kayu Jaya Abadi', 'Jl. Raya Solo No 88, Semarang', '024-12345678', 'kayujaya@mail.com', 'Supplier kayu dan triplek'),
  ('PT Pipa Plastik Utama', 'Jl. Mangga Dua Raya No 12, Jakarta', '021-34567890', 'sales@pipaplastik.co.id', 'Supplier pipa PVC dan fitting'),
  ('PT Mulia Keramik Indah', 'Jl. Raya Bekasi Km 15, Jakarta', '021-45678901', 'sales@muliatile.co.id', 'Supplier keramik dan granit'),
  ('PT Schneider Electric', 'Jl. H.R. Rasuna Said Kav 10, Jakarta', '021-56789012', 'sales@schneider.co.id', 'Supplier alat listrik'),
  ('UD Maju Perkakas', 'Jl. Pasar Minggu No 45, Jakarta', '021-67890123', 'majuperkakas@mail.com', 'Supplier alat pertukangan'),
  ('PT Mur Baut Sejahtera', 'Jl. Raya Industri No 23, Tangerang', '021-78901234', 'sales@murbaut.co.id', 'Supplier mur dan baut');

-- 5. PELANGGAN (Customers)
INSERT INTO pelanggan (nama_pelanggan, alamat, no_hp, email, keterangan) VALUES
  ('Budi Santoso', 'Jl. Merdeka No 10, Jakarta', '081234567890', 'budi@gmail.com', 'Pelanggan tetap'),
  ('Siti Rahmawati', 'Perumahan Griya Asri Blok A5, Bekasi', '081298765432', 'siti.rahma@yahoo.com', NULL),
  ('Ahmad Hidayat', 'Jl. Kenanga No 22, Depok', '087812345678', 'ahmad.h@mail.com', 'Kontraktor'),
  ('CV Bangun Bersama', 'Jl. Sudirman Kav 15, Jakarta', '021-87654321', 'info@bangunbersama.co.id', 'Perusahaan konstruksi'),
  ('Dewi Lestari', 'Jl. Mawar No 7, Tangerang', '085612345678', 'dewilestari@mail.com', NULL),
  ('PT Properti Mandiri', 'Jl. Thamrin No 88, Jakarta', '021-98765432', 'procurement@propertimandiri.co.id', 'Pengembang properti'),
  ('Hendra Gunawan', 'Perumahan Permata Hijau Blok C3, Bekasi', '081345678901', 'hendra.g@mail.com', 'Pelanggan baru'),
  ('Toko Maju Bangunan', 'Jl. Raya Pasar No 15, Depok', '021-23456789', 'tokomaju@mail.com', 'Reseller bangunan');

-- 6. PENGGUNA (Users) — SHA-256 hashes
INSERT INTO pengguna (username, password, level, aktif) VALUES
  ('admin',   '240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9', 'ADMIN', true),
  ('kasir1',  'f02b7c1e519e4fa436147f7e1399974f9510aa9c8e0cb8be29151eb540f9d214', 'KASIR', true),
  ('kasir2',  'f02b7c1e519e4fa436147f7e1399974f9510aa9c8e0cb8be29151eb540f9d214', 'KASIR', true),
  ('owner',   '43a0d17178a9d26c9e0fe9a74b0b45e38d32f27aed887a008a54bf6e033bf7b9', 'OWNER', true);

-- 7. PRODUK (Products)
INSERT INTO produk (nama_produk, id_kategori, id_satuan, hitung_stok, harga_modal, harga_jual_satuan, harga_jual_grosir, diskon, barcode) VALUES
  -- Semen & Mortar (kategori 1)
  ('Semen Tiga Roda 50kg',      1, 1, true, 55000,  68000,  65000,  0, '8990000000001'),
  ('Semen Dynamix 50kg',        1, 1, true, 52000,  65000,  62000,  0, '8990000000002'),
  ('Semen Holcim 50kg',         1, 1, true, 54000,  67000,  64000,  0, '8990000000003'),
  ('Mortar Acian Putih 40kg',   1, 1, true, 48000,  60000,  58000,  0, '8990000000004'),
  ('Mortar Perekat Bata 40kg',  1, 1, true, 42000,  55000,  53000,  0, '8990000000005'),

  -- Cat & Pelapis (kategori 2)
  ('Cat Tembok Nippon 5kg',        2, 9, true, 85000,  115000, 110000, 0, '8990000000006'),
  ('Cat Tembok Dulux 5kg',         2, 9, true, 95000,  135000, 128000, 0, '8990000000007'),
  ('Cat Kayu Nippon 1kg',          2, 9, true, 35000,  48000,   45000, 0, '8990000000008'),
  ('Cat Besi Nippon 1kg',          2, 9, true, 38000,  50000,   48000, 0, '8990000000009'),
  ('Plamur Tembok 1kg',            2, 2, true, 12000,  18000,   17000, 0, '8990000000010'),
  ('Cat Tembok Avitex 25kg',       2, 9, true, 180000, 250000, 240000, 0, '8990000000011'),

  -- Besi & Baja (kategori 3)
  ('Besi Beton 10mm',              3, 3, true, 45000,  58000,   55000,  0, '8990000000012'),
  ('Besi Beton 12mm',              3, 3, true, 60000,  75000,   72000,  0, '8990000000013'),
  ('Besi Beton 8mm',               3, 3, true, 32000,  42000,   40000,  0, '8990000000014'),
  ('Besi Hollow 4x4 1.2mm',        3, 3, true, 55000,  72000,   68000,  0, '8990000000015'),
  ('Baja Ringan C75',              3, 3, true, 48000,  62000,   60000,  0, '8990000000016'),
  ('Wiremesh M8 2.1m x 5.4m',      3, 4, true, 280000, 350000, 340000, 0, '8990000000017'),

  -- Kayu & Triplek (kategori 4)
  ('Kayu Meranti 6x12 4m',         4, 3, true, 40000,  55000,   52000,  0, '8990000000018'),
  ('Kayu Borneo 5x10 4m',          4, 3, true, 28000,  38000,   36000,  0, '8990000000019'),
  ('Triplek 12mm 120x240cm',       4, 4, true, 85000,  120000, 115000, 0, '8990000000020'),
  ('Triplek 9mm 120x240cm',        4, 4, true, 65000,  90000,   85000,  0, '8990000000021'),
  ('Multiplek 18mm 120x240cm',     4, 4, true, 130000, 175000, 168000, 0, '8990000000022'),

  -- Pipa & Sambungan (kategori 5)
  ('Pipa PVC 1/2" AW',             5, 3, true, 8000,   12000,   11000,  0, '8990000000023'),
  ('Pipa PVC 3/4" AW',             5, 3, true, 10000,  15000,   14000,  0, '8990000000024'),
  ('Pipa PVC 1" AW',               5, 3, true, 14000,  20000,   19000,  0, '8990000000025'),
  ('Pipa PVC 2" AW',               5, 3, true, 25000,  35000,   33000,  0, '8990000000026'),
  ('Sambungan L 1/2"',             5, 8, true, 2500,   4000,    3800,   0, '8990000000027'),
  ('Sambungan T 1/2"',             5, 8, true, 3000,   5000,    4800,   0, '8990000000028'),
  ('Lem PVC 100ml',                 5, 8, true, 5000,   8000,    7500,   0, '8990000000029'),

  -- Atap & Plafon (kategori 6)
  ('Atap Seng Gelombang 1.8m',     6, 4, true, 35000,  48000,   46000,  0, '8990000000030'),
  ('Atap Spandek 0.3mm 6m',        6, 4, true, 70000,  95000,   92000,  0, '8990000000031'),
  ('Genteng Beton',                 6, 8, true, 3000,   4500,    4300,   0, '8990000000032'),
  ('Papan Gypsum 120x240cm',       6, 4, true, 50000,  70000,   68000,  0, '8990000000033'),
  ('List Gypsum 2.2m',              6, 3, true, 12000,  18000,   17000,  0, '8990000000034'),

  -- Keramik & Lantai (kategori 7)
  ('Keramik Mulia 40x40',          7, 7, true, 42000,  58000,   55000,  0, '8990000000035'),
  ('Keramik Mulia 50x50',          7, 7, true, 55000,  74000,   70000,  0, '8990000000036'),
  ('Keramik Dinding 25x40',        7, 7, true, 38000,  52000,   50000,  0, '8990000000037'),
  ('Granit 60x60',                 7, 7, true, 95000,  135000, 128000, 0, '8990000000038'),
  ('Nat Keramik 1kg',              7, 2, true, 8000,   12000,   11500,  0, '8990000000039'),
  ('Semen Instan Keramik 40kg',    7, 1, true, 45000,  58000,   56000,  0, '8990000000040'),

  -- Alat Listrik (kategori 8)
  ('Kabel NYM 2x1.5mm 50m',       8, 10, true, 120000, 165000, 158000, 0, '8990000000041'),
  ('Kabel NYM 3x2.5mm 50m',       8, 10, true, 200000, 280000, 268000, 0, '8990000000042'),
  ('MCB Schneider 6A',             8, 8, true, 35000,  50000,   48000,  0, '8990000000043'),
  ('MCB Schneider 10A',            8, 8, true, 35000,  50000,   48000,  0, '8990000000044'),
  ('Stop Kontak Broco',            8, 8, true, 8000,   12000,   11500,  0, '8990000000045'),
  ('Saklar Broco',                 8, 8, true, 7000,   10000,   9500,   0, '8990000000046'),
  ('Fitting Lampu',                8, 8, true, 4000,   6000,    5800,   0, '8990000000047'),

  -- Alat Pertukangan (kategori 9)
  ('Palu Estwing 16oz',            9, 8, true, 45000,  65000,   62000,  0, '8990000000048'),
  ('Obeng Set 6in1',               9, 12, true, 25000,  38000,   36000,  0, '8990000000049'),
  ('Tang Kombinasi',               9, 8, true, 28000,  42000,   40000,  0, '8990000000050'),
  ('Meteran 5m',                   9, 8, true, 15000,  22000,   21000,  0, '8990000000051'),
  ('Gergaji Kayu',                 9, 8, true, 18000,  28000,   26000,  0, '8990000000052'),
  ('Amplas 1 Rol',                 9, 10, true, 8000,   12000,   11500,  0, '8990000000053'),
  ('Bor Listrik',                  9, 8, true, 180000, 250000, 240000, 0, '8990000000054'),

  -- Mur & Baut (kategori 10)
  ('Baut 10mm 2cm',                10, 11, false, 50000,  75000,   72000,  0, '8990000000055'),
  ('Baut 12mm 3cm',                10, 11, false, 60000,  90000,   86000,  0, '8990000000056'),
  ('Mur 10mm',                     10, 11, false, 30000,  45000,   43000,  0, '8990000000057'),
  ('Ring 10mm',                    10, 11, false, 15000,  25000,   24000,  0, '8990000000058'),
  ('DynaBolt 10mm',                10, 8, true, 3000,   5000,    4800,   0, '8990000000059'),

  -- Peralatan Kamar Mandi (kategori 11)
  ('Closet Duduk',                 11, 8, true, 350000, 500000, 480000, 0, '8990000000060'),
  ('Closet Jongkok',               11, 8, true, 120000, 175000, 168000, 0, '8990000000061'),
  ('Shower Set',                   11, 8, true, 85000,  125000, 120000, 0, '8990000000062'),
  ('Keran Air',                    11, 8, true, 25000,  38000,   36000,  0, '8990000000063'),
  ('Fleksibel Pipa 50cm',          11, 8, true, 12000,  18000,   17000,  0, '8990000000064'),

  -- Lem & Perekat (kategori 12)
  ('Lem Kayu 500ml',               12, 8, true, 15000,  22000,   21000,  0, '8990000000065'),
  ('Silicon Sealant 300ml',        12, 8, true, 20000,  30000,   28000,  0, '8990000000066'),
  ('Lem Super 3g',                 12, 8, true, 5000,   8000,    7500,   0, '8990000000067'),
  ('Fox 50gr',                     12, 8, true, 4000,   6500,    6000,   0, '8990000000068');

-- 8. BARANG MASUK (Stock In — 3 months of history)
INSERT INTO barang_masuk (tgl_masuk, id_supplier, id_produk, harga_beli, jumlah, total) VALUES
  -- Supplier 1: Semen Indonesia
  ('2026-02-03', 1, 1, 55000,  50,  2750000),
  ('2026-02-03', 1, 2, 52000,  30,  1560000),
  ('2026-02-10', 1, 4, 48000,  20,   960000),
  ('2026-02-17', 1, 5, 42000,  25,  1050000),
  ('2026-03-05', 1, 1, 55000,  60,  3300000),
  ('2026-03-12', 1, 3, 54000,  40,  2160000),
  ('2026-04-02', 1, 1, 55000,  50,  2750000),
  ('2026-04-15', 1, 2, 52000,  35,  1820000),
  ('2026-04-20', 1, 5, 42000,  30,  1260000),

  -- Supplier 2: Nippon Paint
  ('2026-02-05', 2, 6,  85000,  20,  1700000),
  ('2026-02-05', 2, 7,  95000,  15,  1425000),
  ('2026-02-18', 2, 8,  35000,  24,   840000),
  ('2026-03-08', 2, 6,  85000,  25,  2125000),
  ('2026-03-08', 2, 9,  38000,  30,  1140000),
  ('2026-03-22', 2, 11, 180000, 10,  1800000),
  ('2026-04-10', 2, 7,  95000,  18,  1710000),

  -- Supplier 3: Krakatau Steel
  ('2026-02-08', 3, 12, 45000,  40,  1800000),
  ('2026-02-08', 3, 13, 60000,  30,  1800000),
  ('2026-02-22', 3, 14, 32000,  50,  1600000),
  ('2026-03-10', 3, 16, 48000,  35,  1680000),
  ('2026-03-25', 3, 15, 55000,  25,  1375000),
  ('2026-04-05', 3, 12, 45000,  50,  2250000),
  ('2026-04-18', 3, 17, 280000, 15,  4200000),

  -- Supplier 4: Kayu Jaya
  ('2026-02-12', 4, 18, 40000,  30,  1200000),
  ('2026-02-12', 4, 19, 28000,  40,  1120000),
  ('2026-03-01', 4, 20, 85000,  20,  1700000),
  ('2026-03-15', 4, 22, 130000, 15,  1950000),
  ('2026-04-08', 4, 21, 65000,  25,  1625000),
  ('2026-04-22', 4, 18, 40000,  35,  1400000),

  -- Supplier 5: Pipa Plastik
  ('2026-02-15', 5, 23, 8000,   100,   800000),
  ('2026-02-15', 5, 24, 10000,  80,   800000),
  ('2026-02-28', 5, 25, 14000,  60,   840000),
  ('2026-03-10', 5, 26, 25000,  40,  1000000),
  ('2026-03-28', 5, 29, 5000,   50,   250000),
  ('2026-04-12', 5, 23, 8000,   120,  960000),

  -- Supplier 7: Schneider
  ('2026-02-20', 7, 42, 120000, 10,  1200000),
  ('2026-03-05', 7, 44, 35000,  30,  1050000),
  ('2026-03-05', 7, 45, 35000,  30,  1050000),
  ('2026-03-20', 7, 42, 120000, 15,  1800000),
  ('2026-04-15', 7, 46, 8000,   50,   400000),
  ('2026-04-15', 7, 47, 7000,   50,   350000),

  -- Supplier 8: Maju Perkakas
  ('2026-02-25', 8, 49, 45000,  15,   675000),
  ('2026-03-12', 8, 50, 25000,  20,   500000),
  ('2026-03-28', 8, 52, 15000,  30,   450000),
  ('2026-04-10', 8, 55, 180000, 8,   1440000);

-- 9. TRANSAKSI KELUAR (Sales Transactions)
-- Transaction 1: Cash sale to Budi Santoso
INSERT INTO transaksi_keluar (no_transaksi, tgl_transaksi, id_kasir, id_pelanggan, id_metode_bayar, subtotal, diskon_persen, diskon_nominal, pajak_persen, pajak_nominal, total, bayar, kembali, dp, sisa) VALUES
  (2026040001, '2026-04-01 09:15:00', 2, 1, 1, 185000, 0, 0, 0, 0, 185000, 200000, 15000, 0, 0);
INSERT INTO detail_transaksi_keluar (id_transaksi, id_produk, type_harga_jual, harga_modal, harga_jual, diskon_item, qty, jumlah, kas_masuk, profit) VALUES
  (1, 1,  'SATUAN', 55000,  68000,  0, 2, 136000, 136000, 26000),
  (1, 23, 'SATUAN', 8000,   12000,  0, 3, 36000,  36000,  12000),
  (1, 29, 'SATUAN', 5000,   8000,   0, 1, 8000,   8000,   3000);

-- Transaction 2: Credit sale to CV Bangun Bersama
INSERT INTO transaksi_keluar (no_transaksi, tgl_transaksi, id_kasir, id_pelanggan, id_metode_bayar, subtotal, diskon_persen, diskon_nominal, pajak_persen, pajak_nominal, total, bayar, kembali, dp, sisa) VALUES
  (2026040002, '2026-04-03 10:30:00', 2, 4, 3, 1625000, 5, 81250, 0, 0, 1543750, 1000000, 0, 500000, 543750);
INSERT INTO detail_transaksi_keluar (id_transaksi, id_produk, type_harga_jual, harga_modal, harga_jual, diskon_item, qty, jumlah, kas_masuk, profit) VALUES
  (2, 13, 'SATUAN', 60000, 75000,  0, 15, 1125000, 1125000, 225000),
  (2, 14, 'SATUAN', 32000, 42000,  0, 10, 420000,  420000,  100000),
  (2, 57, 'SATUAN', 45000, 65000,  0, 1, 65000,   65000,   20000);

-- Transaction 3: Cash sale to walk-in customer (no pelanggan)
INSERT INTO transaksi_keluar (no_transaksi, tgl_transaksi, id_kasir, id_pelanggan, id_metode_bayar, subtotal, diskon_persen, diskon_nominal, pajak_persen, pajak_nominal, total, bayar, kembali, dp, sisa) VALUES
  (2026040003, '2026-04-05 14:00:00', 3, NULL, 1, 248000, 0, 0, 0, 0, 248000, 250000, 2000, 0, 0);
INSERT INTO detail_transaksi_keluar (id_transaksi, id_produk, type_harga_jual, harga_modal, harga_jual, diskon_item, qty, jumlah, kas_masuk, profit) VALUES
  (3, 6,  'SATUAN', 85000,  115000, 0, 1, 115000, 115000, 30000),
  (3, 10, 'SATUAN', 12000,  18000,  0, 2, 36000,  36000,  12000),
  (3, 48, 'SATUAN', 45000,  65000,  0, 1, 65000,  65000,  20000);

-- Transaction 4: Large order from PT Properti Mandiri
INSERT INTO transaksi_keluar (no_transaksi, tgl_transaksi, id_kasir, id_pelanggan, id_metode_bayar, subtotal, diskon_persen, diskon_nominal, pajak_persen, pajak_nominal, total, bayar, kembali, dp, sisa) VALUES
  (2026040004, '2026-04-08 11:00:00', 2, 6, 3, 4850000, 10, 485000, 0, 0, 4365000, 2500000, 0, 1000000, 865000);
INSERT INTO detail_transaksi_keluar (id_transaksi, id_produk, type_harga_jual, harga_modal, harga_jual, diskon_item, qty, jumlah, kas_masuk, profit) VALUES
  (4, 32, 'GROSIR', 70000,  92000,  0, 30, 2760000, 2760000, 660000),
  (4, 35, 'SATUAN', 50000,  70000,  0, 20, 1400000, 1400000, 400000),
  (4, 62, 'SATUAN', 120000, 175000, 0, 4, 525000,  525000,  220000);

-- Transaction 5: Cash sale
INSERT INTO transaksi_keluar (no_transaksi, tgl_transaksi, id_kasir, id_pelanggan, id_metode_bayar, subtotal, diskon_persen, diskon_nominal, pajak_persen, pajak_nominal, total, bayar, kembali, dp, sisa) VALUES
  (2026040005, '2026-04-10 16:45:00', 3, 3, 4, 535000, 0, 0, 0, 0, 535000, 535000, 0, 0, 0);
INSERT INTO detail_transaksi_keluar (id_transaksi, id_produk, type_harga_jual, harga_modal, harga_jual, diskon_item, qty, jumlah, kas_masuk, profit) VALUES
  (5, 37, 'SATUAN', 42000,  58000,  0, 5, 290000, 290000, 80000),
  (5, 39, 'SATUAN', 38000,  52000,  0, 3, 156000, 156000, 42000),
  (5, 56, 'SATUAN', 3000,   4500,   0, 12, 54000,  54000,  18000);

-- Transaction 6: Small cash sale
INSERT INTO transaksi_keluar (no_transaksi, tgl_transaksi, id_kasir, id_pelanggan, id_metode_bayar, subtotal, diskon_persen, diskon_nominal, pajak_persen, pajak_nominal, total, bayar, kembali, dp, sisa) VALUES
  (2026040006, '2026-04-12 08:30:00', 2, NULL, 1, 72000, 0, 0, 0, 0, 72000, 100000, 28000, 0, 0);
INSERT INTO detail_transaksi_keluar (id_transaksi, id_produk, type_harga_jual, harga_modal, harga_jual, diskon_item, qty, jumlah, kas_masuk, profit) VALUES
  (6, 53, 'SATUAN', 8000,   12000,  0, 3, 36000,  36000,  12000),
  (6, 54, 'SATUAN', 7000,   10000,  0, 2, 20000,  20000,  6000),
  (6, 48, 'SATUAN', 5000,   8000,   0, 2, 16000,  16000,  6000);

-- Transaction 7: Reseller order from Toko Maju Bangunan
INSERT INTO transaksi_keluar (no_transaksi, tgl_transaksi, id_kasir, id_pelanggan, id_metode_bayar, subtotal, diskon_persen, diskon_nominal, pajak_persen, pajak_nominal, total, bayar, kembali, dp, sisa) VALUES
  (2026040007, '2026-04-15 09:00:00', 2, 8, 2, 2140000, 3, 64200, 0, 0, 2075800, 2075800, 0, 0, 0);
INSERT INTO detail_transaksi_keluar (id_transaksi, id_produk, type_harga_jual, harga_modal, harga_jual, diskon_item, qty, jumlah, kas_masuk, profit) VALUES
  (7, 1,  'GROSIR', 55000, 65000,  0, 10, 650000,  650000,  100000),
  (7, 4,  'GROSIR', 48000, 58000,  0, 8, 464000,  464000,  80000),
  (7, 37, 'GROSIR', 42000, 55000,  0, 12, 660000,  660000,  156000),
  (7, 6,  'GROSIR', 85000, 110000, 0, 3, 330000,  330000,  75000);

-- Transaction 8: Debit sale to Siti
INSERT INTO transaksi_keluar (no_transaksi, tgl_transaksi, id_kasir, id_pelanggan, id_metode_bayar, subtotal, diskon_persen, diskon_nominal, pajak_persen, pajak_nominal, total, bayar, kembali, dp, sisa) VALUES
  (2026040008, '2026-04-18 13:20:00', 3, 2, 2, 276000, 0, 0, 0, 0, 276000, 300000, 24000, 0, 0);
INSERT INTO detail_transaksi_keluar (id_transaksi, id_produk, type_harga_jual, harga_modal, harga_jual, diskon_item, qty, jumlah, kas_masuk, profit) VALUES
  (8, 30, 'SATUAN', 4500,   6500,   0, 10, 65000,   65000,   20000),
  (8, 25, 'SATUAN', 14000,  20000,  0, 5, 100000,  100000,  30000),
  (8, 24, 'SATUAN', 10000,  15000,  0, 4, 60000,   60000,   20000);

-- Transaction 9: Cash sale - tools
INSERT INTO transaksi_keluar (no_transaksi, tgl_transaksi, id_kasir, id_pelanggan, id_metode_bayar, subtotal, diskon_persen, diskon_nominal, pajak_persen, pajak_nominal, total, bayar, kembali, dp, sisa) VALUES
  (2026040009, '2026-04-20 15:10:00', 2, 7, 1, 448000, 0, 0, 0, 0, 448000, 500000, 52000, 0, 0);
INSERT INTO detail_transaksi_keluar (id_transaksi, id_produk, type_harga_jual, harga_modal, harga_jual, diskon_item, qty, jumlah, kas_masuk, profit) VALUES
  (9, 49, 'SATUAN', 45000,  65000,  0, 2, 130000, 130000,  40000),
  (9, 50, 'SATUAN', 25000,  38000,  0, 3, 114000, 114000,  39000),
  (9, 55, 'SATUAN', 180000, 250000, 0, 1, 250000, 250000,  70000);

-- Transaction 10: Small cash sale - pipa
INSERT INTO transaksi_keluar (no_transaksi, tgl_transaksi, id_kasir, id_pelanggan, id_metode_bayar, subtotal, diskon_persen, diskon_nominal, pajak_persen, pajak_nominal, total, bayar, kembali, dp, sisa) VALUES
  (2026040010, '2026-04-22 10:00:00', 3, NULL, 1, 66000, 0, 0, 0, 0, 66000, 70000, 4000, 0, 0);
INSERT INTO detail_transaksi_keluar (id_transaksi, id_produk, type_harga_jual, harga_modal, harga_jual, diskon_item, qty, jumlah, kas_masuk, profit) VALUES
  (10, 23, 'SATUAN', 8000,  12000, 0, 3, 36000, 36000, 12000),
  (10, 27, 'SATUAN', 2500,  4000,  0, 5, 20000, 20000, 7500),
  (10, 28, 'SATUAN', 3000,  5000,  0, 2, 10000, 10000, 4000);

-- 10. PENGATURAN (Store Settings)
INSERT INTO pengaturan (id, nama_toko, alamat, telepon, email, nama_kasir_aktif, metode_diskon, footer_struk_1, footer_struk_2, footer_struk_3, footer_invoice_1, footer_invoice_2, footer_invoice_3)
VALUES (1, 'Toko Bangunan Sobat', 'Jl. Raya Pasar No 123, Jakarta', '021-12345678', 'toko@sobats.com', 'Kasir', 'Nominal', 'Terima kasih telah berbelanja', 'Barang yang sudah dibeli tidak dapat dikembalikan', 'Layanan konsumen: 0812-3456-7890', 'Pembayaran via transfer ke BCA 1234567890 a.n. Toko Sobat', 'Pembayaran via QRIS tersedia', 'Terima kasih atas kepercayaan Anda');
