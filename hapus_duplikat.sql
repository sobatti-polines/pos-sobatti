-- =====================================================================================
-- PANDUAN PENGHAPUSAN DATA DUPLIKAT
-- =====================================================================================
-- Karena kamu tidak menyebutkan nama tabelnya, di bawah ini aku berikan 
-- template query yang sangat aman dan umum digunakan untuk menghapus duplikat.
--
-- Secara default, script ini mencontohkan tabel 'produk' dengan acuan 'nama_produk'.
-- Jika yang duplikat adalah tabel lain (misal: 'pelanggan'), silakan ganti 
-- kata 'produk' menjadi 'pelanggan' dan 'nama_produk' menjadi 'nama_pelanggan'.
--
-- CARA KERJA:
-- 1. Mengelompokkan data berdasarkan kolom yang dianggap duplikat (PARTITION BY).
-- 2. Mengurutkan data (ORDER BY) berdasarkan 'id' untuk menentukan mana yang dipertahankan.
--    - ORDER BY id ASC  = Mempertahankan data yang PERTAMA dimasukkan (Paling Lama).
--    - ORDER BY id DESC = Mempertahankan data yang TERAKHIR dimasukkan (Paling Baru).
-- =====================================================================================

-- -------------------------------------------------------------------------------------
-- LANGKAH 1: CEK DULU DATA APA SAJA YANG DUPLIKAT (JANGAN LANGSUNG HAPUS)
-- Blok (block) query di bawah ini dan jalankan (Run) untuk melihat datanya.
-- -------------------------------------------------------------------------------------
SELECT 
    nama_produk, -- Ganti dengan kolom yang duplikat (misal nama_pelanggan)
    COUNT(*) as jumlah_duplikat
FROM 
    produk       -- Ganti dengan nama tabelmu
GROUP BY 
    nama_produk  -- Ganti dengan kolom acuan
HAVING 
    COUNT(*) > 1;


-- -------------------------------------------------------------------------------------
-- LANGKAH 2: LIHAT DETAIL BARIS DATA YANG DUPLIKAT
-- Ini akan memunculkan urutan data. row_num = 1 adalah data yang akan DIPERTAHANKAN.
-- row_num = 2, 3, dst adalah data yang akan DIHAPUS.
-- -------------------------------------------------------------------------------------
SELECT 
    id,
    nama_produk, 
    -- Jika tabel memiliki created_at, bisa ditambahkan di sini
    ROW_NUMBER() OVER (
        PARTITION BY nama_produk 
        ORDER BY id DESC -- Gunakan DESC untuk mempertahankan data TERBARU, atau ASC untuk TERLAMA
    ) as row_num
FROM 
    produk
WHERE 
    nama_produk IN (
        SELECT nama_produk 
        FROM produk 
        GROUP BY nama_produk 
        HAVING COUNT(*) > 1
    );


-- -------------------------------------------------------------------------------------
-- LANGKAH 3: EKSEKUSI HAPUS DATA DUPLIKAT (HATI-HATI)
-- Jika Langkah 1 dan 2 sudah sesuai dengan harapanmu, jalankan query DELETE di bawah.
-- Query ini akan menghapus semua data yang row_num-nya lebih dari 1 (duplikatnya).
-- -------------------------------------------------------------------------------------
WITH DuplikatCTE AS (
    SELECT 
        id,
        ROW_NUMBER() OVER (
            PARTITION BY nama_produk -- Acuan kolom yang duplikat
            ORDER BY id DESC         -- DESC: mempertahankan data TERBARU. Ubah jadi ASC jika ingin sebaliknya.
        ) as row_num
    FROM 
        produk -- Ganti dengan nama tabelmu
)
DELETE FROM produk
WHERE id IN (
    SELECT id 
    FROM DuplikatCTE 
    WHERE row_num > 1
);
