# Laporan Komprehensif POS Sobatti

## 1. Daftar Routes & Fitur

### Route: `app`
- **File**: `app/page.tsx`
- **Supabase Tables Interacted**: None
- **Fetch Calls**: None

### Route: `app/scanner/[sessionId]`
- **File**: `app/scanner/[sessionId]/page.tsx`
- **Supabase Tables Interacted**: None
- **Fetch Calls**: None

### Route: `app/dashboard`
- **File**: `app/dashboard/page.tsx`
- **Supabase Tables Interacted**: None
- **Fetch Calls**: None

### Route: `app/dashboard/settings`
- **File**: `app/dashboard/settings/page.tsx`
- **Supabase Tables Interacted**: None
- **Fetch Calls**: None

### Route: `app/dashboard/settings/keuangan`
- **File**: `app/dashboard/settings/keuangan/page.tsx`
- **Supabase Tables Interacted**: None
- **Fetch Calls**: None

### Route: `app/dashboard/settings/users`
- **File**: `app/dashboard/settings/users/page.tsx`
- **Supabase Tables Interacted**: None
- **Fetch Calls**: None

### Route: `app/dashboard/settings/reference-data`
- **File**: `app/dashboard/settings/reference-data/page.tsx`
- **Supabase Tables Interacted**: satuan, metode_bayar, kategori
- **Fetch Calls**: None

### Route: `app/dashboard/customers`
- **File**: `app/dashboard/customers/page.tsx`
- **Supabase Tables Interacted**: None
- **Fetch Calls**: None

### Route: `app/dashboard/attendance/generate-qr`
- **File**: `app/dashboard/attendance/generate-qr/page.tsx`
- **Supabase Tables Interacted**: None
- **Fetch Calls**: /api/attendance/generate-qr

### Route: `app/dashboard/attendance/history`
- **File**: `app/dashboard/attendance/history/page.tsx`
- **Supabase Tables Interacted**: None
- **Fetch Calls**: None

### Route: `app/dashboard/attendance/report`
- **File**: `app/dashboard/attendance/report/page.tsx`
- **Supabase Tables Interacted**: None
- **Fetch Calls**: None

### Route: `app/dashboard/laporan/laba-rugi`
- **File**: `app/dashboard/laporan/laba-rugi/page.tsx`
- **Supabase Tables Interacted**: None
- **Fetch Calls**: None

### Route: `app/dashboard/laporan/neraca`
- **File**: `app/dashboard/laporan/neraca/page.tsx`
- **Supabase Tables Interacted**: None
- **Fetch Calls**: None

### Route: `app/dashboard/hutang`
- **File**: `app/dashboard/hutang/page.tsx`
- **Supabase Tables Interacted**: None
- **Fetch Calls**: None

### Route: `app/dashboard/piutang`
- **File**: `app/dashboard/piutang/page.tsx`
- **Supabase Tables Interacted**: None
- **Fetch Calls**: None

### Route: `app/dashboard/tutup-kasir`
- **File**: `app/dashboard/tutup-kasir/page.tsx`
- **Supabase Tables Interacted**: None
- **Fetch Calls**: None

### Route: `app/dashboard/inventory`
- **File**: `app/dashboard/inventory/page.tsx`
- **Supabase Tables Interacted**: satuan, produk, kategori
- **Fetch Calls**: None

### Route: `app/dashboard/inventory/stock-opname`
- **File**: `app/dashboard/inventory/stock-opname/page.tsx`
- **Supabase Tables Interacted**: None
- **Fetch Calls**: None

### Route: `app/dashboard/inventory/stock-opname/history`
- **File**: `app/dashboard/inventory/stock-opname/history/page.tsx`
- **Supabase Tables Interacted**: None
- **Fetch Calls**: None

### Route: `app/dashboard/inventory/stock-in`
- **File**: `app/dashboard/inventory/stock-in/page.tsx`
- **Supabase Tables Interacted**: supplier
- **Fetch Calls**: None

### Route: `app/dashboard/inventory/stock-in/history`
- **File**: `app/dashboard/inventory/stock-in/history/page.tsx`
- **Supabase Tables Interacted**: supplier
- **Fetch Calls**: None

### Route: `app/dashboard/transactions`
- **File**: `app/dashboard/transactions/page.tsx`
- **Supabase Tables Interacted**: metode_bayar
- **Fetch Calls**: None

### Route: `app/dashboard/suppliers`
- **File**: `app/dashboard/suppliers/page.tsx`
- **Supabase Tables Interacted**: None
- **Fetch Calls**: None

### Route: `app/dashboard/reports`
- **File**: `app/dashboard/reports/page.tsx`
- **Supabase Tables Interacted**: None
- **Fetch Calls**: None

### Route: `app/dashboard/laporan-kasir`
- **File**: `app/dashboard/laporan-kasir/page.tsx`
- **Supabase Tables Interacted**: None
- **Fetch Calls**: None

### Route: `app/attendance/scan`
- **File**: `app/attendance/scan/page.tsx`
- **Supabase Tables Interacted**: None
- **Fetch Calls**: /api/attendance/checkout, /api/attendance/checkin

### Route: `app/pos`
- **File**: `app/pos/page.tsx`
- **Supabase Tables Interacted**: pengaturan
- **Fetch Calls**: /api/pos/payment-methods, /api/pos/products, /api/network-ip, /api/pos/customers

### Route: `app/pos/test-barcode`
- **File**: `app/pos/test-barcode/page.tsx`
- **Supabase Tables Interacted**: None
- **Fetch Calls**: None

### Route: `app/pos/invoice/[id]`
- **File**: `app/pos/invoice/[id]/page.tsx`
- **Supabase Tables Interacted**: None
- **Fetch Calls**: None

### Route: `app/pos/invoice/[id]/receipt`
- **File**: `app/pos/invoice/[id]/receipt/page.tsx`
- **Supabase Tables Interacted**: None
- **Fetch Calls**: None

### Route: `app/api/low-stock`
- **File**: `app/api/low-stock/route.ts`
- **Supabase Tables Interacted**: None
- **Fetch Calls**: None

### Route: `app/api/scanner/[sessionId]`
- **File**: `app/api/scanner/[sessionId]/route.ts`
- **Supabase Tables Interacted**: None
- **Fetch Calls**: None

### Route: `app/api/scanner/[sessionId]/events`
- **File**: `app/api/scanner/[sessionId]/events/route.ts`
- **Supabase Tables Interacted**: None
- **Fetch Calls**: None

### Route: `app/api/auth/login`
- **File**: `app/api/auth/login/route.ts`
- **Supabase Tables Interacted**: None
- **Fetch Calls**: None

### Route: `app/api/network-ip`
- **File**: `app/api/network-ip/route.ts`
- **Supabase Tables Interacted**: None
- **Fetch Calls**: None

### Route: `app/api/attendance/generate-qr`
- **File**: `app/api/attendance/generate-qr/route.ts`
- **Supabase Tables Interacted**: None
- **Fetch Calls**: None

### Route: `app/api/attendance/history`
- **File**: `app/api/attendance/history/route.ts`
- **Supabase Tables Interacted**: None
- **Fetch Calls**: None

### Route: `app/api/attendance/checkout`
- **File**: `app/api/attendance/checkout/route.ts`
- **Supabase Tables Interacted**: None
- **Fetch Calls**: None

### Route: `app/api/attendance/today`
- **File**: `app/api/attendance/today/route.ts`
- **Supabase Tables Interacted**: None
- **Fetch Calls**: None

### Route: `app/api/attendance/checkin`
- **File**: `app/api/attendance/checkin/route.ts`
- **Supabase Tables Interacted**: absensi
- **Fetch Calls**: None

### Route: `app/api/admin/attendance`
- **File**: `app/api/admin/attendance/route.ts`
- **Supabase Tables Interacted**: None
- **Fetch Calls**: None

### Route: `app/api/pos/customers`
- **File**: `app/api/pos/customers/route.ts`
- **Supabase Tables Interacted**: None
- **Fetch Calls**: None

### Route: `app/api/pos/checkout`
- **File**: `app/api/pos/checkout/route.ts`
- **Supabase Tables Interacted**: None
- **Fetch Calls**: None

### Route: `app/api/pos/payment-methods`
- **File**: `app/api/pos/payment-methods/route.ts`
- **Supabase Tables Interacted**: None
- **Fetch Calls**: None

### Route: `app/api/pos/products`
- **File**: `app/api/pos/products/route.ts`
- **Supabase Tables Interacted**: None
- **Fetch Calls**: None

### Route: `app/api/pos/barcode`
- **File**: `app/api/pos/barcode/route.ts`
- **Supabase Tables Interacted**: None
- **Fetch Calls**: None

## 2. Tabel Database dan Sumber Data Form

### Tabel: `pengaturan_keuangan`
- **Sumber Data / Modifikasi (Pages/Components)**:
  - `lib/laporan-kasir.ts`
  - `app/dashboard/settings/keuangan/actions.ts`
  - `lib/laporan-keuangan.ts`

### Tabel: `satuan`
- **Sumber Data / Modifikasi (Pages/Components)**:
  - `app/dashboard/inventory/page.tsx`
  - `app/dashboard/settings/reference-data/page.tsx`

### Tabel: `metode_bayar`
- **Sumber Data / Modifikasi (Pages/Components)**:
  - `lib/laporan-kasir.ts`
  - `app/dashboard/transactions/page.tsx`
  - `app/dashboard/settings/reference-data/page.tsx`

### Tabel: `kategori`
- **Sumber Data / Modifikasi (Pages/Components)**:
  - `app/dashboard/inventory/page.tsx`
  - `app/dashboard/settings/reference-data/page.tsx`

### Tabel: `pelanggan`
- **Sumber Data / Modifikasi (Pages/Components)**:
  - `app/dashboard/customers/actions.ts`

### Tabel: `produk`
- **Sumber Data / Modifikasi (Pages/Components)**:
  - `app/dashboard/inventory/page.tsx`
  - `app/dashboard/inventory/actions.ts`

### Tabel: `supplier`
- **Sumber Data / Modifikasi (Pages/Components)**:
  - `app/dashboard/inventory/stock-in/history/page.tsx`
  - `app/dashboard/inventory/stock-in/page.tsx`
  - `app/dashboard/suppliers/actions.ts`

### Tabel: `pengaturan`
- **Sumber Data / Modifikasi (Pages/Components)**:
  - `app/pos/page.tsx`

### Tabel: `absensi`
- **Sumber Data / Modifikasi (Pages/Components)**:
  - `app/api/attendance/checkin/route.ts`

### Tabel: `piutang_dagang`
- **Sumber Data / Modifikasi (Pages/Components)**:
  - `lib/piutang.ts`

### Tabel: `pembayaran_piutang`
- **Sumber Data / Modifikasi (Pages/Components)**:
  - `lib/piutang.ts`

### Tabel: `riwayat_avco`
- **Sumber Data / Modifikasi (Pages/Components)**:
  - `lib/avco.ts`

### Tabel: `pembayaran_hutang`
- **Sumber Data / Modifikasi (Pages/Components)**:
  - `lib/hutang.ts`

### Tabel: `hutang_dagang`
- **Sumber Data / Modifikasi (Pages/Components)**:
  - `lib/hutang.ts`

## 3. Detail File Code Lengkap

### File: `app/not-found.tsx`
- **Tipe/Fungsi**: Komponen / Utilitas

### File: `app/page.tsx`
- **Tipe/Fungsi**: Komponen / Utilitas

### File: `app/layout.tsx`
- **Tipe/Fungsi**: Komponen / Utilitas

### File: `app/manifest.ts`
- **Tipe/Fungsi**: Komponen / Utilitas

### File: `app/scanner/[sessionId]/page.tsx`
- **Tipe/Fungsi**: Komponen / Utilitas

### File: `app/dashboard/page.tsx`
- **Tipe/Fungsi**: Komponen / Utilitas

### File: `app/dashboard/layout.tsx`
- **Tipe/Fungsi**: Komponen / Utilitas

### File: `app/dashboard/settings/profile-form.tsx`
- **Tipe/Fungsi**: Form Component

### File: `app/dashboard/settings/actions.ts`
- **Tipe/Fungsi**: Komponen / Utilitas

### File: `app/dashboard/settings/page.tsx`
- **Tipe/Fungsi**: Komponen / Utilitas

### File: `app/dashboard/settings/store-actions.ts`
- **Tipe/Fungsi**: Komponen / Utilitas

### File: `app/dashboard/settings/store-form.tsx`
- **Tipe/Fungsi**: Form Component

### File: `app/dashboard/settings/keuangan/finance-settings-form.tsx`
- **Tipe/Fungsi**: Form Component

### File: `app/dashboard/settings/keuangan/actions.ts`
- **Tipe/Fungsi**: Komponen / Utilitas
- **Interaksi Tabel**: pengaturan_keuangan

### File: `app/dashboard/settings/keuangan/page.tsx`
- **Tipe/Fungsi**: Komponen / Utilitas

### File: `app/dashboard/settings/users/actions.ts`
- **Tipe/Fungsi**: Komponen / Utilitas

### File: `app/dashboard/settings/users/page.tsx`
- **Tipe/Fungsi**: Komponen / Utilitas

### File: `app/dashboard/settings/users/users-client.tsx`
- **Tipe/Fungsi**: Komponen / Utilitas

### File: `app/dashboard/settings/reference-data/actions.ts`
- **Tipe/Fungsi**: Komponen / Utilitas

### File: `app/dashboard/settings/reference-data/page.tsx`
- **Tipe/Fungsi**: Komponen / Utilitas
- **Interaksi Tabel**: satuan, metode_bayar, kategori

### File: `app/dashboard/settings/reference-data/reference-client.tsx`
- **Tipe/Fungsi**: Komponen / Utilitas

### File: `app/dashboard/customers/customers-client.tsx`
- **Tipe/Fungsi**: Komponen / Utilitas

### File: `app/dashboard/customers/actions.ts`
- **Tipe/Fungsi**: Komponen / Utilitas
- **Interaksi Tabel**: pelanggan

### File: `app/dashboard/customers/page.tsx`
- **Tipe/Fungsi**: Komponen / Utilitas

### File: `app/dashboard/attendance/generate-qr/page.tsx`
- **Tipe/Fungsi**: Komponen / Utilitas

### File: `app/dashboard/attendance/history/history-client.tsx`
- **Tipe/Fungsi**: Komponen / Utilitas

### File: `app/dashboard/attendance/history/page.tsx`
- **Tipe/Fungsi**: Komponen / Utilitas

### File: `app/dashboard/attendance/report/page.tsx`
- **Tipe/Fungsi**: Komponen / Utilitas

### File: `app/dashboard/attendance/report/report-client.tsx`
- **Tipe/Fungsi**: Komponen / Utilitas

### File: `app/dashboard/laporan/laba-rugi/laba-rugi-client.tsx`
- **Tipe/Fungsi**: Komponen / Utilitas

### File: `app/dashboard/laporan/laba-rugi/actions.ts`
- **Tipe/Fungsi**: Komponen / Utilitas

### File: `app/dashboard/laporan/laba-rugi/page.tsx`
- **Tipe/Fungsi**: Komponen / Utilitas

### File: `app/dashboard/laporan/neraca/neraca-client.tsx`
- **Tipe/Fungsi**: Komponen / Utilitas

### File: `app/dashboard/laporan/neraca/actions.ts`
- **Tipe/Fungsi**: Komponen / Utilitas

### File: `app/dashboard/laporan/neraca/page.tsx`
- **Tipe/Fungsi**: Komponen / Utilitas

### File: `app/dashboard/hutang/actions.ts`
- **Tipe/Fungsi**: Komponen / Utilitas

### File: `app/dashboard/hutang/page.tsx`
- **Tipe/Fungsi**: Komponen / Utilitas

### File: `app/dashboard/hutang/hutang-client.tsx`
- **Tipe/Fungsi**: Komponen / Utilitas

### File: `app/dashboard/piutang/piutang-client.tsx`
- **Tipe/Fungsi**: Komponen / Utilitas

### File: `app/dashboard/piutang/actions.ts`
- **Tipe/Fungsi**: Komponen / Utilitas

### File: `app/dashboard/piutang/page.tsx`
- **Tipe/Fungsi**: Komponen / Utilitas

### File: `app/dashboard/tutup-kasir/tutup-kasir-client.tsx`
- **Tipe/Fungsi**: Komponen / Utilitas

### File: `app/dashboard/tutup-kasir/actions.ts`
- **Tipe/Fungsi**: Komponen / Utilitas

### File: `app/dashboard/tutup-kasir/page.tsx`
- **Tipe/Fungsi**: Komponen / Utilitas

### File: `app/dashboard/inventory/actions.ts`
- **Tipe/Fungsi**: Komponen / Utilitas
- **Interaksi Tabel**: produk

### File: `app/dashboard/inventory/page.tsx`
- **Tipe/Fungsi**: Komponen / Utilitas
- **Interaksi Tabel**: satuan, produk, kategori

### File: `app/dashboard/inventory/inventory-client.tsx`
- **Tipe/Fungsi**: Komponen / Utilitas

### File: `app/dashboard/inventory/stock-opname/stock-opname-client.tsx`
- **Tipe/Fungsi**: Form Component

### File: `app/dashboard/inventory/stock-opname/actions.ts`
- **Tipe/Fungsi**: Komponen / Utilitas

### File: `app/dashboard/inventory/stock-opname/page.tsx`
- **Tipe/Fungsi**: Komponen / Utilitas

### File: `app/dashboard/inventory/stock-opname/history/history-client.tsx`
- **Tipe/Fungsi**: Komponen / Utilitas

### File: `app/dashboard/inventory/stock-opname/history/page.tsx`
- **Tipe/Fungsi**: Komponen / Utilitas

### File: `app/dashboard/inventory/stock-in/stock-in-client.tsx`
- **Tipe/Fungsi**: Form Component

### File: `app/dashboard/inventory/stock-in/actions.ts`
- **Tipe/Fungsi**: Komponen / Utilitas

### File: `app/dashboard/inventory/stock-in/page.tsx`
- **Tipe/Fungsi**: Komponen / Utilitas
- **Interaksi Tabel**: supplier

### File: `app/dashboard/inventory/stock-in/history/history-client.tsx`
- **Tipe/Fungsi**: Komponen / Utilitas

### File: `app/dashboard/inventory/stock-in/history/page.tsx`
- **Tipe/Fungsi**: Komponen / Utilitas
- **Interaksi Tabel**: supplier

### File: `app/dashboard/transactions/actions.ts`
- **Tipe/Fungsi**: Komponen / Utilitas

### File: `app/dashboard/transactions/page.tsx`
- **Tipe/Fungsi**: Komponen / Utilitas
- **Interaksi Tabel**: metode_bayar

### File: `app/dashboard/transactions/transactions-client.tsx`
- **Tipe/Fungsi**: Komponen / Utilitas

### File: `app/dashboard/suppliers/actions.ts`
- **Tipe/Fungsi**: Komponen / Utilitas
- **Interaksi Tabel**: supplier

### File: `app/dashboard/suppliers/page.tsx`
- **Tipe/Fungsi**: Komponen / Utilitas

### File: `app/dashboard/suppliers/suppliers-client.tsx`
- **Tipe/Fungsi**: Komponen / Utilitas

### File: `app/dashboard/reports/page.tsx`
- **Tipe/Fungsi**: Komponen / Utilitas

### File: `app/dashboard/reports/reports-client.tsx`
- **Tipe/Fungsi**: Komponen / Utilitas

### File: `app/dashboard/laporan-kasir/page.tsx`
- **Tipe/Fungsi**: Komponen / Utilitas

### File: `app/dashboard/laporan-kasir/laporan-kasir-client.tsx`
- **Tipe/Fungsi**: Komponen / Utilitas

### File: `app/attendance/scan/page.tsx`
- **Tipe/Fungsi**: Komponen / Utilitas

### File: `app/pos/page.tsx`
- **Tipe/Fungsi**: Komponen / Utilitas
- **Interaksi Tabel**: pengaturan

### File: `app/pos/layout.tsx`
- **Tipe/Fungsi**: Komponen / Utilitas

### File: `app/pos/test-barcode/page.tsx`
- **Tipe/Fungsi**: Komponen / Utilitas

### File: `app/pos/invoice/[id]/page.tsx`
- **Tipe/Fungsi**: Komponen / Utilitas

### File: `app/pos/invoice/[id]/print-button.tsx`
- **Tipe/Fungsi**: Komponen / Utilitas

### File: `app/pos/invoice/[id]/receipt/page.tsx`
- **Tipe/Fungsi**: Komponen / Utilitas

### File: `app/api/low-stock/route.ts`
- **Tipe/Fungsi**: Komponen / Utilitas

### File: `app/api/scanner/[sessionId]/route.ts`
- **Tipe/Fungsi**: Komponen / Utilitas

### File: `app/api/scanner/[sessionId]/events/route.ts`
- **Tipe/Fungsi**: Komponen / Utilitas

### File: `app/api/auth/login/route.ts`
- **Tipe/Fungsi**: Komponen / Utilitas

### File: `app/api/network-ip/route.ts`
- **Tipe/Fungsi**: Komponen / Utilitas

### File: `app/api/attendance/generate-qr/route.ts`
- **Tipe/Fungsi**: Komponen / Utilitas

### File: `app/api/attendance/history/route.ts`
- **Tipe/Fungsi**: Komponen / Utilitas

### File: `app/api/attendance/checkout/route.ts`
- **Tipe/Fungsi**: Komponen / Utilitas

### File: `app/api/attendance/today/route.ts`
- **Tipe/Fungsi**: Komponen / Utilitas

### File: `app/api/attendance/checkin/route.ts`
- **Tipe/Fungsi**: Komponen / Utilitas
- **Interaksi Tabel**: absensi

### File: `app/api/admin/attendance/route.ts`
- **Tipe/Fungsi**: Komponen / Utilitas

### File: `app/api/pos/customers/route.ts`
- **Tipe/Fungsi**: Komponen / Utilitas

### File: `app/api/pos/checkout/route.ts`
- **Tipe/Fungsi**: Komponen / Utilitas

### File: `app/api/pos/payment-methods/route.ts`
- **Tipe/Fungsi**: Komponen / Utilitas

### File: `app/api/pos/products/route.ts`
- **Tipe/Fungsi**: Komponen / Utilitas

### File: `app/api/pos/barcode/route.ts`
- **Tipe/Fungsi**: Komponen / Utilitas

### File: `components/logout-button.tsx`
- **Tipe/Fungsi**: Komponen / Utilitas

### File: `components/dashboard-sidebar.tsx`
- **Tipe/Fungsi**: Komponen / Utilitas

### File: `components/dashboard-mobile-nav.tsx`
- **Tipe/Fungsi**: Komponen / Utilitas

### File: `components/product-detail-sheet.tsx`
- **Tipe/Fungsi**: Komponen / Utilitas

### File: `components/low-stock-banner.tsx`
- **Tipe/Fungsi**: Komponen / Utilitas

### File: `components/attendance-widget.tsx`
- **Tipe/Fungsi**: Komponen / Utilitas

### File: `components/dashboard-low-stock.tsx`
- **Tipe/Fungsi**: Komponen / Utilitas

### File: `components/login-form.tsx`
- **Tipe/Fungsi**: Form Component

### File: `components/ui/button.tsx`
- **Tipe/Fungsi**: Komponen / Utilitas

### File: `components/ui/badge.tsx`
- **Tipe/Fungsi**: Komponen / Utilitas

### File: `components/ui/tabs.tsx`
- **Tipe/Fungsi**: Komponen / Utilitas

### File: `components/ui/select.tsx`
- **Tipe/Fungsi**: Komponen / Utilitas

### File: `components/ui/sheet.tsx`
- **Tipe/Fungsi**: Komponen / Utilitas

### File: `components/ui/label.tsx`
- **Tipe/Fungsi**: Komponen / Utilitas

### File: `components/ui/table.tsx`
- **Tipe/Fungsi**: Komponen / Utilitas

### File: `components/ui/dialog.tsx`
- **Tipe/Fungsi**: Komponen / Utilitas

### File: `components/ui/card.tsx`
- **Tipe/Fungsi**: Komponen / Utilitas

### File: `components/ui/input.tsx`
- **Tipe/Fungsi**: Komponen / Utilitas

### File: `lib/terbilang.ts`
- **Tipe/Fungsi**: Komponen / Utilitas

### File: `lib/piutang.ts`
- **Tipe/Fungsi**: Komponen / Utilitas
- **Interaksi Tabel**: piutang_dagang, pembayaran_piutang

### File: `lib/dashboard.ts`
- **Tipe/Fungsi**: Komponen / Utilitas

### File: `lib/low-stock.ts`
- **Tipe/Fungsi**: Komponen / Utilitas

### File: `lib/scanner-relay.ts`
- **Tipe/Fungsi**: Komponen / Utilitas

### File: `lib/avco.ts`
- **Tipe/Fungsi**: Komponen / Utilitas
- **Interaksi Tabel**: riwayat_avco

### File: `lib/laporan-kasir.ts`
- **Tipe/Fungsi**: Komponen / Utilitas
- **Interaksi Tabel**: metode_bayar, pengaturan_keuangan

### File: `lib/laporan-keuangan.ts`
- **Tipe/Fungsi**: Komponen / Utilitas
- **Interaksi Tabel**: pengaturan_keuangan

### File: `lib/utils.ts`
- **Tipe/Fungsi**: Komponen / Utilitas

### File: `lib/export-utils.ts`
- **Tipe/Fungsi**: Komponen / Utilitas

### File: `lib/hutang.ts`
- **Tipe/Fungsi**: Komponen / Utilitas
- **Interaksi Tabel**: pembayaran_hutang, hutang_dagang

### File: `lib/attendance.ts`
- **Tipe/Fungsi**: Komponen / Utilitas

### File: `lib/supabase/client.ts`
- **Tipe/Fungsi**: Komponen / Utilitas

### File: `lib/supabase/admin.ts`
- **Tipe/Fungsi**: Komponen / Utilitas

### File: `lib/supabase/server.ts`
- **Tipe/Fungsi**: Komponen / Utilitas

### File: `stores/pos-store.ts`
- **Tipe/Fungsi**: Komponen / Utilitas

### File: `supabase/migrations/20260601000001_add_accounting_fields.sql`
- **Tipe/Fungsi**: Komponen / Utilitas

### File: `supabase/migrations/20260529114225_fix_checkout_race_condition.sql`
- **Tipe/Fungsi**: Komponen / Utilitas

### File: `supabase/migrations/20260606000001_update_process_checkout.sql`
- **Tipe/Fungsi**: Komponen / Utilitas

### File: `supabase/migrations/20260601000002_create_hutang_piutang.sql`
- **Tipe/Fungsi**: Komponen / Utilitas

### File: `supabase/migrations/20260707_add_rls_riwayat_avco.sql`
- **Tipe/Fungsi**: Komponen / Utilitas

### File: `supabase/migrations/20260708_add_produk_realtime.sql`
- **Tipe/Fungsi**: Komponen / Utilitas

### File: `supabase/migrations/20260706_add_stok_gudang.sql`
- **Tipe/Fungsi**: Komponen / Utilitas

### File: `supabase/migrations/20260710_widen_numeric_columns.sql`
- **Tipe/Fungsi**: Komponen / Utilitas

### File: `supabase/migrations/20260606000003_add_neraca_rpc.sql`
- **Tipe/Fungsi**: Komponen / Utilitas

### File: `supabase/migrations/20260601000003_create_avco_tracking.sql`
- **Tipe/Fungsi**: Komponen / Utilitas

### File: `supabase/migrations/20260710_process_barang_masuk.sql`
- **Tipe/Fungsi**: Komponen / Utilitas

### File: `supabase/migrations/20260606000002_process_checkout_piutang.sql`
- **Tipe/Fungsi**: Komponen / Utilitas

### File: `supabase/migrations/20260601000004_create_kas_dan_laporan.sql`
- **Tipe/Fungsi**: Komponen / Utilitas

