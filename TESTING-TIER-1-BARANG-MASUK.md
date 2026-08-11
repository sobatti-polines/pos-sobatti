# Panduan Uji Manual — Tier 1 Modul Barang Masuk / Retur Pembelian

> Dokumen panduan step-by-step. Jalankan sendiri secara berurutan. Centang tiap langkah setelah lolos.

---

## PRASYARAT

- [x] Semua migration di bawah SUDAH dijalankan di Supabase **SQL Editor** (berurutan, tanpa error):
    1. `20260810_barang_masuk_no_surat.sql`
    2. `20260810_barang_masuk_void.sql`
    3. `20260810_retur_pembelian.sql`
    4. `20260810_update_process_barang_masuk_no_surat.sql`
    5. `20260810_fix_retur_wib_rls.sql`
    6. `20260810_guard_hitung_stok.sql`
    7. `20260810_sync_harga_modal_avco.sql`
    8. `20260810_fix_db_cleanup_rls.sql`
- [x] Login sebagai **ADMIN** (atau OWNER) di `http://localhost:3000`
- [x] Pastikan ada minimal **2 produk** di Inventaris (`/dashboard/inventory`) dengan `hitung_stok = aktif`, dan stok gudang 0
  - Produk A: base unit `pcs`
  - Produk B: pakai satuan besar, contoh `12 pcs = 1 lusin` (UoM) — untuk menguji konversi
- [x] Pastikan minimal 1 **Supplier** ada (`/dashboard/suppliers`)
- [ ] (opsional) Persiapkan 1 produk dengan `hitung_stok = tidak aktif` untuk uji Test 8

> Jika ada langkah yang gagal, catat pesan errornya dan laporkan. Jangan lanjut ke test berikutnya sebelum memahami kenapa gagal.

---

## TEST 1 — Input Barang Masuk + No. Faktur + UoM

**Lokasi**: `/dashboard/inventory/stock-in`

1. Buka halaman **Barang Masuk**.
2. Pilih **Supplier**, **Tanggal Masuk** (hari ini), dan isi **No. Faktur/Nota** (contoh: `FK-20260810-001`).
3. Tambahkan baris:
   - **Produk B** (yang UoM lusin), satuan suplai `lusin` (terisi otomatis), qty suplai `2`
   - Harga/beli terisi, cek **Total Cost** = `2 × harga lusin`.
4. Tambahkan baris kedua: **Produk A**, qty `5 pcs`.
5. Klik **Simpan**.

**Hasil yang diharapkan**:
- Toast/sukses, form ter-reset (No. Faktur kembali kosong).
- Di Supabase opsional cek:
  ```sql
  SELECT id, no_surat, status, supplied_qty, supplied_unit, applied_conversion_ratio, base_qty_added FROM barang_masuk ORDER BY id DESC LIMIT 2;
  ```
  - baris Produk B: `no_surat = FK-20260810-001`, `base_qty_added = 24` (2 lusin × 12)
  - baris Produk A: `base_qty_added = 5`
- Stok gudang bertambah di Inventaris.

---

## TEST 2 — History: No. Faktur + Search + Total

**Lokasi**: `/dashboard/inventory/stock-in/history`

1. Buka **Riwayat Barang Masuk**.
2. Cek kolom **No. Faktur** menampilkan `FK-20260810-001` (baris lama tanpa no_surat tampil `-`).
3. Ketik `FK-20260810-001` di kolom pencarian → hanya menampilkan 2 baris tadi.
4. Cek **Total Nilai Pembelian** = jumlah total 2 baris (AKTIF).
5. Cek **Jumlah Catatan** benar.

**Hasil**:
- [] No. Faktur tampil dan bisa dicari
- [] Total & Jumlah Catatan = data AKTIF

---

## TEST 3 — Export CSV & PDF History

1. Di halaman History, klik **Export** → **CSV**.
2. Buka file CSV → pastikan ada kolom **No. Faktur** dan **Status**.
3. Klik **Export** → **PDF** → pastikan isi wajar (No. Faktur & Status ada).

**Hasil**:
- [x] CSV & PDF berisi data + kolom Baru

---

## TEST 4 — Edit Barang Masuk (edit ringan saja)

1. Di History, klik ikon **pensil (Edit)** pada baris Produk A.
2. Ubah **No. Faktur** menjadi `FK-EDI-001` dan **Keterangan** menjadi "cek edit".
3. Klik **Simpan**.
4. Halaman refresh -> No. Faktur berubah, keterangan muncul.

**Hasil yang diharapkan**:
- Berhasil, **tidak** mengubah qty/stok/AVCO/produk/supplier.
- Cek di Supabase `SELECT no_surat, keterangan, base_qty_added FROM barang_masuk WHERE id = <id>` → `base_qty_added` tetap.

---

## TEST 5 — Void Barang Masuk

**Lokasi**: `/dashboard/inventory/stock-in/history`

1. Temukan baris **Produk A** (qty 5 pcs).
2. Catat stok gudang Produk A saat ini di Inventaris (misal: 5).
3. Klik ikon **larangan/void** di baris Produk A.
4. Isi **Alasan Pembatalan** (wajib, contoh "test void"), klik **Ya, Batalkan**.
5. Halaman refresh.

**Hasil yang diharapkan**:
- Baris Produk A tampil **DIVOID** + coret (strikethrough), tombol Edit & Void hilang.
- Di Inventaris, stok gudang Produk A **kembali ke nilai awal** (0).
- Opsional cek Supabase:
  ```sql
  SELECT bm.status, r.jenis_mutasi, r.qty_keluar, r.stok_sesudah, r.avco_sesudah
  FROM barang_masuk bm JOIN riwayat_avco r ON r.jenis_mutasi = 'retur_beli' AND r.id_referensi = bm.id
  WHERE bm.id = <id produk A>;
  ```
- Di **Laporan Kas Harian** (`/dashboard/tutup-kasir` atau laporan kasir) barang masuk DIVOID **tidak** dihitung di total keluar.

---

## TEST 6 — Void Ganda → Ditolak

1. Di History, cek baris Produk A (sudah DIVOID) → tombol void **tidak ada**.
2. Coba void dari URL/aksi lain (misal ulangi action yang sama) — tidak perlu; cukup pastikan UI menyembunyikan tombol.

**Hasil**:
- [x] Baris DIVOID tidak bisa di-void lagi (UI menyembunyikan tombol)

---

## TEST 7 — Void Barang Masuk yang Stoknya Sudah Dipindah ke Display

1. Buat barang masuk baru untuk Produk A (qty 10 pcs).
2. Di `/dashboard/inventory`, pindahkan 4 pcs dari **gudang → display** (Restock Display / menu pindah stok).
3. Kembali ke History, void barang masuk qty 10 itu.
4. **Hasil yang diharapkan**: void **tetap sukses**; stok gudang tidak negatif (dipotong habis sampai 0, sisanya jadi selisih dokumen — dicatat di konsistensi riwayat).
   - Cek stok gudang tidak pernah `-` (negatif) di Inventaris.

---

## TEST 8 — Retur Pembelian (qty parsial)

**Lokasi**: `/dashboard/inventory/stock-in/retur`

1. Buat barang masuk baru Produk B: `1 lusin` (base = 12). Pastikan stok gudang Produk B = 12.
2. Buka **Retur Barang** (sidebar → Inventaris → Retur Barang).
3. Pada baris Produk B tadi, klik **Retur**.
4. Di dialog, isi **Qty Retur** = `2` (dihitung dalam base unit `pcs`), **Keterangan** "rusak".
5. Klik **Simpan Retur**.
6. Toast sukses menampilkan **No. Retur** (`RB-YYYYMMDD-01`).

**Hasil yang diharapkan**:
- Di Inventaris, stok gudang Produk B = 10 (12 − 2).
- Buka **Riwayat Retur** (`/dashboard/inventory/stock-in/retur/history`) → ada record baru: No. Retur, Tanggal, Supplier, Total Nilai, Operator, Keterangan.
- `total_nilai` = 2 × harga pokok saat retur.
- Opsional cek Supabase:
  ```sql
  SELECT * FROM retur_pembelian ORDER BY created_at DESC LIMIT 1;
  SELECT * FROM detail_retur_pembelian ORDER BY created_at DESC LIMIT 1;
  ```

---

## TEST 9 — Retur qty > stok gudang → Ditolak

1. Di **Retur Barang**, pilih barang masuk Produk B (stok gudang 10).
2. Dialog muncul dengan **Maks. Retur** = min(base_qty_added, stok_gudang).
3. Usahakan input qty **sangat besar** (melebihi stok gudang / maks).
4. Klik **Simpan Retur**.

**Hasil**:
- [x] Ditolak dengan pesan **"Stok gudang tidak mencukupi..."** (atau qty dibatasi di dialog)

---

## TEST 10 — Retur dari Barang Masuk yang sudah DIVOID → Ditolak

1. Ambil ID barang masuk yang sudah DIVOID (dari Test 5).
2. Pastikan baris DIVOID **tidak muncul** di daftar **Retur Barang** (halaman hanya tampilkan status AKTIF).
3. Coba akses langsung `getBarangMasukForRetur` — tidak perlu; cukup verifikasi UI menyembunyikannya.

**Hasil**:
- [x] Barang masuk DIVOID tidak muncul sebagai kandidat retur di UI

---

## TEST 11 — Barang Masuk Produk dengan `hitung_stok = false` → Ditolak

1. Siapkan produk dengan `hitung_stok = tidak aktif`.
2. Di form **Barang Masuk**, pilih produk itu sebagai baris.
3. Isi qty + harga, klik **Simpan**.

**Hasil**:
- [x] Ditolak dengan pesan **"Produk \"...\" tidak terhitung stoknya..."**
- [x] Tidak ada perubahan stok / riwayat baru untuk produk itu

---

## TEST 12 — Akses sebagai KASIR → Ditolak

1. Login sebagai akun ber-role **KASIR**.
2. Buka `/dashboard/inventory/stock-in`, `/dashboard/inventory/stock-in/history`, `/dashboard/inventory/stock-in/retur`.

**Hasil**:
- [x] Ditolak (menu Inventaris tidak tampil di sidebar KASIR; bila akses URL langsung diarahkan ke halaman akses ditolak / unauthorized)

---

## REGRESI — Pastikan Fitur Lama Tetap Jalan

1. [ ] **Checkout POS normal**: buka `/pos`, pilih produk, bayar → transaksi & stok display berkurang (tidak tersentuh void/retur)
2. [ ] **Barang masuk biasa tanpa No. Faktur**: form tanpa mengisi No. Faktur tetap sukses (no_surat = null)
3. [ ] **Restock display** (gudang → display) tetap normal
4. [ ] **Pindah display → gudang** tetap normal
5. [ ] **Stok opname** tetap normal (tidak bentrok kolom/trigger)
6. [ ] **Laba Rugi & Neraca** bisa dibuka tanpa error
7. [ ] **Tutup Kasir / Laporan Kas Harian** terbuka normal → `total_keluar` = pembelian AKTIF saja

---

## CATATAN AKHIR

Jika semua test lolos, Tier 1 selesai. Lanjut ke Tier 2 (T2-01 s/d T2-04) bila diminta.
