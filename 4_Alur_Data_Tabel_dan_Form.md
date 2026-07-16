# 4. Alur Data Tabel UI dan Sumber Input Form

Dokumen ini menjelaskan secara mendetail halaman mana yang menampilkan sebuah tabel data, tabel Supabase apa yang ditampilkan, dan dari mana/halaman mana pengguna menginputkan data tersebut (Form/Action).

## Data Tabel: `absensi`

### Ditampilkan di Halaman (View/Read):
- *(Tidak ditemukan query `.select()` langsung di frontend/kode sumber. Mungkin di-fetch via RPC atau API lain)*

### Diinputkan dari Halaman/Form (Insert/Update):
- **Aksi/Form di:** `app/api/attendance/checkin/route.ts`

---

## Data Tabel: `hutang_dagang`

### Ditampilkan di Halaman (View/Read):
- *(Tidak ditemukan query `.select()` langsung di frontend/kode sumber. Mungkin di-fetch via RPC atau API lain)*

### Diinputkan dari Halaman/Form (Insert/Update):
- **Aksi/Form di:** `lib/hutang.ts`

---

## Data Tabel: `kategori`

### Ditampilkan di Halaman (View/Read):
- `app/dashboard/inventory/page.tsx`
- `app/dashboard/settings/reference-data/page.tsx`

### Diinputkan dari Halaman/Form (Insert/Update):
- *(Tidak ditemukan query `.insert()` atau `.update()` langsung. Mungkin via API atau fitur ini belum selesai)*

---

## Data Tabel: `metode_bayar`

### Ditampilkan di Halaman (View/Read):
- `app/dashboard/settings/reference-data/page.tsx`
- `app/dashboard/transactions/page.tsx`
- `lib/laporan-kasir.ts`

### Diinputkan dari Halaman/Form (Insert/Update):
- *(Tidak ditemukan query `.insert()` atau `.update()` langsung. Mungkin via API atau fitur ini belum selesai)*

---

## Data Tabel: `pelanggan`

### Ditampilkan di Halaman (View/Read):
- *(Tidak ditemukan query `.select()` langsung di frontend/kode sumber. Mungkin di-fetch via RPC atau API lain)*

### Diinputkan dari Halaman/Form (Insert/Update):
- **Aksi/Form di:** `app/dashboard/customers/actions.ts`
  - *Kemungkinan Form UI berada di:* app/dashboard/customers/customers-client.tsx, app/dashboard/customers/page.tsx

---

## Data Tabel: `pembayaran_hutang`

### Ditampilkan di Halaman (View/Read):
- *(Tidak ditemukan query `.select()` langsung di frontend/kode sumber. Mungkin di-fetch via RPC atau API lain)*

### Diinputkan dari Halaman/Form (Insert/Update):
- **Aksi/Form di:** `lib/hutang.ts`

---

## Data Tabel: `pembayaran_piutang`

### Ditampilkan di Halaman (View/Read):
- *(Tidak ditemukan query `.select()` langsung di frontend/kode sumber. Mungkin di-fetch via RPC atau API lain)*

### Diinputkan dari Halaman/Form (Insert/Update):
- **Aksi/Form di:** `lib/piutang.ts`

---

## Data Tabel: `pengaturan`

### Ditampilkan di Halaman (View/Read):
- `app/pos/page.tsx`

### Diinputkan dari Halaman/Form (Insert/Update):
- *(Tidak ditemukan query `.insert()` atau `.update()` langsung. Mungkin via API atau fitur ini belum selesai)*

---

## Data Tabel: `pengaturan_keuangan`

### Ditampilkan di Halaman (View/Read):
- `app/dashboard/settings/keuangan/actions.ts`
- `lib/laporan-kasir.ts`
- `lib/laporan-keuangan.ts`

### Diinputkan dari Halaman/Form (Insert/Update):
- *(Tidak ditemukan query `.insert()` atau `.update()` langsung. Mungkin via API atau fitur ini belum selesai)*

---

## Data Tabel: `piutang_dagang`

### Ditampilkan di Halaman (View/Read):
- *(Tidak ditemukan query `.select()` langsung di frontend/kode sumber. Mungkin di-fetch via RPC atau API lain)*

### Diinputkan dari Halaman/Form (Insert/Update):
- **Aksi/Form di:** `lib/piutang.ts`

---

## Data Tabel: `produk`

### Ditampilkan di Halaman (View/Read):
- `app/dashboard/inventory/page.tsx`

### Diinputkan dari Halaman/Form (Insert/Update):
- **Aksi/Form di:** `app/dashboard/inventory/actions.ts`
  - *Kemungkinan Form UI berada di:* app/dashboard/inventory/page.tsx, app/dashboard/inventory/inventory-client.tsx, app/dashboard/inventory/stock-opname/stock-opname-client.tsx, app/dashboard/inventory/stock-opname/page.tsx, app/dashboard/inventory/stock-opname/history/history-client.tsx, app/dashboard/inventory/stock-opname/history/page.tsx, app/dashboard/inventory/stock-in/stock-in-client.tsx, app/dashboard/inventory/stock-in/page.tsx, app/dashboard/inventory/stock-in/history/history-client.tsx, app/dashboard/inventory/stock-in/history/page.tsx

---

## Data Tabel: `riwayat_avco`

### Ditampilkan di Halaman (View/Read):
- *(Tidak ditemukan query `.select()` langsung di frontend/kode sumber. Mungkin di-fetch via RPC atau API lain)*

### Diinputkan dari Halaman/Form (Insert/Update):
- **Aksi/Form di:** `lib/avco.ts`

---

## Data Tabel: `satuan`

### Ditampilkan di Halaman (View/Read):
- `app/dashboard/inventory/page.tsx`
- `app/dashboard/settings/reference-data/page.tsx`

### Diinputkan dari Halaman/Form (Insert/Update):
- *(Tidak ditemukan query `.insert()` atau `.update()` langsung. Mungkin via API atau fitur ini belum selesai)*

---

## Data Tabel: `supplier`

### Ditampilkan di Halaman (View/Read):
- `app/dashboard/inventory/stock-in/history/page.tsx`
- `app/dashboard/inventory/stock-in/page.tsx`

### Diinputkan dari Halaman/Form (Insert/Update):
- **Aksi/Form di:** `app/dashboard/suppliers/actions.ts`
  - *Kemungkinan Form UI berada di:* app/dashboard/suppliers/page.tsx, app/dashboard/suppliers/suppliers-client.tsx

---

## Analisis Eksplisit Per Halaman Dashboard

### Halaman: `/dashboard/customers`
- **Menampilkan Data:** (Melalui RPC atau tidak ada select langsung)
- **Form Input:** Tidak ditemukan form langsung di halaman ini (Mungkin view-only).

### Halaman: `/dashboard/inventory`
- **Menampilkan Data dari Tabel:** supplier, produk, kategori, satuan
- **Form Input/Action di Rute ini:**
  - `app/dashboard/inventory/stock-opname/stock-opname-client.tsx`
  - `app/dashboard/inventory/stock-in/stock-in-client.tsx`
  - **Yang mengubah tabel:** produk

### Halaman: `/dashboard/inventory/stock-in`
- **Menampilkan Data dari Tabel:** supplier
- **Form Input/Action di Rute ini:**
  - `app/dashboard/inventory/stock-in/stock-in-client.tsx`

### Halaman: `/dashboard/inventory/stock-in/history`
- **Menampilkan Data dari Tabel:** supplier
- **Form Input:** Tidak ditemukan form langsung di halaman ini (Mungkin view-only).

### Halaman: `/dashboard/inventory/stock-opname`
- **Menampilkan Data:** (Melalui RPC atau tidak ada select langsung)
- **Form Input/Action di Rute ini:**
  - `app/dashboard/inventory/stock-opname/stock-opname-client.tsx`

### Halaman: `/dashboard/inventory/stock-opname/history`
- **Menampilkan Data:** (Melalui RPC atau tidak ada select langsung)
- **Form Input:** Tidak ditemukan form langsung di halaman ini (Mungkin view-only).

### Halaman: `/dashboard/laporan/laba-rugi`
- **Menampilkan Data:** (Melalui RPC atau tidak ada select langsung)
- **Form Input:** Tidak ditemukan form langsung di halaman ini (Mungkin view-only).

### Halaman: `/dashboard/laporan/neraca`
- **Menampilkan Data:** (Melalui RPC atau tidak ada select langsung)
- **Form Input:** Tidak ditemukan form langsung di halaman ini (Mungkin view-only).

### Halaman: `/dashboard/laporan-kasir`
- **Menampilkan Data:** (Melalui RPC atau tidak ada select langsung)
- **Form Input:** Tidak ditemukan form langsung di halaman ini (Mungkin view-only).

### Halaman: `/dashboard/hutang`
- **Menampilkan Data:** (Melalui RPC atau tidak ada select langsung)
- **Form Input:** Tidak ditemukan form langsung di halaman ini (Mungkin view-only).

### Halaman: `/dashboard/piutang`
- **Menampilkan Data:** (Melalui RPC atau tidak ada select langsung)
- **Form Input:** Tidak ditemukan form langsung di halaman ini (Mungkin view-only).

### Halaman: `/dashboard/transactions`
- **Menampilkan Data dari Tabel:** metode_bayar
- **Form Input:** Tidak ditemukan form langsung di halaman ini (Mungkin view-only).

### Halaman: `/dashboard/suppliers`
- **Menampilkan Data:** (Melalui RPC atau tidak ada select langsung)
- **Form Input:** Tidak ditemukan form langsung di halaman ini (Mungkin view-only).

### Halaman: `/dashboard/settings/users`
- **Menampilkan Data:** (Melalui RPC atau tidak ada select langsung)
- **Form Input:** Tidak ditemukan form langsung di halaman ini (Mungkin view-only).

### Halaman: `/dashboard/settings/reference-data`
- **Menampilkan Data dari Tabel:** metode_bayar, kategori, satuan
- **Form Input:** Tidak ditemukan form langsung di halaman ini (Mungkin view-only).

### Halaman: `/dashboard/settings/keuangan`
- **Menampilkan Data dari Tabel:** pengaturan_keuangan
- **Form Input/Action di Rute ini:**
  - `app/dashboard/settings/keuangan/finance-settings-form.tsx`

### Halaman: `/dashboard/attendance/history`
- **Menampilkan Data:** (Melalui RPC atau tidak ada select langsung)
- **Form Input:** Tidak ditemukan form langsung di halaman ini (Mungkin view-only).

### Halaman: `/dashboard/attendance/report`
- **Menampilkan Data:** (Melalui RPC atau tidak ada select langsung)
- **Form Input:** Tidak ditemukan form langsung di halaman ini (Mungkin view-only).

