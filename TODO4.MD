# Instruksi Pengembangan Fitur: Sistem Konversi Satuan Barang Masuk (UoM) & Manajemen Stok Gudang

**Konteks Proyek:** POS Sobatti (Next.js 16 App Router, Supabase, Tailwind v4, React Hook Form + Zod, Zustand).
**Tujuan:** Membangun modul penerimaan barang dari *Supplier* (Toko 1) menggunakan satuan agregat (*bulk* seperti Lusin, Set, Roll) yang secara otomatis dikonversi menjadi satuan dasar (*Piece*/Pcs) untuk stok di basis data dan transaksi penjualan di kasir (Toko 2).

Terapkan perubahan berikut pada sistem:

## 1. Migrasi Basis Data (Supabase PostgreSQL)

Buat skema migrasi baru di dalam direktori `supabase/migrations/` untuk memperbarui tabel yang relevan. Sistem wajib menjadikan `pieces` (pcs) sebagai kebenaran tunggal (*single source of truth*) untuk stok inventaris.

*   **Modifikasi Tabel `products` (Master Barang):**
    *   Tambahkan kolom `base_unit` (tipe: `varchar`, *default*: 'pcs').
    *   Tambahkan kolom `default_purchase_unit` (tipe: `varchar`, contoh: 'lusin', 'roll').
    *   Tambahkan kolom `conversion_ratio` (tipe: `integer` atau `numeric`, *default*: 1). Kolom ini merepresentasikan jumlah `base_unit` di dalam satu `purchase_unit`.

*   **Modifikasi/Pembuatan Tabel `inbound_transactions` (Log Barang Masuk):**
    Wajib mencatat jejak audit secara mendetail dengan menambahkan kolom:
    *   `supplied_unit` (`varchar`): Satuan saat barang diterima dari Toko 1 (contoh: 'lusin').
    *   `supplied_qty` (`numeric`): Jumlah dalam satuan suplai.
    *   `applied_conversion_ratio` (`numeric`): Rasio yang digunakan pada saat transaksi terjadi (untuk mengantisipasi perubahan rasio di masa depan).
    *   `base_qty_added` (`numeric`): Hasil kalkulasi otomatis (`supplied_qty` * `applied_conversion_ratio`).
    *   `total_cost` (`numeric`): Total harga beli modal dari Toko 1.
    *   `base_cost_per_piece` (`numeric`): Kalkulasi Harga Pokok Penjualan (HPP) (`total_cost` / `base_qty_added`).

## 2. Logika *Backend* & *Server Actions* (Next.js 16)

*   **Kalkulasi Mutlak di *Server-Side*:** Dilarang memercayai kalkulasi total dari klien. Klien hanya bertugas mengirimkan `product_id`, `supplied_unit`, `supplied_qty`, dan `total_cost`.
*   **Tugas *Server Action*:**
    1.  Mengambil data `conversion_ratio` dari master barang di basis data.
    2.  Mengalikan kuantitas (`supplied_qty`) dengan rasio konversi untuk mendapatkan `base_qty_added`.
    3.  Membagi `total_cost` dengan `base_qty_added` untuk memperbarui HPP/modal dasar per *piece*.
    4.  Menjalankan pembaruan stok utama dan pencatatan riwayat `inbound_transactions` dalam satu transaksi basis data (*DB Transaction*) atau menggunakan fungsi RPC (*Remote Procedure Call*) di Supabase untuk mencegah inkonsistensi data jika terjadi *race-condition*.

## 3. Antarmuka Formulir Barang Masuk (UI/UX)

*   **Komponen UI:** Gunakan `react-hook-form`, `zod` untuk validasi, dan komponen shadcn/ui yang sudah tersedia di proyek. Dilarang menggunakan komponen pihak ketiga yang baru.
*   **Elemen Formulir:**
    *   **Pilih Barang:** Komponen *Select* atau *Combobox* untuk memilih barang.
    *   **Satuan Suplai:** Komponen *Dropdown* (*Select*) yang menampilkan opsi satuan berdasarkan konfigurasi master barang.
    *   **Kuantitas Masuk:** *Input* numerik untuk kuantitas dalam satuan suplai.
    *   **Total Harga Modal:** *Input* untuk total nilai pembelian dari Toko 1.
*   **Indikator Konversi Real-time (Wajib):**
    *   Saat pengguna memasukkan data, tampilkan teks *read-only* yang memperlihatkan kalkulasi konversi secara visual untuk mencegah *human error*.
    *   *Format Teks Indikator:* "Barang masuk: 2 Lusin. (Rasio: 1 Lusin = 12 Pcs). Total masuk gudang: **24 Pcs**."
    *   Terapkan gaya tipografi editorial standar POS Sobatti: `font-weight: 300`, warna *navy* pekat untuk teks informasi reguler, dan `font-feature-settings: "tnum"` untuk seluruh *output* angka.

## 4. Pembaruan Status (*State Management*)

*   Perbarui `stores/pos-store.ts` apabila penambahan stok memengaruhi langsung data yang masuk dalam *cache* di kasir. Sistem harus menyinkronkan ulang data stok terbaru setelah transaksi barang masuk berhasil dicatat (*invalidate cache*).

## 5. Aturan Ketat Eksekusi

1.  Gunakan Bahasa Indonesia baku dan profesional pada setiap label antarmuka, pesan kesalahan Zod, dan notifikasi (*toast*).
2.  Seluruh tampilan nilai uang di antarmuka wajib dibungkus dengan utilitas `formatIDR()`.
3.  Kode wajib mematuhi konvensi App Router pada Next.js 16 (pisahkan komponen *Client* dan *Server* secara tegas dengan direktif `"use client"` jika memerlukan *hooks*, dan biarkan sebagai komponen *Server* jika hanya untuk proses *render* sisi *server*).