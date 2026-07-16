# 2. Database dan Pemetaan Form

Analisis ini memetakan tabel pada database ke komponen/form mana yang berinteraksi dengannya.

## Tabel: `absensi`
- **Pages**: app/dashboard/attendance/history/page.tsx, app/dashboard/attendance/report/page.tsx
- **API Routes**: app/api/attendance/history/route.ts, app/api/attendance/checkout/route.ts, app/api/attendance/checkin/route.ts, app/api/admin/attendance/route.ts
- **Lib/Utils**: lib/attendance.ts


## Tabel: `barang_masuk`
- **Pages**: app/dashboard/inventory/stock-in/history/page.tsx
- **Components/Forms**: app/dashboard/inventory/actions.ts, session-ses_0b4e.md
- **Lib/Utils**: lib/laporan-kasir.ts


## Tabel: `detail_transaksi_keluar`
- **Pages**: app/dashboard/reports/page.tsx, app/pos/invoice/[id]/page.tsx, app/pos/invoice/[id]/receipt/page.tsx
- **Components/Forms**: app/dashboard/transactions/actions.ts
- **Lib/Utils**: lib/dashboard.ts


## Tabel: `hutang_dagang`
- **Pages**: app/dashboard/hutang/page.tsx
- **Components/Forms**: session-ses_0b4e.md
- **Lib/Utils**: lib/laporan-kasir.ts, lib/laporan-keuangan.ts, lib/hutang.ts


## Tabel: `kategori`
- **Pages**: app/dashboard/settings/reference-data/page.tsx, app/dashboard/inventory/page.tsx


## Tabel: `metode_bayar`
- **Pages**: app/dashboard/settings/reference-data/page.tsx, app/dashboard/hutang/page.tsx, app/dashboard/piutang/page.tsx, app/dashboard/transactions/page.tsx
- **API Routes**: app/api/pos/checkout/route.ts, app/api/pos/payment-methods/route.ts
- **Lib/Utils**: lib/laporan-kasir.ts


## Tabel: `pelanggan`
- **Pages**: app/dashboard/customers/page.tsx
- **Components/Forms**: app/dashboard/customers/actions.ts
- **API Routes**: app/api/pos/customers/route.ts


## Tabel: `pembayaran_hutang`
- **Components/Forms**: session-ses_0b4e.md
- **Lib/Utils**: lib/laporan-kasir.ts, lib/laporan-keuangan.ts, lib/hutang.ts


## Tabel: `pembayaran_piutang`
- **Lib/Utils**: lib/piutang.ts, lib/laporan-kasir.ts, lib/laporan-keuangan.ts


## Tabel: `pengaturan`
- **Pages**: app/dashboard/settings/page.tsx, app/pos/page.tsx, app/pos/invoice/[id]/page.tsx, app/pos/invoice/[id]/receipt/page.tsx
- **Components/Forms**: app/dashboard/settings/store-actions.ts
- **API Routes**: app/api/pos/checkout/route.ts


## Tabel: `pengaturan_keuangan`
- **Pages**: app/dashboard/settings/keuangan/page.tsx
- **Components/Forms**: app/dashboard/settings/keuangan/actions.ts
- **Lib/Utils**: lib/laporan-kasir.ts, lib/laporan-keuangan.ts


## Tabel: `pengguna`
- **Pages**: app/dashboard/settings/users/page.tsx, app/dashboard/attendance/history/page.tsx, app/pos/page.tsx
- **Components/Forms**: app/dashboard/settings/actions.ts, app/dashboard/settings/users/actions.ts, app/dashboard/hutang/actions.ts, app/dashboard/piutang/actions.ts, app/dashboard/tutup-kasir/actions.ts
- **API Routes**: app/api/auth/login/route.ts, app/api/attendance/generate-qr/route.ts, app/api/attendance/history/route.ts, app/api/attendance/checkout/route.ts, app/api/attendance/checkin/route.ts, app/api/admin/attendance/route.ts, app/api/pos/checkout/route.ts
- **Lib/Utils**: lib/attendance.ts


## Tabel: `piutang_dagang`
- **Pages**: app/dashboard/piutang/page.tsx
- **Lib/Utils**: lib/piutang.ts, lib/laporan-keuangan.ts


## Tabel: `produk`
- **Pages**: app/dashboard/inventory/page.tsx, app/dashboard/inventory/stock-opname/page.tsx, app/dashboard/inventory/stock-in/page.tsx, app/dashboard/reports/page.tsx
- **Components/Forms**: app/dashboard/inventory/actions.ts, session-ses_0b4e.md, FEATURE_PLAN_AKUNTANSI.md
- **API Routes**: app/api/low-stock/route.ts, app/api/pos/products/route.ts, app/api/pos/barcode/route.ts
- **Lib/Utils**: lib/dashboard.ts, lib/low-stock.ts, lib/avco.ts


## Tabel: `qr_session`
- **API Routes**: app/api/attendance/generate-qr/route.ts, app/api/attendance/checkout/route.ts, app/api/attendance/checkin/route.ts


## Tabel: `riwayat_avco`
- **Components/Forms**: app/dashboard/inventory/actions.ts, session-ses_0b4e.md
- **Lib/Utils**: lib/avco.ts


## Tabel: `saldo_kas_harian`
- **Pages**: app/dashboard/laporan-kasir/page.tsx
- **Lib/Utils**: lib/laporan-kasir.ts, lib/laporan-keuangan.ts


## Tabel: `satuan`
- **Pages**: app/dashboard/settings/reference-data/page.tsx, app/dashboard/inventory/page.tsx


## Tabel: `stok_opname`
- **Pages**: app/dashboard/inventory/stock-opname/history/page.tsx
- **Components/Forms**: app/dashboard/inventory/stock-opname/actions.ts, session-ses_0b4e.md


## Tabel: `supplier`
- **Pages**: app/dashboard/inventory/stock-in/page.tsx, app/dashboard/inventory/stock-in/history/page.tsx, app/dashboard/suppliers/page.tsx
- **Components/Forms**: app/dashboard/suppliers/actions.ts, session-ses_0b4e.md


## Tabel: `table`
- **Components/Forms**: session-ses_0b4e.md


## Tabel: `transaksi_keluar`
- **Pages**: app/dashboard/transactions/page.tsx, app/dashboard/reports/page.tsx, app/pos/invoice/[id]/page.tsx, app/pos/invoice/[id]/receipt/page.tsx
- **Components/Forms**: app/dashboard/transactions/actions.ts
- **Lib/Utils**: lib/dashboard.ts, lib/laporan-kasir.ts, lib/laporan-keuangan.ts


