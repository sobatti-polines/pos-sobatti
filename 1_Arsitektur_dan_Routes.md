# 1. Arsitektur dan Routes

## Route: `/api/admin/attendance`
- **File**: `app/api/admin/attendance/route.ts`
- **Tipe**: API Endpoint
- **Menerima JSON Body?**: Tidak
- **Query Params**: startDate, endDate, page, limit
- **Contoh Response JSON**:
  - `{ error: "Unauthorized" }, { status: 401 }`
  - `{ error: "Forbidden" }, { status: 403 }`
  - `{ error: error.message }, { status: 500 }`
  - `{     data,     count,     page,     limit,   }`
- **Akses Supabase Tables**: absensi, pengguna

## Route: `/api/attendance/checkin`
- **File**: `app/api/attendance/checkin/route.ts`
- **Tipe**: API Endpoint
- **Menerima JSON Body?**: Ya
- **Contoh Response JSON**:
  - `{ error: "Unauthorized" }, { status: 401 }`
  - `{ error: "User profile not found" }, { status: 404 }`
  - `{ error: "Owner cannot perform attendance" }, { status: 403 }`
  - `{ error: "Invalid or inactive QR token" }, { status: 400 }`
  - `{ error: "QR token expired" }, { status: 400 }`
  - `{ error: "Already checked in today" }, { status: 400 }`
  - `{ error: insertError.message }, { status: 500 }`
  - `{       success: true,       message: "Check-in successful",       status,       telat_menit,     }`
  - `{ error: message }, { status: 500 }`
- **Akses Supabase Tables**: absensi, qr_session, pengguna

## Route: `/api/attendance/checkout`
- **File**: `app/api/attendance/checkout/route.ts`
- **Tipe**: API Endpoint
- **Menerima JSON Body?**: Ya
- **Contoh Response JSON**:
  - `{ error: "Unauthorized" }, { status: 401 }`
  - `{ error: "User profile not found" }, { status: 404 }`
  - `{ error: "Owner cannot perform attendance" }, { status: 403 }`
  - `{ error: "Invalid or inactive QR token" }, { status: 400 }`
  - `{ error: "QR token expired" }, { status: 400 }`
  - `{ error: "You haven't checked in today" }, { status: 400 }`
  - `{ error: "Already checked out today" }, { status: 400 }`
  - `{ error: updateError.message }, { status: 500 }`
  - `{       success: true,       message: "Check-out successful",     }`
  - `{ error: message }, { status: 500 }`
- **Akses Supabase Tables**: absensi, qr_session, pengguna

## Route: `/api/attendance/generate-qr`
- **File**: `app/api/attendance/generate-qr/route.ts`
- **Tipe**: API Endpoint
- **Menerima JSON Body?**: Tidak
- **Contoh Response JSON**:
  - `{ error: "Unauthorized" }, { status: 401 }`
  - `{ error: "Forbidden: Owner only" }, { status: 403 }`
  - `{ error: error.message }, { status: 500 }`
  - `{       token: qrSession.token,       expired_at: qrSession.expired_at,       expire_seconds: expire...`
  - `{ error: message }, { status: 500 }`
- **Akses Supabase Tables**: qr_session, pengguna

## Route: `/api/attendance/history`
- **File**: `app/api/attendance/history/route.ts`
- **Tipe**: API Endpoint
- **Menerima JSON Body?**: Tidak
- **Contoh Response JSON**:
  - `{ error: "Unauthorized" }, { status: 401 }`
  - `{ error: "User profile not found" }, { status: 404 }`
  - `{ error: error.message }, { status: 500 }`
  - `history`
- **Akses Supabase Tables**: absensi, pengguna

## Route: `/api/attendance/today`
- **File**: `app/api/attendance/today/route.ts`
- **Tipe**: API Endpoint
- **Menerima JSON Body?**: Tidak
- **Contoh Response JSON**:
  - `{ error: "Unauthorized or User not found" }, { status: 401 }`
  - `data`
  - `{ error: message }, { status: 500 }`

## Route: `/api/auth/login`
- **File**: `app/api/auth/login/route.ts`
- **Tipe**: API Endpoint
- **Menerima JSON Body?**: Ya
- **Contoh Response JSON**:
  - `{ message: "Username/Email and password are required" },       { status: 400 }`
  - `{ ok: true }`
  - `{ message: "Username/Email atau kata sandi salah. Coba lagi." },       { status: 401 }`
  - `{ message: "Akun Anda dinonaktifkan. Silakan hubungi admin." },       { status: 401 }`
  - `{ ok: true, role }, {      headers: response.headers    }`
- **Akses Supabase Tables**: pengguna

## Route: `/api/low-stock`
- **File**: `app/api/low-stock/route.ts`
- **Tipe**: API Endpoint
- **Menerima JSON Body?**: Tidak
- **Contoh Response JSON**:
  - `[]`
  - `[]`
  - `lowStock`
- **Akses Supabase Tables**: produk

## Route: `/api/network-ip`
- **File**: `app/api/network-ip/route.ts`
- **Tipe**: API Endpoint
- **Menerima JSON Body?**: Tidak
- **Contoh Response JSON**:
  - `{ ip }`

## Route: `/api/pos/barcode`
- **File**: `app/api/pos/barcode/route.ts`
- **Tipe**: API Endpoint
- **Menerima JSON Body?**: Tidak
- **Query Params**: code
- **Contoh Response JSON**:
  - `{ error: "code required" }, { status: 400 }`
  - `{ product: barcodeMatch }`
  - `{ product: data }`
  - `{ product: data }`
  - `{ product: null }, { status: 404 }`
- **Akses Supabase Tables**: produk

## Route: `/api/pos/checkout`
- **File**: `app/api/pos/checkout/route.ts`
- **Tipe**: API Endpoint
- **Menerima JSON Body?**: Ya
- **Contoh Response JSON**:
  - `{ error: "Cart is empty" }, { status: 400 }`
  - `{ error: "Unauthorized" }, { status: 401 }`
  - `{ error: "Staff profile not found. Cannot process checkout." },       { status: 403 }`
  - `{ error: error.message }, { status: 500 }`
  - `data`
- **Akses Supabase Tables**: pengaturan, pengguna, metode_bayar

## Route: `/api/pos/customers`
- **File**: `app/api/pos/customers/route.ts`
- **Tipe**: API Endpoint
- **Menerima JSON Body?**: Tidak
- **Contoh Response JSON**:
  - `{ error: error.message }, { status: 500 }`
  - `data ?? []`
- **Akses Supabase Tables**: pelanggan

## Route: `/api/pos/payment-methods`
- **File**: `app/api/pos/payment-methods/route.ts`
- **Tipe**: API Endpoint
- **Menerima JSON Body?**: Tidak
- **Contoh Response JSON**:
  - `{ error: error.message }, { status: 500 }`
  - `data ?? []`
- **Akses Supabase Tables**: metode_bayar

## Route: `/api/pos/products`
- **File**: `app/api/pos/products/route.ts`
- **Tipe**: API Endpoint
- **Menerima JSON Body?**: Tidak
- **Contoh Response JSON**:
  - `{ error: error.message }, { status: 500 }`
  - `data ?? []`
- **Akses Supabase Tables**: produk

## Route: `/api/scanner/[sessionId]/events`
- **File**: `app/api/scanner/[sessionId]/events/route.ts`
- **Tipe**: API Endpoint
- **Menerima JSON Body?**: Tidak

## Route: `/api/scanner/[sessionId]`
- **File**: `app/api/scanner/[sessionId]/route.ts`
- **Tipe**: API Endpoint
- **Menerima JSON Body?**: Ya
- **Contoh Response JSON**:
  - `{ error: "Unauthorized" }, { status: 401 }`
  - `{ error: "barcode required" }, { status: 400 }`
  - `{ ok: true }`

## Route: `/attendance/scan`
- **File**: `app/attendance/scan/page.tsx`
- **Tipe**: UI Page
- **Fetch Calls (External/Internal API)**:
  - `/api/attendance/checkout`
  - `/api/attendance/checkin`

## Route: `/dashboard/attendance/generate-qr`
- **File**: `app/dashboard/attendance/generate-qr/page.tsx`
- **Tipe**: UI Page
- **Fetch Calls (External/Internal API)**:
  - `/api/attendance/generate-qr`

## Route: `/dashboard/attendance/history`
- **File**: `app/dashboard/attendance/history/page.tsx`
- **Tipe**: UI Page
- **Akses Supabase Tables**: absensi, pengguna

## Route: `/dashboard/attendance/report`
- **File**: `app/dashboard/attendance/report/page.tsx`
- **Tipe**: UI Page
- **Akses Supabase Tables**: absensi

## Route: `/dashboard/customers`
- **File**: `app/dashboard/customers/page.tsx`
- **Tipe**: UI Page
- **Akses Supabase Tables**: pelanggan

## Route: `/dashboard/hutang`
- **File**: `app/dashboard/hutang/page.tsx`
- **Tipe**: UI Page
- **Akses Supabase Tables**: metode_bayar, hutang_dagang

## Route: `/dashboard/inventory`
- **File**: `app/dashboard/inventory/page.tsx`
- **Tipe**: UI Page
- **Akses Supabase Tables**: produk, kategori, satuan

## Route: `/dashboard/inventory/stock-in/history`
- **File**: `app/dashboard/inventory/stock-in/history/page.tsx`
- **Tipe**: UI Page
- **Akses Supabase Tables**: barang_masuk, supplier

## Route: `/dashboard/inventory/stock-in`
- **File**: `app/dashboard/inventory/stock-in/page.tsx`
- **Tipe**: UI Page
- **Akses Supabase Tables**: produk, supplier

## Route: `/dashboard/inventory/stock-opname/history`
- **File**: `app/dashboard/inventory/stock-opname/history/page.tsx`
- **Tipe**: UI Page
- **Akses Supabase Tables**: stok_opname

## Route: `/dashboard/inventory/stock-opname`
- **File**: `app/dashboard/inventory/stock-opname/page.tsx`
- **Tipe**: UI Page
- **Akses Supabase Tables**: produk

## Route: `/dashboard/laporan-kasir`
- **File**: `app/dashboard/laporan-kasir/page.tsx`
- **Tipe**: UI Page
- **Akses Supabase Tables**: saldo_kas_harian

## Route: `/dashboard/laporan/laba-rugi`
- **File**: `app/dashboard/laporan/laba-rugi/page.tsx`
- **Tipe**: UI Page

## Route: `/dashboard/laporan/neraca`
- **File**: `app/dashboard/laporan/neraca/page.tsx`
- **Tipe**: UI Page

## Route: `/dashboard`
- **File**: `app/dashboard/page.tsx`
- **Tipe**: UI Page

## Route: `/dashboard/piutang`
- **File**: `app/dashboard/piutang/page.tsx`
- **Tipe**: UI Page
- **Akses Supabase Tables**: metode_bayar, piutang_dagang

## Route: `/dashboard/reports`
- **File**: `app/dashboard/reports/page.tsx`
- **Tipe**: UI Page
- **Akses Supabase Tables**: detail_transaksi_keluar, produk, transaksi_keluar

## Route: `/dashboard/settings/keuangan`
- **File**: `app/dashboard/settings/keuangan/page.tsx`
- **Tipe**: UI Page
- **Akses Supabase Tables**: pengaturan_keuangan

## Route: `/dashboard/settings`
- **File**: `app/dashboard/settings/page.tsx`
- **Tipe**: UI Page
- **Akses Supabase Tables**: pengaturan

## Route: `/dashboard/settings/reference-data`
- **File**: `app/dashboard/settings/reference-data/page.tsx`
- **Tipe**: UI Page
- **Akses Supabase Tables**: metode_bayar, kategori, satuan

## Route: `/dashboard/settings/users`
- **File**: `app/dashboard/settings/users/page.tsx`
- **Tipe**: UI Page
- **Akses Supabase Tables**: pengguna

## Route: `/dashboard/suppliers`
- **File**: `app/dashboard/suppliers/page.tsx`
- **Tipe**: UI Page
- **Akses Supabase Tables**: supplier

## Route: `/dashboard/transactions`
- **File**: `app/dashboard/transactions/page.tsx`
- **Tipe**: UI Page
- **Akses Supabase Tables**: metode_bayar, transaksi_keluar

## Route: `/dashboard/tutup-kasir`
- **File**: `app/dashboard/tutup-kasir/page.tsx`
- **Tipe**: UI Page

## Route: `/`
- **File**: `app/page.tsx`
- **Tipe**: UI Page

## Route: `/pos/invoice/[id]`
- **File**: `app/pos/invoice/[id]/page.tsx`
- **Tipe**: UI Page
- **Akses Supabase Tables**: detail_transaksi_keluar, transaksi_keluar, pengaturan

## Route: `/pos/invoice/[id]/receipt`
- **File**: `app/pos/invoice/[id]/receipt/page.tsx`
- **Tipe**: UI Page
- **Akses Supabase Tables**: detail_transaksi_keluar, transaksi_keluar, pengaturan

## Route: `/pos`
- **File**: `app/pos/page.tsx`
- **Tipe**: UI Page
- **Fetch Calls (External/Internal API)**:
  - `/api/network-ip`
  - `/api/pos/products`
  - `/api/pos/payment-methods`
  - `/api/pos/barcode?code=${encodeURIComponent(barcode)}`
  - `/api/pos/customers`
- **Akses Supabase Tables**: pengaturan, pengguna

## Route: `/pos/test-barcode`
- **File**: `app/pos/test-barcode/page.tsx`
- **Tipe**: UI Page

## Route: `/scanner/[sessionId]`
- **File**: `app/scanner/[sessionId]/page.tsx`
- **Tipe**: UI Page
- **Fetch Calls (External/Internal API)**:
  - `/api/scanner/${sessionId}`

