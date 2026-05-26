# POS App: Spec vs. Implementation Gap Analysis

> Comparison of `pos_app_spec.md` (VBA Excel POS v3.0.5) against the current Next.js + Supabase implementation.

---

## Legend

| Status | Meaning |
|--------|---------|
| ✅ Done | Feature is fully implemented |
| ⚠️ Partial | Core feature exists but missing key parts from the spec |
| ❌ Missing | Feature has not been implemented at all |

---

## 1. Master Data (Sheets 1–4)

| Spec Feature | Status | Notes |
|---|---|---|
| **Sheet 1: Manajemen Pengguna** | ⚠️ Partial | Users exist in `pengguna` table with username, password, level. Auth works via Supabase Auth. **Missing:** No admin UI to manage users (add/edit/delete users, change roles). Settings page only allows editing own profile. |
| **Sheet 2: Daftar Produk** | ⚠️ Partial | Product CRUD is fully implemented in `/dashboard/inventory`. **Missing:** `harga_jual_promo` column — spec defines 3 price tiers (Satuan, Grosir, Promo) but the DB/app only has Satuan and Grosir. |
| **Sheet 3: Daftar Supplier** | ✅ Done | Supplier data exists in the database and is used in the Stock-In module. **Missing:** No dedicated CRUD management page for suppliers in the dashboard. |
| **Sheet 4: Daftar Pelanggan** | ⚠️ Partial | Customers exist in DB and are selectable during POS checkout. **Missing:** No dedicated CRUD management page for customers. No default `UMUM` row enforcement. |

---

## 2. Operational Modules (Sheets 5, 9, 10, 13)

| Spec Feature | Status | Notes |
|---|---|---|
| **Sheet 5: Transaksi Kasir (POS)** | ⚠️ Partial | The POS cashier page (`/pos`) is fully functional with product search, cart, numpad, customer selection, payment method, discounts, checkout, and barcode scanner. **Missing features:** |
| | | • **Harga Jual Promo** — No promo pricing tier |
| | | • **Harga Manual** — Cashier cannot input a custom manual price |
| | | • **Per-item discount** — Spec allows per-item discount editing at POS; currently only global discount (%) is supported. The `diskon_item` field exists in the DB but is always `0` |
| | | • **DP / Down Payment flow** — DB fields exist (dp, sisa) but the POS UI has no way to specify a partial/DP payment. Currently only full Tunai payment logic works |
| | | • **Auto stock deduction** — The checkout API does NOT deduct stock from products when `hitung_stok = true`. Only transaction records are saved |
| **Sheet 9: Hapus Transaksi Keluar** | ❌ Missing | No UI or API to delete/void a transaction. No way to correct erroneous transactions |
| **Sheet 10: Input Stok Opname** | ❌ Missing | No stock opname (physical inventory count) form exists. The `stok_opname` table exists in the DB but no UI or API has been built |
| **Sheet 13: Input Barang Masuk** | ✅ Done | Fully implemented at `/dashboard/inventory/stock-in` with supplier selection, multi-row input, product search, and validation |

---

## 3. Database / History Views (Sheets 6, 8, 11, 14)

| Spec Feature | Status | Notes |
|---|---|---|
| **Sheet 6: Daftar Transaksi Keluar** | ⚠️ Partial | Recent transactions appear on the dashboard. **Missing:** No dedicated full transaction history page with filtering, search, date range, subtotals, and autofilter |
| **Sheet 8: Detail Transaksi Keluar** | ⚠️ Partial | Transaction detail data exists in the DB and is shown on the invoice page. **Missing:** No browsable detail view outside of the invoice |
| **Sheet 11: Daftar Stok Opname** | ❌ Missing | No stock opname history page |
| **Sheet 14: Daftar Barang Masuk** | ❌ Missing | No history/list page for past stock-in entries. The data is in the DB but there's no UI to browse/filter past receiving records |

---

## 4. Output / Printing (Sheet 7)

| Spec Feature | Status | Notes |
|---|---|---|
| **Sheet 7: Cetak Nota (Invoice)** | ⚠️ Partial | Invoice page exists at `/pos/invoice/[id]` with a printable layout and a Print button. **Missing:** |
| | | • **Struk Kasir 58mm format** — Only the Invoice format is implemented; no thermal receipt layout |
| | | • **Faktur Penjualan format** — No separate "Faktur" header variant |
| | | • **Terbilang (number to words)** — Not implemented. Spec requires Indonesian number-to-words on all receipts |
| | | • **Store info on invoice** — Invoice doesn't pull store name/address/phone from the `pengaturan` table |
| | | • **Configurable nota footer** — Footer text from `pengaturan` table is not used |
| | | • **Post-checkout redirect to invoice** — After checkout, no automatic navigation to the invoice for printing |

---

## 5. Configuration (Sheet 12)

| Spec Feature | Status | Notes |
|---|---|---|
| **Sheet 12: Pengaturan (Settings)** | ⚠️ Partial | The `pengaturan` table exists in the DB with store info, discount method, footer text, etc. The Settings page (`/dashboard/settings`) only manages user profile (username/password). **Missing:** |
| | | • **Store Info management** — No UI to edit store name, address, phone, email |
| | | • **Transaction Config** — No UI for discount method (Nominal vs Persen), tax rate, nota type, print method, logo toggle |
| | | • **Bank Info** — No UI for bank account details |
| | | • **Footer Config** — No UI for customizing nota footer text |
| | | • **Kasir aktif** — No UI for setting active cashier name |

---

## 6. Reference Tables (Sheets 15–17)

| Spec Feature | Status | Notes |
|---|---|---|
| **Sheet 15: Tabel Kategori** | ⚠️ Partial | Categories exist in DB and are used as dropdowns in Inventory. **Missing:** No dedicated admin page to add/edit/delete categories |
| **Sheet 16: Tabel Satuan** | ⚠️ Partial | Units exist in DB and are used in Inventory. **Missing:** No dedicated admin page to add/edit/delete units |
| **Sheet 17: Tabel Metode Bayar** | ⚠️ Partial | Payment methods exist in DB and appear in POS. **Missing:** No admin page to manage payment methods |

---

## 7. Business Logic Gaps

| Rule from Spec | Status | Notes |
|---|---|---|
| **Auto stock deduction on sale** | ❌ Missing | `checkout/route.ts` saves transaction but does NOT update product stock. Spec says: "stok produk berkurang sebesar qty terjual (jika `Hitung Stok = YA`)" |
| **Auto stock addition on barang masuk** | ✅ Done | Stock-in action correctly creates records (stock is calculated dynamically from `barang_masuk` - `detail_transaksi_keluar`) |
| **Stock is calculated, not stored** | ✅ Done | Stock is computed dynamically (sum of `barang_masuk.jumlah` − sum of `detail_transaksi_keluar.qty`), not stored as a column on `produk` |
| **Tax/PPn calculation** | ⚠️ Partial | `TAX_RATE = 0.0` is hardcoded in POS page. DB has `pajak_persen`/`pajak_nominal` fields but no configurable tax. Spec requires configurable tax from `pengaturan` |
| **Discount method (Nominal vs Persen)** | ⚠️ Partial | Only percent discount is implemented in POS. Spec supports both Nominal and Persen modes from `pengaturan.metode_diskon` |
| **Per-item discount** | ❌ Missing | DB field exists (`diskon_item`) but POS UI doesn't allow editing it — always sets to `0` |
| **DP / Down Payment flow** | ❌ Missing | DB columns exist (`dp`, `sisa`) but POS UI does not support partial payment or DP workflow |
| **Terbilangku() function** | ❌ Missing | No number-to-Indonesian-words conversion anywhere in the codebase |
| **Profit calculation** | ✅ Done | Checkout API computes `profit = (harga_jual - harga_modal) × qty`. Spec also subtracts item discount but currently item discount is always `0` |

---

## 8. Dashboard Pages Referenced in Sidebar but Not Implemented

| Page | Status |
|---|---|
| `/dashboard/reports` (Laporan) | ❌ Missing — Sidebar link exists but no page |
| `/dashboard/support` (Bantuan) | ❌ Missing — Sidebar link exists but no page |

---

## Summary: What's Missing (Prioritized)

### 🔴 Critical (Core business logic gaps)

1. **Auto stock deduction on sale** — Checkout doesn't deduct stock
2. **Transaction History page** — No way to browse/search/filter all past sales
3. **Delete/Void Transaction** — No correction mechanism for wrong transactions
4. **DP/Down Payment UI** — Partial payment flow in POS
5. **Per-item discount editing in POS** — Always hardcoded to 0

### 🟠 Important (Missing modules)

6. **Stock Opname** — Input form + history view
7. **Barang Masuk History** — List page for past stock-in entries
8. **Store Settings page** — Manage store info, tax, discount method, nota config, bank info
9. **Reports page** — Sales analytics, profit reports, stock reports
10. **Customer CRUD page** — Add/edit/delete customers
11. **Supplier CRUD page** — Add/edit/delete suppliers

### 🟡 Nice-to-have (Feature parity with spec)

12. **Promo pricing tier** (`harga_jual_promo`) — DB + UI
13. **Manual price option** at POS
14. **Terbilang function** — Indonesian number-to-words on invoices
15. **Thermal receipt (58mm) format** for printing
16. **Faktur Penjualan** variant of the invoice
17. **User Management page** — Admin CRUD for users/roles
18. **Category/Unit/Payment method management pages**
19. **Invoice pulls store info** from `pengaturan` table
20. **Configurable tax rate** from settings
21. **Post-checkout → auto-redirect to invoice for printing**
