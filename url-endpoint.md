# URL & Endpoint — POS Sobatti
# Semua URL menggunakan localhost:3000 (dev server Next.js)
# Format: role <ROLE> / <nama halaman> / <url>
# Total 33 halaman + 22 API endpoint

# ============================================================
# BLOCK 1: OWNER — akses penuh (29 halaman)
# ============================================================

role owner
dashboard
http://localhost:3000/dashboard

role owner
transactions
http://localhost:3000/dashboard/transactions

role owner
customers
http://localhost:3000/dashboard/customers

role owner
suppliers
http://localhost:3000/dashboard/suppliers

role owner
inventory
http://localhost:3000/dashboard/inventory

role owner
stock-in
http://localhost:3000/dashboard/inventory/stock-in

role owner
stock-in-history
http://localhost:3000/dashboard/inventory/stock-in/history

role owner
stock-opname
http://localhost:3000/dashboard/inventory/stock-opname

role owner
stock-opname-history
http://localhost:3000/dashboard/inventory/stock-opname/history

role owner
reports
http://localhost:3000/dashboard/reports

role owner
laba-rugi
http://localhost:3000/dashboard/laporan/laba-rugi

role owner
neraca
http://localhost:3000/dashboard/laporan/neraca

role owner
tutup-kasir
http://localhost:3000/dashboard/tutup-kasir

role owner
laporan-kasir
http://localhost:3000/dashboard/laporan-kasir

role owner
label-generator
http://localhost:3000/dashboard/label-generator

role owner
product-label
http://localhost:3000/dashboard/product-label

role owner
log-aktivitas
http://localhost:3000/dashboard/log-aktivitas

role owner
attendance-scan
http://localhost:3000/dashboard/attendance/scan

role owner
attendance-history
http://localhost:3000/dashboard/attendance/history

role owner
attendance-generate-qr
http://localhost:3000/dashboard/attendance/generate-qr

role owner
attendance-report
http://localhost:3000/dashboard/attendance/report

role owner
settings
http://localhost:3000/dashboard/settings

role owner
settings-users
http://localhost:3000/dashboard/settings/users

role owner
settings-reference-data
http://localhost:3000/dashboard/settings/reference-data

role owner
settings-keuangan
http://localhost:3000/dashboard/settings/keuangan

role owner
pos
http://localhost:3000/pos

role owner
invoice
http://localhost:3000/pos/invoice/[id]

role owner
receipt
http://localhost:3000/pos/invoice/[id]/receipt

role owner
test-barcode
http://localhost:3000/pos/test-barcode

# ============================================================
# BLOCK 2: ADMIN — semua halaman dashboard minus 3 (26 halaman)
# Khusus OWNER: attendance-report, settings-users, attendance-generate-qr
# ============================================================

role admin
dashboard
http://localhost:3000/dashboard

role admin
transactions
http://localhost:3000/dashboard/transactions

role admin
customers
http://localhost:3000/dashboard/customers

role admin
suppliers
http://localhost:3000/dashboard/suppliers

role admin
inventory
http://localhost:3000/dashboard/inventory

role admin
stock-in
http://localhost:3000/dashboard/inventory/stock-in

role admin
stock-in-history
http://localhost:3000/dashboard/inventory/stock-in/history

role admin
stock-opname
http://localhost:3000/dashboard/inventory/stock-opname

role admin
stock-opname-history
http://localhost:3000/dashboard/inventory/stock-opname/history

role admin
reports
http://localhost:3000/dashboard/reports

role admin
laba-rugi
http://localhost:3000/dashboard/laporan/laba-rugi

role admin
neraca
http://localhost:3000/dashboard/laporan/neraca

role admin
tutup-kasir
http://localhost:3000/dashboard/tutup-kasir

role admin
laporan-kasir
http://localhost:3000/dashboard/laporan-kasir

role admin
label-generator
http://localhost:3000/dashboard/label-generator

role admin
product-label
http://localhost:3000/dashboard/product-label

role admin
log-aktivitas
http://localhost:3000/dashboard/log-aktivitas

role admin
attendance-scan
http://localhost:3000/dashboard/attendance/scan

role admin
attendance-history
http://localhost:3000/dashboard/attendance/history

role admin
settings
http://localhost:3000/dashboard/settings

role admin
settings-reference-data
http://localhost:3000/dashboard/settings/reference-data

role admin
settings-keuangan
http://localhost:3000/dashboard/settings/keuangan

role admin
pos
http://localhost:3000/pos

role admin
invoice
http://localhost:3000/pos/invoice/[id]

role admin
receipt
http://localhost:3000/pos/invoice/[id]/receipt

role admin
test-barcode
http://localhost:3000/pos/test-barcode

# ============================================================
# BLOCK 3: KASIR (4 halaman)
# Catatan: /dashboard/* diblokir layout (redirect ke /pos)
# ============================================================

role kasir
pos
http://localhost:3000/pos

role kasir
invoice
http://localhost:3000/pos/invoice/[id]

role kasir
receipt
http://localhost:3000/pos/invoice/[id]/receipt

role kasir
test-barcode
http://localhost:3000/pos/test-barcode

# ============================================================
# BLOCK 4: KARYAWAN (1 halaman)
# CATATAN BUG: dashboard/layout.tsx redirect KARYAWAN ke
# /attendance/scan yang TIDAK ADA (harusnya /dashboard/attendance/scan).
# Saat ini KARYAWAN tidak bisa mengakses halaman apa pun (404).
# ============================================================

role karyawan
attendance-scan
http://localhost:3000/dashboard/attendance/scan

# ============================================================
# BLOCK 5: PUBLIC — tanpa login (5 halaman)
# ============================================================

role public
login
http://localhost:3000/

role public
demo-price-tag
http://localhost:3000/demo-price-tag

role public
scanner-hp
http://localhost:3000/scanner/[sessionId]

role public
label-generator
http://localhost:3000/label-generator

role public
not-found
http://localhost:3000/404

# ============================================================
# API ENDPOINTS (22 route handler)
# ============================================================

api
auth-login
http://localhost:3000/api/auth/login

api
pos-checkout
http://localhost:3000/api/pos/checkout

api
pos-products
http://localhost:3000/api/pos/products

api
pos-customers
http://localhost:3000/api/pos/customers

api
pos-member-search
http://localhost:3000/api/pos/member-search

api
pos-member-register
http://localhost:3000/api/pos/member-register

api
pos-payment-methods
http://localhost:3000/api/pos/payment-methods

api
pos-barcode
http://localhost:3000/api/pos/barcode

api
attendance-checkin
http://localhost:3000/api/attendance/checkin

api
attendance-checkout
http://localhost:3000/api/attendance/checkout

api
attendance-today
http://localhost:3000/api/attendance/today

api
attendance-history
http://localhost:3000/api/attendance/history

api
attendance-generate-qr
http://localhost:3000/api/attendance/generate-qr

api
admin-attendance
http://localhost:3000/api/admin/attendance

api
laporan-penjualan
http://localhost:3000/api/laporan/penjualan

api
laporan-penjualan-id
http://localhost:3000/api/laporan/penjualan/[id]

api
laporan-penjualan-rekap
http://localhost:3000/api/laporan/penjualan/rekap

api
laporan-penjualan-export
http://localhost:3000/api/laporan/penjualan/export

api
low-stock
http://localhost:3000/api/low-stock

api
network-ip
http://localhost:3000/api/network-ip

api
scanner-session
http://localhost:3000/api/scanner/[sessionId]

api
scanner-session-events
http://localhost:3000/api/scanner/[sessionId]/events

# ============================================================
# CATATAN & TEMUAN
# ============================================================
# 1. /dashboard/support ada di sidebar tapi TIDAK ADA halamannya (dead link → 404)
# 2. /dashboard/transactions/[id] sudah dihapus (detail via sheet client-side)
# 3. /label-generator redirect ke /dashboard/label-generator
# 4. /api/dashboard/* tidak ada (AGENTS.md outdated) — data dashboard via Supabase client
# 5. KARYAWAN terkunci (bug layout redirect), lihat BLOCK 4
