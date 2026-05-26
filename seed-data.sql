-- ============================================================
-- SEED DATA: Toko Bangunan Sobat
-- Satuan IDs: Sak=8, Batang=9, Lembar=10, Meter=11, Dus=12,
--             Buah=13, Kaleng=14, Rol=15, Kotak=16, Set=17
-- Metode Bayar IDs: Tunai=1, DP=2, QRIS=3, Debit Mandiri=4,
--                   Debit BNI=5, Transfer=7, Debit=8
-- ============================================================

-- PRODUK (Products)
INSERT INTO produk (nama_produk, id_kategori, id_satuan, hitung_stok, harga_modal, harga_jual_satuan, harga_jual_grosir, diskon) VALUES
  -- Semen & Mortar (kategori 6)
  ('Semen Tiga Roda 50kg',      6, 8,  true, 55000,  68000,  65000,  0),
  ('Semen Dynamix 50kg',        6, 8,  true, 52000,  65000,  62000,  0),
  ('Semen Holcim 50kg',         6, 8,  true, 54000,  67000,  64000,  0),
  ('Mortar Acian Putih 40kg',   6, 8,  true, 48000,  60000,  58000,  0),
  ('Mortar Perekat Bata 40kg',  6, 8,  true, 42000,  55000,  53000,  0),

  -- Cat & Pelapis (kategori 7)
  ('Cat Tembok Nippon 5kg',       7, 14, true, 85000,  115000, 110000, 0),
  ('Cat Tembok Dulux 5kg',        7, 14, true, 95000,  135000, 128000, 0),
  ('Cat Kayu Nippon 1kg',          7, 14, true, 35000,  48000,   45000, 0),
  ('Cat Besi Nippon 1kg',          7, 14, true, 38000,  50000,   48000, 0),
  ('Plamur Tembok 1kg',            7, 2,  true, 12000,  18000,   17000, 0),
  ('Cat Tembok Avitex 25kg',       7, 14, true, 180000, 250000, 240000, 0),

  -- Besi & Baja (kategori 8)
  ('Besi Beton 10mm',              8, 9,  true, 45000,  58000,   55000,  0),
  ('Besi Beton 12mm',              8, 9,  true, 60000,  75000,   72000,  0),
  ('Besi Beton 8mm',               8, 9,  true, 32000,  42000,   40000,  0),
  ('Besi Hollow 4x4 1.2mm',        8, 9,  true, 55000,  72000,   68000,  0),
  ('Baja Ringan C75',              8, 9,  true, 48000,  62000,   60000,  0),
  ('Wiremesh M8 2.1m x 5.4m',      8, 10, true, 280000, 350000, 340000, 0),

  -- Kayu & Triplek (kategori 9)
  ('Kayu Meranti 6x12 4m',         9, 9,  true, 40000,  55000,   52000,  0),
  ('Kayu Borneo 5x10 4m',          9, 9,  true, 28000,  38000,   36000,  0),
  ('Triplek 12mm 120x240cm',       9, 10, true, 85000,  120000, 115000, 0),
  ('Triplek 9mm 120x240cm',        9, 10, true, 65000,  90000,   85000,  0),
  ('Multiplek 18mm 120x240cm',     9, 10, true, 130000, 175000, 168000, 0),

  -- Pipa & Sambungan (kategori 10)
  ('Pipa PVC 1/2" AW',             10, 9, true, 8000,   12000,   11000,  0),
  ('Pipa PVC 3/4" AW',             10, 9, true, 10000,  15000,   14000,  0),
  ('Pipa PVC 1" AW',               10, 9, true, 14000,  20000,   19000,  0),
  ('Pipa PVC 2" AW',               10, 9, true, 25000,  35000,   33000,  0),
  ('Sambungan L 1/2"',             10, 13, true, 2500,   4000,    3800,   0),
  ('Sambungan T 1/2"',             10, 13, true, 3000,   5000,    4800,   0),
  ('Lem PVC 100ml',                 10, 13, true, 5000,   8000,    7500,   0),

  -- Atap & Plafon (kategori 11)
  ('Atap Seng Gelombang 1.8m',     11, 10, true, 35000,  48000,   46000,  0),
  ('Atap Spandek 0.3mm 6m',        11, 10, true, 70000,  95000,   92000,  0),
  ('Genteng Beton',                 11, 13, true, 3000,   4500,    4300,   0),
  ('Papan Gypsum 120x240cm',       11, 10, true, 50000,  70000,   68000,  0),
  ('List Gypsum 2.2m',              11, 9,  true, 12000,  18000,   17000,  0),

  -- Keramik & Lantai (kategori 12)
  ('Keramik Mulia 40x40',          12, 12, true, 42000,  58000,   55000,  0),
  ('Keramik Mulia 50x50',          12, 12, true, 55000,  74000,   70000,  0),
  ('Keramik Dinding 25x40',        12, 12, true, 38000,  52000,   50000,  0),
  ('Granit 60x60',                 12, 12, true, 95000,  135000, 128000, 0),
  ('Nat Keramik 1kg',              12, 2,  true, 8000,   12000,   11500,  0),
  ('Semen Instan Keramik 40kg',    12, 8,  true, 45000,  58000,   56000,  0),

  -- Alat Listrik (kategori 13)
  ('Kabel NYM 2x1.5mm 50m',       13, 15, true, 120000, 165000, 158000, 0),
  ('Kabel NYM 3x2.5mm 50m',       13, 15, true, 200000, 280000, 268000, 0),
  ('MCB Schneider 6A',             13, 13, true, 35000,  50000,   48000,  0),
  ('MCB Schneider 10A',            13, 13, true, 35000,  50000,   48000,  0),
  ('Stop Kontak Broco',            13, 13, true, 8000,   12000,   11500,  0),
  ('Saklar Broco',                 13, 13, true, 7000,   10000,   9500,   0),
  ('Fitting Lampu',                13, 13, true, 4000,   6000,    5800,   0),

  -- Alat Pertukangan (kategori 14)
  ('Palu Estwing 16oz',            14, 13, true, 45000,  65000,   62000,  0),
  ('Obeng Set 6in1',               14, 17, true, 25000,  38000,   36000,  0),
  ('Tang Kombinasi',               14, 13, true, 28000,  42000,   40000,  0),
  ('Meteran 5m',                   14, 13, true, 15000,  22000,   21000,  0),
  ('Gergaji Kayu',                 14, 13, true, 18000,  28000,   26000,  0),
  ('Amplas 1 Rol',                 14, 15, true, 8000,   12000,   11500,  0),
  ('Bor Listrik',                  14, 13, true, 180000, 250000, 240000, 0),

  -- Mur & Baut (kategori 15)
  ('Baut 10mm 2cm',                15, 16, false, 50000,  75000,   72000,  0),
  ('Baut 12mm 3cm',                15, 16, false, 60000,  90000,   86000,  0),
  ('Mur 10mm',                     15, 16, false, 30000,  45000,   43000,  0),
  ('Ring 10mm',                    15, 16, false, 15000,  25000,   24000,  0),
  ('DynaBolt 10mm',                15, 13, true, 3000,   5000,    4800,   0),

  -- Peralatan Kamar Mandi (kategori 16)
  ('Closet Duduk',                 16, 13, true, 350000, 500000, 480000, 0),
  ('Closet Jongkok',               16, 13, true, 120000, 175000, 168000, 0),
  ('Shower Set',                   16, 13, true, 85000,  125000, 120000, 0),
  ('Keran Air',                    16, 13, true, 25000,  38000,   36000,  0),
  ('Fleksibel Pipa 50cm',          16, 13, true, 12000,  18000,   17000,  0),

  -- Lem & Perekat (kategori 17)
  ('Lem Kayu 500ml',               17, 13, true, 15000,  22000,   21000,  0),
  ('Silicon Sealant 300ml',        17, 13, true, 20000,  30000,   28000,  0),
  ('Lem Super 3g',                 17, 13, true, 5000,   8000,    7500,   0),
  ('Fox 50gr',                     17, 13, true, 4000,   6500,    6000,   0);

-- BARANG MASUK (Stock In)
INSERT INTO barang_masuk (tgl_masuk, id_supplier, id_produk, harga_beli, jumlah, total) VALUES
  ('2026-02-03', 1, 1,  55000,  50,  2750000),
  ('2026-02-03', 1, 2,  52000,  30,  1560000),
  ('2026-02-10', 1, 4,  48000,  20,   960000),
  ('2026-02-17', 1, 5,  42000,  25,  1050000),
  ('2026-03-05', 1, 1,  55000,  60,  3300000),
  ('2026-03-12', 1, 3,  54000,  40,  2160000),
  ('2026-04-02', 1, 1,  55000,  50,  2750000),
  ('2026-04-15', 1, 2,  52000,  35,  1820000),
  ('2026-04-20', 1, 5,  42000,  30,  1260000),

  ('2026-02-05', 2, 6,  85000,  20,  1700000),
  ('2026-02-05', 2, 7,  95000,  15,  1425000),
  ('2026-02-18', 2, 8,  35000,  24,   840000),
  ('2026-03-08', 2, 6,  85000,  25,  2125000),
  ('2026-03-08', 2, 9,  38000,  30,  1140000),
  ('2026-03-22', 2, 11, 180000, 10,  1800000),
  ('2026-04-10', 2, 7,  95000,  18,  1710000),

  ('2026-02-08', 3, 12, 45000,  40,  1800000),
  ('2026-02-08', 3, 13, 60000,  30,  1800000),
  ('2026-02-22', 3, 14, 32000,  50,  1600000),
  ('2026-03-10', 3, 16, 48000,  35,  1680000),
  ('2026-03-25', 3, 15, 55000,  25,  1375000),
  ('2026-04-05', 3, 12, 45000,  50,  2250000),
  ('2026-04-18', 3, 17, 280000, 15,  4200000),

  ('2026-02-12', 4, 18, 40000,  30,  1200000),
  ('2026-02-12', 4, 19, 28000,  40,  1120000),
  ('2026-03-01', 4, 20, 85000,  20,  1700000),
  ('2026-03-15', 4, 22, 130000, 15,  1950000),
  ('2026-04-08', 4, 21, 65000,  25,  1625000),
  ('2026-04-22', 4, 18, 40000,  35,  1400000),

  ('2026-02-15', 5, 23, 8000,   100,   800000),
  ('2026-02-15', 5, 24, 10000,  80,   800000),
  ('2026-02-28', 5, 25, 14000,  60,   840000),
  ('2026-03-10', 5, 26, 25000,  40,  1000000),
  ('2026-03-28', 5, 29, 5000,   50,   250000),
  ('2026-04-12', 5, 23, 8000,   120,  960000),

  ('2026-02-20', 7, 42, 120000, 10,  1200000),
  ('2026-03-05', 7, 44, 35000,  30,  1050000),
  ('2026-03-05', 7, 45, 35000,  30,  1050000),
  ('2026-03-20', 7, 42, 120000, 15,  1800000),
  ('2026-04-15', 7, 46, 8000,   50,   400000),
  ('2026-04-15', 7, 47, 7000,   50,   350000),

  ('2026-02-25', 8, 49, 45000,  15,   675000),
  ('2026-03-12', 8, 50, 25000,  20,   500000),
  ('2026-03-28', 8, 52, 15000,  30,   450000),
  ('2026-04-10', 8, 55, 180000, 8,   1440000);

-- TRANSAKSI KELUAR (Sales)
-- Metode Bayar: Tunai=1, Transfer=7, QRIS=3, Debit=8
-- Kasir: kasir1=2, kasir2=3

-- Transaction 1: Cash sale to Budi Santoso
INSERT INTO transaksi_keluar (no_transaksi, tgl_transaksi, id_kasir, id_pelanggan, id_metode_bayar, subtotal, diskon_persen, diskon_nominal, pajak_persen, pajak_nominal, total, bayar, kembali, dp, sisa) VALUES
  (2026040001, '2026-04-01 09:15:00', 2, 1, 1, 185000, 0, 0, 0, 0, 185000, 200000, 15000, 0, 0);
INSERT INTO detail_transaksi_keluar (id_transaksi, id_produk, type_harga_jual, harga_modal, harga_jual, diskon_item, qty, jumlah, kas_masuk, profit) VALUES
  (1, 1,  'SATUAN', 55000,  68000,  0, 2, 136000, 136000, 26000);
INSERT INTO detail_transaksi_keluar (id_transaksi, id_produk, type_harga_jual, harga_modal, harga_jual, diskon_item, qty, jumlah, kas_masuk, profit) VALUES
  (1, 23, 'SATUAN', 8000,   12000,  0, 3, 36000,  36000,  12000);
INSERT INTO detail_transaksi_keluar (id_transaksi, id_produk, type_harga_jual, harga_modal, harga_jual, diskon_item, qty, jumlah, kas_masuk, profit) VALUES
  (1, 29, 'SATUAN', 5000,   8000,   0, 1, 8000,   8000,   3000);

-- Transaction 2: Transfer from CV Bangun Bersama (partial payment)
INSERT INTO transaksi_keluar (no_transaksi, tgl_transaksi, id_kasir, id_pelanggan, id_metode_bayar, subtotal, diskon_persen, diskon_nominal, pajak_persen, pajak_nominal, total, bayar, kembali, dp, sisa) VALUES
  (2026040002, '2026-04-03 10:30:00', 2, 4, 7, 1625000, 5, 81250, 0, 0, 1543750, 1000000, 0, 500000, 543750);
INSERT INTO detail_transaksi_keluar (id_transaksi, id_produk, type_harga_jual, harga_modal, harga_jual, diskon_item, qty, jumlah, kas_masuk, profit) VALUES
  (2, 13, 'SATUAN', 60000, 75000,  0, 15, 1125000, 1125000, 225000);
INSERT INTO detail_transaksi_keluar (id_transaksi, id_produk, type_harga_jual, harga_modal, harga_jual, diskon_item, qty, jumlah, kas_masuk, profit) VALUES
  (2, 14, 'SATUAN', 32000, 42000,  0, 10, 420000,  420000,  100000);
INSERT INTO detail_transaksi_keluar (id_transaksi, id_produk, type_harga_jual, harga_modal, harga_jual, diskon_item, qty, jumlah, kas_masuk, profit) VALUES
  (2, 57, 'SATUAN', 45000, 65000,  0, 1, 65000,   65000,   20000);

-- Transaction 3: Cash sale (walk-in)
INSERT INTO transaksi_keluar (no_transaksi, tgl_transaksi, id_kasir, id_pelanggan, id_metode_bayar, subtotal, diskon_persen, diskon_nominal, pajak_persen, pajak_nominal, total, bayar, kembali, dp, sisa) VALUES
  (2026040003, '2026-04-05 14:00:00', 3, NULL, 1, 248000, 0, 0, 0, 0, 248000, 250000, 2000, 0, 0);
INSERT INTO detail_transaksi_keluar (id_transaksi, id_produk, type_harga_jual, harga_modal, harga_jual, diskon_item, qty, jumlah, kas_masuk, profit) VALUES
  (3, 6,  'SATUAN', 85000,  115000, 0, 1, 115000, 115000, 30000);
INSERT INTO detail_transaksi_keluar (id_transaksi, id_produk, type_harga_jual, harga_modal, harga_jual, diskon_item, qty, jumlah, kas_masuk, profit) VALUES
  (3, 10, 'SATUAN', 12000,  18000,  0, 2, 36000,  36000,  12000);
INSERT INTO detail_transaksi_keluar (id_transaksi, id_produk, type_harga_jual, harga_modal, harga_jual, diskon_item, qty, jumlah, kas_masuk, profit) VALUES
  (3, 48, 'SATUAN', 45000,  65000,  0, 1, 65000,  65000,  20000);

-- Transaction 4: Transfer from PT Properti Mandiri
INSERT INTO transaksi_keluar (no_transaksi, tgl_transaksi, id_kasir, id_pelanggan, id_metode_bayar, subtotal, diskon_persen, diskon_nominal, pajak_persen, pajak_nominal, total, bayar, kembali, dp, sisa) VALUES
  (2026040004, '2026-04-08 11:00:00', 2, 6, 7, 4850000, 10, 485000, 0, 0, 4365000, 2500000, 0, 1000000, 865000);
INSERT INTO detail_transaksi_keluar (id_transaksi, id_produk, type_harga_jual, harga_modal, harga_jual, diskon_item, qty, jumlah, kas_masuk, profit) VALUES
  (4, 32, 'GROSIR', 70000,  92000,  0, 30, 2760000, 2760000, 660000);
INSERT INTO detail_transaksi_keluar (id_transaksi, id_produk, type_harga_jual, harga_modal, harga_jual, diskon_item, qty, jumlah, kas_masuk, profit) VALUES
  (4, 35, 'SATUAN', 50000,  70000,  0, 20, 1400000, 1400000, 400000);
INSERT INTO detail_transaksi_keluar (id_transaksi, id_produk, type_harga_jual, harga_modal, harga_jual, diskon_item, qty, jumlah, kas_masuk, profit) VALUES
  (4, 62, 'SATUAN', 120000, 175000, 0, 4, 525000,  525000,  220000);

-- Transaction 5: QRIS from Ahmad Hidayat
INSERT INTO transaksi_keluar (no_transaksi, tgl_transaksi, id_kasir, id_pelanggan, id_metode_bayar, subtotal, diskon_persen, diskon_nominal, pajak_persen, pajak_nominal, total, bayar, kembali, dp, sisa) VALUES
  (2026040005, '2026-04-10 16:45:00', 3, 3, 3, 535000, 0, 0, 0, 0, 535000, 535000, 0, 0, 0);
INSERT INTO detail_transaksi_keluar (id_transaksi, id_produk, type_harga_jual, harga_modal, harga_jual, diskon_item, qty, jumlah, kas_masuk, profit) VALUES
  (5, 37, 'SATUAN', 42000,  58000,  0, 5, 290000, 290000, 80000);
INSERT INTO detail_transaksi_keluar (id_transaksi, id_produk, type_harga_jual, harga_modal, harga_jual, diskon_item, qty, jumlah, kas_masuk, profit) VALUES
  (5, 39, 'SATUAN', 38000,  52000,  0, 3, 156000, 156000, 42000);
INSERT INTO detail_transaksi_keluar (id_transaksi, id_produk, type_harga_jual, harga_modal, harga_jual, diskon_item, qty, jumlah, kas_masuk, profit) VALUES
  (5, 56, 'SATUAN', 3000,   4500,   0, 12, 54000,  54000,  18000);

-- Transaction 6: Small cash sale
INSERT INTO transaksi_keluar (no_transaksi, tgl_transaksi, id_kasir, id_pelanggan, id_metode_bayar, subtotal, diskon_persen, diskon_nominal, pajak_persen, pajak_nominal, total, bayar, kembali, dp, sisa) VALUES
  (2026040006, '2026-04-12 08:30:00', 2, NULL, 1, 72000, 0, 0, 0, 0, 72000, 100000, 28000, 0, 0);
INSERT INTO detail_transaksi_keluar (id_transaksi, id_produk, type_harga_jual, harga_modal, harga_jual, diskon_item, qty, jumlah, kas_masuk, profit) VALUES
  (6, 53, 'SATUAN', 8000,   12000,  0, 3, 36000,  36000,  12000);
INSERT INTO detail_transaksi_keluar (id_transaksi, id_produk, type_harga_jual, harga_modal, harga_jual, diskon_item, qty, jumlah, kas_masuk, profit) VALUES
  (6, 54, 'SATUAN', 7000,   10000,  0, 2, 20000,  20000,  6000);
INSERT INTO detail_transaksi_keluar (id_transaksi, id_produk, type_harga_jual, harga_modal, harga_jual, diskon_item, qty, jumlah, kas_masuk, profit) VALUES
  (6, 48, 'SATUAN', 5000,   8000,   0, 2, 16000,  16000,  6000);

-- Transaction 7: Debit from Toko Maju Bangunan
INSERT INTO transaksi_keluar (no_transaksi, tgl_transaksi, id_kasir, id_pelanggan, id_metode_bayar, subtotal, diskon_persen, diskon_nominal, pajak_persen, pajak_nominal, total, bayar, kembali, dp, sisa) VALUES
  (2026040007, '2026-04-15 09:00:00', 2, 8, 8, 2140000, 3, 64200, 0, 0, 2075800, 2075800, 0, 0, 0);
INSERT INTO detail_transaksi_keluar (id_transaksi, id_produk, type_harga_jual, harga_modal, harga_jual, diskon_item, qty, jumlah, kas_masuk, profit) VALUES
  (7, 1,  'GROSIR', 55000, 65000,  0, 10, 650000,  650000,  100000);
INSERT INTO detail_transaksi_keluar (id_transaksi, id_produk, type_harga_jual, harga_modal, harga_jual, diskon_item, qty, jumlah, kas_masuk, profit) VALUES
  (7, 4,  'GROSIR', 48000, 58000,  0, 8, 464000,  464000,  80000);
INSERT INTO detail_transaksi_keluar (id_transaksi, id_produk, type_harga_jual, harga_modal, harga_jual, diskon_item, qty, jumlah, kas_masuk, profit) VALUES
  (7, 37, 'GROSIR', 42000, 55000,  0, 12, 660000,  660000,  156000);
INSERT INTO detail_transaksi_keluar (id_transaksi, id_produk, type_harga_jual, harga_modal, harga_jual, diskon_item, qty, jumlah, kas_masuk, profit) VALUES
  (7, 6,  'GROSIR', 85000, 110000, 0, 3, 330000,  330000,  75000);

-- Transaction 8: Debit from Siti
INSERT INTO transaksi_keluar (no_transaksi, tgl_transaksi, id_kasir, id_pelanggan, id_metode_bayar, subtotal, diskon_persen, diskon_nominal, pajak_persen, pajak_nominal, total, bayar, kembali, dp, sisa) VALUES
  (2026040008, '2026-04-18 13:20:00', 3, 2, 8, 276000, 0, 0, 0, 0, 276000, 300000, 24000, 0, 0);
INSERT INTO detail_transaksi_keluar (id_transaksi, id_produk, type_harga_jual, harga_modal, harga_jual, diskon_item, qty, jumlah, kas_masuk, profit) VALUES
  (8, 30, 'SATUAN', 4500,   6500,   0, 10, 65000,   65000,   20000);
INSERT INTO detail_transaksi_keluar (id_transaksi, id_produk, type_harga_jual, harga_modal, harga_jual, diskon_item, qty, jumlah, kas_masuk, profit) VALUES
  (8, 25, 'SATUAN', 14000,  20000,  0, 5, 100000,  100000,  30000);
INSERT INTO detail_transaksi_keluar (id_transaksi, id_produk, type_harga_jual, harga_modal, harga_jual, diskon_item, qty, jumlah, kas_masuk, profit) VALUES
  (8, 24, 'SATUAN', 10000,  15000,  0, 4, 60000,   60000,   20000);

-- Transaction 9: Cash sale - tools to Hendra
INSERT INTO transaksi_keluar (no_transaksi, tgl_transaksi, id_kasir, id_pelanggan, id_metode_bayar, subtotal, diskon_persen, diskon_nominal, pajak_persen, pajak_nominal, total, bayar, kembali, dp, sisa) VALUES
  (2026040009, '2026-04-20 15:10:00', 2, 7, 1, 448000, 0, 0, 0, 0, 448000, 500000, 52000, 0, 0);
INSERT INTO detail_transaksi_keluar (id_transaksi, id_produk, type_harga_jual, harga_modal, harga_jual, diskon_item, qty, jumlah, kas_masuk, profit) VALUES
  (9, 49, 'SATUAN', 45000,  65000,  0, 2, 130000, 130000,  40000);
INSERT INTO detail_transaksi_keluar (id_transaksi, id_produk, type_harga_jual, harga_modal, harga_jual, diskon_item, qty, jumlah, kas_masuk, profit) VALUES
  (9, 50, 'SATUAN', 25000,  38000,  0, 3, 114000, 114000,  39000);
INSERT INTO detail_transaksi_keluar (id_transaksi, id_produk, type_harga_jual, harga_modal, harga_jual, diskon_item, qty, jumlah, kas_masuk, profit) VALUES
  (9, 55, 'SATUAN', 180000, 250000, 0, 1, 250000, 250000,  70000);

-- Transaction 10: Small cash sale - pipa
INSERT INTO transaksi_keluar (no_transaksi, tgl_transaksi, id_kasir, id_pelanggan, id_metode_bayar, subtotal, diskon_persen, diskon_nominal, pajak_persen, pajak_nominal, total, bayar, kembali, dp, sisa) VALUES
  (2026040010, '2026-04-22 10:00:00', 3, NULL, 1, 66000, 0, 0, 0, 0, 66000, 70000, 4000, 0, 0);
INSERT INTO detail_transaksi_keluar (id_transaksi, id_produk, type_harga_jual, harga_modal, harga_jual, diskon_item, qty, jumlah, kas_masuk, profit) VALUES
  (10, 23, 'SATUAN', 8000,  12000, 0, 3, 36000, 36000, 12000);
INSERT INTO detail_transaksi_keluar (id_transaksi, id_produk, type_harga_jual, harga_modal, harga_jual, diskon_item, qty, jumlah, kas_masuk, profit) VALUES
  (10, 27, 'SATUAN', 2500,  4000,  0, 5, 20000, 20000, 7500);
INSERT INTO detail_transaksi_keluar (id_transaksi, id_produk, type_harga_jual, harga_modal, harga_jual, diskon_item, qty, jumlah, kas_masuk, profit) VALUES
  (10, 28, 'SATUAN', 3000,  5000,  0, 2, 10000, 10000, 4000);
