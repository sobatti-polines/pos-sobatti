# POS App — Feature To-Do List

> Tracks all missing features from `gap_analysis.md`.
> Mark `[x]` when complete, `[/]` when in progress.
> DB schema is ✅ complete — all items below are **app-level** (UI/API).

---

## 🔴 Critical — Core Business Logic

These affect data correctness and must be fixed first.

- [x] **1. Auto stock deduction on sale**
  - File: `app/api/pos/checkout/route.ts`
  - After saving transaction, deduct stock for items where `hitung_stok = true`
  - Currently stock is never reduced when a sale is made

- [x] **2. Transaction History page**
  - Route: `/dashboard/transactions`
  - Full list of all past sales with search, date range filter, payment method filter
  - Show: No. Transaksi, tanggal, kasir, pelanggan, total, metode bayar, status
  - Subtotals row at top (like the Excel SUBTOTAL function)
  - Click a row to view detail / reprint invoice
  - Add sidebar link

- [x] **3. Delete / Void Transaction**
  - Route: `/dashboard/transactions/void` or modal on transaction history
  - Input: No. Transaksi → preview all items → confirm delete
  - API: Delete rows from `detail_transaksi_keluar` and `transaksi_keluar`
  - Note: spec says stock is NOT auto-restored — manual adjustment needed

- [x] **4. DP / Down Payment flow in POS**
  - When `metode_bayar` is "DP", show DP input field
  - Calculate: `sisa = total - dp`
  - Save `dp` and `sisa` fields to `transaksi_keluar` (columns already exist)
  - Show sisa on invoice

- [x] **5. Per-item discount in POS**
  - When a cart item is selected, allow setting per-item discount via numpad
  - Save to `detail_transaksi_keluar.diskon_item` (column exists, currently always 0)
  - Update line total: `jumlah = (harga - diskon_item) × qty`
  - Update profit calculation: `profit = (harga_jual - harga_modal) × qty - diskon_item × qty`

---

## 🟠 Important — Missing Modules

New pages/modules that complete the app.

- [x] **6. Stock Opname — Input Form**
  - Route: `/dashboard/inventory/stock-opname`
  - Form: select produk → auto-fill stok sistem → input stok fisik → auto-calc selisih
  - Save to `stok_opname` table (already exists with correct columns)
  - Add sidebar link under Inventaris

- [x] **7. Stock Opname — History page**
  - Route: `/dashboard/inventory/stock-opname/history`
  - List all past opname records with date filter
  - Show: tanggal, produk, stok sistem, stok fisik, selisih, keterangan

- [x] **8. Barang Masuk — History page**
  - Route: `/dashboard/inventory/stock-in/history`
  - List all past stock-in records with date/supplier filter
  - Show: tanggal, supplier, produk, harga beli, jumlah, total
  - Subtotals for total nilai

- [x] **9. Store Settings page**
  - Route: `/dashboard/settings/store`
  - Sections:
    - [x] Store Info: nama_toko, alamat, telepon, email
    - [x] Transaction Config: metode_diskon, pajak_persen, jenis_nota, metode_cetak, logo_nota
    - [x] Bank Info: bank1 & bank2 (nama, rekening, atas_nama)
    - [x] Footer Config: footer_struk 1-3, footer_invoice 1-3, hormat_kami_nama
  - Read/write from `pengaturan` table (id=1)

- [x] **10. Reports page**
  - Route: `/dashboard/reports`
  - Sidebar link already exists (currently dead link)
  - Sections:
    - [x] Sales report: daily/weekly/monthly revenue, order count, avg ticket
    - [x] Profit report: total profit by date range
    - [x] Stock report: current stock levels, stock value (harga_modal × stok)
    - [x] Top products: best sellers by qty and revenue

- [ ] **11. Customer Management page**
  - Route: `/dashboard/customers`
  - CRUD: add/edit/delete customers
  - Show: nama, alamat, no_hp, email, keterangan
  - Protect UMUM row from deletion
  - Add sidebar link

- [ ] **12. Supplier Management page**
  - Route: `/dashboard/suppliers`
  - CRUD: add/edit/delete suppliers
  - Show: nama_supplier, alamat, telepon, email, keterangan
  - Add sidebar link

---

## 🟡 Nice-to-have — Full Spec Parity

Polish items for full feature parity with the Excel VBA version.

- [ ] **13. Promo pricing tier in POS**
  - Add "Promo" option to price type selector (alongside Satuan/Grosir)
  - Use `produk.harga_jual_promo` (column already exists, all NULL currently)
  - Add promo price field to inventory product form

- [ ] **14. Manual price option in POS**
  - Add "Harga Manual" option to price type selector
  - Let cashier type a custom price via numpad for the selected item

- [ ] **15. Terbilang function**
  - Create `lib/terbilang.ts` — convert number to Indonesian words
  - Example: `terbilang(164600)` → "Seratus Enam Puluh Empat Ribu Enam Ratus Rupiah"
  - Display on all invoice/receipt formats

- [ ] **16. Thermal receipt (58mm) format**
  - Create narrow receipt layout at `/pos/invoice/[id]/receipt`
  - 58mm width, monospace font, compact layout
  - Show: store name, date, items, totals, footer, terbilang

- [ ] **17. Faktur Penjualan format**
  - Add header variant to invoice page: "FAKTUR PENJUALAN" instead of "INVOICE"
  - Toggle based on `pengaturan.jenis_nota` or manual selection

- [ ] **18. User Management page (admin only)**
  - Route: `/dashboard/settings/users`
  - CRUD: add/edit/delete users, set level (ADMIN/KASIR/OWNER)
  - Create corresponding Supabase Auth accounts
  - Only visible to ADMIN/OWNER roles

- [ ] **19. Category / Unit / Payment Method management**
  - Route: `/dashboard/settings/reference-data`
  - Three tabs or sections:
    - [ ] Kategori — add/edit/delete categories
    - [ ] Satuan — add/edit/delete units
    - [ ] Metode Bayar — add/edit/delete payment methods

- [ ] **20. Invoice pulls store info from pengaturan**
  - Fetch `pengaturan` row on invoice page
  - Display: store name, address, phone, email in header
  - Display: footer text from pengaturan
  - Display: bank info if available

- [ ] **21. Configurable tax rate**
  - Fetch `pengaturan.pajak_persen` on POS page (replace hardcoded `TAX_RATE = 0.0`)
  - Apply tax to subtotal in checkout calculation
  - Show tax line on invoice

- [ ] **22. Post-checkout redirect to invoice**
  - After successful checkout in POS, redirect to `/pos/invoice/[id]`
  - Or show a modal with print option and "New Transaction" button

- [ ] **23. Nominal discount support**
  - Read `pengaturan.metode_diskon` ("Nominal" or "Persen")
  - If "Nominal": discount input is in Rupiah, not percentage
  - Update POS UI and checkout API accordingly

---

## Progress Tracker

| Priority | Total | Done | Remaining |
|----------|-------|------|-----------|
| 🔴 Critical | 5 | 0 | 5 |
| 🟠 Important | 7 | 0 | 7 |
| 🟡 Nice-to-have | 11 | 0 | 11 |
| **Total** | **23** | **0** | **23** |

> Last updated: 2026-05-23
