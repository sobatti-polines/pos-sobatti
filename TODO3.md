# POS App — Accounting Module To-Do List

> Tracks all implementation steps from `FEATURE_PLAN_AKUNTANSI.md`.
> Mark `[x]` when complete, `[/]` when in progress.
> **NOTE:** All SQL migrations mentioned must be run manually in Supabase by the user.
> **NOTE:** Read first database.MD file for better understanding of the database schema.

---

## 🔴 Critical — Database & AVCO Foundation (Phase 1)

These form the core of the accounting logic, adjusting COGS (Cost of Goods Sold / HPP) and inventory valuation.

- [x] **1. Manual SQL Migrations**
  - Run `20260601000001_add_accounting_fields.sql` (Add AVCO fields to `produk`, `transaksi_keluar`, `detail_transaksi_keluar`).
  - Run `20260601000002_create_hutang_piutang.sql` (Create AP/AR and payment tables).
  - Run `20260601000003_create_avco_tracking.sql` (Create `riwayat_avco` table).
  - Run `20260601000004_create_kas_dan_laporan.sql` (Create daily cash and financial settings tables).
  - *Database Adjustment Note:* You must also manually update the existing `process_checkout` Postgres function to correctly populate the new `total_hpp`, `laba_kotor`, and `harga_pokok_satuan` fields during transactions.

- [x] **2. AVCO (Average Cost) Logic**
  - Create `lib/avco.ts` with `calculateNewAVCO()` and `recordAVCOMutation()`.
  - Update Stock-In (`Barang Masuk`) flow in `lib/pembelian.ts` to trigger the AVCO calculation upon receiving goods.
  - Update POS Checkout API to ensure the AVCO snapshot (COGS) is accurately passed to the database transaction.

---

## 🟠 Important — Payables, Receivables & Daily Cash (Phase 2)

Managing debts, credits, and cashier shifts.

- [x] **3. Accounts Payable (Hutang Dagang) Module**
  - Create `lib/hutang.ts` (`createHutang`, `bayarHutang`, `getHutangList`).
  - Update Stock-In flow: automatically create Accounts Payable if the payment method is "Credit/Tempo".
  - Create UI: `/dashboard/hutang` (List view, detail view, and debt payment form).

- [x] **4. Accounts Receivable (Piutang Dagang) Module**
  - Create `lib/piutang.ts` (`createPiutang`, `bayarPiutang`, `getPiutangList`).
  - Update POS Checkout flow: automatically create Accounts Receivable if the payment method is "Credit" or "DP" (Down Payment).
  - Create UI: `/dashboard/piutang` (List view, detail view, and receivable payment form).

- [x] **5. Daily Cashier Report (Laporan Kasir Harian)**
  - Create `lib/laporan-kasir.ts` (`generateLaporanKasir`, `konfirmasiTutupKasir`).
  - Create UI: `/dashboard/tutup-kasir` for end-of-shift cash reconciliation (input actual cash in drawer, calculate over/short).
  - Create UI: `/dashboard/laporan-kasir` (List of daily reports, detail view, print button).

---

## 🟡 Nice-to-have — Financial Reports & Polish (Phase 3)

Generating formal accounting reports using the Partial Integration mode.

- [x] **6. Profit & Loss Report (Laba Rugi)**
  - Create `lib/laporan-keuangan.ts` with `generateLabaRugi(startDate, endDate)`.
  - Create UI: `/dashboard/laporan/laba-rugi` (Period selector, P&L table).

- [x] **7. Balance Sheet (Neraca)**
  - Create UI for initial setup: Input Initial Capital (Modal Awal) into `pengaturan_keuangan`.
  - Add `generateNeraca(date)` to `lib/laporan-keuangan.ts`.
  - Create UI: `/dashboard/laporan/neraca` (Ensure Total Assets = Total Liabilities + Total Equity).

- [x] **8. Polish & Print**
  - Build print layouts (CSS print media queries or jsPDF) for the Cashier Report, P&L, and Balance Sheet.
  - Add "Export to Excel/CSV" functionality for all financial reports.

---

## Progress Tracker

| Priority | Total | Done | Remaining |
|----------|-------|------|-----------|
| 🔴 Critical | 2 | 2 | 0 |
| 🟠 Important | 3 | 3 | 0 |
| 🟡 Nice-to-have | 3 | 3 | 0 |
| **Total** | **8** | **8** | **0** |

> Last updated: 2026-06-06
