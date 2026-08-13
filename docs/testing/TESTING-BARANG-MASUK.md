# Panduan Uji Manual — Tier 1 & Tier 2 Modul Barang Masuk / Retur Pembelian

> Dokumen panduan step-by-step untuk memverifikasi **Tier 1** (data dasar barang masuk & retur pembelian) dan **Tier 2** (UX & integrasi: kolom waktu input, scan barcode di form, cetak surat jalan, ulangi pembelian).

> **Status**: Semua task di `todo-barang-masuk.md` — **Tier 1 (T1-01 s/d T1-19)** dan **Tier 2 (T2-01 s/d T2-04)** — sudah selesai dikerjakan. Dokumen ini adalah panduan **verifikasi manual** — jalankan secara berurutan dan centang tiap langkah setelah lolos untuk memastikan tidak ada yang terlewat & tidak ada regresi. Tanda `[x]` pada bagian Tier 1 berarti langkah itu sudah terverifikasi/gigunakan saat pengerjaan tier tersebut.

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
- [x] (opsional) Persiapkan 1 produk dengan `hitung_stok = tidak aktif` untuk uji Test 8
- [x] (Tier 2, opsional) Persiapkan minimal 1 produk dengan **barcode terisi** agar bisa menguji scan (Test 16 & 17)
- [x] (Tier 2, opsional) Untuk scan via HP (Test 17): HP Android + Chrome dalam **satu jaringan LAN/WiFi** dengan server, dan server bisa diakses via IP LAN (`/api/network-ip`)

> Jika ada langkah yang gagal, catat pesan errornya dan laporkan. Jangan lanjut ke test berikutnya sebelum memahami kenapa gagal.

---

## TIER 1 — Data Dasar Barang Masuk & Retur (T1-01 s/d T1-19)

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
- [x] No. Faktur tampil dan bisa dicari
- [x] Total & Jumlah Catatan = data AKTIF

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

## TEST 12 — Sinkron `harga_modal` dari AVCO (T1-19)

1. Pastikan produk yang digunakan memiliki `harga_modal` = 0 atau kosong (cek di `/dashboard/inventory` → Edit Produk).
2. Lakukan transaksi **Barang Masuk**, **Retur**, atau **Void** yang memicu perhitungan ulang AVCO.
3. Buka halaman Edit Produk lagi (atau cek via database).

**Hasil**:
- [x] `harga_modal` produk otomatis tersinkronisasi menjadi sama dengan `harga_pokok_avco` (HPP baru).
- [x] Sinkronisasi **hanya** terjadi jika nilai awal `harga_modal` adalah 0 atau kosong.

---

## TEST 13 — Tampilan Mutasi "Retur Pembelian" di Detail Produk (T1-16)

1. Buka Inventaris (`/dashboard/inventory`).
2. Klik pada produk yang baru saja dilakukan Retur Pembelian (misal produk dari Test 8).
3. Pada sheet detail produk yang muncul di sebelah kanan, buka tab **Riwayat HPP/AVCO** atau riwayat mutasi.

**Hasil**:
- [x] Terdapat baris mutasi dengan jenis **"Retur Pembelian"** (`retur_beli`).
- [x] Qty keluar dan harga pokok sesuai dengan data retur yang telah dilakukan.

---

## TEST 14 — Akses sebagai KASIR → Ditolak

1. Login sebagai akun ber-role **KASIR**.
2. Buka `/dashboard/inventory/stock-in`, `/dashboard/inventory/stock-in/history`, `/dashboard/inventory/stock-in/retur`.

**Hasil**:
- [x] Ditolak (menu Inventaris tidak tampil di sidebar KASIR; bila akses URL langsung diarahkan ke halaman akses ditolak / unauthorized)

---

## TIER 2 — Peningkatan UX & Integrasi (T2-01 s/d T2-04)

## TEST 15 — Kolom "Waktu Input" (`created_at`) di History (T2-01)

**Lokasi**: `/dashboard/inventory/stock-in/history`

1. Buka **Riwayat Barang Masuk**.
2. Kolom **"Waktu Input"** tampil di tabel (format `dd/mm/yyyy HH:mm`, sumber `created_at`). Pada layar mobile kolom ini **tersembunyi**. Baris data lama tanpa `created_at` menampilkan `-`.
3. Klik header "Waktu Input" → urut **naik/turun** berfungsi (sortable).
4. Tanpa klik sort (halaman pertama dibuka), data sudah urut **`tgl_masuk DESC, waktu input DESC`** (yang terbaru di atas).

**Hasil yang diharapkan**:
- [ ] Kolom "Waktu Input" tampil, format tanggal + jam benar, sortable, dan urut default sudah terbaru di atas

## TEST 16 — Scan Barcode (Keyboard/USB/Manual) di Form Barang Masuk (T2-02)

**Lokasi**: `/dashboard/inventory/stock-in`
**Prasyarat**: minimal 1 produk dengan `barcode` terisi (di `/dashboard/inventory` → edit produk → isi kolom barcode).

1. Buka form **Barang Masuk**. Di atas tabel item ada bar **"Scan Barcode"** berisi label, input barcode, dan tombol **"Scan via HP"**.
2. Klik input barcode, lalu **scan atau ketik barcode** produk dan tekan **Enter**:
   - **Barcode dikenal** (cocok persis `produk.barcode`, atau `produk.id`, atau nama yang mengandung) → produk masuk ke **baris item kosong pertama** (atau baris baru bila tidak ada baris kosong), kolom **Satuan Suplai** terisi otomatis (`default_purchase_unit`, fallback satuan inventori), muncul feedback hijau `"<Nama Produk> ditambahkan (baris N)"`, dan kursor otomatis pindah ke input **Qty Masuk** baris tersebut.
   - **Barcode tidak dikenal** → feedback merah `"Produk "<kode>" tidak ditemukan"`, input dikosongkan & tetap fokus; **tidak ada** baris baru yang dibuat.
3. Setelah scan, isi **Qty Masuk** & **Total Harga**, klik **Simpan Barang Masuk** → tersimpan normal (stok gudang bertambah, AVCO & riwayat ter-update).

**Hasil yang diharapkan**:
- [ ] Scan barcode dikenal → item terisi otomatis + feedback hijau + fokus ke qty
- [ ] Scan barcode tidak dikenal → feedback merah "Produk tidak ditemukan", tanpa item
- [ ] Item hasil scan bisa dilengkapi qty/harga lalu disimpan (validasi biasa tetap jalan)

## TEST 17 — Scan Barcode via HP (SSE Relay) (T2-02)

**Lokasi**: `/dashboard/inventory/stock-in` (PC) + 1 HP Android + Chrome
**Prasyarat**: PC & HP dalam **satu jaringan LAN/WiFi**; server dapat diakses via IP LAN (bisa dicek lewat `/api/network-ip`).

1. Di form Barang Masuk, klik **"Scan via HP"** → muncul modal berisi **QR code** dan indikator *"Menunggu koneksi..."*.
2. Pindai QR dengan kamera HP → terbuka halaman scanner `/scanner/<sessionId>` di Chrome HP → **izinkan akses kamera**.
3. Setelah tersambung, indikator berubah menjadi **"Terhubung"** (titik hijau berdenyut).
4. Scan barcode produk dengan kamera HP → dalam ±1–2 detik produk muncul di form (feedback hijau, satuan terisi, fokus qty — sama seperti Test 14).
5. Tutup modal → koneksi terputus; buka lagi → QR & koneksi baru dibuat ulang.

**Catatan**: barcode yang tidak dikenal saat scan via HP juga ditandai "Produk tidak ditemukan". Jika jaringan LAN tidak memungkinkan, langkah ini boleh dilewati — Test 14 (input manual/keyboard) sudah mencakup fungsi inti.

**Hasil yang diharapkan**:
- [ ] QR terbuka di HP, status "Terhubung", scan dari HP → item masuk ke form

## TEST 18 — Cetak Surat Jalan / Dokumen Penerimaan (T2-03)

**Lokasi**: `/dashboard/inventory/stock-in/history` → `/dashboard/inventory/stock-in/print/[id]`

1. Di **Riwayat**, klik ikon **printer** pada baris mana pun (AKTIF maupun DIVOID) → halaman **Surat Jalan** terbuka di tab baru.
2. Verifikasi isi dokumen (format A4):
   - **Header**: judul "Surat Jalan", nama toko + alamat + telepon/email (dari **Pengaturan toko**), **No. Faktur**, tanggal masuk.
   - **Info**: Supplier (nama/alamat/telepon), nomor dokumen (No. `####`), jumlah item.
   - **Tabel item**: No, Produk (+ SKU), **Qty Suplai**, **Base Qty**, **Harga/Pcs**, **Total** — cocok dengan data barang masuk (konversi UoM benar bila satuan suplai ≠ satuan dasar).
   - **Ringkasan**: **Total** + teks *"Terbilang: ..."*.
   - **Blok tanda tangan**: "Penerima" & "Supplier".
   - **Footer** dari Pengaturan (`footer_invoice_1/2/3`).
3. Baris berstatus **DIVOID** tercoret + label `(DIVOID)` dan **tidak dihitung** dalam total; muncul catatan *"Sebagian baris dibatalkan (DIVOID) dan tidak dihitung dalam total."*.
4. Klik **"Cetak Dokumen"** (tombol biru di atas) atau `Ctrl+P` → pratinjau print A4 rapi, mendukung multi-halaman, tanpa sidebar dashboard.
5. Dari form Barang Masuk: setelah **Simpan** sukses, klik tombol **"Cetak Dokumen"** di banner hijau → surat jalan untuk id yang baru saja disimpan.
6. Buka `/dashboard/inventory/stock-in/print/<id-tidak-ada>` → halaman **404** (bukan error).

**Hasil yang diharapkan**:
- [ ] Isi dokumen lengkap & benar (toko, no faktur, supplier, item + SKU, total terbilang, tanda tangan)
- [ ] Baris DIVOID dicoret & tidak dihitung di total
- [ ] Print preview A4 rapi; id tidak valid → 404
- [ ] Tombol "Cetak Dokumen" di banner sukses form mengarah ke print page yang benar

## TEST 19 — Ulangi Pembelian / Reorder (T2-04)

**Lokasi**: `/dashboard/inventory/stock-in/history` → `/dashboard/inventory/stock-in?reorder=<id>`

1. Di **Riwayat**, pada baris **AKTIF**, klik ikon **ulangi** (panah melingkar / `Repeat`) → diarahkan ke form `/dashboard/inventory/stock-in?reorder=<id>`.
2. Form sudah **ter-prefill**: **Supplier** terpilih, item-item penerimaan lama terisi (produk, satuan suplai, **qty suplai**, **total harga**), `tgl_masuk` = hari ini, **No. Faktur kosong**.
3. Muncul **banner "Ulangi Pembelian"**: menampilkan nama supplier, No. Faktur (bila ada), dan jumlah item terisi — dengan tombol **"Buat Baru"** di kanan.
4. Ubah qty salah satu item (mis. naikkan jumlah pembelian), klik **Simpan Barang Masuk** → simpan sukses; banner hilang, form ter-reset, dan barang masuk baru muncul di History.
5. Klik tombol **"Buat Baru"** pada banner → kembali ke form kosong (tanpa prefill).
6. Prefill mengambil **seluruh baris AKTIF** satu penerimaan (supplier + tanggal + No. Faktur sama); produk yang sudah tidak aktif / tidak ada di daftar **dilewati**; barang masuk DIVOID tidak diikutkan.
7. `?reorder=<id>` dengan id tidak valid / barang masuk DIVOID / tidak ada item → form normal **tanpa prefill dan tanpa error**.
8. Baris **DIVOID** tidak menampilkan tombol Repeat (juga Edit/Void disembunyikan); ikon printer tetap tersedia untuk semua baris.

**Hasil yang diharapkan**:
- [ ] Prefill "Buat Ulang" benar (supplier + item + qty + harga)
- [ ] Bisa diedit & disimpan sebagai barang masuk baru — barang masuk sumber tidak berubah
- [ ] Banner + tombol "Buat Baru" berfungsi; id invalid → form normal tanpa error

---

## REGRESI TIER 1 — Pastikan Fitur Lama Tetap Jalan

1. [x] **Checkout POS normal**: buka `/pos`, pilih produk, bayar → transaksi & stok display berkurang (tidak tersentuh void/retur)
2. [x] **Barang masuk biasa tanpa No. Faktur**: form tanpa mengisi No. Faktur tetap sukses (no_surat = null)
3. [x] **Restock display** (gudang → display) tetap normal
4. [x] **Pindah display → gudang** tetap normal
5. [x] **Stok opname** tetap normal (tidak bentrok kolom/trigger)
6. [x] **Laba Rugi & Neraca** bisa dibuka tanpa error
7. [x] **Tutup Kasir / Laporan Kas Harian** terbuka normal → `total_keluar` = pembelian AKTIF saja

## REGRESI TIER 2 — Pastikan Fitur Baru Tidak Mengganggu yang Lain

1. [ ] Kolom "Waktu Input" + tombol aksi baru (printer / ulangi) tidak merusak search, filter supplier & tanggal, sort, dan export CSV/PDF History yang lama.
2. [ ] Scan barcode (Test 16/17) tidak mengganggu pemilihan produk **manual** di kolom Produk (ProductCombo cari nama/barcode tetap berfungsi).
3. [ ] Form dari "Ulangi Pembelian" tetap bisa digabung dengan scan barcode: buka form reorder lalu scan produk lain → baris bertambah normal.
4. [ ] Halaman print Surat Jalan untuk barang masuk yang **semua baris DIVOID** → total Rp 0, label DIVOID tampil, tanpa error.
5. [ ] Riwayat retur (`/dashboard/inventory/stock-in/retur/history`) & form retur tetap normal (tidak terpengaruh perubahan history stock-in).
6. [ ] `npx tsc --noEmit` bersih & `npx eslint` file yang diubah Tier 2 tidak menambah error baru.

---

## CATATAN AKHIR

- Jika semua test di atas lolos, maka **Tier 1 & Tier 2 modul Barang Masuk / Retur Pembelian selesai dan stabil**.
- **Syarat teknis test Tier 2**: scan via HP (Test 17) butuh HP Android + Chrome di jaringan LAN/WiFi yang sama dengan server, dan server bisa diakses via IP LAN. Jika tidak memungkinkan, fungsi scan via keyboard manual (Test 16) sudah mencakup inti fitur.
- **Tier 3 (Future)** di `todo-barang-masuk.md` — PO lengkap, partial delivery/backorder, QC check, hutang dagang, batch/lot & expiry, foto faktur, idempotency key — **belum dikerjakan**, hanya catatan rencana.
