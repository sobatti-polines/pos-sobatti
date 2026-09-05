# FITUR TAMBAHAN — POS Sobatti / PLK POS

> Dokumen ini mencatat **semua fitur yang sudah ada di project tetapi TIDAK tercatat di `FITUR.md`**.
> Dibuat: 2026-09-03 · Berdasarkan analisa menyeluruh seluruh codebase (sidebar, file page, server actions, API routes, database tables, helper libs, komponen UI).
> Status: `[x]` sudah ada & berfungsi · `[!]` ada masalah/catatan

---

## A. MODUL PO CUSTOM (Purchase Order Custom) — `app/dashboard/po-custom` — 7 fitur

| # | Fitur | Deskripsi | Lokasi | ✓ |
|---|-------|-----------|--------|---|
| 1 | CRUD PO Custom | DataTable PO custom: no PO otomatis (`POC-YYYYMMDD-UUID8`), pelanggan, nama pesanan, qty, harga total, target selesai, status workflow. Search + filter status + sort. | `app/dashboard/po-custom/po-custom-client.tsx`, `app/dashboard/po-custom/actions.ts` | [x] |
| 2 | Status workflow PO | 6 status: `DRAFT` → `MENUNGGU_DP` → `DIPROSES` → `SIAP_KIRIM` → `SELESAI` / `BATAL`. Quick-status buttons di detail view. PO yang sudah difinalisasi tidak bisa diedit/dihapus. | `app/dashboard/po-custom/actions.ts` (`PoCustomStatus`) | [x] |
| 3 | Spesifikasi Custom (Atribut) | Form key-value dinamis untuk spesifikasi custom (contoh: Ukuran = 80x210cm, Warna = Putih). Disimpan sebagai JSONB `atribut_custom` di tabel `po_custom`. | `po-custom-client.tsx` (bagian form attributes) | [x] |
| 4 | Sistem Pembayaran Bertahap | Tabel `po_custom_pembayaran` dengan jenis: `DP`, `PELUNASAN`, `TAMBAHAN`. Form input tanggal bayar, jumlah, metode bayar, keterangan. Total dibayar & sisa otomatis dihitung. DP awal bisa diatur saat pembuatan PO (dalam persen). | `actions.ts` (`addPoCustomPayment`) | [x] |
| 5 | Finalisasi ke Transaksi | PO bisa difinalisasi menjadi transaksi penjualan via RPC `finalize_po_custom`. Syarat: produk inventaris dipilih, PO lunas (sisa = 0), status bukan BATAL. Setelah finalisasi masuk ke laporan penjualan, omset, dan laba rugi. | `actions.ts` (`finalizePoCustom`), RPC `finalize_po_custom` | [x] |
| 6 | Cetak PO Custom | Tombol cetak di setiap baris → buka `/dashboard/po-custom/[id]/print` di tab baru. Dokumen berisi detail PO, spesifikasi, info pelanggan, dan status. | `app/dashboard/po-custom/[id]/print/`, `print-button.tsx` | [x] |
| 7 | Searchable Combobox | Komponen dropdown dengan pencarian real-time untuk memilih pelanggan dan produk. Highlight pencarian, keyboard navigation, max 60 hasil. | `po-custom-client.tsx` (komponen `SearchableCombobox`) | [x] |

### Database PO Custom

| Tabel | Kolom Penting |
|-------|--------------|
| `po_custom` | `id`, `no_po`, `id_pelanggan`, `id_produk`, `tanggal_po`, `nama_pesanan`, `spesifikasi`, `atribut_custom` (JSONB), `qty`, `harga_total`, `target_selesai`, `status`, `catatan_internal`, `id_transaksi_keluar`, `finalized_at`, `finalized_by`, `created_by` |
| `po_custom_pembayaran` | `id`, `id_po`, `tanggal_bayar`, `jumlah_bayar`, `id_metode_bayar`, `jenis_pembayaran` (DP/PELUNASAN/TAMBAHAN), `keterangan`, `created_by` |

### API/Action PO Custom

| Fungsi | Lokasi |
|--------|--------|
| `savePoCustom()` | Create/update PO + log aktivitas |
| `addPoCustomPayment()` | Tambah pembayaran + validasi total |
| `deletePoCustom()` | Hapus PO (bisa jika belum finalisasi) |
| `finalizePoCustom()` | Finalisasi ke transaksi via RPC |

---

## B. MODUL JADWAL KARYAWAN — `app/dashboard/jadwal-karyawan` — 8 fitur

| # | Fitur | Deskripsi | Lokasi | ✓ |
|---|-------|-----------|--------|---|
| 1 | Jadwal Mingguan Grid | Grid interaktif 7 hari × N karyawan. Setiap cell: PAGI / SORE / LIBUR (klik untuk ganti siklus). Status: DRAFT / TERBIT. Navigasi minggu sebelumnya/berikutnya. | `jadwal-karyawan-client.tsx`, `page.tsx` | [x] |
| 2 | Konfigurasi Shift | Setting jam mulai/selesai untuk shift PAGI dan SORE. Kebutuhan minimum pegawai per shift (pagi & sore). | `jadwal-karyawan-client.tsx` (input jam pagi/sore, kebutuhan) | [x] |
| 3 | Auto-Suggest Shift | Tombol "Sarankan Shift" mengisi jadwal secara otomatis dengan algoritma: seimbangkan jumlah PAGI/SORE per karyawan berdasarkan riwayat 4 minggu terakhir, penuhi kebutuhan minimum per hari. | `jadwal-karyawan-client.tsx` (`handleSuggest`) | [x] |
| 4 | Catatan Seragam | Input catatan per hari (contoh: "Batik", "Seragam Biru"). Disimpan sebagai JSONB `catatan_seragam` di `jadwal_mingguan`. Bisa diupdate kapan saja termasuk setelah jadwal diterbitkan. | `jadwal-karyawan-client.tsx` (section "Catatan Seragam"), `actions.ts` (`saveUniformNotes`) | [x] |
| 5 | Publish Workflow | Simpan Draft → Terbitkan. Saat Terbit, status berubah ke `TERBIT` dan tidak bisa diedit lagi. Terbitkan terblokir jika ada permintaan libur yang masih menunggu. | `actions.ts` (`saveWeeklySchedule`) | [x] |
| 6 | Riwayat Shift (4 minggu) | Tabel `jadwal_karyawan` menyimpan riwayat shift per karyawan. Riwayat 4 minggu terakhir ditampilkan di sidebar untuk referensi pembagian shift. | `page.tsx` (`historyRows`) | [x] |
| 7 | Export PDF Jadwal | Export jadwal mingguan ke PDF landscape A4: header nama toko, info shift, tabel karyawan × 7 hari dengan warna shift, baris total P/S/L, baris seragam, footer. | `jadwal-karyawan-client.tsx` (`exportSchedulePDF`) | [x] |
| 8 | Export Excel Jadwal | Export jadwal ke file `.xlsx` (Sheet "Jadwal" + Sheet "Info"). Format kolom width otomatis, warna shift di Excel. Library: `xlsx`. | `jadwal-karyawan-client.tsx` (`exportScheduleExcel`) | [x] |

### Database Jadwal

| Tabel | Kolom Penting |
|-------|--------------|
| `shift_kerja` | `id`, `kode` (PAGI/SORE), `nama`, `jam_mulai`, `jam_selesai`, `aktif`, `urutan` |
| `jadwal_mingguan` | `id`, `minggu_mulai`, `kebutuhan_pagi`, `kebutuhan_sore`, `status` (DRAFT/TERBIT), `catatan_seragam` (JSONB) |
| `jadwal_karyawan` | `id`, `id_pengguna`, `id_jadwal_mingguan`, `tanggal`, `tipe_jadwal` (PAGI/SORE/LIBUR), `catatan` |
| `permintaan_libur` | `id`, `id_jadwal_mingguan`, `id_pengguna`, `tanggal`, `status` (MENUNGGU/DISETUJUI/DITOLAK), `created_at`, `ditinjau_pada` |

### Server Actions Jadwal

| Fungsi | Lokasi |
|--------|--------|
| `saveWeeklySchedule()` | Simpan/tulis jadwal mingguan + shift karyawan |
| `saveUniformNotes()` | Update catatan seragam |
| `saveLeaveRequest()` | Booking libur (karyawan) |
| `cancelLeaveRequest()` | Batalkan booking libur |
| `reviewLeaveRequest()` | Setujui/tolak/batalkan persetujuan libur (owner) |

---

## C. MODUL JADWAL SAYA (My Schedule) — `app/dashboard/jadwal-saya` — 4 fitur

| # | Fitur | Deskripsi | Lokasi | ✓ |
|---|-------|-----------|--------|---|
| 1 | Lihat Jadwal Mingguan | Tampilan 7 hari: tanggal, badge shift (PAGI/SORE/LIBUR), jam kerja, catatan seragam. Highlight hari ini. Period: "Minggu Ini". | `page.tsx` (Server Component) | [x] |
| 2 | Shift Hari Ini | Kartu ringkas: badge shift hari ini + jam mulai-selesai. Jika "Belum ada jadwal" → teks placeholder. | `page.tsx` (grid info) | [x] |
| 3 | Booking Libur Minggu Depan | Karyawan bisa booking 1 hari libur di minggu depan (jika draft sudah tersedia). Kapasitas per hari = `ceil(total_karyawan / 7)`. Tampil daftar request aktif (Menunggu/Disetujui) per hari. Tombol "Pilih"/"Pindahkan"/"Batalkan". | `booking-libur-client.tsx` | [x] |
| 4 | Status Booking | Badge: "Terbuka" (draft minggu depan ada + belum lewat) / "Belum tersedia". Info jika ditolak: "Permintaan [tanggal] ditolak. Pilih hari lain yang masih tersedia." | `booking-libur-client.tsx` | [x] |

---

## D. MODUL ABSENSI MANUAL — `app/dashboard/attendance/manual` — 1 fitur

| # | Fitur | Deskripsi | Lokasi | ✓ |
|---|-------|-----------|--------|---|
| 1 | Absen Manual (Owner) | Owner dapat melakukan input absensi manual untuk karyawan (tidak perlu QR scan). Berguna untuk koreksi atau kasus khusus. | `app/dashboard/attendance/manual/` | [x] |

---

## E. LAPORAN ANALISIS PRODUK — `app/dashboard/laporan/analisis-produk` — 4 fitur

| # | Fitur | Deskripsi | Lokasi | ✓ |
|---|-------|-----------|--------|---|
| 1 | Tabel Analisis Produk | DataTable: nama produk, SKU, qty terjual (per satuan), frekuensi transaksi, omzet item, pendapatan neto. Search + sort. | `analisis-produk-client.tsx` | [x] |
| 2 | Quick Date Range | Preset tombol: Hari Ini / 7 hari / 30 hari / Bulan Ini. Input date manual juga tersedia. | `analisis-produk-client.tsx` | [x] |
| 3 | Detail Riwayat Penjualan | Klik ikon mata → modal dialog: qty per satuan, omset, neto. Tabel riwayat transaksi per periode (no transaksi, waktu, qty, omzet, neto). | `analisis-produk-client.tsx` (DetailPanel) | [x] |
| 4 | Export Analisis | Export dropdown: CSV & PDF dengan kolom Produk, SKU, Qty Terjual, Frekuensi, Omzet, Neto. | `analisis-produk-client.tsx`, `components/export-dropdown.tsx` | [x] |

### Server Actions Analisis

| Fungsi | Lokasi |
|--------|--------|
| `fetchAnalisisProduk()` | Aggregate penjualan per produk dalam rentang tanggal |
| `fetchRiwayatPenjualanProduk()` | Detail transaksi per produk dalam rentang tanggal |

---

## F. LAPORAN PERGERAKAN HARGA — `app/dashboard/laporan/pergerakan-harga` — 3 fitur

| # | Fitur | Deskripsi | Lokasi | ✓ |
|---|-------|-----------|--------|---|
| 1 | Riwayat Perubahan Harga | Tabel periode harga: effective_from → effective_to, arah perubahan (Naik/Turun/Campuran/Tetap/Harga Awal), harga saat itu (Retail/Grosir/Promo/Besar), qty terjual, omzet. | `pergerakan-harga-client.tsx` | [x] |
| 2 | Ringkasan Statistik | 3 kartu: total kali harga berubah, total qty terjual, total omzet. | `pergerakan-harga-client.tsx` (summary cards) | [x] |
| 3 | Pencarian Produk | Searchable dropdown: ketik nama/SKU/barcode, max 20 hasil, highlight, checkmark jika terpilih. Filter tanggal dari/sampai. | `pergerakan-harga-client.tsx` | [x] |

### Database Riwayat Harga

| Tabel | Kolom Penting |
|-------|--------------|
| `riwayat_harga_produk` | `id` (UUID), `id_produk`, `effective_from` (timestamptz), `source` (manual/trigger/etc), `harga_jual_satuan`, `harga_jual_grosir`, `harga_jual_promo`, `harga_jual_besar_satuan`, `harga_jual_besar_grosir`, `harga_jual_besar_promo`, `jual_satuan`, `conversion_ratio` |

### Fungsi Terkait

| Fungsi | Lokasi |
|--------|--------|
| `snapshot_harga_produk()` | RPC/function: snapshot harga produk saat ada perubahan (trigger di DB) |

---

## G. BUKA KASIR (Halaman Terpisah) — `app/dashboard/buka-kasir` — 3 fitur

| # | Fitur | Deskripsi | Lokasi | ✓ |
|---|-------|-----------|--------|---|
| 1 | Buka Sesi Kasir | Halaman terpisah dari Tutup Kasir. Form input uang awal (float) → `bukaSesiKasir()`. Hanya untuk role KASIR. | `buka-kasir-client.tsx` | [x] |
| 2 | Status Sesi | Indikator: "Kasir Sudah Dibuka" (check icon) / form buka sesi (belum dibuka). Badge "Sesi sudah ditutup" jika sudah tutup kasir. | `buka-kasir-client.tsx` | [x] |
| 3 | Shift Date Picker | Date picker untuk memilih tanggal shift. Auto-refresh summary saat tanggal berubah. | `buka-kasir-client.tsx` | [x] |

---

## H. HALAMAN BANTUAN / SUPPORT — `app/dashboard/support` — 1 fitur

| # | Fitur | Deskripsi | Lokasi | ✓ |
|---|-------|-----------|--------|---|
| 1 | FAQ & Kontak | Halaman bantuan dengan 6 FAQ (transaksi, stok, display/gudang, tutup kasir, absensi QR, barcode). Info kontak toko dari pengaturan. Saran & masukan section. | `app/dashboard/support/page.tsx` | [x] |

---

## I. WIDGET & KOMPONEN DASHBOARD BARU — 4 fitur

| # | Fitur | Deskripsi | Lokasi | ✓ |
|---|-------|-----------|--------|---|
| 1 | Widget Ringkasan Keuangan Bulanan | 2 kartu: Laba (Rugi) Bersih (hijau) + Beban Operasional (merah). Link ke laporan laba rugi & pengeluaran. | `components/dashboard-finance-summary.tsx` | [x] |
| 2 | User Profile Card | Avatar initials + online indicator (hijau) + nama + badge role. Digunakan di sidebar. | `components/user-profile-card.tsx` | [x] |
| 3 | Export Dropdown | Komponen reusable: tombol dropdown dengan opsi Export CSV & Export PDF. | `components/export-dropdown.tsx` | [x] |
| 4 | Highlight Text | Komponen client-side: highlight kata kunci pencarian dalam teks. Background primary/15, rounded. Digunakan di combobox PO Custom. | `components/highlight.tsx` | [x] |

---

## J. KOMPONEN POS TAMBAHAN — 3 fitur

| # | Fitur | Deskripsi | Lokasi | ✓ |
|---|-------|-----------|--------|---|
| 1 | Jam Real-time (Clock) | Komponen client: jam digital real-time (WIB) di header POS. Update setiap 1 detik. | `app/pos/clock.tsx` | [x] |
| 2 | Auto-Print | Komponen client: otomatis trigger `window.print()` setelah 500ms delay. Digunakan di halaman struk/invoice. | `app/pos/auto-print.tsx` | [x] |
| 3 | Loading Skeleton | `app/pos/loading.tsx` dan `app/dashboard/loading.tsx` untuk loading state halaman. | `app/pos/loading.tsx`, `app/dashboard/loading.tsx` | [x] |

---

## K. HELPER LIBS BARU — 4 fitur

| # | Fitur | Deskripsi | Lokasi | ✓ |
|---|-------|-----------|--------|---|
| 1 | Store Settings Helper | `getStoreSettings(supabase)` — ambil info toko (nama, alamat, telepon, email) dari `pengaturan` (id=1). Return type `StoreSettings`. Digunakan di laporan & print. | `lib/store-settings.ts` | [x] |
| 2 | Produk Paket Helper | `attachMasterInfo()` — lampirkan info master ke daftar produk paket. `masterTotalStock()` — total stok master (display + gudang). `maxPaketFromMaster()` — maksimal paket yang bisa dibuat. | `lib/produk-paket.ts` | [x] |
| 3 | Attendance Display Helper | `normalizeAttendanceStatus()` — normalisasi status (ON TIME → HADIR, ALPHA → TIDAK_HADIR). `attendanceStatusLabel()`, `attendanceStatusBadgeClass()`, `formatAttendanceTime()`, `attendanceDescription()`. | `lib/attendance-display.ts` | [x] |
| 4 | Supabase fetchAllRows | Helper untuk fetch semua data dari Supabase dengan pagination otomatis (mengatasi limit 1000 baris default). Digunakan di PO Custom & Jadwal Karyawan. | `lib/supabase/fetch-all.ts` | [x] |

---

## L. FITUR TAMBAHAN PADA MODUL YANG SUDAH ADA — 6 fitur

| # | Fitur | Deskripsi | Lokasi | ✓ |
|---|-------|-----------|--------|---|
| 1 | Reorder / Ulangi Pembelian | Tombol "Repeat" di Riwayat Barang Masuk (baris AKTIF) → redirect ke form barang masuk dengan prefill: supplier, tanggal, semua item aktif dari penerimaan sebelumnya. Banner "Ulangi Pembelian" dengan tombol "Buat Baru". | `app/dashboard/inventory/stock-in/history/`, `stock-in-client.tsx` (prefill), `page.tsx` (searchParams reorder) | [x] |
| 2 | Barcode Scanner di Barang Masuk | Input barcode + "Scan via HP" button di form barang masuk. Mendukung: (1) input manual/keyboard barcode, (2) scan via HP (QR → SSE relay). Barcode dikenal → produk masuk otomatis ke baris baru. | `stock-in-client.tsx` (scan barcode section) | [x] |
| 3 | Waktu Input di Riwayat | Kolom "Waktu Input" (`created_at`) di Riwayat Barang Masuk. Format `dd/mm/yyyy HH:mm`, sortable, default urut terbaru di atas. Tersembunyi di mobile. | `app/dashboard/inventory/stock-in/history/` | [x] |
| 4 | Cetak Dokumen dari Banner Sukses | Setelah simpan barang masuk, banner hijau menampilkan tombol "Cetak Dokumen" → langsung buka surat jalan untuk id yang baru disimpan. | `stock-in-client.tsx` (success banner) | [x] |
| 5 | Search di Laporan Kasir | Fitur search dan filter di tabel Riwayat Kas Harian. | `app/dashboard/laporan-kasir/` | [x] |
| 6 | Laporan Stok Opname | Halaman laporan khusus stok opname di sidebar (berbeda dari Riwayat Opname). | `app/dashboard/laporan/stok-opname/`, `app/dashboard/laporan/stok-opname/actions.ts` | [x] |

---

## M. DATABASE & MIGRASI TAMBAHAN — 7 item

> Migrasi-migrasi ini ada di project tetapi **tidak tercatat di bagian "RINGKASAN MIGRASI" di `FITUR.md`**.

| # | Migrasi | Deskripsi |
|---|---------|-----------|
| 1 | `20260914_add_riwayat_harga_produk.sql` | Tabel `riwayat_harga_produk` + fungsi `snapshot_harga_produk()` + trigger snapshot otomatis saat harga produk berubah |
| 2 | `20260915_add_po_custom.sql` | Tabel `po_custom` + `po_custom_pembayaran` |
| 3 | `20260916_finalize_po_custom_transaction.sql` | RPC `finalize_po_custom()` — finalisasi PO ke transaksi |
| 4 | `20260917_jadwal_karyawan.sql` | Tabel `shift_kerja`, `jadwal_mingguan`, `jadwal_karyawan` |
| 5 | `20260918_harga_satuan_besar_manual.sql` | Trigger snapshot harga manual + perbaikan harga besar |
| 6 | `20260919_booking_libur_mingguan.sql` | Tabel `permintaan_libur` |
| 7 | `20260920_absen_manual.sql` | Fungsi absensi manual untuk owner |

---

## N. API ENDPOINTS TAMBAHAN — 8 endpoint

> Endpoint-endpoint ini ada di project tetapi **tidak tercatat di bagian "DAFTAR API ENDPOINT" di `FITUR.md`**.

| Method | Endpoint | Fungsi |
|--------|----------|--------|
| POST | `/api/event-promo` | Buat event promo baru |
| PUT | `/api/event-promo/[id]` | Update event promo |
| DELETE | `/api/event-promo/[id]` | Hapus event promo |
| POST | `/api/event-promo/[id]/produk` | Tambah produk ke event promo |
| DELETE | `/api/event-promo/[id]/produk/[id_produk]` | Hapus produk dari event promo |
| GET | `/api/inventory/barcode` | Generate barcode SVG (CODE128) untuk produk |
| POST | `/api/env` | Ambil env variables (network config) |
| GET | `/api/pos/customers` | Daftar pelanggan POS (termasuk poin) |

---

## O. RPC FUNCTIONS TAMBAHAN — 3 function

| # | Function | Deskripsi |
|---|----------|-----------|
| 1 | `finalize_po_custom(p_id_po, p_id_pengguna, p_id_metode_bayar)` | Finalisasi PO Custom menjadi transaksi `transaksi_keluar` + `detail_transaksi_keluar`. Kurangi stok produk, catat AVCO, hitung HPP. Advisory lock. |
| 2 | `snapshot_harga_produk(p_produk)` | Simpan snapshot semua kolom harga produk ke `riwayat_harga_produk`. Dipanggil oleh trigger saat harga berubah. |
| 3 | `save_leave_request(...)` | Catat permintaan libur karyawan (via server action, bukan RPC) |

---

## P. PERUBAHAN SIDEBAR YANG BELUM DICATAT — 2 item

| # | Item | Deskripsi | Lokasi |
|---|------|-----------|--------|
| 1 | Menu "PO Custom" | Tampil di sidebar untuk role ADMIN/OWNER. Ikon ClipboardList. | `components/dashboard-sidebar.tsx` |
| 2 | Menu "Jadwal Saya" | Tampil di sidebar untuk role KASIR/KARYAWAN/ADMIN (isStaff). Ikon CalendarDays. | `components/dashboard-sidebar.tsx` |
| 3 | Menu "Jadwal Karyawan" | Tampil di sidebar untuk role OWNER. Ikon CalendarDays. | `components/dashboard-sidebar.tsx` |
| 4 | Menu "Absen Manual" | Tampil di sidebar untuk role OWNER. Ikon ClipboardCheck. | `components/dashboard-sidebar.tsx` |
| 5 | Menu "Analisis Produk" | Tampil di sub-menu Laporan untuk role ADMIN/OWNER. | `components/dashboard-sidebar.tsx` |
| 6 | Menu "Pergerakan Harga" | Tampil di sub-menu Laporan untuk role OWNER. | `components/dashboard-sidebar.tsx` |
| 7 | Menu "Buka Kasir" | Tampil di sidebar untuk role KASIR (terpisah dari Tutup Kasir). Ikon Wallet. | `components/dashboard-sidebar.tsx` |
| 8 | User Profile Card di Sidebar | Avatar + nama + role ditampilkan di atas tombol logout. | `components/dashboard-sidebar.tsx` |
| 9 | Badge Low Stock di Sidebar | Jumlah produk menipis ditampilkan di menu Inventaris. | `components/dashboard-sidebar.tsx` |

---

## Q. FITUR UI/UX TAMBAHAN — 3 fitur

| # | Fitur | Deskripsi | Lokasi | ✓ |
|---|-------|-----------|--------|---|
| 1 | Mobile Nav dengan Semua Menu | Slide-over mobile nav mencakup semua menu termasuk PO Custom, Jadwal, dan link bottom (Pengaturan, Keuangan, Bantuan). | `components/dashboard-mobile-nav.tsx` | [x] |
| 2 | Laporan Ringkasan dengan Preset | Preset cepat: Hari Ini, 7 Hari, 30 Hari, Bulan Ini — langsung filter data tanpa input tanggal manual. | `app/dashboard/reports/reports-client.tsx` | [x] |
| 3 | Expandable Row di DataTable | DataTable mendukung expanded row untuk detail tambahan tanpa modal terpisah. | `components/data-table.tsx` | [x] |

---

## R. RINGKASAN PERBEDAAN ANGKA

| Area | FITUR.md | Aktual (Termasuk Tambahan) | Selisih |
|------|----------|---------------------------|---------|
| Total Fitur | 120 | **~155** | +35 |
| API Endpoints | 25 | **33** | +8 |
| Migrasi SQL | 23 | **~30** | +7 |
| Tabel Database | ~25 | **~33** | +8 |
| Server Actions | ~20 | **~28** | +8 |
| Helper Libs | 15 file | **19 file** | +4 |
| Komponen UI | 18 file | **24 file** | +6 |

---

## CATATAN TAMBAHAN

1. **`fiturnew.md` adalah duplikat `FITUR.md`** — file ini berisi konten yang identik dengan `FITUR.md` (kemungkinan backup atau versi lama).

2. **Modul PO Custom adalah modul terbesar yang tidak tercatat** — mencakup 7 fitur, 2 tabel database, 1 RPC, 4 server actions, dan 1 halaman print.

3. **Modul Jadwal Karyawan juga sangat signifikan** — mencakup 8 fitur, 4 tabel database, 5 server actions, dan 2 format export (PDF + Excel).

4. **Buka Kasir dipisah dari Tutup Kasir** — di `FITUR.md` hanya "Tutup Kasir" yang dicatat (#85), padahal ada halaman terpisah "Buka Kasir" untuk role KASIR.

5. **Laporan Analisis Produk dan Pergerakan Harga** adalah 2 halaman laporan baru yang tidak ada di `FITUR.md`.

6. **Riwayat Harga Produk** (`riwayat_harga_produk`) adalah tabel dan fitur database penting untuk audit trail perubahan harga — tidak tercatat di FITUR.md sama sekali.

---

*Dibuat: 2026-09-03 · Total 35+ fitur tambahan + 8 API + 7 migrasi + 8 tabel database · Diverifikasi dari seluruh codebase project*
