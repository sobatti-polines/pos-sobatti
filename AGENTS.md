# POS Sobatti — Panduan Agent AI

Selamat datang di proyek **POS Sobatti**. Dokumen ini berisi aturan esensial, konteks arsitektur, dan panduan untuk AI agent yang bekerja di codebase ini. **Baca seluruh dokumen sebelum membuat perubahan apapun.**

---

## ⚠️ ATURAN KRITIS

1. **Next.js 16**: Project ini menggunakan Next.js 16 (App Router) + React 19 + TypeScript 5. API, konvensi, dan struktur file bisa berbeda dari versi sebelumnya. Baca panduan di `node_modules/next/dist/docs/` sebelum menulis kode. Perhatikan deprecation notices.
2. **DILARANG menggunakan browser untuk testing**. Gunakan automated testing atau serahkan visual/manual testing ke user.
3. **Bahasa**: Semua UI copy, error messages, dan form labels **WAJIB Bahasa Indonesia**.
4. **Hati-hati dengan SERVICE_ROLE**: Jangan pernah mengekspos `SERVICE_ROLE` key. Hanya digunakan di `lib/supabase/admin.ts`.
5. **Jangan commit tanpa diminta**. Stage hanya file yang dimaksud.

---

## 🏗️ ARSITEKTUR & TECH STACK

| Layer | Teknologi |
|-------|-----------|
| **Framework** | Next.js 16 (App Router) + React 19 |
| **Bahasa** | TypeScript 5 (strict mode) |
| **Styling** | Tailwind CSS v4 + shadcn/ui (Radix UI Nova) + class-variance-authority |
| **Database** | Supabase (PostgreSQL) + Row Level Security (RLS) |
| **Auth** | Supabase Auth (email/password via SSR cookies) |
| **State Management** | Zustand v5 (POS state) + React hooks (server state) |
| **Forms & Validation** | React Hook Form + Zod v4 |
| **Table/Data Grid** | @tanstack/react-table v8 (via `DataTable` component) |
| **Scanner** | @zxing/browser + @zxing/library (barcode/QR) |
| **PDF** | jspdf + jspdf-autotable |
| **CSV** | papaparse |
| **Barcode Label** | jsbarcode |
| **QR Code Generate** | qrcode |
| **Icons** | lucide-react |
| **Date** | date-fns v4 |
| **PWA** | @ducanh2912/next-pwa |
| **Linting** | ESLint 9 (flat config) + eslint-config-next |

---

## 📁 STRUKTUR FILE LENGKAP

```
app/                          # Next.js App Router pages & API routes
├── page.tsx                  # Halaman login
├── layout.tsx                # Root layout (metadata, fonts, globals)
├── not-found.tsx             # Halaman 404
├── manifest.ts               # PWA manifest
├── globals.css               # Tailwind CSS v4 + design tokens
│
├── api/                      # API route handlers (Next.js Route Handlers)
│   ├── auth/login/route.ts
│   ├── pos/
│   │   ├── checkout/route.ts
│   │   ├── customer-search/route.ts
│   │   └── products/route.ts
│   ├── dashboard/
│   │   ├── transactions/
│   │   │   ├── route.ts
│   │   │   └── [id]/
│   │   │       └── route.ts
│   │   └── stats/route.ts
│   ├── attendance/
│   │   ├── today/route.ts
│   │   ├── check-in/route.ts
│   │   ├── check-out/route.ts
│   │   ├── qr-scan/route.ts
│   │   └── generate-qr/route.ts
│   ├── inventory/
│   │   ├── products/route.ts
│   │   ├── categories/route.ts
│   │   ├── units/route.ts
│   │   ├── suppliers/route.ts
│   │   ├── stock-in/route.ts
│   │   ├── stock-opname/route.ts
│   │   └── barcode/route.ts
│   ├── customers/route.ts
│   ├── low-stock/route.ts
│   ├── scanner/relay/route.ts
│   ├── settings/route.ts
│   ├── users/route.ts
│   └── laporan/
│       ├── penjualan/
│       │   ├── route.ts
│       │   └── [id]/route.ts
│       ├── laba-rugi/route.ts
│       └── neraca/route.ts
│
├── pos/                      # Modul POS (Point of Sale)
│   ├── page.tsx              # Halaman utama POS (kasir)
│   ├── loading.tsx
│   └── invoice/
│       └── [id]/
│           └── page.tsx      # Halaman invoice/struk (thermal 58mm & faktur)
│
├── dashboard/                # Modul Dashboard & Manajemen
│   ├── page.tsx              # Ringkasan dashboard (revenue, chart, stok menipis)
│   ├── layout.tsx            # Dashboard layout (sidebar + mobile nav)
│   ├── loading.tsx
│   ├── transactions/
│   │   ├── page.tsx          # Riwayat transaksi
│   │   └── [id]/
│   │       └── page.tsx      # Detail transaksi
│   ├── customers/
│   │   └── page.tsx          # Manajemen pelanggan
│   ├── suppliers/
│   │   └── page.tsx          # Manajemen supplier
│   ├── inventory/
│   │   ├── page.tsx          # Daftar produk (inventaris)
│   │   ├── stock-in/
│   │   │   ├── page.tsx      # Form barang masuk
│   │   │   └── history/
│   │   │       └── page.tsx  # Riwayat barang masuk
│   │   └── stock-opname/
│   │       ├── page.tsx      # Form stok opname
│   │       └── history/
│   │           └── page.tsx  # Riwayat stok opname
│   ├── reports/
│   │   └── page.tsx          # Laporan penjualan
│   ├── laporan/
│   │   ├── laba-rugi/
│   │   │   └── page.tsx      # Laporan Laba Rugi
│   │   └── neraca/
│   │       └── page.tsx      # Laporan Neraca
│   ├── tutup-kasir/
│   │   └── page.tsx          # Tutup Kasir harian
│   ├── laporan-kasir/
│   │   └── page.tsx          # Riwayat kas harian
│   ├── attendance/
│   │   ├── history/
│   │   │   └── page.tsx      # Riwayat absensi pribadi
│   │   ├── generate-qr/
│   │   │   └── page.tsx      # Generate QR code absensi (auto-refresh 30s)
│   │   └── report/
│   │       └── page.tsx      # Laporan absensi pegawai (admin/owner)
│   └── settings/
│       ├── page.tsx          # Pengaturan toko
│       ├── users/
│       │   └── page.tsx      # Manajemen pengguna
│       ├── reference-data/
│       │   └── page.tsx      # Data referensi (kategori, satuan, metode bayar)
│       └── keuangan/
│           └── page.tsx      # Pengaturan keuangan (modal awal, dll)
│
├── attendance/                # Modul Absensi
│   └── scan/
│       └── page.tsx          # Scan QR absensi (kamera HP)
│
└── scanner/                   # Modul Scanner Barcode
    └── [sessionId]/
        └── page.tsx          # Halaman scanner barcode via SSE relay

components/
├── ui/                        # shadcn/ui primitives (JANGAN diubah tanpa perlu)
│   ├── badge.tsx
│   ├── button.tsx             # Pill-shaped (rounded-full) default
│   ├── card.tsx
│   ├── dialog.tsx
│   ├── input.tsx
│   ├── label.tsx
│   ├── select.tsx
│   ├── sheet.tsx
│   ├── table.tsx
│   └── tabs.tsx
│
├── data-table.tsx             # DataTable reusable (search, sort, filter, pagination, edit row, mobile cards, export)
├── login-form.tsx             # Form login
├── logout-button.tsx          # Tombol logout
├── dashboard-sidebar.tsx      # Sidebar navigasi dashboard (desktop)
├── dashboard-mobile-nav.tsx   # Navigasi mobile (slide-over menu)
├── dashboard-low-stock.tsx    # Widget stok menipis
├── low-stock-banner.tsx       # Banner stok menipis
├── attendance-widget.tsx      # Widget absensi di dashboard
└── product-detail-sheet.tsx   # Sheet detail produk

lib/
├── utils.ts                   # cn() utility (clsx + tailwind-merge)
├── terbilang.ts               # terbilang() + terbilangRupiah() — angka ke kata Indonesia
├── export-utils.ts            # exportToCSV() + exportToPDF()
├── scanner-relay.ts           # In-memory SSE relay untuk barcode scanner (5 menit timeout)
├── attendance.ts              # getTodayAttendance() + getMonthlyAttendanceStats()
├── dashboard.ts               # getDashboardData() — ringkasan dashboard
├── low-stock.ts               # getLowStockItems() — produk dengan stok <= minimum
├── avco.ts                    # calculateNewAVCO() + recordAVCOMutation() — Average Cost
├── laporan-kasir.ts           # getDailyCashSummary() + confirmTutupKasir()
├── laporan-keuangan.ts        # generateLabaRugi() + generateNeraca()
│
└── supabase/
    ├── client.ts              # createClient() — browser client (NEXT_PUBLIC keys)
    ├── server.ts              # createClient() — server component client (cookie-based SSR)
    └── admin.ts               # supabaseAdmin + createAdminClient() — service_role (SERVICE_ROLE env)

stores/
└── pos-store.ts               # Zustand store untuk POS (lihat detail di bawah)

hooks/
├── use-table.ts               # useTable() — sorting, pagination, client-side
└── use-low-stock-realtime.ts  # useLowStockRealtime() — polling + realtime subscription

types/
└── barcode-detector.d.ts      # Ambient type untuk BarcodeDetector Web API

supabase/
└── migrations/                # 19 file migrasi SQL (lihat detail di bawah)

public/
├── icon-192x192.png
├── icon-512x512.png
├── file.svg, globe.svg, next.svg, vercel.svg, window.svg
```

---

## 🗄️ DATABASE SCHEMA LENGKAP

### Tables (20 tabel + fungsi RPC)

| Tabel | Key Columns | Keterangan |
|-------|------------|------------|
| **kategori** | `id SERIAL PK`, `nama VARCHAR UNIQUE` | Kategori produk |
| **satuan** | `id SERIAL PK`, `nama VARCHAR UNIQUE` | Satuan produk |
| **merk** | `id SERIAL PK`, `nama VARCHAR UNIQUE`, `kode VARCHAR(4) UNIQUE` | Merek/brand produk |
| **metode_bayar** | `id SERIAL PK`, `nama VARCHAR UNIQUE` | Metode pembayaran |
| **pengguna** | `id SERIAL PK`, `username VARCHAR UNIQUE`, `password VARCHAR`, `level VARCHAR` (ADMIN/KASIR/OWNER/KARYAWAN), `aktif BOOL`, `nama TEXT` | Pengguna sistem |
| **supplier** | `id SERIAL PK`, `nama_supplier VARCHAR`, `alamat TEXT`, `telepon VARCHAR`, `email VARCHAR`, `keterangan TEXT` | Pemasok barang |
| **pelanggan** | `id SERIAL PK`, `nama_pelanggan VARCHAR`, `alamat TEXT`, `no_hp VARCHAR`, `email VARCHAR`, `keterangan TEXT` | Pelanggan |
| **produk** | `id SERIAL PK`, `nama_produk VARCHAR`, `sku VARCHAR UNIQUE`, `id_merk INT FK(merk)`, `id_kategori INT FK(kategori)`, `id_satuan INT FK(satuan)`, `hitung_stok BOOL`, `harga_modal NUMERIC`, `harga_jual_satuan NUMERIC`, `harga_jual_grosir NUMERIC`, `harga_jual_promo NUMERIC`, `diskon NUMERIC`, `stok NUMERIC`, `stok_gudang NUMERIC`, `stok_minimum INT DEFAULT 5`, `barcode TEXT UNIQUE`, `harga_pokok_avco NUMERIC`, `nilai_persediaan NUMERIC`, `base_unit VARCHAR DEFAULT 'pcs'`, `default_purchase_unit VARCHAR`, `conversion_ratio NUMERIC DEFAULT 1` | Produk (dual stok: display+gudang) |
| **transaksi_keluar** | `id SERIAL PK`, `no_transaksi BIGINT UNIQUE`, `tgl_transaksi TIMESTAMP`, `id_kasir INT FK(pengguna)`, `id_pelanggan INT FK(pelanggan)`, `id_metode_bayar INT FK(metode_bayar)`, `subtotal`, `diskon_persen`, `diskon_nominal`, `pajak_persen`, `pajak_nominal`, `total`, `bayar`, `kembali`, `dp`, `sisa`, `total_hpp`, `laba_kotor` | Transaksi penjualan |
| **detail_transaksi_keluar** | `id SERIAL PK`, `id_transaksi INT FK`, `id_produk INT FK`, `type_harga_jual VARCHAR` (SATUAN/GROSIR/PROMO), `harga_modal`, `harga_jual`, `diskon_item`, `qty`, `jumlah`, `kas_masuk`, `profit`, `harga_pokok_satuan`, `total_harga_pokok` | Item detail transaksi |
| **barang_masuk** | `id SERIAL PK`, `tgl_masuk DATE`, `id_supplier INT FK`, `id_produk INT FK`, `harga_beli NUMERIC`, `jumlah NUMERIC`, `total NUMERIC`, `keterangan TEXT`, `supplied_unit VARCHAR`, `supplied_qty NUMERIC`, `applied_conversion_ratio NUMERIC`, `base_qty_added NUMERIC`, `total_cost NUMERIC`, `base_cost_per_piece NUMERIC` | Barang masuk (pembelian stok) |
| **stok_opname** | `id SERIAL PK`, `tgl_opname DATE`, `id_produk INT FK`, `stok_sistem NUMERIC`, `stok_fisik NUMERIC`, `selisih NUMERIC`, `keterangan TEXT` | Stok opname |
| **absensi** | `id BIGSERIAL PK`, `id_pengguna INT FK`, `tanggal DATE`, `jam_masuk TIMESTAMP`, `jam_pulang TIMESTAMP`, `status VARCHAR` (HADIR/TELAT), `telat_menit INT`, `latitude NUMERIC`, `longitude NUMERIC`, `foto_masuk TEXT`, `foto_pulang TEXT`, `device_info TEXT` | Absensi karyawan |
| **qr_session** | `id BIGSERIAL PK`, `token TEXT UNIQUE`, `expired_at TIMESTAMPTZ`, `is_active BOOL`, `created_by INT FK(pengguna)`, `created_at TIMESTAMP` | Sesi QR absensi (30 detik) |
| **pengaturan** | `id SERIAL PK`, `nama_toko VARCHAR`, `alamat TEXT`, `telepon VARCHAR`, `email VARCHAR`, `nama_kasir_aktif VARCHAR`, `metode_diskon VARCHAR`, `bank1_nama`, `bank1_rekening`, `bank1_atas_nama`, `bank2_...`, `footer_struk_1/2/3 TEXT`, `footer_invoice_1/2/3 TEXT`, `pajak_persen NUMERIC`, `jenis_nota TEXT`, `metode_cetak TEXT`, `logo_nota BOOL`, `hormat_kami_nama TEXT` | Pengaturan toko |
| **riwayat_avco** | `id UUID PK`, `id_produk INT FK`, `tanggal TIMESTAMPTZ`, `jenis_mutasi TEXT` (pembelian/penjualan/koreksi), `id_referensi INT`, `qty_masuk`, `qty_keluar`, `harga_satuan_transaksi NUMERIC`, `stok_sebelum`, `avco_sebelum`, `stok_sesudah`, `avco_sesudah`, `nilai_persediaan_sesudah` | Riwayat AVCO (Average Cost) |
| **saldo_kas_harian** | `id UUID PK`, `tanggal DATE UNIQUE`, `saldo_awal`, `total_masuk`, `total_keluar`, `saldo_akhir GENERATED`, `uang_aktual`, `selisih`, `dikonfirmasi BOOL`, `id_pengguna INT FK` | Saldo kas harian (tutup kasir) |
| **pengaturan_keuangan** | `id UUID PK`, `modal_awal NUMERIC`, `tanggal_mulai DATE`, `nama_pemilik TEXT`, `npwp TEXT` | Pengaturan keuangan |
| **hutang_dagang** | `id UUID PK`, `id_barang_masuk INT FK`, `id_supplier INT FK`, `tanggal_hutang DATE`, `tanggal_jatuh_tempo DATE`, `jumlah_awal`, `jumlah_terbayar`, `sisa_hutang GENERATED`, `status TEXT` (belum_lunas/lunas) | Hutang dagang (ada tapi fitur dihapus) |
| **pembayaran_hutang** | `id UUID PK`, `id_hutang UUID FK`, `tanggal_bayar DATE`, `jumlah_bayar`, `metode_bayar TEXT`, `id_pengguna INT FK` | Pembayaran hutang |
| **piutang_dagang** | `id UUID PK`, `id_transaksi_keluar INT FK`, `id_pelanggan INT FK`, `tanggal_piutang DATE`, `tanggal_jatuh_tempo DATE`, `jumlah_awal`, `jumlah_terbayar`, `sisa_piutang GENERATED`, `status TEXT` (belum_lunas/lunas/lewat_jatuh_tempo/macet) | Piutang dagang |
| **pembayaran_piutang** | `id UUID PK`, `id_piutang UUID FK`, `tanggal_bayar DATE`, `jumlah_bayar`, `metode_bayar TEXT`, `id_pengguna INT FK` | Pembayaran piutang |

### RPC Functions (PostgreSQL)

| Function | Parameter | Keterangan |
|----------|-----------|------------|
| **process_checkout** | `p_items JSONB, p_id_kasir INT, p_id_pelanggan INT?, p_id_metode_bayar INT?, p_diskon_persen NUMERIC, p_bayar NUMERIC, p_pajak_persen NUMERIC, p_is_dp BOOL` | Proses checkout: generate no_transaksi (YYYYMM + 4 digit seq), hitung subtotal/diskon/pajak/total, insert header + detail, kurangi stok (display stok), catat AVCO history, buat piutang jika sisa > 0. **Gunakan `pg_advisory_xact_lock(987654321)`** untuk serialisasi race condition. |
| **process_barang_masuk** | `p_items JSONB` | Proses barang masuk: dual-format (UoM + legacy). Insert barang_masuk, update stok_gudang, hitung ulang harga_pokok_avco & nilai_persediaan. Gunakan `pg_advisory_xact_lock(987654322)`. |
| **get_inventory_value_at_date** | `p_date DATE` | Ambil nilai persediaan (nilai_persediaan_sesudah) per produk dari riwayat_avco terakhir sebelum/saat tanggal. |

### Format Nomor Transaksi
- Format: `YYYYMM` + `NNNN` (4 digit sequential per bulan)
- Contoh: `2026070001`, `2026070002`
- Prefix di-generate dalam timezone `Asia/Jakarta` (WIB)
- Race condition dicegah dengan `pg_advisory_xact_lock(987654321)`
- Sequential per bulan, bukan global (reset setiap bulan)

---

## 💼 BUSINESS LOGIC & DOMAIN RULES

### Domain & Konteks
- **Tujuan**: POS untuk toko retail bahan bangunan & material (toko bangunan). Menggantikan sistem Excel VBA lama.
- **Target**: Sobatti Store — toko material bangunan.

### Pricing & Diskon
- **3 Tier Harga**: `Satuan` (retail), `Grosir` (wholesale), `Promo` (promotional)
- **Tipe Harga di DB**: `SATUAN`, `GROSIR`, `PROMO` (disimpan UPPERCASE di `detail_transaksi_keluar.type_harga_jual`)
- **Diskon Item**: Per-produk, dikurangkan dari harga jual sebelum dikali qty
- **Diskon Global**: Persentase dari subtotal
- **Pajak**: Persentase dari (subtotal - diskon), diambil dari `pengaturan.pajak_persen`

### Stok (Dual Warehouse System)
- **`stok`**: Stok display (tersedia di rak toko)
- **`stok_gudang`**: Stok gudang/warehouse
- **Total Stok** = `stok` + `stok_gudang`
- **Penjualan**: Kurangi `stok` (display). Jika stok display tidak cukup, kurangi sisa dari `stok_gudang` (logika di klien).
- **Barang Masuk**: Tambah ke `stok_gudang` (bukan display)
- **Produk** dengan `hitung_stok = false` tidak akan dikurangi stoknya saat checkout

### AVCO (Average Cost / Harga Pokok)
- Method: **Weighted Average Cost (AVCO)** — harga pokok rata-rata tertimbang
- Dihitung otomatis saat:
  - **Barang Masuk** (pembelian): `harga_pokok_avco` baru = (total nilai lama + total nilai masuk) / (total qty lama + qty masuk)
  - **Penjualan**: Catat AVCO saat ini sebagai HPP, update nilai_persediaan
- Tabel `riwayat_avco` mencatat setiap mutasi dengan stok sebelum/sesudah dan avco sebelum/sesudah
- **HPP per transaksi** = `harga_pokok_avco` × qty terjual
- **Profit** = (harga_jual - diskon_item - harga_pokok_avco) × qty
- Fungsi di `lib/avco.ts`: `calculateNewAVCO()` untuk kalkulasi, `recordAVCOMutation()` untuk pencatatan + update produk
- **Migration ke-9** (20260606000001) menambahkan kolom HPP ke transaksi; **migration ke-10** (20260606000002) menambahkan AVCO + update process_checkout

### Hutang & Piutang
- **Catatan**: Fitur Hutang & Piutang telah **dihapus dari codebase** (commit `60673b9` — "delete hutang"). Tabel dan sidebar links masih ada di DB/UI tapi tidak aktif digunakan.
- Piutang masih dibuat otomatis saat checkout jika `sisa > 0` (dari `process_checkout`).
- Kode untuk manajemen hutang/piutang (CRUD, pembayaran) sudah dihapus.

### Transaksi (Checkout Flow)
1. Kasir memilih produk (search/barcode scan)
2. Pilih tipe harga (Satuan/Grosir/Promo)
3. Atur qty (via numpad +/-, atau klik item + numpad)
4. Pilih pelanggan (opsional, wajib jika kredit/DP)
5. Pilih metode bayar
6. Input jumlah bayar (via numpad)
7. Submit → POST `/api/pos/checkout` → panggil RPC `process_checkout`
8. Redirect ke `/pos/invoice/[id]`
9. Invoice bisa dicetak thermal 58mm atau faktur A4

### Laporan Keuangan (Laba Rugi & Neraca)

**Laba Rugi** (`lib/laporan-keuangan.ts:generateLabaRugi`):
- `penjualan_kotor` = SUM(subtotal)
- `diskon` = SUM(diskon_nominal)
- `pendapatan_bersih` = SUM(total) - SUM(pajak_nominal)
- `hpp` = SUM(total_hpp)
- `laba_kotor` = pendapatan_bersih - hpp
- `beban_operasional` = 0 (placeholder untuk masa depan)
- `laba_bersih` = laba_kotor - beban_operasional

**Neraca** (`lib/laporan-keuangan.ts:generateNeraca`):
- **Aset**: Kas = saldo_akhir dari `saldo_kas_harian` (atau modal_awal fallback), Persediaan = dari RPC `get_inventory_value_at_date`, Piutang = 0 (dinonaktifkan)
- **Kewajiban**: Hutang = 0 (dinonaktifkan)
- **Ekuitas**: Modal awal + Laba ditahan (kumulatif dari semua transaksi)

### Tutup Kasir
- `lib/laporan-kasir.ts:getDailyCashSummary()`: Hitung saldo awal (dari saldo kemarin atau modal_awal), total masuk (penjualan tunai), total keluar (pembelian tunai), saldo akhir sistem
- `confirmTutupKasir()`: Simpan ke `saldo_kas_harian`, hitung selisih antara uang aktual dan saldo sistem

### Absensi (Attendance)
- **QR Code**: Generate QR token (`qr_session`) dengan expiry 30 detik. Token unik via `crypto.randomUUID()`.
- **Scan QR**: Via kamera HP menggunakan `@zxing/browser`. Validasi token masih aktif dan belum expired.
- **Geofencing**: Validasi GPS — latitude/longitude dari `.env` (`STORE_LATITUDE`, `STORE_LONGITUDE`), radius max `MAX_ATTENDANCE_RADIUS` (50m). Hitung jarak menggunakan formula **Haversine**.
- **Check-in**: Catat `jam_masuk`, status "HADIR" atau "TELAT" (bandingkan dengan `ATTENDANCE_START_TIME` + `ATTENDANCE_TOLERANCE_MINUTES`).
- **Check-out**: Catat `jam_pulang` (tidak ada validasi GPS untuk check-out).
- **Widget Dashboard**: `AttendanceWidget` menampilkan status hari ini (BELUM ABSEN / HADIR / TERLAMBAT), jam masuk/pulang, tombol scan.

### Barcode Scanner (SSE Relay)
- **Skenario**: HP digunakan sebagai scanner barcode via kamera, hasil scan dikirim ke sesi browser POS.
- **Mekanisme**: In-memory SSE (Server-Sent Events) relay di `lib/scanner-relay.ts`
- **Session**: Setiap sesi punya `sessionId` unik. Session expired setelah 5 menit idle.
- **Flow**: 
  1. Buka `/scanner/[sessionId]` di HP (tampilkan kamera via `@zxing/browser`)
  2. Scan barcode → POST `/api/scanner/relay` dengan `{ sessionId, barcode }`
  3. Server emit ke semua listener di session tersebut
  4. POS page terima event via SSE dan tambahkan produk ke cart
- Barcode bisa juga diketik manual (fallback)

### Barcode Generation
- Barcode produk dibuat dengan `jsbarcode` (format CODE128)
- API `/api/inventory/barcode` untuk generate barcode SVG per produk
- Produk bisa memiliki SKU (nomor unik) selain barcode

### UoM Conversion (Unit of Measure)
- **Base Unit**: Default `pcs` (satuan dasar inventory)
- **Purchase Unit**: Satuan pembelian dari supplier (contoh: `lusin`, `roll`, `set`)
- **Conversion Ratio**: Jumlah base_unit dalam 1 purchase_unit (contoh: 12 untuk lusin → 1 lusin = 12 pcs)
- Disimpan di kolom `produk.base_unit`, `produk.default_purchase_unit`, `produk.conversion_ratio`
- Di form Barang Masuk: input quantity dalam purchase unit → otomatis dikonversi ke base unit
- HPP tetap dalam base unit (per pcs), total cost = qty_supplied × total_cost (bukan per piece)
- Migration `20260720_add_uom_conversion.sql` + `20260710_process_barang_masuk.sql` (dual-format)

### SKU & Merk
- Sistem SKU untuk identifikasi produk unik selain barcode
- Tabel `merk` dengan kode 4 karakter
- Produk bisa diassign ke merk tertentu
- Unique constraint: `(nama_produk, sku)` — nama produk bisa duplicate asal SKU beda

### Real-time Low Stock
- Hook `useLowStockRealtime()` mengambil data via API `/api/low-stock` kemudian subscribe ke perubahan tabel `produk` via `supabase.channel()`
- Produk dengan `hitung_stok = true` dan `stok <= stok_minimum` masuk daftar low stock
- Tampilkan di dashboard widget & sidebar badge

### Roles & Access Control
| Role | Akses |
|------|-------|
| **OWNER** | Full akses: dashboard, semua laporan, manajemen absensi (generate QR, laporan pegawai), pengaturan, users |
| **ADMIN** | Dashboard, transaksi, inventory, pelanggan, supplier, laporan, absensi pribadi, pengaturan |
| **KASIR** | Dashboard ringkasan, POS (penjualan), absensi pribadi (scan QR, riwayat). **Tidak** bisa akses inventory/supplier/pelanggan/laporan |
| **KARYAWAN** | Absensi pribadi saja (scan QR, riwayat). Menu navigasi minimalis |

### Env Variables
| Variable | Keterangan |
|----------|-----------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key (public) |
| `SERVICE_ROLE` | Supabase service_role key (rahasia, hanya di server) |
| `STORE_LATITUDE` | Latitude toko (untuk geofencing absensi) |
| `STORE_LONGITUDE` | Longitude toko |
| `MAX_ATTENDANCE_RADIUS` | Radius geofencing (meter) |
| `QR_EXPIRE_SECONDS` | Masa berlaku QR session |
| `ATTENDANCE_START_TIME` | Jam mulai kerja |
| `ATTENDANCE_TOLERANCE_MINUTES` | Toleransi keterlambatan (menit) |

---

## 🎨 DESAIN & UI (Stripi-inspired)

### Vibe
Professional, trustworthy, financial-grade confidence. Bukan generic SaaS, bukan cold enterprise. Mewah tapi tetap hangat.

### Typography
- **Display text**: `font-weight: 300` + negative tracking (`tracking-tight` / `tracking-tighter`)
- **Money/Numbers**: `font-feature-settings: "tnum"` (tabular numbers) + `tabular-nums` class
- **Labels** (small caps): `text-[10px] font-medium/semibold uppercase tracking-wider`
- **Font family**: Sohne-family (dari shadcn default)

### Colors
| Token | Value | Penggunaan |
|-------|-------|-----------|
| `primary` | `#533afd` (electric indigo) | Tombol CTA, link, aksen aktif |
| `primary-foreground` | white | Teks di tombol primary |
| `foreground` | ~`#0d253d` (deep navy) | Teks utama |
| `muted-foreground` | ~`#6b7280` | Teks sekunder/label |
| `background` | white / `#ffffff` | Background utama |
| `canvas-cream` | `#f5e9d4` | Background hangat (jarang) |
| `destructive` | ~`#ea2261` (ruby) | Tombol/aksi destruktif |
| `warning` | amber | Badge stok menipis |

### Komponen
- **Buttons**: **Pill-shaped** (`rounded-full`). Default: `h-10 px-6 rounded-full bg-primary`
- **Cards**: `rounded-xl`, soft shadow, ring halus
- **Input/Select**: `rounded-[6px]`, border primary saat focus
- **Tables**: Modern, bordered, hover states, mobile-responsive cards
- **Dialog/Sheet**: Radix UI primitives dengan backdrop blur

### Layout
- **Dashboard**: Sidebar (desktop) + Mobile nav (slide-over). Konten utama fleksibel.
- **POS**: Full-screen layout, split: panel produk (kiri) + cart/numpad (kanan)
- **Invoice**: Dua mode — thermal (58mm, hitam putih, minimal) dan faktur (lengkap dengan kop toko)

---

## 🧠 ZUSTAND STORE (pos-store.ts)

State utama untuk halaman POS:

```typescript
interface PosState {
  // Data master (di-fetch di awal)
  products: Product[]           // Produk dengan harga & stok
  customers: Customer[]         // Pelanggan
  paymentMethods: PaymentMethod[] // Metode bayar

  // Cart & POS flow
  cart: CartItem[]              // Item di keranjang ({ id_produk, nama_produk, kategori, harga_jual, qty, diskon_item, tipe_harga })
  numpadValue: string           // Input numpad (string karena bisa mengandung ".")
  searchQuery: string           // Pencarian produk
  selectedCustomer: Customer | null
  selectedPayment: number       // ID metode bayar (default: 1 = Tunai)
  activeCartItemId: number | null  // Item yang sedang dipilih/diedit qty/harga
  checkoutLoading: boolean
  checkoutError: string | null

  // Actions
  setProducts(), setCustomers(), setPaymentMethods()
  addToCart(product)            // Tambah (atau increment qty jika sudah ada)
  updateQty(id, delta)          // Ubah qty (+1/-1)
  removeItem(id)                // Hapus dari cart
  clearCart()                   // Reset cart
  numpadPress(val)              // "0"-"9", "delete", "."
  setNumpadValue(val)
  setSelectedCustomer(c)
  setSelectedPayment(id)
  setActiveCartItemId(id)       // Toggle selected item
  applyNumpadAsQty()            // Terapkan numpadValue sebagai qty item aktif
  setPriceType(type)            // Ganti tipe harga item aktif (Satuan/Grosir/Promo)
  checkout()                    // POST /api/pos/checkout → redirect ke invoice
}
```

---

## 🌐 API ROUTES LENGKAP

| Route | Method | Fungsi |
|-------|--------|--------|
| `/api/auth/login` | POST | Login dengan Supabase Auth |
| `/api/pos/products` | GET | Ambil semua produk (aktif) |
| `/api/pos/customer-search` | GET | Cari pelanggan by nama/no_hp |
| `/api/pos/checkout` | POST | Proses checkout (panggil RPC process_checkout) |
| `/api/dashboard/stats` | GET | Data ringkasan dashboard |
| `/api/dashboard/transactions` | GET | Riwayat transaksi (paginated, filterable) |
| `/api/dashboard/transactions/[id]` | GET | Detail transaksi |
| `/api/dashboard/transactions/[id]` | DELETE | Void transaksi |
| `/api/low-stock` | GET | Daftar produk stok menipis |
| `/api/customers` | GET/POST | CRUD pelanggan |
| `/api/customers/[id]` | PUT/DELETE | Edit/hapus pelanggan |
| `/api/inventory/products` | GET/POST | CRUD produk |
| `/api/inventory/categories` | GET/POST | CRUD kategori |
| `/api/inventory/units` | GET/POST | CRUD satuan |
| `/api/inventory/suppliers` | GET/POST | CRUD supplier |
| `/api/inventory/stock-in` | POST | Barang masuk (panggil RPC process_barang_masuk) |
| `/api/inventory/stock-opname` | POST | Simpan stok opname |
| `/api/inventory/barcode` | GET | Generate barcode SVG |
| `/api/attendance/today` | GET | Status absensi hari ini |
| `/api/attendance/check-in` | POST | Check-in (QR scan + GPS) |
| `/api/attendance/check-out` | POST | Check-out |
| `/api/attendance/qr-scan` | POST | Validasi QR + lokasi |
| `/api/attendance/generate-qr` | GET | Generate QR token baru |
| `/api/scanner/relay` | POST | Relay barcode ke sesi POS |
| `/api/settings` | GET/PUT | CRUD pengaturan toko |
| `/api/users` | GET/POST/PUT | CRUD pengguna |
| `/api/laporan/penjualan` | GET | Laporan penjualan (paginated, filterable) |
| `/api/laporan/penjualan/rekap` | GET | Rekap penjualan (grouped) |
| `/api/laporan/penjualan/[id]` | GET | Detail transaksi untuk laporan |
| `/api/laporan/penjualan/export` | GET | Export CSV laporan penjualan |
| `/api/laporan/laba-rugi` | GET | Generate laporan laba rugi |
| `/api/laporan/neraca` | GET | Generate laporan neraca |

---

## 🔧 UTILITY FUNCTIONS

| Fungsi | File | Parameter | Return |
|--------|------|-----------|--------|
| `cn(...inputs)` | `lib/utils.ts` | ClassValue[] | string (merged classes) |
| `terbilang(angka)` | `lib/terbilang.ts` | number | string (contoh: "Seratus Dua Puluh Tiga") |
| `terbilangRupiah(angka)` | `lib/terbilang.ts` | number | string (contoh: "Seratus Dua Puluh Tiga Rupiah") |
| `formatIDR()` | — | TBD | TBD (helper tambahan untuk format mata uang) |
| `exportToCSV(filename, headers, data)` | `lib/export-utils.ts` | string, string[], any[][] | void (download) |
| `exportToPDF(filename, title, headers, data)` | `lib/export-utils.ts` | string, string, string[], any[][] | void (download) |
| `calculateNewAVCO(currentQty, currentAvco, incomingQty, incomingPrice)` | `lib/avco.ts` | number, number, number, number | { newAvco, newTotalValue, newQty } |
| `recordAVCOMutation(supabase, params)` | `lib/avco.ts` | SupabaseClient, AVCOParams | Promise<void> |
| `getTodayAttendance()` | `lib/attendance.ts` | none | { attendance?, user } |
| `getMonthlyAttendanceStats()` | `lib/attendance.ts` | none | { total, hadir, telat } |
| `getDashboardData()` | `lib/dashboard.ts` | none | DashboardData |
| `getLowStockItems()` | `lib/low-stock.ts` | none | LowStockItem[] |
| `getDailyCashSummary(supabase, date)` | `lib/laporan-kasir.ts` | SupabaseClient, string | CashSummary |
| `confirmTutupKasir(supabase, params)` | `lib/laporan-kasir.ts` | SupabaseClient, TutupKasirParams | SaldoKasHarian |
| `generateLabaRugi(supabase, startDate, endDate)` | `lib/laporan-keuangan.ts` | SupabaseClient, string, string | LabaRugiReport |
| `generateNeraca(supabase, date)` | `lib/laporan-keuangan.ts` | SupabaseClient, string | NeracaReport |

---

## 🧩 MIGRATION HISTORY (19 files)

| No | File | Tujuan |
|----|------|--------|
| 1 | `20260529114225_fix_checkout_race_condition.sql` | Fix race condition checkout + advisory lock |
| 2 | `20260601000001_add_accounting_fields.sql` | Tambah kolom HPP ke transaksi, AVCO ke produk |
| 3 | `20260601000002_create_hutang_piutang.sql` | Buat tabel hutang & piutang dagang |
| 4 | `20260601000003_create_avco_tracking.sql` | Buat tabel riwayat_avco |
| 5 | `20260601000004_create_kas_dan_laporan.sql` | Buat saldo_kas_harian & pengaturan_keuangan |
| 6 | `20260606000001_update_process_checkout.sql` | Update process_checkout dengan AVCO/HPP |
| 7 | `20260606000002_process_checkout_piutang.sql` | Update process_checkout: otomatis buat piutang |
| 8 | `20260606000003_add_neraca_rpc.sql` | Buat RPC get_inventory_value_at_date |
| 9 | `20260706_add_stok_gudang.sql` | Tambah kolom stok_gudang, update process_checkout |
| 10 | `20260707_add_rls_riwayat_avco.sql` | RLS untuk riwayat_avco |
| 11 | `20260708_add_produk_realtime.sql` | Tambah tabel produk ke publikasi realtime |
| 12 | `20260710_process_barang_masuk.sql` | Buat RPC process_barang_masuk (dual format) |
| 13 | `20260710_widen_numeric_columns.sql` | Perluas tipe numeric columns |
| 14 | `20260716_add_rls_hutang_piutang.sql` | RLS untuk tabel hutang/piutang |
| 15 | `20260717_add_sku_dan_merk.sql` | Buat tabel merk, tambah kolom sku & id_merk |
| 16 | `20260717_drop_produk_nama_produk_unique.sql` | Ganti unique constraint ke (nama, sku) |
| 17 | `20260718104411_update_process_barang_masuk.sql` | Update process_barang_masuk (UoM + legacy) |
| 18 | `20260720_add_uom_conversion.sql` | Tambah kolom UoM ke produk & audit barang_masuk |
| 19 | *(belum diapply — migration untuk drop hutang/piutang)* | — |

---

## 📋 CATATAN PENTING

### Konvensi Kode
- **Gunakan ekspor named** untuk komponen (bukan default export)
- **Server Components** sebisa mungkin, "use client" hanya jika perlu interaktivitas
- **Error handling**: Selalu tangani error di try/catch, tampilkan pesan di UI
- **Loading states**: Gunakan `loading.tsx` untuk page loading, spinner untuk action loading
- **"use client"** ada di: komponen interaktif (forms, dialogs, navigation, hooks), komponen dengan state/effect
- **Server Components** ada di: layout, page shell, data fetching di server

### Security
- ALL Supabase tables have **RLS enabled** for authenticated users
- Checkout & barang_masuk via **SECURITY DEFINER** RPC functions (bypass RLS)
- **SERVICE_ROLE** hanya digunakan di `lib/supabase/admin.ts` untuk operasi yang perlu bypass RLS
- Validasi sisi server **harus dilakukan** untuk semua operasi write (jangan trust client)

### PWA
- next-pwa dikonfigurasi dengan `dest: "public"`, disable di development
- Web manifest di `app/manifest.ts`
- Service worker caching untuk attendance module masih pending (TODO2 item #8)

### DataTable Component
- Komponen `DataTable` di `components/data-table.tsx` sangat fleksibel:
  - Search, sort (asc/desc), filter (select, date-range, custom)
  - Pagination (dengan items per page selector)
  - Action buttons (primary/outline/destructive)
  - Delete modal konfirmasi
  - Edit row (inline + expanded)
  - Row click handler
  - Mobile card mode (responsive breakpoint configurable)
  - Loading state, empty state, error banner
  - Kolom bisa punya custom render, sort key berbeda, mobile label, hide di mobile
- Gunakan `useTable()` hook untuk sorting + pagination state management

### Design Guidelines Implementation
- **Dashboard sidebar**: `DashboardSidebar.tsx` — hidden di mobile
- **Mobile nav**: `DashboardMobileNav.tsx` — slide-over menu dari kanan
- **Low stock**: Widget di sidebar & dashboard, realtime update via Supabase subscription
- **Attendance widget**: Gradient mesh background, card dengan status, jam masuk/pulang, tombol scan

### Invoice (Receipt) Printing
- **Thermal 58mm**: Nota kecil (struk) — format minimalis, hanya informasi esensial
- **Faktur Penjualan**: Format A4 lengkap — kop toko, header, detail item, footer, tanda tangan
- **Footer struk** bisa dikonfigurasi dari `pengaturan` (footer_struk_1/2/3, footer_invoice_1/2/3)
- **Informasi Bank**: Dari pengaturan (bank1_nama, bank1_rekening, bank1_atas_nama, bank2_...)

### Outstanding Work (from TODO files)
- **TODO2 Item #8**: PWA service worker caching untuk attendance module
- **TODO4**: UoM (Unit of Measure) conversion untuk Barang Masuk — fitur baru yang belum dimulai
- **Hutang/Piutang**: Module telah dihapus (commit `60673b9`), tetapi tabel masih ada di database

---

## 🔍 REFERENSI CEPAT

### Dimana mencari untuk...
| Kebutuhan | Lokasi |
|-----------|--------|
| Schema database | `database.MD` atau `supabase/migrations/` |
| Design tokens | `DESIGN.md` |
| Fitur yang belum selesai | `TODO1.md` sampai `TODO4.MD` |
| API docs laporan penjualan | `docs/api-laporan-penjualan.md` |
| Cara menambah route baru | `app/api/` (ikuti pattern route handler Next.js 16) |
| Cara menambah halaman | `app/` (ikuti App Router conventions) |
| Cara styling | Tailwind CSS v4 classes + `cn()` utility |
| Error handling pattern | Lihat `pos-store.ts` → `checkout()` action |
| Mobile responsiveness | Lihat `data-table.tsx` mobileCards prop pattern |
