# POS Sobatti - Panduan Agent AI

Dokumen ini adalah pegangan kerja untuk agent yang masuk ke codebase **POS Sobatti / PLK POS**. Baca sebelum mengubah file. Utamakan source code aktual dan `supabase/schema_dump.sql` sebagai kebenaran teknis terbaru; dokumen lama seperti TODO/notes dipakai sebagai konteks historis.

---

## Aturan Kritis

1. **Next.js 16 + React 19**: gunakan pola App Router terbaru. Jika ragu soal API Next.js, cek `node_modules/next/dist/docs/` sebelum menulis kode.
2. **Dilarang memakai browser untuk testing**. Gunakan lint/build/test otomatis atau serahkan visual/manual testing ke user.
3. **Semua UI copy, error message, label form, dan teks baru wajib Bahasa Indonesia**.
4. **Jangan pernah expose `SERVICE_ROLE`**. Key ini hanya boleh dipakai server-side lewat `lib/supabase/admin.ts`.
5. **Jangan commit/stage tanpa diminta**. Jika diminta stage, stage hanya file yang relevan.
6. **Mutasi stok, kas, transaksi, AVCO, dan data finansial harus divalidasi server-side**. Jangan percaya data dari client.
7. **Jangan bypass domain RPC tanpa alasan kuat**. Checkout, barang masuk, retur, isi stok paket, dan stok opname sengaja dipusatkan di PostgreSQL RPC agar atomik.

---

## Stack dan Pola Arsitektur

| Area | Teknologi / Pola |
| --- | --- |
| Framework | Next.js 16 App Router, React 19, TypeScript strict |
| Styling | Tailwind CSS v4, shadcn/ui local primitives, lucide-react |
| Auth | Supabase Auth via SSR cookies (`@supabase/ssr`) |
| Database | Supabase PostgreSQL + RLS + SECURITY DEFINER RPC |
| State POS | Zustand v5 di `stores/pos-store.ts` |
| Form | React Hook Form + Zod |
| Table | `components/data-table.tsx` + `hooks/use-table.ts` |
| Scanner | `@zxing/browser`, `@zxing/library`, SSE relay |
| Export/Print | jspdf, jspdf-autotable, papaparse, jsbarcode, qrcode |
| PWA | `@ducanh2912/next-pwa` |

Pola umum:

- Server Components untuk page shell dan data awal.
- Client Components hanya untuk interaksi, form, dialog, scanner, table state, dan realtime hooks.
- Dashboard CRUD sebagian besar memakai Server Actions di `app/dashboard/**/actions.ts`.
- Route Handlers di `app/api/**` dipakai untuk POS, auth, attendance, laporan penjualan, scanner, low stock, event promo, dan utilitas kecil.
- Setelah mutasi Server Action, panggil `revalidatePath()` untuk halaman terkait.
- Aktivitas admin penting dicatat via `lib/activity-log.ts`.

---

## Peta File Cepat

### Entrypoint dan Auth

| Kebutuhan | Lokasi |
| --- | --- |
| Root layout, metadata, preload | `app/layout.tsx` |
| Login page | `app/page.tsx` |
| Form login client | `components/login-form.tsx` |
| Login API Supabase | `app/api/auth/login/route.ts` |
| Supabase server client | `lib/supabase/server.ts` |
| Supabase browser client | `lib/supabase/client.ts` |
| Supabase service role admin | `lib/supabase/admin.ts` |
| Role guard dashboard | `proxy.ts` |
| Dashboard shell/sidebar | `app/dashboard/layout.tsx`, `components/dashboard-sidebar.tsx`, `components/dashboard-mobile-nav.tsx` |

### POS

| Kebutuhan | Lokasi |
| --- | --- |
| Guard halaman POS khusus KASIR | `app/pos/page.tsx` |
| UI utama POS | `app/pos/pos-client.tsx` |
| State cart/numpad/customer/payment/checkout | `stores/pos-store.ts` |
| Produk POS | `app/api/pos/products/route.ts` |
| Lookup barcode/id/nama | `app/api/pos/barcode/route.ts` |
| Checkout | `app/api/pos/checkout/route.ts` + RPC `process_checkout` |
| Member search/register | `app/api/pos/member-search/route.ts`, `app/api/pos/member-register/route.ts` |
| Invoice/faktur/struk | `app/pos/invoice/[id]/page.tsx`, `app/pos/invoice/[id]/receipt/page.tsx` |
| Scanner HP untuk POS | `app/scanner/[sessionId]/page.tsx`, `app/api/scanner/[sessionId]/route.ts`, `app/api/scanner/[sessionId]/events/route.ts`, `lib/scanner-relay.ts` |

### Dashboard dan Master Data

| Kebutuhan | Lokasi |
| --- | --- |
| Ringkasan dashboard | `app/dashboard/page.tsx`, `lib/dashboard.ts` |
| DataTable reusable | `components/data-table.tsx`, `hooks/use-table.ts` |
| Produk/inventaris | `app/dashboard/inventory/page.tsx`, `app/dashboard/inventory/inventory-client.tsx`, `app/dashboard/inventory/actions.ts` |
| Barang masuk | `app/dashboard/inventory/stock-in/**`, `app/dashboard/inventory/stock-in/actions.ts` |
| Tentukan harga barang masuk | `app/dashboard/inventory/stock-in/tentukan-harga/**` |
| Retur pembelian | `app/dashboard/inventory/stock-in/retur/**` |
| Stok opname sesi | `app/dashboard/inventory/stock-opname/**`, `app/dashboard/inventory/stock-opname/actions.ts` |
| Pelanggan | `app/dashboard/customers/**` |
| Supplier | `app/dashboard/suppliers/**` |
| Reference data | `app/dashboard/settings/reference-data/**` |
| Users | `app/dashboard/settings/users/**` |
| Pengaturan toko | `app/dashboard/settings/store-actions.ts`, `app/dashboard/settings/store-form.tsx` |
| Event promo | `app/dashboard/event-promo/**`, `app/api/event-promo/**` |

### Keuangan dan Laporan

| Kebutuhan | Lokasi |
| --- | --- |
| Buka kasir | `app/dashboard/buka-kasir/**` |
| Tutup kasir | `app/dashboard/tutup-kasir/**`, `lib/laporan-kasir.ts` |
| Riwayat kas harian | `app/dashboard/laporan-kasir/**` |
| Kas admin | `app/dashboard/keuangan/kas-admin/**` |
| Pengeluaran operasional | `app/dashboard/keuangan/pengeluaran/**` |
| Arus kas | `app/dashboard/keuangan/arus-kas/**`, `lib/laporan-keuangan.ts` |
| Laporan penjualan | `app/dashboard/reports/**`, `app/api/laporan/penjualan/**` |
| Laba rugi | `app/dashboard/laporan/laba-rugi/**`, `lib/laporan-keuangan.ts` |
| Neraca | `app/dashboard/laporan/neraca/**`, `lib/laporan-keuangan.ts` |
| Laporan kas | `app/dashboard/laporan/kas/**` |
| Laporan stok opname | `app/dashboard/laporan/stok-opname/**` |

### Absensi, Label, dan Utilitas

| Kebutuhan | Lokasi |
| --- | --- |
| Absensi pribadi | `app/dashboard/attendance/scan`, `app/dashboard/attendance/history` |
| Generate QR absensi | `app/dashboard/attendance/generate-qr/page.tsx`, `app/api/attendance/generate-qr/route.ts` |
| Check-in/out | `app/api/attendance/checkin/route.ts`, `app/api/attendance/checkout/route.ts` |
| Laporan absensi admin | `app/dashboard/attendance/report/**`, `app/api/admin/attendance/route.ts` |
| Helper absensi | `lib/attendance.ts` |
| Price tag A4 | `app/dashboard/label-generator/page.tsx`, `components/price-tag.tsx` |
| Label thermal produk | `app/dashboard/product-label/**`, `components/product-sticker-label.tsx` |
| Export CSV/PDF | `lib/export-utils.ts`, `components/export-dropdown.tsx` |

---

## Database Aktual

Sumber utama schema: `supabase/schema_dump.sql`. Migration ada di `supabase/migrations/`, tetapi dump lebih cepat untuk melihat kondisi akhir.

### Tabel Inti

| Area | Tabel penting |
| --- | --- |
| Master | `produk`, `kategori`, `satuan`, `merk`, `supplier`, `pelanggan`, `metode_bayar`, `pengaturan`, `pengguna` |
| Transaksi | `transaksi_keluar`, `detail_transaksi_keluar` |
| Stok/AVCO | `barang_masuk`, `retur_pembelian`, `detail_retur_pembelian`, `stok_opname`, `sesi_stok_opname`, `stok_opname_sesi_detail`, `riwayat_avco` |
| Produk paket | kolom di `produk`: `id_produk_master`, `qty_per_unit`, `isi_satuan`, `jenis_isi_paket` |
| Promo | `event_promo`, `event_promo_produk` |
| Kas/keuangan | `saldo_kas_harian`, `kas_admin_topup`, `pengeluaran`, `kategori_beban`, `pengaturan_keuangan` |
| Absensi | `absensi`, `qr_session` |
| Audit/lokasi | `log_aktivitas`, `lokasi_area` |

Hutang/piutang sudah dihapus oleh migration `20260721_drop_hutang_piutang.sql`. Kolom `dp` dan `sisa` di `transaksi_keluar` masih ada untuk status pembayaran, tetapi tidak membuat piutang dagang.

### RPC / Function Penting

| Function | Peran |
| --- | --- |
| `process_checkout` | Checkout atomik: nomor transaksi, header/detail, validasi bayar/stok, potong display lalu gudang, HPP/AVCO, status transaksi |
| `process_barang_masuk` | Barang masuk atomik: UoM conversion, tambah `stok_gudang`, AVCO, nilai persediaan |
| `cancel_barang_masuk` | Void barang masuk, reverse stok/AVCO |
| `process_retur_pembelian` | Retur supplier, kurangi gudang, update AVCO/nilai persediaan |
| `process_isi_stok_paket` | Membentuk stok produk paket dari produk master |
| `process_stock_opname` | Stok opname legacy/bulk |
| `process_stok_opname_apply` | Apply sesi stok opname modern |
| `batalkan_sesi_stok_opname` | Batalkan draft/sesi opname |
| `get_inventory_value_at_date` | Nilai persediaan per tanggal untuk laporan |
| `get_harga_efektif_produk` | Harga efektif produk dengan event promo |
| `increment_point`, `reset_pelanggan_id_seq` | Member point |
| `tambah_log_aktivitas` | Audit log SECURITY DEFINER |

Untuk fungsi RPC, cek definisi akhir di `supabase/schema_dump.sql`, bukan hanya migration awal, karena banyak fungsi sudah di-`CREATE OR REPLACE` berkali-kali.

---

## Business Rules yang Harus Dijaga

### Role dan Akses

| Role | Akses utama |
| --- | --- |
| `OWNER` | Full dashboard, laporan, users, absensi admin, keuangan |
| `ADMIN` | Dashboard, transaksi, inventory, pelanggan, supplier, laporan operasional, pengaturan terbatas |
| `KASIR` | POS, buka/tutup kasir, riwayat transaksi, absensi pribadi |
| `KARYAWAN` | Absensi pribadi dan ringkasan absensi |

Guard utama:

- `proxy.ts` membatasi dashboard route untuk `KASIR` dan `KARYAWAN`.
- `app/pos/page.tsx` memastikan hanya `KASIR` yang melihat POS.
- Server Actions tetap wajib cek role sendiri; layout/proxy bukan security boundary yang cukup.

### Checkout dan Harga

- Tier harga: `SATUAN`, `GROSIR`, `PROMO` di database; UI memakai `Satuan`, `Grosir`, `Promo`.
- POS mengirim `qty` dalam base unit dan `qty_satuan` dalam satuan jual yang tampil.
- Harga satuan besar selalu dihitung dari harga kecil x `conversion_ratio`; jangan jadikan input manual.
- Diskon item untuk satuan besar ikut dikali `conversion_ratio`.
- Harga custom didukung dan dikirim sebagai `harga_jual_custom`.
- Event promo aktif diambil dari `/api/event-promo/efektif` dan memengaruhi harga POS.
- Checkout harus lewat `/api/pos/checkout` dan RPC `process_checkout`.

### Stok dan Produk Paket

- `stok` = display/rak toko.
- `stok_gudang` = gudang.
- Barang masuk selalu menambah `stok_gudang`.
- Penjualan mengurangi display dulu, lalu gudang.
- Produk dengan `hitung_stok = false` tidak dipotong stok saat checkout.
- Restock display dilakukan manual via `restockDisplay` di inventory action.
- Produk paket memakai `id_produk_master` dan `qty_per_unit`; stok paket dibentuk lewat RPC `process_isi_stok_paket`, bukan dengan barang masuk biasa.

### AVCO / HPP

- HPP memakai AVCO weighted average.
- Barang masuk, penjualan, retur, void barang masuk, dan stok opname harus menjaga `riwayat_avco`.
- `harga_modal` adalah fallback/manual baseline. RPC hanya sinkron dari `harga_pokok_avco` jika nilai saat ini NULL atau 0; jangan timpa manual override.
- Checkout fallback HPP: `COALESCE(NULLIF(harga_pokok_avco, 0), harga_modal)`.

### Kas dan Keuangan

- Model kas dipisah:
  - **Kas kasir/laci**: uang awal + penjualan tunai neto; dikelola lewat buka/tutup kasir.
  - **Kas admin**: topup owner + refund retur - pengeluaran tunai.
  - **Kas bank/non-tunai**: penjualan non-tunai kumulatif.
- `lib/laporan-kasir.ts` adalah sumber logika buka/tutup kasir.
- `lib/laporan-keuangan.ts` adalah sumber laba-rugi, neraca, arus kas, kas kasir/admin/bank.
- Pengeluaran operasional berada di tabel `pengeluaran` dengan status `AKTIF`/void.
- Laba rugi sekarang memasukkan HPP, beban operasional, selisih kas, dan koreksi stok.

### Absensi

- QR session expired sesuai env `QR_EXPIRE_SECONDS`.
- Check-in memvalidasi QR aktif, geofence Haversine jika koordinat toko tersedia, dan menandai token terpakai.
- Owner tidak melakukan absensi.
- Status telat dihitung dari QR pertama hari itu + toleransi, fallback ke `ATTENDANCE_START_TIME`.
- Gunakan tanggal bisnis WIB saat membaca/menulis status harian.

### Low Stock

- Source helper: `lib/low-stock.ts`, realtime hook: `hooks/use-low-stock-realtime.ts`, API: `app/api/low-stock/route.ts`.
- Display low: `stok > 0 && stok <= stok_minimum`.
- Gudang low: `stok_minimum_gudang != null && stok_gudang <= stok_minimum_gudang`.
- Stok display 0 dianggap habis, bukan menipis.

---

## Route Handler Penting

| Route | Method | Fungsi |
| --- | --- | --- |
| `/api/auth/login` | POST | Login username/email Supabase |
| `/api/pos/products` | GET | Ambil semua produk POS, `dynamic = force-dynamic`, `no-store` |
| `/api/pos/barcode` | GET | Lookup produk by barcode, numeric id, lalu nama |
| `/api/pos/customers` | GET | Pelanggan POS |
| `/api/pos/payment-methods` | GET | Metode bayar aktif |
| `/api/pos/member-search` | GET | Cari member by nomor HP |
| `/api/pos/member-register` | POST | Register member + retry sequence |
| `/api/pos/checkout` | POST | Checkout via RPC `process_checkout` |
| `/api/attendance/today` | GET | Status absensi hari ini |
| `/api/attendance/checkin` | POST | Check-in QR + GPS |
| `/api/attendance/checkout` | POST | Check-out |
| `/api/attendance/generate-qr` | POST | Generate QR absensi owner |
| `/api/admin/attendance` | GET | Laporan absensi admin/owner |
| `/api/laporan/penjualan` | GET | Laporan penjualan filterable |
| `/api/laporan/penjualan/rekap` | GET | Rekap penjualan |
| `/api/laporan/penjualan/export` | GET | Export laporan penjualan |
| `/api/low-stock` | GET | Produk stok menipis |
| `/api/scanner/[sessionId]` | POST | Kirim barcode dari HP ke relay |
| `/api/scanner/[sessionId]/events` | GET | SSE stream ke POS |
| `/api/event-promo/**` | GET/POST/PUT/DELETE | CRUD dan harga efektif event promo |
| `/api/network-ip` | GET | IP LAN server untuk QR scanner |

---

## Server Actions Penting

| File | Fungsi utama |
| --- | --- |
| `app/dashboard/inventory/actions.ts` | CRUD/import produk, delete aman/paksa, move display/gudang, isi stok paket, mutation history, generate SKU/barcode |
| `app/dashboard/inventory/stock-in/actions.ts` | Add/void/update barang masuk, retur pembelian |
| `app/dashboard/inventory/stock-opname/actions.ts` | Sesi stok opname, save draft, apply, cancel |
| `app/dashboard/inventory/stock-in/tentukan-harga/actions.ts` | Owner menentukan harga barang masuk yang belum priced |
| `app/dashboard/transactions/actions.ts` | Void transaksi, edit metode bayar, detail transaksi |
| `app/dashboard/keuangan/kas-admin/actions.ts` | Topup/edit/delete kas admin |
| `app/dashboard/keuangan/pengeluaran/actions.ts` | Create/update/void/list pengeluaran |
| `app/dashboard/keuangan/arus-kas/actions.ts` | Fetch arus kas |
| `app/dashboard/laporan/kas/actions.ts` | Laporan kas |
| `app/dashboard/laporan/laba-rugi/actions.ts` | Fetch laba-rugi |
| `app/dashboard/laporan/neraca/actions.ts` | Fetch neraca |
| `app/dashboard/laporan/stok-opname/actions.ts` | Fetch laporan stok opname |
| `app/dashboard/tutup-kasir/actions.ts` | Fetch summary, buka sesi, tutup kasir, edit sesi owner |
| `app/dashboard/customers/actions.ts` | CRUD/import pelanggan |
| `app/dashboard/suppliers/actions.ts` | CRUD/import supplier |
| `app/dashboard/settings/users/actions.ts` | CRUD/import user + Supabase Auth sync |
| `app/dashboard/settings/reference-data/actions.ts` | CRUD/import kategori/satuan/merk |
| `app/dashboard/settings/store-actions.ts` | Update pengaturan toko + sync metode bayar bank |
| `app/dashboard/event-promo/actions.ts` | Save/delete event promo + produk terkait |

---

## UI dan Design Rules

- Vibe: professional, financial-grade, hangat, bukan generic SaaS.
- Gunakan design tokens dari `app/globals.css`.
- Tombol default pill-shaped (`rounded-full`) mengikuti `components/ui/button.tsx`.
- Input/select cenderung `rounded-[6px]`.
- Pakai `lucide-react` untuk icon.
- Jangan ubah primitive `components/ui/**` kecuali perlu dan efeknya dipahami.
- Untuk tabel/dashboard CRUD, pakai `DataTable` jika cocok daripada membuat table baru.
- Untuk angka uang, gunakan `Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR" })` dan class `tabular-nums`.
- Copy visible harus Bahasa Indonesia.
- Jangan pakai visible text untuk menjelaskan cara memakai UI kecuali memang konten bantuan/support.

---

## Testing dan Verifikasi

Command umum:

- `npm run lint`
- `npm run build`
- `npx playwright test` hanya jika user meminta atau relevan, dan tetap jangan membuka browser manual.

Catatan:

- ESLint mengabaikan `tests/**`, `*.js`, `supabase/**`, `public/**`, `.agents/**`.
- Playwright config dapat menjalankan `npm run dev` otomatis di port 3000.
- Jika perubahan menyentuh database/RPC, verifikasi minimal dengan membaca `supabase/schema_dump.sql` dan action/API pemanggilnya. Jangan menjalankan migration ke database tanpa instruksi eksplisit.
- Jika perubahan menyentuh kas/stok/transaksi, cek jalur server dan client sekaligus: UI payload, Server Action/API, RPC/table, revalidate, dan laporan yang terdampak.

---

## Env Variables

| Variable | Keterangan |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key public |
| `SERVICE_ROLE` | Service role secret, hanya server/admin client |
| `STORE_LATITUDE` | Latitude toko untuk geofencing |
| `STORE_LONGITUDE` | Longitude toko untuk geofencing |
| `MAX_ATTENDANCE_RADIUS` | Radius absensi meter |
| `QR_EXPIRE_SECONDS` | Masa berlaku QR absensi |
| `ATTENDANCE_START_TIME` | Fallback jam mulai kerja |
| `ATTENDANCE_TOLERANCE_MINUTES` | Toleransi telat setelah absen dibuka |

---

## Referensi Cepat Saat Mulai Task

1. Baca file yang relevan dulu dengan `rg`/`sed`; jangan mengandalkan nama route di dokumen saja.
2. Untuk schema akhir, buka `supabase/schema_dump.sql`.
3. Untuk fungsi RPC, cari nama function di `supabase/schema_dump.sql`.
4. Untuk perubahan UI dashboard, cek `DataTable`, sidebar/mobile nav, dan design token.
5. Untuk perubahan POS, cek `pos-client.tsx`, `pos-store.ts`, API POS, lalu RPC.
6. Untuk perubahan finansial, cek `lib/laporan-kasir.ts`, `lib/laporan-keuangan.ts`, action terkait, dan status transaksi `berhasil`.
7. Untuk perubahan stok, cek efek ke `produk.stok`, `produk.stok_gudang`, `riwayat_avco`, low stock, dan laporan.

