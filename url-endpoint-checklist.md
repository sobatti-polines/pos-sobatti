# Checklist Verifikasi URL — POS Sobatti

Cara pakai:
1. Login dengan role yang sesuai pada tiap blok.
2. Buka tiap URL satu per satu, centang [x] jika halaman tampil normal tanpa error.
3. Periksa: data ter-load, tombol/navigasi berfungsi, akses role sesuai.
4. Tulis masalah pada kolom catatan bila ada.

Legenda status: `[ ]` belum dicek · `[x]` OK · `[!]` ada masalah

Format tiap item: `nama — URL — path file`

## Role OWNER (29 halaman)

- [x] **dashboard** — /dashboard — `app/dashboard/page.tsx`
- [x] **transactions** — /dashboard/transactions — `app/dashboard/transactions/page.tsx`
- [x] **customers** — /dashboard/customers — `app/dashboard/customers/page.tsx`
- [x] **suppliers** — /dashboard/suppliers — `app/dashboard/suppliers/page.tsx`
- [x] **inventory** — /dashboard/inventory — `app/dashboard/inventory/page.tsx`
- [x] **stock-in** — /dashboard/inventory/stock-in — `app/dashboard/inventory/stock-in/page.tsx`
- [x] **stock-in-history** — /dashboard/inventory/stock-in/history — `app/dashboard/inventory/stock-in/history/page.tsx`
- [x] **stock-opname** — /dashboard/inventory/stock-opname — `app/dashboard/inventory/stock-opname/page.tsx`
- [x] **stock-opname-history** — /dashboard/inventory/stock-opname/history — `app/dashboard/inventory/stock-opname/history/page.tsx`
- [x] **reports** — /dashboard/reports — `app/dashboard/reports/page.tsx`
- [x] **laba-rugi** — /dashboard/laporan/laba-rugi — `app/dashboard/laporan/laba-rugi/page.tsx`
- [x] **neraca** — /dashboard/laporan/neraca — `app/dashboard/laporan/neraca/page.tsx`
- [x] **tutup-kasir** — /dashboard/tutup-kasir — `app/dashboard/tutup-kasir/page.tsx`
- [x] **laporan-kasir** — /dashboard/laporan-kasir — `app/dashboard/laporan-kasir/page.tsx`
- [x] **label-generator** — /dashboard/label-generator — `app/dashboard/label-generator/page.tsx`
- [x] **product-label** — /dashboard/product-label — `app/dashboard/product-label/page.tsx`
- [x] **log-aktivitas** — /dashboard/log-aktivitas — `app/dashboard/log-aktivitas/page.tsx`
- [x] **attendance-scan** — /dashboard/attendance/scan — `app/dashboard/attendance/scan/page.tsx`
- [x] **attendance-history** — /dashboard/attendance/history — `app/dashboard/attendance/history/page.tsx`
- [x] **attendance-generate-qr** — /dashboard/attendance/generate-qr — `app/dashboard/attendance/generate-qr/page.tsx`
- [x] **attendance-report** — /dashboard/attendance/report — `app/dashboard/attendance/report/page.tsx`
- [x] **settings** — /dashboard/settings — `app/dashboard/settings/page.tsx`
- [x] **settings-users** — /dashboard/settings/users — `app/dashboard/settings/users/page.tsx`
- [x] **settings-reference-data** — /dashboard/settings/reference-data — `app/dashboard/settings/reference-data/page.tsx`
- [x] **settings-keuangan** — /dashboard/settings/keuangan — `app/dashboard/settings/keuangan/page.tsx`
- [!] **pos** — /pos — `app/pos/page.tsx`
- [x] **invoice** — /pos/invoice/[id] — `app/pos/invoice/[id]/page.tsx`
- [x] **receipt** — /pos/invoice/[id]/receipt — `app/pos/invoice/[id]/receipt/page.tsx`
- [x] **test-barcode** — /pos/test-barcode — `app/pos/test-barcode/page.tsx`

## Role ADMIN (26 halaman)

> Catatan: Khusus OWNER: attendance-report, settings-users, attendance-generate-qr

- [x] **dashboard** — /dashboard — `app/dashboard/page.tsx`
- [x] **transactions** — /dashboard/transactions — `app/dashboard/transactions/page.tsx`
- [x] **customers** — /dashboard/customers — `app/dashboard/customers/page.tsx`
- [x] **suppliers** — /dashboard/suppliers — `app/dashboard/suppliers/page.tsx`
- [x] **inventory** — /dashboard/inventory — `app/dashboard/inventory/page.tsx`
- [x] **stock-in** — /dashboard/inventory/stock-in — `app/dashboard/inventory/stock-in/page.tsx`
- [x] **stock-in-history** — /dashboard/inventory/stock-in/history — `app/dashboard/inventory/stock-in/history/page.tsx`
- [x] **stock-opname** — /dashboard/inventory/stock-opname — `app/dashboard/inventory/stock-opname/page.tsx`
- [x] **stock-opname-history** — /dashboard/inventory/stock-opname/history — `app/dashboard/inventory/stock-opname/history/page.tsx`
- [x] **reports** — /dashboard/reports — `app/dashboard/reports/page.tsx`
- [x] **laba-rugi** — /dashboard/laporan/laba-rugi — `app/dashboard/laporan/laba-rugi/page.tsx`
- [x] **neraca** — /dashboard/laporan/neraca — `app/dashboard/laporan/neraca/page.tsx`
- [x] **tutup-kasir** — /dashboard/tutup-kasir — `app/dashboard/tutup-kasir/page.tsx`
- [x] **laporan-kasir** — /dashboard/laporan-kasir — `app/dashboard/laporan-kasir/page.tsx`
- [x] **label-generator** — /dashboard/label-generator — `app/dashboard/label-generator/page.tsx`
- [x] **product-label** — /dashboard/product-label — `app/dashboard/product-label/page.tsx`
- [x] **log-aktivitas** — /dashboard/log-aktivitas — `app/dashboard/log-aktivitas/page.tsx`
- [x] **attendance-scan** — /dashboard/attendance/scan — `app/dashboard/attendance/scan/page.tsx`
- [x] **attendance-history** — /dashboard/attendance/history — `app/dashboard/attendance/history/page.tsx`
- [x] **settings** — /dashboard/settings — `app/dashboard/settings/page.tsx`
- [x] **settings-reference-data** — /dashboard/settings/reference-data — `app/dashboard/settings/reference-data/page.tsx`
- [x] **settings-keuangan** — /dashboard/settings/keuangan — `app/dashboard/settings/keuangan/page.tsx`
- [!] **pos** — /pos — `app/pos/page.tsx`
- [x] **invoice** — /pos/invoice/[id] — `app/pos/invoice/[id]/page.tsx`
- [x] **receipt** — /pos/invoice/[id]/receipt — `app/pos/invoice/[id]/receipt/page.tsx`
- [x] **test-barcode** — /pos/test-barcode — `app/pos/test-barcode/page.tsx`

## Role KASIR (4 halaman)

> Catatan: Catatan: /dashboard/* diblokir layout (redirect ke /pos)

- [x] **pos** — /pos — `app/pos/page.tsx`
- [x] **invoice** — /pos/invoice/[id] — `app/pos/invoice/[id]/page.tsx`
- [x] **receipt** — /pos/invoice/[id]/receipt — `app/pos/invoice/[id]/receipt/page.tsx`
- [x] **test-barcode** — /pos/test-barcode — `app/pos/test-barcode/page.tsx`

## Role KARYAWAN (1 halaman)

> Catatan: CATATAN BUG: dashboard/layout.tsx redirect KARYAWAN ke
> Catatan: /attendance/scan yang TIDAK ADA (harusnya /dashboard/attendance/scan).
> Catatan: Saat ini KARYAWAN tidak bisa mengakses halaman apa pun (404).

- [ ] **attendance-scan** — /dashboard/attendance/scan — `app/dashboard/attendance/scan/page.tsx`

## Role PUBLIC (tanpa login) (5 halaman)

- [ ] **login** — / — `app/page.tsx`
- [ ] **demo-price-tag** — /demo-price-tag — `app/demo-price-tag/page.tsx`
- [ ] **scanner-hp** — /scanner/[sessionId] — `app/scanner/[sessionId]/page.tsx`
- [ ] **label-generator** — /label-generator — `app/label-generator/page.tsx`
- [ ] **not-found** — /404 — `app/not-found.tsx`

## API Endpoints (22)

- [ ] `POST /api/auth/login` — auth-login — `app/api/auth/login/route.ts`
- [ ] `POST /api/pos/checkout` — pos-checkout — `app/api/pos/checkout/route.ts`
- [ ] `GET /api/pos/products` — pos-products — `app/api/pos/products/route.ts`
- [ ] `GET /api/pos/customers` — pos-customers — `app/api/pos/customers/route.ts`
- [ ] `GET /api/pos/member-search` — pos-member-search — `app/api/pos/member-search/route.ts`
- [ ] `POST /api/pos/member-register` — pos-member-register — `app/api/pos/member-register/route.ts`
- [ ] `GET /api/pos/payment-methods` — pos-payment-methods — `app/api/pos/payment-methods/route.ts`
- [ ] `GET /api/pos/barcode` — pos-barcode — `app/api/pos/barcode/route.ts`
- [ ] `POST /api/attendance/checkin` — attendance-checkin — `app/api/attendance/checkin/route.ts`
- [ ] `POST /api/attendance/checkout` — attendance-checkout — `app/api/attendance/checkout/route.ts`
- [ ] `GET /api/attendance/today` — attendance-today — `app/api/attendance/today/route.ts`
- [ ] `GET /api/attendance/history` — attendance-history — `app/api/attendance/history/route.ts`
- [ ] `POST /api/attendance/generate-qr` — attendance-generate-qr — `app/api/attendance/generate-qr/route.ts`
- [ ] `GET /api/admin/attendance` — admin-attendance — `app/api/admin/attendance/route.ts`
- [ ] `GET /api/laporan/penjualan` — laporan-penjualan — `app/api/laporan/penjualan/route.ts`
- [ ] `GET /api/laporan/penjualan/[id]` — laporan-penjualan-id — `app/api/laporan/penjualan/[id]/route.ts`
- [ ] `GET /api/laporan/penjualan/rekap` — laporan-penjualan-rekap — `app/api/laporan/penjualan/rekap/route.ts`
- [ ] `GET /api/laporan/penjualan/export` — laporan-penjualan-export — `app/api/laporan/penjualan/export/route.ts`
- [ ] `GET /api/low-stock` — low-stock — `app/api/low-stock/route.ts`
- [ ] `GET /api/network-ip` — network-ip — `app/api/network-ip/route.ts`
- [ ] `POST /api/scanner/[sessionId]` — scanner-session — `app/api/scanner/[sessionId]/route.ts`
- [ ] `GET /api/scanner/[sessionId]/events` — scanner-session-events — `app/api/scanner/[sessionId]/events/route.ts`

---
## Ringkasan
- Total halaman: 65
- Total API: 22
- Total item yang dicek: 87
