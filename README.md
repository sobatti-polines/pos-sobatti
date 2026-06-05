<div align="center">

# POS Sobatti

**Sistem Point of Sale modern untuk toko retail, ditulis ulang dari aplikasi Excel VBA klasik ke Next.js + Supabase.**

[![Next.js](https://img.shields.io/badge/Next.js-16-000000?style=flat-square&logo=next.js&logoColor=white)](https://nextjs.org)
[![React](https://img.shields.io/badge/React-19-149eca?style=flat-square&logo=react&logoColor=white)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178c6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-3ecf8e?style=flat-square&logo=supabase&logoColor=white)](https://supabase.com)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-4-38bdf8?style=flat-square&logo=tailwind-css&logoColor=white)](https://tailwindcss.com)

[Tentang](#tentang) • [Fitur](#fitur) • [Memulai](#memulai) • [Arsitektur](#arsitektur) • [Pengembangan](#pengembangan)

</div>

---

## Tentang

**POS Sobatti** adalah aplikasi kasir berbasis web yang dirancang untuk operasional harian toko retail — transaksi, inventaris, pelanggan, supplier, absensi, dan laporan — dalam satu aplikasi PWA yang ringan.

Proyek ini adalah migrasi modern dari aplikasi POS berbasis Microsoft Excel + VBA (17 sheet, macro `Terbilangku`, VBA Save Transaction, dsb.) ke stack web kontemporer dengan tetap mempertahankan aturan bisnis inti: penomoran transaksi sequential mulai `#10000001`, tiga tier harga (satuan/grosir/promo), diskon bertingkat (per item + global), metode DP, dan cetak nota dalam Rupiah dengan fungsi **terbilang** berbahasa Indonesia.

Antarmuka sengaja dibuat kalem dan profesional — bukan SaaS generic, bukan portal banking kaku. Login terasa secepat mungkin untuk kasir harian, tetapi tetap aman untuk manajer.

> [!NOTE]
> Nama "Sobatti" diambil dari identitas internal toko ritel tempat sistem ini pertama kali digunakan.

## Fitur

- **Antarmuka Kasir (POS)** — pencarian produk, keranjang, numpad on-screen, tiga tier harga (Satuan / Grosir / Promo), diskon per item dan global, multiple payment method, cetak invoice.
- **Dashboard Manajer** — ringkasan revenue hari ini vs kemarin, jumlah transaksi, rata-rata ticket, grafik 14 hari, daftar stok menipis, transaksi terbaru.
- **Manajemen Inventaris** — master produk, kategori, satuan, tracking stok otomatis setiap checkout, pembelian barang masuk, dan stock opname.
- **Manajemen Pelanggan & Supplier** — CRUD lengkap dengan pencarian inline, edit in-place, dan validasi.
- **Riwayat Transaksi & Laporan** — pencarian, filter, dan cetak ulang nota dalam format struk / invoice / faktur.
- **Absensi QR Code** — modul absensi berbasis QR dinamis untuk kasir dan admin, dengan validasi sesi dan pemindai kamera (PWA-friendly).
- **Pemindai Barcode** — integrasi kamera via ZXing untuk input produk cepat di halaman kasir.
- **Manajemen Pengguna** — level akses (Administrator / Kasir), username + email auth, dan pengelolaan akun via Supabase Auth.
- **PWA** — dapat di-install di perangkat kasir, dukungan HTTPS lokal untuk kamera scanner.
- **Format Rupiah + Terbilang** — formatter IDR lengkap dengan fungsi `terbilang()` Bahasa Indonesia untuk cetak nota.

## Memulai

### Prasyarat

- **Node.js 20+**
- **npm / pnpm / yarn / bun**
- **Akun Supabase** (atau instance Supabase lokal via Docker)
- **Supabase CLI** (`npm i -g supabase`) untuk menjalankan migrasi database
- **Kamera (opsional)** — untuk fitur barcode scanner dan absensi QR

### Instalasi

1. Clone repositori dan pasang dependensi:

   ```bash
   git clone <your-repo-url>
   cd app
   npm install
   ```

2. Salin file environment dan isi kredensial Supabase:

   ```bash
   cp .env.local.example .env.local
   ```

   Variabel yang dibutuhkan:

   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
   ```

3. Jalankan migrasi database ke instance Supabase Anda:

   ```bash
   supabase db push
   ```

4. Jalankan server pengembangan:

   ```bash
   npm run dev
   ```

   Buka [http://localhost:3000](http://localhost:3000) di browser.

> [!TIP]
> Untuk pengembangan di perangkat mobile (menguji kamera scanner / PWA), gunakan `npm run dev:https` agar kamera dapat diakses di perangkat lain dalam jaringan lokal Anda.

## Skrip

| Perintah              | Deskripsi                                                    |
| --------------------- | ------------------------------------------------------------ |
| `npm run dev`         | Menjalankan server pengembangan di `http://localhost:3000`   |
| `npm run dev:https`   | Menjalankan dev server dengan HTTPS (untuk akses kamera)     |
| `npm run build`       | Build produksi                                               |
| `npm run start`       | Menjalankan server produksi                                  |
| `npm run lint`        | Menjalankan ESLint                                           |

## Arsitektur

```
app/
├─ page.tsx               # Halaman login
├─ pos/                   # Antarmuka kasir (cart, checkout, numpad)
├─ dashboard/             # Dashboard, inventaris, pelanggan, supplier, dll.
├─ attendance/            # Absensi QR via PWA
├─ scanner/[sessionId]/   # Pemindai kamera untuk kasir & absensi
└─ api/                   # Route handlers (auth, pos, attendance, admin)

components/
├─ ui/                    # shadcn/ui primitives (Button, Input, Table, dsb.)
├─ login-form.tsx
├─ dashboard-sidebar.tsx
├─ dashboard-mobile-nav.tsx
└─ attendance-widget.tsx

lib/
├─ supabase/              # Klien Supabase (server & browser)
├─ dashboard.ts           # Aggregator data dashboard
├─ attendance.ts          # Logika absensi
├─ scanner-relay.ts       # Relay event scanner via SSE
├─ terbilang.ts           # Fungsi Terbilang Bahasa Indonesia
└─ utils.ts

stores/
└─ pos-store.ts           # State global kasir (Zustand)

supabase/
└─ migrations/            # Skema & migrasi PostgreSQL
```

### Stack Teknologi

| Layer        | Teknologi                                                  |
| ------------ | ---------------------------------------------------------- |
| Framework    | Next.js 16 (App Router) + React 19 + TypeScript 5          |
| Styling      | Tailwind CSS 4 + shadcn/ui + Radix UI                      |
| State        | Zustand (POS), React Hook Form, Zod (validasi)             |
| Database     | Supabase (PostgreSQL) + Row Level Security                 |
| Auth         | Supabase Auth (email + username)                           |
| Scanner      | @zxing/browser + @zxing/library                            |
| PWA          | next-pwa                                                   |

## Pengembangan

> [!IMPORTANT]
> Versi Next.js yang digunakan memiliki **breaking changes** dari versi yang umum dikenal. Selalu baca panduan di `node_modules/next/dist/docs/` sebelum menulis kode baru, dan perhatikan deprecation notices.

### Mengikuti Konvensi

- **Komponen UI** — gunakan primitive di `components/ui/` (shadcn). Jangan menarik library UI baru tanpa diskusi.
- **Data fetching** — pisahkan logika di `lib/<domain>.ts` (server-side via `lib/supabase/server.ts`).
- **Form & validasi** — React Hook Form + Zod. Definisikan schema di file yang sama dengan form.
- **Format uang** — gunakan helper `formatIDR()` di setiap halaman; jumlah di database adalah `numeric`/`bigint` (IDR tanpa subunit).
- **Bahasa** — semua copy UI dalam Bahasa Indonesia; pesan error dan label tetap dalam Bahasa Indonesia.

### Skema Database

Skema mengikuti struktur sheet Excel asli, dinormalisasi ke relasional:

- `pengguna` — akun & level akses
- `produk`, `kategori`, `satuan` — master barang
- `pelanggan`, `supplier` — master relasi
- `transaksi_keluar`, `detail_transaksi_keluar` — header & detail penjualan
- `barang_masuk`, `stok_opname` — pembelian & koreksi stok
- `absensi` — catatan absensi
- `pengaturan` — konfigurasi toko (nama, alamat, pajak, dsb.)
- `metode_bayar` — sumber dropdown metode pembayaran

Lihat `db_schema_analysis.md` untuk detail relasi dan `supabase/migrations/` untuk versi SQL.

### Penomoran Transaksi

No. Transaksi sequential dimulai dari `10000001`. Implementasi atomic untuk mencegah race condition saat dua kasir melakukan checkout bersamaan (lihat `20260529114225_fix_checkout_race_condition.sql`).

### Fungsi Terbilang

`lib/terbilang.ts` adalah port TypeScript dari VBA `Terbilangku()`. Mendukung angka hingga triliun, negatif (`Minus`), dan suffix `Rupiah`.

```ts
import { terbilangRupiah } from "@/lib/terbilang";

terbilangRupiah(164600); // "Seratus Enam Puluh Empat Ribu Enam Ratus Rupiah"
```

## Berkas Pendukung

Dokumentasi tambahan tersedia di root repositori:

- `PRODUCT.md` — prinsip desain, kepribadian brand, dan anti-reference UI
- `DESIGN.md` — catatan desain lengkap
- `pos_app_spec.md` — spesifikasi aplikasi Excel VBA asli (sumber kebenaran aturan bisnis)
- `techspec_attendance_module_pos_sobatti.md` — spesifikasi teknis modul absensi
- `db_schema_analysis.md` — analisis skema database
- `gap_analysis.md` — analisis kesenjangan implementasi
- `AGENTS.md` — aturan khusus untuk agen AI yang bekerja di repo ini
