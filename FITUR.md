# Fitur Lengkap — POS Sobatti / PLK POS

> Daftar lengkap SEMUA fitur yang ada di project ini (hasil analisa mendalam: 58 halaman, 27 API route, 61 migrasi SQL, dll).
> Status: `[ ]` belum dicek · `[x]` sudah ada & berfungsi · `[!]` ada masalah/catatan
> Sumber: `TODO1..6` = tertulis di file TODO · `BARU` = tidak tertulis di TODO manapun

---

## A. MODUL POS — KASIR (`app/pos`) — 19 fitur

| # | Fitur | Deskripsi | Lokasi | Sumber | ✓ |
|---|-------|-----------|--------|--------|---|
| 1 | Katalog produk | Grid produk dengan warna per kategori (12 mapping warna), search (nama/kategori/id/barcode), filter kategori | `app/pos/page.tsx` | dasar | [x] |
| 2 | Numpad on-screen | Tombol 0-9, `delete`, `.`; berlaku untuk qty item aktif & jumlah bayar | `stores/pos-store.ts` (`numpadPress`) | dasar | [x] |
| 3 | Keranjang (cart) | Tambah item, qty +/− (min 0 = hapus otomatis), hapus item, item aktif untuk diedit, subtotal live | `stores/pos-store.ts` | dasar | [x] |
| 4 | Tipe harga 3 tier | Satuan / Grosir / Promo per item, ganti tier mengubah harga item | `stores/pos-store.ts` (`setPriceType`), `app/pos/page.tsx` | TODO1#13 | [x] |
| 5 | Diskon per item | Diskon item via numpad, dihitung dari harga sebelum dikali qty | `stores/pos-store.ts`, `detail_transaksi_keluar.diskon_item` | TODO1#5 | [x] |
| 6 | Pajak dinamis | `pajak_persen` dari pengaturan (bukan hardcoded), diterapkan ke subtotal | `app/api/pos/checkout/route.ts` | TODO1#20 | [x] |
| 7 | Pilih pelanggan | Dropdown pelanggan (default UMUM), wajib jika kredit/DP | `app/pos/page.tsx`, `/api/pos/customers` | dasar | [x] |
| 8 | Cari Member by No HP | Modal cari via `/api/pos/member-search`, tampil kartu member (nama, no HP, poin) + tombol "Pilih Member" | `app/pos/page.tsx`, `/api/pos/member-search` | TODO5 | [x] |
| 9 | Daftar Member Baru | Modal registrasi (nama + no HP min 10 digit), cek duplikat (409), auto-fill dari query, poin awal 0 | `app/pos/page.tsx`, `/api/pos/member-register` | TODO5 | [x] |
| 10 | Badge poin member | Badge poin di bawah nama pelanggan terpilih jika point > 0 (ikon Award) | `app/pos/page.tsx` | TODO5 | [x] |
| 11 | Metode bayar & DP | Metode bayar dari tabel `metode_bayar`; jika "DP" tampil input DP → `sisa = total − dp` tersimpan | `app/pos/page.tsx`, RPC `process_checkout` | TODO1#4 | [x] |
| 12 | Checkout atomik | RPC `process_checkout`: advisory lock `987654321`, no_transaksi `YYYYMM+NNNN` (WIB), potong stok, catat AVCO, hitung HPP & laba kotor | `app/api/pos/checkout/route.ts`, migrasi `20260529` s/d `20260721` | TODO1#1 | [x] |
| 13 | Poin member otomatis | Setelah checkout: `poin = floor(total / poin_min_pembelian)`, update via RPC `increment_point`, return `poin_ditambahkan` | `app/api/pos/checkout/route.ts` | TODO5+TODO6 | [x] |
| 14 | Cek Stok modal | Modal cek stok produk (display + gudang) saat item dipilih | `app/pos/page.tsx` (ikon PackageSearch) | BARU | [x] |
| 15 | Scanner barcode kamera | Modal scan barcode dengan kamera (ZXing) langsung di POS | `app/pos/page.tsx` (ikon ScanLine) | BARU | [x] |
| 16 | Scanner barcode hardware | Dukungan USB barcode scanner via keyboard wedge: buffer 150ms + Enter, auto add to cart, khusus cek stok saat modal terbuka | `app/pos/page.tsx:250` (`handleKeyDown`) | BARU | [x] |
| 17 | Indikator WiFi & IP server | Ikon Wifi/WifiOff + tampil IP server (dari `/api/network-ip`) untuk panduan koneksi scanner HP | `app/pos/page.tsx`, `/api/network-ip` | BARU | [x] |
| 18 | Banner stok menipis | Banner atas berwarna warning + link inventaris, dismiss per sesi (sessionStorage) | `components/low-stock-banner.tsx` | BARU | [x] |
| 19 | Redirect pasca-checkout | Sukses → redirect ke `/pos/invoice/[id]`, cart di-reset | `stores/pos-store.ts` (`checkout()`) | TODO1#21 | [x] |

## B. SCANNER BARCODE (HP) — `app/scanner` — 5 fitur

| # | Fitur | Deskripsi | Lokasi | Sumber | ✓ |
|---|-------|-----------|--------|--------|---|
| 20 | Kamera HP sebagai scanner | Halaman scan barcode via kamera (ZXing `BrowserMultiFormatReader`) untuk HP, terhubung ke sesi POS via SSE | `app/scanner/[sessionId]/page.tsx` | BARU | [x] |
| 21 | Relay SSE in-memory | `ensureSession/addListener/emit`, sesi kadaluarsa 5 menit idle | `lib/scanner-relay.ts` | BARU | [x] |
| 22 | Push barcode ke sesi | POST `/api/scanner/[sessionId]` (wajib auth) → emit ke semua listener | `app/api/scanner/[sessionId]/route.ts` | BARU | [x] |
| 23 | Stream SSE events | GET `/api/scanner/[sessionId]/events`, ping keep-alive 20 detik, cleanup saat koneksi ditutup | `app/api/scanner/[sessionId]/events/route.ts` | BARU | [x] |
| 24 | Feedback scan | Getar 80ms, cooldown per barcode, hitung jumlah scan | `app/scanner/[sessionId]/page.tsx` | BARU | [x] |

## C. INVOICE & STRUK — `app/pos/invoice` — 6 fitur

| # | Fitur | Deskripsi | Lokasi | Sumber | ✓ |
|---|-------|-----------|--------|--------|---|
| 25 | Invoice A4 | Kop toko (nama, alamat, telepon, email), data transaksi/pelanggan/kasir/metode bayar, tabel item, total, terbilang, tombol cetak | `app/pos/invoice/[id]/page.tsx` | TODO1#14,19 | [x] |
| 26 | Faktur Penjualan | Varian header "FAKTUR PENJUALAN" (query `?type=`) | `app/pos/invoice/[id]/page.tsx` | TODO1#16 | [x] |
| 27 | Struk thermal 58mm | Format minimalis, tanpa simbol Rp, tanggal `dd/MM/yy HH:mm`, terbilang, footer dari pengaturan | `app/pos/invoice/[id]/receipt/page.tsx` | TODO1#15 | [x] |
| 28 | Info bank di invoice | Bank 1 & 2 (nama, rekening, atas nama) dari pengaturan | `app/pos/invoice/[id]/page.tsx` | TODO1#19 | [x] |
| 29 | Footer struk/invoice | `footer_struk_1..3`, `footer_invoice_1..3`, `hormat_kami_nama` dari pengaturan | invoice & receipt | TODO1#19 | [x] |
| 30 | Terbilang | `terbilang()` + `terbilangRupiah()` — angka ke kata Bahasa Indonesia (sampai triliun, negatif) | `lib/terbilang.ts` | TODO1#14 | [x] |

## D. INVENTORI — `app/dashboard/inventory` — 20 fitur

| # | Fitur | Deskripsi | Lokasi | Sumber | ✓ |
|---|-------|-----------|--------|--------|---|
| 31 | CRUD produk | DataTable produk: tambah/edit inline, hapus modal, kolom sku/nama/kategori/satuan/3 harga/diskon/stok/AVCO, toggle visibilitas | `app/dashboard/inventory/inventory-client.tsx` | dasar | [x] |
| 32 | Stok ganda (dual warehouse) | `stok` (display) + `stok_gudang`; penjualan kurangi display, sisa dari gudang; barang masuk ke gudang | migrasi `20260706_add_stok_gudang.sql` | TODO4 | [x] |
| 33 | Restock display cepat | Tombol restock dari stok gudang ke display per baris | `app/dashboard/inventory/inventory-client.tsx` | BARU | [x] |
| 34 | UoM Conversion | `base_unit` (pcs), `default_purchase_unit` (lusin/roll/set), `conversion_ratio` per produk, di form produk | migrasi `20260720_add_uom_conversion.sql` | TODO4 | [x] |
| 35 | Barang Masuk multi-baris | Form: supplier, tanggal, baris dinamis (produk, qty suplai, satuan suplai, total harga, keterangan), Zod + useFieldArray | `app/dashboard/inventory/stock-in/stock-in-client.tsx` | TODO4 | [x] |
| 36 | Indikator konversi real-time | Teks: "Barang masuk: 2 Lusin. (Rasio: 1 Lusin = 12 Pcs). Total masuk gudang: 24 Pcs." | `stock-in-client.tsx` | TODO4 | [x] |
| 37 | RPC Barang Masuk | `process_barang_masuk`: advisory lock `987654322`, dual-format (UoM + legacy), hitung AVCO tertimbang, catat riwayat | migrasi `20260718104411_update_process_barang_masuk.sql` | TODO4 | [x] |
| 38 | Riwayat Barang Masuk | DataTable: search, filter supplier & tanggal, kolom audit UoM (supplied_unit, qty, ratio, base_qty_added, total_cost, base_cost_per_piece), export CSV/PDF | `app/dashboard/inventory/stock-in/history/` | TODO1#8 | [x] |
| 39 | Stok Opname form | Tanggal + baris dinamis (produk, stok fisik ≥ 0, keterangan), stok sistem auto, import CSV | `app/dashboard/inventory/stock-opname/stock-opname-client.tsx` | TODO1#6 | [x] |
| 40 | RPC Stok Opname bulk | `process_stock_opname`: advisory lock `987654323`, insert bulk, selisih, riwayat AVCO jenis 'koreksi' | migrasi `20260728_add_bulk_stock_opname.sql` | BARU | [x] |
| 41 | Riwayat Stok Opname | DataTable: tanggal, produk, stok sistem, stok fisik, selisih, keterangan; filter tanggal; export | `app/dashboard/inventory/stock-opname/history/` | TODO1#7 | [x] |
| 42 | AVCO (Average Cost) | `calculateNewAVCO()` + `recordAVCOMutation()` (pembelian/penjualan/koreksi/retur_beli/retur_jual), update `harga_pokok_avco` & `nilai_persediaan` | `lib/avco.ts`, tabel `riwayat_avco` | TODO3#2 | [x] |
| 43 | Kartu Stok & Mutasi | Tab di sheet detail produk: riwayat mutasi (jenis, qty, harga beli dengan indikator naik/turun, HPP AVCO sesudah, supplier) | `components/product-detail-sheet.tsx` | BARU | [x] |
| 44 | Detail produk sheet | Tab info dasar: nama, barcode, kategori, satuan, stok display/gudang, min stok, harga modal, HPP AVCO (highlight ungu), 3 harga jual | `components/product-detail-sheet.tsx` | BARU | [x] |
| 45 | Low stock realtime | `useLowStockRealtime()`: fetch `/api/low-stock` + subscribe Supabase realtime, shared singleton ref-count | `hooks/use-low-stock-realtime.ts` | BARU | [!] |
| 46 | Widget stok menipis | Dashboard widget: 5 item teratas, ikon kategori produk (semen, cat, besi, dll), link "Stok Ulang" | `components/dashboard-low-stock.tsx` | BARU | [x] |
| 47 | Badge sidebar stok menipis | Badge AlertTriangle di menu Inventaris (role manajemen) | `components/dashboard-sidebar.tsx` | BARU | [x] |
| 48 | Barcode produk | Generate barcode CODE128 (jsbarcode), API SVG, tampil di detail/import | `app/api/inventory/barcode/route.ts` | BARU | [x] |
| 49 | SKU & Merk | Tabel `merk` (kode 4 char), kolom `sku` UNIQUE + `id_merk` di produk, unique `(nama_produk, sku)` | migrasi `20260717_*` | BARU | [x] |
| 50 | Import CSV produk | Modal import (preview, validasi per baris, template), papaparse | `components/import-csv-modal.tsx` | BARU | [x] |

| 78 | Produk Paket (Bundling) | Dukungan produk paket dengan master, `qty_per_unit`, `isi_satuan`, `jenis_isi_paket` (Fixed / Actual Weight), isi stok paket otomatis ke master/gudang | migrasi `20260830`..`20260903` | BARU | [x] |
| 79 | Lokasi Area Rak | Tambahan tabel `lokasi_area` dan mapping di produk untuk mempermudah pencarian barang di gudang/rak | migrasi `20260901` | BARU | [x] |
| 80 | Stok Opname Berbasis Sesi | Stok opname menggunakan konsep sesi (simpan draft, selesaikan, void), dengan riwayat per sesi | `app/dashboard/inventory/stock-opname/` | BARU | [x] |
| 81 | Retur Pembelian | Modul retur pembelian barang ke supplier dengan riwayat, memotong HPP dan mereset AVCO secara proporsional | `app/dashboard/inventory/stock-in/retur/` | BARU | [x] |
| 82 | Batal/Void Barang Masuk | Fitur membatalkan barang masuk dengan mengembalikan uang dan HPP ke nilai sebelumnya | migrasi `20260810` | BARU | [x] |
| 83 | Cetak Bukti Barang Masuk | Tombol cetak tanda terima barang masuk ke gudang PDF/Print | `app/dashboard/inventory/stock-in/print/[id]` | BARU | [x] |
| 84 | Harga Besar Otomatis | Sinkronisasi konversi UoM untuk `harga_jual_besar_*` otomatis di tingkat DB via trigger | migrasi `20260816` | BARU | [x] |
| 85 | Generate SKU & Barcode | Tombol generate otomatis 6 digit angka acak unik untuk SKU dan Barcode di form produk | `app/dashboard/inventory/inventory-client.tsx` | BARU | [x] |
| 86 | Stok Minimum Gudang | Indikator stok gudang menipis yang terpisah dari stok display | migrasi `20260816` | BARU | [x] |

## E. MASTER DATA — PELANGGAN, SUPPLIER, REFERENSI — 6 fitur

| # | Fitur | Deskripsi | Lokasi | Sumber | ✓ |
|---|-------|-----------|--------|--------|---|
| 51 | Pelanggan CRUD | DataTable: tambah/edit inline, hapus modal, kolom nama/alamat/no HP/email/keterangan/**Poin** | `app/dashboard/customers/customers-client.tsx` | TODO1#11+TODO5 | [x] |
| 52 | Proteksi pelanggan UMUM | Baris UMUM (default walk-in) dilindungi dari hapus | `customers-client.tsx` | TODO1#11 | [x] |
| 53 | Import CSV pelanggan | Import + kolom Poin ikut export CSV/PDF | `customers-client.tsx` | BARU | [x] |
| 54 | Supplier CRUD | DataTable: tambah/edit/hapus, kolom nama/alamat/telepon/email/keterangan | `app/dashboard/suppliers/` | TODO1#12 | [x] |
| 55 | Data referensi 3 tab | Kategori | Satuan | Metode Bayar — CRUD inline per tab | `app/dashboard/settings/reference-data/reference-client.tsx` | TODO1#18 | [x] |
| 56 | Import CSV referensi | Import kategori/satuan/metode bayar + template | `reference-client.tsx` | BARU | [x] |


## E.2. EVENT PROMO — `app/dashboard/event-promo` — 3 fitur

| # | Fitur | Deskripsi | Lokasi | Sumber | ✓ |
|---|-------|-----------|--------|--------|---|
| 87 | CRUD Event Promo | DataTable event promosi: nama, tipe diskon (persen/nominal), nilai, tanggal mulai & selesai, aktif/tidak | `app/dashboard/event-promo/` | BARU | [x] |
| 88 | Manajemen Produk Promo | Menambahkan produk spesifik yang masuk ke dalam event promo, berlaku dinamis di seluruh POS | `app/dashboard/event-promo/` | BARU | [x] |
| 89 | API Diskon Efektif | Endpoint kalkulasi diskon otomatis yang sedang aktif berdasar tanggal hari ini (`/api/event-promo/efektif`) | `app/api/event-promo/efektif/route.ts` | BARU | [x] |

## F. PENGGUNA & AUTH — 7 fitur

| # | Fitur | Deskripsi | Lokasi | Sumber | ✓ |
|---|-------|-----------|--------|--------|---|
| 57 | Login username/email | Login pakai email ATAU username (auto `@sobats.com`), cek status aktif, cookie SSR | `app/api/auth/login/route.ts`, `components/login-form.tsx` | dasar | [x] |
| 58 | Redirect berdasarkan role | KASIR→`/pos`, KARYAWAN→`/attendance/scan` (⚠️ bug 404), lain→`/dashboard` | `components/login-form.tsx`, `app/dashboard/layout.tsx` | dasar | [!] |
| 59 | Manajemen pengguna | DataTable: nama, username, level (OWNER/ADMIN/KASIR/KARYAWAN), password, toggle aktif; OWNER only | `app/dashboard/settings/users/users-client.tsx` | TODO1#17 | [x] |
| 60 | Import CSV pengguna | Import pengguna + template | `users-client.tsx` | BARU | [x] |
| 61 | Supabase Auth | Email/password via SSR cookies (`@supabase/ssr`) | `lib/supabase/server.ts`, `client.ts` | dasar | [x] |
| 62 | SERVICE_ROLE terisolasi | Admin client hanya di `lib/supabase/admin.ts` (laporan, RPC) | `lib/supabase/admin.ts` | dasar | [x] |
| 63 | RBAC 4 role | OWNER/ADMIN/KASIR/KARYAWAN — menu & API di-filter per role | sidebar, layout, API | dasar | [x] |

## G. DASHBOARD — `app/dashboard` — 9 fitur

| # | Fitur | Deskripsi | Lokasi | Sumber | ✓ |
|---|-------|-----------|--------|--------|---|
| 64 | Revenue hari ini vs kemarin | Kartu statistik + persentase perubahan (TrendingUp/Down) | `lib/dashboard.ts` (`getDashboardData`) | dasar | [x] |
| 65 | Jumlah order & avg ticket | Kartu CheckCircle2/Clock + rata-rata tiket hari ini | `lib/dashboard.ts` | dasar | [x] |
| 66 | Sparkline 14 hari | Grafik penjualan 14 hari terakhir | `lib/dashboard.ts` | dasar | [x] |
| 67 | Transaksi terbaru | 5 transaksi terakhir + jumlah item, status Selesai/Sebagian/Tertunda (bayar vs total) | `lib/dashboard.ts` | dasar | [x] |
| 68 | Aktivitas terbaru | 10 log terakhir, waktu relatif ("Baru saja", "X menit lalu"), badge aksi, link "Lihat Semua" | `components/dashboard-recent-activity.tsx` | BARU | [x] |
| 69 | Widget stok menipis | Lihat #46 | `components/dashboard-low-stock.tsx` | BARU | [x] |
| 70 | Widget absensi | Status hari ini (BELUM ABSEN/HADIR/TERLAMBAT + menit telat), jam masuk/pulang WIB, tombol Scan; hidden untuk OWNER | `components/attendance-widget.tsx` | TODO2#6 | [x] |
| 71 | Statistik absensi KARYAWAN | Kartu total/hadir/telat bulanan untuk role KARYAWAN | `app/dashboard/page.tsx` | TODO2#6 | [x] |
| 72 | Sidebar + mobile nav | Sidebar desktop role-aware + slide-over mobile, badge low stock, auto-close | `components/dashboard-sidebar.tsx`, `dashboard-mobile-nav.tsx` | dasar | [x] |

## H. TRANSAKSI — `app/dashboard/transactions` — 5 fitur

| # | Fitur | Deskripsi | Lokasi | Sumber | ✓ |
|---|-------|-----------|--------|--------|---|
| 73 | Riwayat transaksi | DataTable: no_transaksi, tanggal, total, bayar/kembali, pelanggan, kasir, metode bayar; search + filter metode + rentang tanggal | `transactions-client.tsx` | TODO1#2 | [x] |
| 74 | Detail transaksi | Sheet/modal detail (fetch item detail) tanpa halaman terpisah | `transactions-client.tsx` | TODO1#2 | [x] |
| 75 | Navigasi ulang ke invoice | Ikon Receipt → buka invoice transaksi | `transactions-client.tsx` | TODO1#2 | [x] |
| 76 | Void transaksi | Modal konfirmasi (Trash2/AlertTriangle), DELETE, role tertentu saja; stok TIDAK dikembalikan (sesuai spesifikasi) | `transactions-client.tsx`, `app/api/dashboard/transactions/[id]/route.ts` | TODO1#3 | [x] |
| 77 | Export riwayat | CSV & PDF | `transactions-client.tsx` | BARU | [x] |

## I. LAPORAN & KEUANGAN — 12 fitur

| # | Fitur | Deskripsi | Lokasi | Sumber | ✓ |
|---|-------|-----------|--------|--------|---|
| 78 | Laporan ringkasan | Preset: Hari Ini / 7 Hari / 30 Hari / Semua; kartu statistik (penjualan, jumlah transaksi); **top produk** (best seller by qty & revenue); daftar stok menipis | `app/dashboard/reports/reports-client.tsx` | TODO1#10 | [x] |
| 79 | API laporan penjualan | GET `/api/laporan/penjualan`: pagination (max 200), filter pelanggan/metode/kasir, search, sort, `include_items`, meta (total, HPP, laba kotor, diskon, pajak, avg) | `app/api/laporan/penjualan/route.ts` | BARU | [x] |
| 80 | Rekap penjualan | GET `/api/laporan/penjualan/rekap`: group_by hari/kasir/metode_bayar/pelanggan, agregasi total/laba/HPP | `app/api/laporan/penjualan/rekap/route.ts` | BARU | [x] |
| 81 | Export CSV laporan | GET `/api/laporan/penjualan/export`: 15 kolom, escaping proper, filename `penjualan_<start>_<end>.csv` | `app/api/laporan/penjualan/export/route.ts` | BARU | [x] |
| 82 | Detail transaksi API | GET `/api/laporan/penjualan/[id]` (relasi lengkap) | `app/api/laporan/penjualan/[id]/route.ts` | BARU | [x] |
| 83 | Laporan Laba Rugi | Rentang tanggal, kartu pendapatan kotor/diskon/bersih, HPP, laba kotor, laba bersih (beban = 0 placeholder); print + export CSV | `app/dashboard/laporan/laba-rugi/`, `lib/laporan-keuangan.ts` | TODO3#6 | [x] |
| 84 | Laporan Neraca | Per tanggal; ASET (kas, persediaan via RPC `get_inventory_value_at_date`, total), KEWAJIBAN (0), EKUITAS (modal awal + laba ditahan); print + export CSV | `app/dashboard/laporan/neraca/`, `lib/laporan-keuangan.ts` | TODO3#7 | [x] |
| 85 | Tutup Kasir | Ringkasan saldo awal (dari kemarin/modal awal), total masuk (kas tunai), total keluar (pembelian), input uang aktual, selisih otomatis, Save (upsert `saldo_kas_harian`) + Print | `app/dashboard/tutup-kasir/`, `lib/laporan-kasir.ts` | TODO3#5 | [x] |
| 86 | Laporan Kasir Harian | DataTable riwayat: tanggal, saldo awal, total masuk/keluar, saldo sistem, uang aktual, selisih, kasir; search + export CSV + print | `app/dashboard/laporan-kasir/` | TODO3#5 | [x] |
| 87 | Log Aktivitas | Tabel `log_aktivitas` (aksi CREATE/UPDATE/DELETE, entitas, deskripsi, data lama/baru JSONB, IP); halaman dengan search + filter entitas/aksi/tanggal | `app/dashboard/log-aktivitas/`, migrasi `20260729_add_log_aktivitas.sql` | BARU | [x] |
| 88 | Deskripsi log otomatis | `buildDeskripsi()` — generator kalimat Indonesia otomatis ("Menambahkan Produk 'X': harga_jual: 5000...") | `lib/activity-log.ts` | BARU | [x] |
| 89 | Export utility | `exportToCSV` (papaparse + BOM UTF-8) & `exportToPDF` (jsPDF + autoTable) | `lib/export-utils.ts` | TODO3#8 | [x] |


## I.2. KEUANGAN & PENGELUARAN — `app/dashboard/keuangan` — 4 fitur

| # | Fitur | Deskripsi | Lokasi | Sumber | ✓ |
|---|-------|-----------|--------|--------|---|
| 90 | Kas Admin & Modal Awal | Saldo kas berjalan admin, di-set modal awal dari pengaturan keuangan | `app/dashboard/keuangan/kas-admin/` | BARU | [x] |
| 91 | Arus Kas | Riwayat mutasi masuk/keluar kas admin, tercatat otomatis dari tiap transaksi pengeluaran/retur/modal | `app/dashboard/keuangan/arus-kas/` | BARU | [x] |
| 92 | Pengeluaran/Beban Operasional | Form pencatatan beban/pengeluaran toko (ATK, Konsumsi, Gaji, dll), langsung potong saldo kas admin | `app/dashboard/keuangan/pengeluaran/` | BARU | [x] |
| 93 | Laporan Kas | Laporan mutasi kas per rentang tanggal (export PDF/CSV) | `app/dashboard/laporan/kas/` | BARU | [x] |

## J. ABSENSI — `app/dashboard/attendance` — 9 fitur

| # | Fitur | Deskripsi | Lokasi | Sumber | ✓ |
|---|-------|-----------|--------|--------|---|
| 90 | Generate QR dinamis | POST `/api/attendance/generate-qr` (OWNER only): token UUID, expired 30-60 detik (env `QR_EXPIRE_SECONDS`); UI QR 300px + countdown + auto-refresh | `app/dashboard/attendance/generate-qr/`, `app/api/attendance/generate-qr/route.ts` | TODO2#3,4 | [x] |
| 91 | Scan QR check-in | POST `/api/attendance/checkin`: validasi token aktif & belum expired, geofencing GPS (Haversine, radius `MAX_ATTENDANCE_RADIUS`), status HADIR/TELAT (10 menit setelah absen dibuka = QR absensi pertama hari itu), cek duplikat, token dinonaktifkan setelah dipakai (anti replay) | `app/dashboard/attendance/scan/`, `app/api/attendance/checkin/route.ts` | TODO2#3,5 | [x] |
| 92 | Check-out | POST `/api/attendance/checkout`: catat `jam_pulang`, wajib sudah check-in, tanpa validasi GPS, token dinonaktifkan | `app/api/attendance/checkout/route.ts` | TODO2#3 | [x] |
| 93 | Riwayat absensi pribadi | GET `/api/attendance/history` (limit 31 hari); DataTable + statistik (total, telat, menit telat) + filter tanggal + export | `app/dashboard/attendance/history/` | TODO2#3,6 | [x] |
| 94 | Laporan absensi pegawai | GET `/api/admin/attendance` (ADMIN/OWNER): paginated, filter start/end; DataTable search + statistik + export; **halaman OWNER only** | `app/dashboard/attendance/report/`, `app/api/admin/attendance/route.ts` | TODO2#7 | [x] |
| 95 | Widget dashboard | Lihat #70 | `components/attendance-widget.tsx` | TODO2#6 | [x] |
| 96 | Tabel absensi + qr_session | Tabel `absensi` (jam masuk/pulang, status, telat_menit, lat/long, device_info) + `qr_session` (token, expired_at, is_active) + index | migrasi TODO2#1 | TODO2#1 | [x] |
| 97 | Geofencing via env | `STORE_LATITUDE`, `STORE_LONGITUDE`, `MAX_ATTENDANCE_RADIUS`, `QR_EXPIRE_SECONDS`, `ATTENDANCE_START_TIME`, `ATTENDANCE_TOLERANCE_MINUTES` | `.env` | TODO2#2 | [x] |
| 98 | PWA | `next-pwa` dikonfigurasi (`dest: public`, disable di dev), manifest (`app/manifest.ts`), icon 192/512 — **SW caching attendance belum** | `next.config.ts`, `app/manifest.ts` | TODO2#8 | [!] |

## K. PENGATURAN — `app/dashboard/settings` — 5 fitur

| # | Fitur | Deskripsi | Lokasi | Sumber | ✓ |
|---|-------|-----------|--------|--------|---|
| 99 | Info toko | nama_toko, alamat, telepon, email | `settings/store-form.tsx` | TODO1#9 | [x] |
| 100 | Konfigurasi transaksi | metode_diskon, pajak_persen, jenis_nota, metode_cetak, logo_nota, **poin_min_pembelian** | `settings/store-form.tsx`, `settings/store-actions.ts` | TODO1#9+TODO6 | [x] |
| 101 | Bank & footer | bank1/bank2 (nama, rekening, atas_nama), footer_struk 1-3, footer_invoice 1-3, hormat_kami_nama | `settings/store-form.tsx` | TODO1#9 | [x] |
| 102 | Keuangan | modal_awal, tanggal_mulai, nama_pemilik, NPWP → `pengaturan_keuangan` | `app/dashboard/settings/keuangan/` | TODO3#7 | [x] |
| 103 | Profil pengguna | Form profil + tautan cepat ke users & referensi | `app/dashboard/settings/page.tsx` | dasar | [x] |

## L. ALAT (TOOLS) — 5 fitur

| # | Fitur | Deskripsi | Lokasi | Sumber | ✓ |
|---|-------|-----------|--------|--------|---|
| 104 | Price tag generator | Label harga 60×37mm (landscape) / 37×60mm (portrait): barcode CODE128 (fallback SKU), harga merah Impact, footer logo; 4 slider ukuran font (mm); preview + navigasi; **download PNG per item & batch ZIP**; print | `app/dashboard/label-generator/`, `components/price-tag.tsx` | BARU | [x] |
| 105 | Stiker label produk | Stiker 33×15mm: nama (max 2 baris), barcode + teks, harga IDR; qty per item (default 3); 3 slider ukuran; print | `app/dashboard/product-label/`, `components/product-sticker-label.tsx` | BARU | [x] |
| 106 | Sheet barcode A4 | 30 label per halaman (3 kolom × 10 baris) dari **import CSV** (Barcode/Item/Harga Retail), CODE128, print | `app/pos/test-barcode/page.tsx` | BARU | [x] |
| 107 | Demo price tag | Halaman statis contoh price tag (publik, tanpa login) | `app/demo-price-tag/page.tsx` | BARU | [x] |
| 108 | Redirect label-generator | `/label-generator` → `/dashboard/label-generator` | `app/label-generator/page.tsx` | BARU | [x] |

## M. INFRASTRUKTUR & TEKNIS — 12 fitur

| # | Fitur | Deskripsi | Lokasi | Sumber | ✓ |
|---|-------|-----------|--------|--------|---|
| 109 | DataTable generik | Search, sort (asc/desc), filter 3 tipe (select/date-range/custom), pagination + items-per-page, edit inline + expanded, delete modal, mobile cards, empty/loading/error state, sticky header | `components/data-table.tsx` | BARU | [x] |
| 110 | Hook useTable | Sorting + pagination client-side, nested key ("a.b"), reset halaman saat sort | `hooks/use-table.ts` | BARU | [x] |
| 111 | ImportCSVModal generik | Drag-drop upload, preview 50 baris + validasi per baris (Valid/Error), download template, ringkasan hasil, auto-close | `components/import-csv-modal.tsx` | BARU | [x] |
| 112 | RLS + SECURITY DEFINER | RLS aktif di semua tabel; RPC check-out/barang masuk/opname/log bypass RLS; SERVICE_ROLE hanya di admin client | migrasi RLS, `lib/supabase/admin.ts` | dasar | [x] |
| 113 | Advisory locks | 3 lock: `987654321` (checkout), `987654322` (barang masuk), `987654323` (stok opname) — cegah race condition | migrasi RPC | dasar | [x] |
| 114 | Zustand store | `pos-store.ts`: products/customers/paymentMethods, cart, numpad, checkout flow | `stores/pos-store.ts` | dasar | [x] |
| 115 | Zod + React Hook Form | Validasi semua form (barang masuk, opname, member register, dll) | berbagai form | dasar | [x] |
| 116 | Caching headers | `pos/products` (60s), `low-stock` (30s) — `stale-while-revalidate` | API routes | BARU | [x] |
| 117 | Responsive | Mobile nav slide-over, mobile cards mode (breakpoint md/lg/xl), touch targets | komponen | dasar | [x] |
| 118 | Export CSV/PDF | Lihat #89 | `lib/export-utils.ts` | TODO3#8 | [x] |
| 119 | 404 page | `app/not-found.tsx` | `app/not-found.tsx` | dasar | [x] |
| 120 | Realtime produk | Subscribe perubahan tabel `produk` untuk low-stock — **⚠️ migrasi `20260708` typo: `ADD TABLE publik` (bukan `produk`) → realtime mungkin tidak berjalan** | `hooks/use-low-stock-realtime.ts`, migrasi `20260708_add_produk_realtime.sql` | BARU | [!] |

---

## 📡 DAFTAR 22 API ENDPOINT


| Method | Endpoint | Fungsi |
|--------|----------|--------|
| POST | `/api/auth/login` | Login email/username, cek aktif, set cookie |
| GET | `/api/pos/products` | Produk utk kasir (search, pagination, cache 60s) |
| GET | `/api/pos/barcode` | Cari produk by barcode/id/nama |
| GET | `/api/pos/customers` | Daftar pelanggan (termasuk poin) |
| GET | `/api/pos/member-search` | Cari member by no HP |
| POST | `/api/pos/member-register` | Daftar member baru (anti duplikat) |
| GET | `/api/pos/payment-methods` | Metode bayar |
| POST | `/api/pos/checkout` | Checkout → RPC + poin member |
| POST | `/api/scanner/[sessionId]` | Relay barcode ke sesi |
| GET | `/api/scanner/[sessionId]/events` | SSE stream barcode |
| GET | `/api/low-stock` | Produk stok menipis (cache 30s) |
| GET | `/api/network-ip` | IP server utk panduan scanner |
| GET | `/api/attendance/today` | Status absensi hari ini |
| POST | `/api/attendance/checkin` | Check-in (QR + GPS + telat) |
| POST | `/api/attendance/checkout` | Check-out |
| GET | `/api/attendance/history` | Riwayat pribadi |
| POST | `/api/attendance/generate-qr` | Generate QR token (OWNER) |
| GET | `/api/admin/attendance` | Laporan pegawai (ADMIN/OWNER) |
| GET | `/api/laporan/penjualan` | Laporan penjualan (pagination/filter/meta) |
| GET | `/api/laporan/penjualan/[id]` | Detail transaksi |
| GET | `/api/laporan/penjualan/rekap` | Rekap group by hari/kasir/metode/pelanggan |
| GET | `/api/laporan/penjualan/export` | Export CSV 15 kolom |
| GET | `/api/event-promo` | CRUD event promo |
| GET | `/api/event-promo/efektif` | Cek event promo aktif hari ini |
| GET | `/api/event-promo/[id]/produk` | Produk dalam promo |

## 🗄️ RINGKASAN 23 MIGRASI SQL

| File |
|------|
| `20260529114225_fix_checkout_race_condition.sql` |
| `20260601000001_add_accounting_fields.sql` |
| `20260601000002_create_hutang_piutang.sql` |
| `20260601000003_create_avco_tracking.sql` |
| `20260601000004_create_kas_dan_laporan.sql` |
| `20260606000001_update_process_checkout.sql` |
| `20260606000002_process_checkout_piutang.sql` |
| `20260606000003_add_neraca_rpc.sql` |
| `20260706_add_stok_gudang.sql` |
| `20260707_add_rls_riwayat_avco.sql` |
| `20260708_add_produk_realtime.sql` |
| `20260710_process_barang_masuk.sql` |
| `20260710_widen_numeric_columns.sql` |
| `20260716_add_rls_hutang_piutang.sql` |
| `20260717_add_sku_dan_merk.sql` |
| `20260717_drop_produk_nama_produk_unique.sql` |
| `20260718104411_update_process_barang_masuk.sql` |
| `20260720_add_uom_conversion.sql` |
| `20260721_drop_hutang_piutang.sql` |
| `20260725_add_member_point.sql` |
| `20260726_add_poin_min_pembelian.sql` |
| `20260728_add_bulk_stock_opname.sql` |
| `20260729_add_log_aktivitas.sql` |
| `20260729_fix_produk_realtime.sql` |
| `20260803_fix_checkout_stock_validation.sql` |
| `20260805_merge_base_unit_into_satuan.sql` |
| `20260807_add_sell_units.sql` |
| `20260808_drop_produk_jual_ratio.sql` |
| `20260808_fix_process_barang_masuk_conversion_ratio.sql` |
| `20260810_barang_masuk_no_surat.sql` |
| `20260810_barang_masuk_void.sql` |
| `20260810_fix_db_cleanup_rls.sql` |
| `20260810_fix_retur_wib_rls.sql` |
| `20260810_fix_rls_stok_opname_sesi.sql` |
| `20260810_fix_sequences_after_reset.sql` |
| `20260810_guard_hitung_stok.sql` |
| `20260810_reset_transaksi_keep_master.sql` |
| `20260810_retur_pembelian.sql` |
| `20260810_sync_harga_modal_avco.sql` |
| `20260810_update_process_barang_masuk_no_surat.sql` |
| `20260812_keuangan_pengeluaran.sql` |
| `20260816_harga_jual_besar_otomatis.sql` |
| `20260816_kategori_beban_atk_konsumsi_kebersihan.sql` |
| `20260816_metode_bayar_bank_dinamis.sql` |
| `20260816_stok_minimum_gudang.sql` |
| `20260830_produk_paket_stok_manual.sql` |
| `20260831_stok_opname_sesi.sql` |
| `20260901_add_lokasi_area.sql` |
| `20260901_isi_stok_paket_ke_gudang.sql` |
| `20260902_jenis_paket_actual_weight.sql` |
| `20260903_add_isi_satuan_paket.sql` |
| `20260904_reset_data_drop_piutang.sql` |
| `20260905_add_event_promo.sql` |
| `20260905_add_event_promo_tasks3to7.sql` |
| `20260906_guard_bayar_minimum.sql` |
| `20260906_kas_admin_dan_uang_awal.sql` |
| `20260907_add_kategori_barang.sql` |
| `20260908_fix_checkout_harga_besar_fallback.sql` |
| `20260909_drop_overload_isi_stok_paket.sql` |
| `20260910_restore_member_point_functions.sql` |
| `20260911_restore_sync_harga_jual_besar.sql` |
| `20260912_generate_sku_barcode.sql` |

## 🐞 TEMUAN & CATATAN PENTING

1. **Realtime typo**: migrasi `20260708` menambahkan tabel `publik` ke `supabase_realtime`, bukan `produk` — widget low-stock realtime mungkin hanya jalan via polling/fallback. Perlu dicek & diperbaiki.
2. **Hutang & Piutang DIHAPUS**: fitur sudah dihapus (commit `60673b9` + migrasi `20260721_drop_hutang_piutang.sql`), tapi TODO3 #3 & #4 masih ditandai `[x]` — TODO kadaluarsa. Kolom `dp`/`sisa` tetap ada di `transaksi_keluar` (tanpa tabel piutang terkait).
3. **Bug redirect KARYAWAN**: `dashboard/layout.tsx` mengarahkan KARYAWAN ke `/attendance/scan` yang **tidak ada** (harusnya `/dashboard/attendance/scan`) → KARYAWAN 404 di semua halaman.
4. **Dead link `/dashboard/support`**: ada di sidebar (bottom links) tapi halaman tidak ada.
5. **AGENTS.md outdated**: 19 migrasi → sebenarnya **23**; klaim "piutang dibuat otomatis saat checkout" sudah tidak berlaku; `/api/dashboard/*` tidak ada.
6. **TODO1 tracker kadaluarsa**: tabel bilang 18/21, padahal isi badan semua 21 `[x]`.
7. **README roadmap kadaluarsa**: UoM ditandai "in progress", padahal sudah selesai (TODO4).
8. **Migrasi duplikat**: `20260710_process_barang_masuk.sql` identik dengan `20260718104411` (file kedua dibuat karena yang pertama sudah ter-apply di sebagian env).
9. **Fitur eks-TODO yang dihapus**: piutang otomatis (RPC lama), halaman `/dashboard/hutang`, `/dashboard/piutang`, `lib/hutang.ts`, `lib/piutang.ts` — TIDAK ADA lagi.
10. **API absensi**: TODO2 menyebut `POST generate-qr`, implementasi aktual juga POST (sudah sesuai); `GET /api/attendance/today` tambahan dari spec.

---

*Dibuat: 2026-07-31 · Total 120 fitur + 22 API + 23 migrasi · Diverifikasi dari 33 halaman, 60 file tsx/ts, 6 TODO, 3 dokumen produk*
