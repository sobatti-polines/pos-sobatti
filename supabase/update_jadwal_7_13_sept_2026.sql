-- ============================================================
-- UPDATE JADWAL KARYAWAN MINGGU 7-13 SEPTEMBER 2026
-- Jalankan di Supabase SQL Editor
-- ============================================================

-- 1. UPDATE ADIL: Selasa (8 Sept) → SORE
UPDATE jadwal_karyawan
SET tipe_jadwal = 'SORE',
    id_shift = (SELECT id FROM shift_kerja WHERE kode = 'SORE')
WHERE id_jadwal_mingguan = (SELECT id FROM jadwal_mingguan WHERE minggu_mulai = '2026-09-07')
  AND id_pengguna = (SELECT id FROM pengguna WHERE nama ILIKE '%adil%' LIMIT 1)
  AND tanggal = '2026-09-08';

-- 2. UPDATE ADIL: Kamis (10 Sept) → LIBUR
UPDATE jadwal_karyawan
SET tipe_jadwal = 'LIBUR',
    id_shift = NULL
WHERE id_jadwal_mingguan = (SELECT id FROM jadwal_mingguan WHERE minggu_mulai = '2026-09-07')
  AND id_pengguna = (SELECT id FROM pengguna WHERE nama ILIKE '%adil%' LIMIT 1)
  AND tanggal = '2026-09-10';

-- 3. UPDATE FITRI: Kamis (10 Sept) → PAGI
UPDATE jadwal_karyawan
SET tipe_jadwal = 'PAGI',
    id_shift = (SELECT id FROM shift_kerja WHERE kode = 'PAGI')
WHERE id_jadwal_mingguan = (SELECT id FROM jadwal_mingguan WHERE minggu_mulai = '2026-09-07')
  AND id_pengguna = (SELECT id FROM pengguna WHERE nama ILIKE '%fitri%' LIMIT 1)
  AND tanggal = '2026-09-10';

-- 4. UPDATE TATA: Kamis (10 Sept) → SORE
UPDATE jadwal_karyawan
SET tipe_jadwal = 'SORE',
    id_shift = (SELECT id FROM shift_kerja WHERE kode = 'SORE')
WHERE id_jadwal_mingguan = (SELECT id FROM jadwal_mingguan WHERE minggu_mulai = '2026-09-07')
  AND id_pengguna = (SELECT id FROM pengguna WHERE nama ILIKE '%tata%' LIMIT 1)
  AND tanggal = '2026-09-10';

-- 5. UPDATE KELIK: Kamis (10 Sept) → SORE
UPDATE jadwal_karyawan
SET tipe_jadwal = 'SORE',
    id_shift = (SELECT id FROM shift_kerja WHERE kode = 'SORE')
WHERE id_jadwal_mingguan = (SELECT id FROM jadwal_mingguan WHERE minggu_mulai = '2026-09-07')
  AND id_pengguna = (SELECT id FROM pengguna WHERE nama ILIKE '%kelik%' LIMIT 1)
  AND tanggal = '2026-09-10';

-- ============================================================
-- 6. VERIFIKASI: Cek hasil update
-- ============================================================
SELECT
  p.nama,
  jk.tanggal,
  CASE WHEN jk.tanggal = '2026-09-07' THEN 'Senin'
       WHEN jk.tanggal = '2026-09-08' THEN 'Selasa'
       WHEN jk.tanggal = '2026-09-09' THEN 'Rabu'
       WHEN jk.tanggal = '2026-09-10' THEN 'Kamis'
       WHEN jk.tanggal = '2026-09-11' THEN 'Jumat'
       WHEN jk.tanggal = '2026-09-12' THEN 'Sabtu'
       WHEN jk.tanggal = '2026-09-13' THEN 'Minggu'
  END AS hari,
  jk.tipe_jadwal,
  sk.kode AS shift
FROM jadwal_karyawan jk
JOIN pengguna p ON p.id = jk.id_pengguna
LEFT JOIN shift_kerja sk ON sk.id = jk.id_shift
WHERE jk.id_jadwal_mingguan = (SELECT id FROM jadwal_mingguan WHERE minggu_mulai = '2026-09-07')
  AND p.nama ILIKE ANY(ARRAY['%adil%', '%fitri%', '%tata%', '%kelik%'])
ORDER BY p.nama, jk.tanggal;
