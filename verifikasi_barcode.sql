-- =====================================================================================
-- VERIFIKASI & PEMBERSIHAN DATA BARCODE PRODUK — POS SOBATTI
-- =====================================================================================
-- Cara pakai:
--   1. Buka Supabase Dashboard → SQL Editor.
--   2. Jalankan SATU BAGIAN pada satu waktu (jangan "Run all").
--   3. BAGIAN 1 dan BAGIAN 3 hanya MEMBACA (aman). BAGIAN 2 MENULIS data —
--      jalankan hanya setelah hasil BAGIAN 1 kamu pahami.
--   4. Saran: export dulu tabel produk (Table Editor → Export CSV) sebelum BAGIAN 2.
--
-- Konteks bug: scan barcode gagal diam-diam bila satu barcode terdaftar di lebih
-- dari satu produk (duplikat), dan pencarian bisa meleset bila barcode/nama
-- mengandung spasi atau karakter aneh.
-- =====================================================================================


-- =====================================================================================
-- BAGIAN 1 — DIAGNOSA (read-only, aman dijalankan kapan saja)
-- =====================================================================================

-- -------------------------------------------------------------------------------------
-- 1A. BARCODE DUPLIKAT (penyebab utama scan gagal: "Produk tidak ditemukan")
--     Dikelompokkan dengan BTRIM supaya varian dengan spasi ikut tertangkap.
--     Kolom produk_terlibat menampilkan [id] nama — catat id pemilik sahnya.
-- -------------------------------------------------------------------------------------
SELECT
    BTRIM(barcode) AS barcode,
    COUNT(*)       AS jumlah_duplikat,
    STRING_AGG('[' || id::text || '] ' || nama_produk, ' | ' ORDER BY id) AS produk_terlibat
FROM produk
WHERE barcode IS NOT NULL
  AND BTRIM(barcode) <> ''
GROUP BY BTRIM(barcode)
HAVING COUNT(*) > 1
ORDER BY COUNT(*) DESC, barcode;

-- -------------------------------------------------------------------------------------
-- 1B. PRODUK TANPA BARCODE (tidak akan pernah bisa discan)
-- -------------------------------------------------------------------------------------
SELECT COUNT(*) AS jumlah_tanpa_barcode
FROM produk
WHERE barcode IS NULL OR BTRIM(barcode) = '';

-- Detail (maks 100 baris):
SELECT id, nama_produk, sku, stok, stok_gudang
FROM produk
WHERE barcode IS NULL OR BTRIM(barcode) = ''
ORDER BY nama_produk
LIMIT 100;

-- -------------------------------------------------------------------------------------
-- 1C. BARCODE ANEH — spasi di awal/akhir, atau karakter di luar A-Z 0-9 - _ . spasi
--     (kode hasil scan biasanya alfanumerik; karakter lain patut dicurigai)
-- -------------------------------------------------------------------------------------
SELECT id, nama_produk, '[' || barcode || ']' AS barcode_asli
FROM produk
WHERE barcode IS NOT NULL
  AND (
        barcode ~ '^\s'
     OR barcode ~ '\s$'
     OR barcode ~ '[^A-Za-z0-9\-_\. ]'
  )
ORDER BY id;

-- -------------------------------------------------------------------------------------
-- 1D. CEK PRODUK SPESIFIK YANG DILAPORKAN BERMASALAH
--     Ganti teks di antara %% dengan nama (sebagian) produk yang dimaksud.
-- -------------------------------------------------------------------------------------
SELECT id, nama_produk, barcode, sku,
       stok, stok_gudang, hitung_stok,
       COALESCE(stok, 0) + COALESCE(stok_gudang, 0) AS stok_total
FROM produk
WHERE nama_produk ILIKE '%GANTI NAMA PRODUK%'
ORDER BY id;

-- -------------------------------------------------------------------------------------
-- 1E. RINGKASAN ATURAN STOK (meluruskan asumsi "stok 0 = tidak bisa dipilih")
--     ATURAN BENAR: produk dengan hitung_stok=true dan stok 0 TETAP muncul dan
--     BISA dipilih di POS — penolakan hanya terjadi saat checkout
--     ("Stok tidak mencukupi..."). hitung_stok=false tidak pernah diblok.
-- -------------------------------------------------------------------------------------
SELECT hitung_stok,
       CASE WHEN COALESCE(stok, 0) + COALESCE(stok_gudang, 0) = 0
            THEN 'stok total 0'
            ELSE 'stok tersedia'
       END AS kondisi_stok,
       COUNT(*) AS jumlah_produk
FROM produk
GROUP BY 1, 2
ORDER BY 1, 2;


-- =====================================================================================
-- BAGIAN 2 — PEMBERSIHAN (MENULIS DATA — pahami dulu hasil BAGIAN 1!)
-- =====================================================================================
-- Strategi yang DIREKOMENDASIKAN adalah 2A: TIDAK menghapus produk, hanya
-- mengosongkan barcode pada baris duplikat. Aman dari FK (riwayat transaksi
-- tetap utuh) dan bisa dipulihkan dengan mengisi ulang barcode lewat dashboard.
--
-- Baris yang DIPERTAHANKAN memakai barcode = baris dengan ID TERKECIL
-- (produk pertama dibuat). Bila kamu ingin mempertahankan baris lain,
-- jangan jalankan 2A — perbaiki manual lewat dashboard produk.
-- =====================================================================================

-- -------------------------------------------------------------------------------------
-- 2A-PRAVIEWS: lihat dulu baris mana yang dipertahankan (rn=1) dan
--              yang barcode-nya akan dikosongkan (rn>1). TIDAK menulis data.
-- -------------------------------------------------------------------------------------
WITH dup AS (
    SELECT id, nama_produk, barcode,
           ROW_NUMBER() OVER (PARTITION BY BTRIM(barcode) ORDER BY id ASC) AS rn
    FROM produk
    WHERE barcode IS NOT NULL
      AND BTRIM(barcode) <> ''
)
SELECT id, nama_produk, barcode, rn,
       CASE WHEN rn = 1 THEN 'DIPERTAHANKAN' ELSE 'barcode dikosongkan' END AS aksi
FROM dup
WHERE rn > 1
   OR id IN (
        SELECT id FROM dup
        WHERE rn = 1
          AND BTRIM(barcode) IN (
              SELECT BTRIM(barcode) FROM produk
              WHERE barcode IS NOT NULL AND BTRIM(barcode) <> ''
              GROUP BY BTRIM(barcode) HAVING COUNT(*) > 1
          )
   )
ORDER BY BTRIM(barcode), rn;

-- -------------------------------------------------------------------------------------
-- 2A. KOSONGKAN BARCODE PADA BARIS DUPLIKAT (rn > 1 dipartisi per barcode)
--     Produk TIDAK dihapus — hanya kolom barcode-nya menjadi NULL.
-- -------------------------------------------------------------------------------------
-- WITH dup AS (
--     SELECT id,
--            ROW_NUMBER() OVER (PARTITION BY BTRIM(barcode) ORDER BY id ASC) AS rn
--     FROM produk
--     WHERE barcode IS NOT NULL
--       AND BTRIM(barcode) <> ''
-- )
-- UPDATE produk p
-- SET barcode = NULL,
--     updated_at = now()
-- FROM dup
-- WHERE p.id = dup.id
--   AND dup.rn > 1;
--
-- CATATAN: query di atas sengaja DIKOMEN. Jalankan 2A-PREVIEW dulu, yakin hasilnya
-- benar, baru hapus tanda komentar di blok WITH..UPDATE dan jalankan.

-- -------------------------------------------------------------------------------------
-- 2B. (ALTERNATIF) RAPIHKAN SPASI — trim barcode yang punya spasi di awal/akhir.
--     Ini tidak mengubah isi barcode yang valid. Aman dijalankan setelah 1C
--     menunjukkan kasus spasi.
-- -------------------------------------------------------------------------------------
-- UPDATE produk
-- SET barcode = BTRIM(barcode),
--     updated_at = now()
-- WHERE barcode IS NOT NULL
--   AND barcode <> BTRIM(barcode);

-- -------------------------------------------------------------------------------------
-- 2C. (OPSIONAL, HATI-HATI) HAPUS baris duplikat yang BENAR-BENAR TANPA riwayat.
--     TIDAK disarankan kecuali kamu yakin barisnya salah buat. FK tanpa cascade
--     (barang_masuk, detail_transaksi_keluar, detail_retur_pembelian, stok_opname,
--     riwayat_avco, produk paket→master) akan MENOLAK hapus bila ada riwayat —
--     itu fail-safe, bukan error yang perlu "diperbaiki". Bila terblokir,
--     pakai 2A saja. Perhatikan: event_promo_produk & riwayat_harga_produk
--     terhapus otomatis (CASCADE) ikut barisnya.
-- -------------------------------------------------------------------------------------
-- WITH dup AS (
--     SELECT id,
--            ROW_NUMBER() OVER (PARTITION BY BTRIM(barcode) ORDER BY id ASC) AS rn
--     FROM produk
--     WHERE barcode IS NOT NULL
--       AND BTRIM(barcode) <> ''
-- ),
-- hapus AS (
--     SELECT dup.id
--     FROM dup
--     WHERE dup.rn > 1
--       AND NOT EXISTS (SELECT 1 FROM detail_transaksi_keluar d WHERE d.id_produk = dup.id)
--       AND NOT EXISTS (SELECT 1 FROM barang_masuk b WHERE b.id_produk = dup.id)
--       AND NOT EXISTS (SELECT 1 FROM detail_retur_pembelian r WHERE r.id_produk = dup.id)
--       AND NOT EXISTS (SELECT 1 FROM stok_opname s WHERE s.id_produk = dup.id)
--       AND NOT EXISTS (SELECT 1 FROM riwayat_avco a WHERE a.id_produk = dup.id)
--       AND NOT EXISTS (SELECT 1 FROM produk anak WHERE anak.id_produk_master = dup.id)
-- )
-- DELETE FROM produk p
-- USING hapus h
-- WHERE p.id = h.id;


-- =====================================================================================
-- BAGIAN 3 — VERIFIKASI SETELAH PEMBERSIHAN (read-only)
-- =====================================================================================
-- Jalankan ulang 1A: hasil yang benar = 0 baris (tidak ada duplikat tersisa).
-- Lalu uji di POS: scan produk yang tadinya gagal → harus masuk keranjang,
-- dan muncul toast peringatan bila masih ada barcode ganda.
SELECT BTRIM(barcode) AS barcode, COUNT(*) AS jumlah,
       STRING_AGG('[' || id::text || '] ' || nama_produk, ' | ' ORDER BY id) AS produk
FROM produk
WHERE barcode IS NOT NULL AND BTRIM(barcode) <> ''
GROUP BY BTRIM(barcode)
HAVING COUNT(*) > 1;
