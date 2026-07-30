# Instruksi Pengembangan Fitur: Sistem Member Poin Pelanggan

**Konteks Proyek:** POS Sobatti (Next.js 16 App Router, Supabase, Tailwind v4, Zustand).
**Tujuan:** Membangun sistem poin member/loyalitas di mana pelanggan bisa mendaftar menjadi member dari halaman POS, mengakumulasi poin (1 poin per Rp100.000 total transaksi), dan kasir bisa mengecek member via nomor telepon.

Terapkan perubahan berikut pada sistem:

## 1. Migrasi Basis Data (Supabase PostgreSQL)

Buat file migrasi baru `supabase/migrations/20260725_add_member_point.sql`:

- **Tabel `pelanggan`:** Tambahkan kolom `point` (`INTEGER`, `NOT NULL DEFAULT 0`).

## 2. Backend — API Routes

### 2a. Update `/api/pos/customers/route.ts` (GET)
- Tambahkan `point` ke SELECT query.
- Response: `{ id, nama_pelanggan, alamat, no_hp, email, point }`.

### 2b. Buat `/api/pos/member-search/route.ts` (GET)
- **Query params:** `no_hp` (string).
- Cari `pelanggan` WHERE `no_hp ILIKE '%' || p_no_hp || '%'`.
- Return `{ found: boolean, customer: Customer | null }`.

### 2c. Buat `/api/pos/member-register/route.ts` (POST)
- **Body:** `{ nama_pelanggan: string, no_hp: string }`.
- Validasi: nama & no_hp wajib diisi.
- Cek duplikat `no_hp` — jika sudah ada, return error "Nomor HP sudah terdaftar sebagai member".
- Insert ke `pelanggan` dengan `point = 0`.
- Return customer baru.

### 2d. Update `/api/pos/checkout/route.ts` (POST)
- Setelah RPC `process_checkout` berhasil dan `data` memiliki `id`:
- Jika `id_pelanggan` tidak null:
  1. Hitung `pointsEarned = Math.floor(data.total / 100000)`.
  2. Jika `pointsEarned > 0`, update `pelanggan` SET `point = COALESCE(point, 0) + pointsEarned`.
- Return tambahan field `poin_ditambahkan: pointsEarned`.

## 3. State Management — Update `stores/pos-store.ts`

- **Interface `Customer`:** Tambahkan `point: number`.

## 4. Frontend — Halaman POS (`app/pos/page.tsx`)

### 4a. Member Search Modal (Dialog)
- **Trigger:** Tombol "Cari Member" di area customer selection (sejajar dengan label Pelanggan).
- **Modal berisi:**
  - Input nomor HP + tombol "Cari".
  - State: `memberSearchQuery`, `memberSearchResult`, `memberSearchLoading`.
  - Jika ditemukan: card member (nama, no_hp, total poin) + tombol "Pilih Member".
  - Jika tidak ditemukan: pesan "Nomor HP belum terdaftar" + tombol "Daftarkan Sebagai Member Baru".

### 4b. Member Registration Modal (Dialog)
- **Field:** Nama Pelanggan (required), No. HP (required, minimal 10 digit).
- **Tombol:** "Daftar & Pilih" → POST `/api/pos/member-register`.
- **Validasi client-side** + tampilkan error dari server (duplikat no_hp).
- **Success:** Set `selectedCustomer`, tutup modal.

### 4c. Poin Badge
- Jika `selectedCustomer` memiliki `point > 0`, tampilkan badge poin di bawah nama pelanggan.

## 5. Frontend — Dashboard Pelanggan

### 5a. Update `app/dashboard/customers/customers-client.tsx`
- **Interface `Customer`:** Tambahkan `point: number`.
- **Kolom baru "Poin"** di DataTable: `{ key: "point", header: "Poin", sortable: true, render: (c) => ... }`.
- **Search filter:** Sertakan `String(c.point)`.
- **Export CSV & PDF:** Tambahkan kolom "Poin".

### 5b. Update `app/dashboard/customers/actions.ts`
- Tambahkan `point` sebagai parameter opsional di tipe `updateCustomer`.

## 6. Aturan Ketat Eksekusi

1. Gunakan Bahasa Indonesia baku pada semua label, pesan error, placeholder, dan notifikasi.
2. Seluruh nilai uang di UI wajib menggunakan `formatIDR()`.
3. Nilai poin ditampilkan dengan format angka biasa, gunakan class `tabular-nums`.
4. Modal baru harus konsisten dengan modal yang sudah ada (Scanner QR & Check Stock modal).
5. Update poin dilakukan di API route setelah RPC `process_checkout` sukses — jangan modifikasi RPC.
6. Jangan commit tanpa diminta.
