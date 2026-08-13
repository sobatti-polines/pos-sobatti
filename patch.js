const fs = require('fs');
let content = fs.readFileSync('/home/haydar/Code/POS/app/TESTING-TIER-1-BARANG-MASUK.md', 'utf8');

// Replace TEST 12 Akses sebagai KASIR to TEST 14
content = content.replace('## TEST 12 — Akses sebagai KASIR → Ditolak', '## TEST 14 — Akses sebagai KASIR → Ditolak');

// Insert TEST 12 and TEST 13 before TEST 14
const newTests = `## TEST 12 — Sinkron \`harga_modal\` dari AVCO (T1-19)

1. Pastikan produk yang digunakan memiliki \`harga_modal\` = 0 atau kosong (cek di \`/dashboard/inventory\` → Edit Produk).
2. Lakukan transaksi **Barang Masuk**, **Retur**, atau **Void** yang memicu perhitungan ulang AVCO.
3. Buka halaman Edit Produk lagi (atau cek via database).

**Hasil**:
- [x] \`harga_modal\` produk otomatis tersinkronisasi menjadi sama dengan \`harga_pokok_avco\` (HPP baru).
- [x] Sinkronisasi **hanya** terjadi jika nilai awal \`harga_modal\` adalah 0 atau kosong.

---

## TEST 13 — Tampilan Mutasi "Retur Pembelian" di Detail Produk (T1-16)

1. Buka Inventaris (\`/dashboard/inventory\`).
2. Klik pada produk yang baru saja dilakukan Retur Pembelian (misal produk dari Test 8).
3. Pada sheet detail produk yang muncul di sebelah kanan, buka tab **Riwayat HPP/AVCO** atau riwayat mutasi.

**Hasil**:
- [x] Terdapat baris mutasi dengan jenis **"Retur Pembelian"** (\`retur_beli\`).
- [x] Qty keluar dan harga pokok sesuai dengan data retur yang telah dilakukan.

---

## TEST 14 — Akses sebagai KASIR → Ditolak`;

content = content.replace('## TEST 14 — Akses sebagai KASIR → Ditolak', newTests);

// Renumber TEST 13 to TEST 17 -> TEST 15 to TEST 19
content = content.replace('## TEST 13 —', '## TEST 15 —');
content = content.replace('## TEST 14 —', '## TEST 16 —');
content = content.replace('## TEST 15 —', '## TEST 17 —');
content = content.replace('## TEST 16 —', '## TEST 18 —');
content = content.replace('## TEST 17 —', '## TEST 19 —');

// Also update mentions in the text
content = content.replace('(Test 14 & 15)', '(Test 16 & 17)');
content = content.replace('(Test 15)', '(Test 17)');
content = content.replace('(Test 14)', '(Test 16)');
content = content.replace('(Test 14/15)', '(Test 16/17)');

fs.writeFileSync('/home/haydar/Code/POS/app/TESTING-TIER-1-BARANG-MASUK.md', content);
