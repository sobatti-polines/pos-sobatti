import re
import sys

with open("FITUR.md", "r") as f:
    text = f.read()

# Update title and summary
text = re.sub(
    r"\(hasil analisa mendalam: .*?\)",
    "(hasil analisa mendalam: 58 halaman, 27 API route, 61 migrasi SQL, dll)",
    text
)
text = text.replace("22 API route", "27 API route")
text = text.replace("23 migrasi SQL", "61 migrasi SQL")

# Update Inventory
inv_addition = """| 78 | Produk Paket (Bundling) | Dukungan produk paket dengan master, `qty_per_unit`, `isi_satuan`, `jenis_isi_paket` (Fixed / Actual Weight), isi stok paket otomatis ke master/gudang | migrasi `20260830`..`20260903` | BARU | [x] |
| 79 | Lokasi Area Rak | Tambahan tabel `lokasi_area` dan mapping di produk untuk mempermudah pencarian barang di gudang/rak | migrasi `20260901` | BARU | [x] |
| 80 | Stok Opname Berbasis Sesi | Stok opname menggunakan konsep sesi (simpan draft, selesaikan, void), dengan riwayat per sesi | `app/dashboard/inventory/stock-opname/` | BARU | [x] |
| 81 | Retur Pembelian | Modul retur pembelian barang ke supplier dengan riwayat, memotong HPP dan mereset AVCO secara proporsional | `app/dashboard/inventory/stock-in/retur/` | BARU | [x] |
| 82 | Batal/Void Barang Masuk | Fitur membatalkan barang masuk dengan mengembalikan uang dan HPP ke nilai sebelumnya | migrasi `20260810` | BARU | [x] |
| 83 | Cetak Bukti Barang Masuk | Tombol cetak tanda terima barang masuk ke gudang PDF/Print | `app/dashboard/inventory/stock-in/print/[id]` | BARU | [x] |
| 84 | Harga Besar Otomatis | Sinkronisasi konversi UoM untuk `harga_jual_besar_*` otomatis di tingkat DB via trigger | migrasi `20260816` | BARU | [x] |
| 85 | Generate SKU & Barcode | Tombol generate otomatis 6 digit angka acak unik untuk SKU dan Barcode di form produk | `app/dashboard/inventory/inventory-client.tsx` | BARU | [x] |
| 86 | Stok Minimum Gudang | Indikator stok gudang menipis yang terpisah dari stok display | migrasi `20260816` | BARU | [x] |"""

text = text.replace("## E. MASTER DATA", inv_addition + "\n\n## E. MASTER DATA")

# Update Event Promo
promo_section = """
## E.2. EVENT PROMO — `app/dashboard/event-promo` — 3 fitur

| # | Fitur | Deskripsi | Lokasi | Sumber | ✓ |
|---|-------|-----------|--------|--------|---|
| 87 | CRUD Event Promo | DataTable event promosi: nama, tipe diskon (persen/nominal), nilai, tanggal mulai & selesai, aktif/tidak | `app/dashboard/event-promo/` | BARU | [x] |
| 88 | Manajemen Produk Promo | Menambahkan produk spesifik yang masuk ke dalam event promo, berlaku dinamis di seluruh POS | `app/dashboard/event-promo/` | BARU | [x] |
| 89 | API Diskon Efektif | Endpoint kalkulasi diskon otomatis yang sedang aktif berdasar tanggal hari ini (`/api/event-promo/efektif`) | `app/api/event-promo/efektif/route.ts` | BARU | [x] |
"""
text = text.replace("## F. PENGGUNA", promo_section + "\n## F. PENGGUNA")

# Update Keuangan
keuangan_section = """
## I.2. KEUANGAN & PENGELUARAN — `app/dashboard/keuangan` — 4 fitur

| # | Fitur | Deskripsi | Lokasi | Sumber | ✓ |
|---|-------|-----------|--------|--------|---|
| 90 | Kas Admin & Modal Awal | Saldo kas berjalan admin, di-set modal awal dari pengaturan keuangan | `app/dashboard/keuangan/kas-admin/` | BARU | [x] |
| 91 | Arus Kas | Riwayat mutasi masuk/keluar kas admin, tercatat otomatis dari tiap transaksi pengeluaran/retur/modal | `app/dashboard/keuangan/arus-kas/` | BARU | [x] |
| 92 | Pengeluaran/Beban Operasional | Form pencatatan beban/pengeluaran toko (ATK, Konsumsi, Gaji, dll), langsung potong saldo kas admin | `app/dashboard/keuangan/pengeluaran/` | BARU | [x] |
| 93 | Laporan Kas | Laporan mutasi kas per rentang tanggal (export PDF/CSV) | `app/dashboard/laporan/kas/` | BARU | [x] |
"""
text = text.replace("## J. ABSENSI", keuangan_section + "\n## J. ABSENSI")


# Replace the APIs section
new_apis = """
| Method | Endpoint | Fungsi |
|--------|----------|--------|
| POST | `/api/auth/login` | Login email/username, cek aktif, set cookie |
| GET | `/api/pos/products` | Produk utk kasir (search, pagination, cache 60s) |
| GET | `/api/pos/barcode` | Cari produk by barcode/id/nama |
| GET | `/api/pos/customers` | Daftar pelanggan (termasuk poin) |
| GET | `/api/pos/member-search` | Cari member by no HP |
| POST | `/api/pos/member-register` | Daftar member baru (anti duplikat) |
| GET | `/api/pos/payment-methods` | Metode bayar |
| POST | `/api/pos/checkout` | Checkout → RPC + poin member |
| POST | `/api/scanner/[sessionId]` | Relay barcode ke sesi |
| GET | `/api/scanner/[sessionId]/events` | SSE stream barcode |
| GET | `/api/low-stock` | Produk stok menipis (cache 30s) |
| GET | `/api/network-ip` | IP server utk panduan scanner |
| GET | `/api/attendance/today` | Status absensi hari ini |
| POST | `/api/attendance/checkin` | Check-in (QR + GPS + telat) |
| POST | `/api/attendance/checkout` | Check-out |
| GET | `/api/attendance/history` | Riwayat pribadi |
| POST | `/api/attendance/generate-qr` | Generate QR token (OWNER) |
| GET | `/api/admin/attendance` | Laporan pegawai (ADMIN/OWNER) |
| GET | `/api/laporan/penjualan` | Laporan penjualan (pagination/filter/meta) |
| GET | `/api/laporan/penjualan/[id]` | Detail transaksi |
| GET | `/api/laporan/penjualan/rekap` | Rekap group by hari/kasir/metode/pelanggan |
| GET | `/api/laporan/penjualan/export` | Export CSV 15 kolom |
| GET | `/api/event-promo` | CRUD event promo |
| GET | `/api/event-promo/efektif` | Cek event promo aktif hari ini |
| GET | `/api/event-promo/[id]/produk` | Produk dalam promo |
"""
text = re.sub(r"\| Method \| Endpoint \| Fungsi \|.*?## 🗄️ RINGKASAN", new_apis + "\n## 🗄️ RINGKASAN", text, flags=re.DOTALL)

# Replace Migrations section
with open("migrations.txt", "r") as f:
    mig_lines = f.read().splitlines()

new_mig_md = "| File |\n|------|\n"
for m in mig_lines:
    new_mig_md += f"| `{m}` |\n"

text = re.sub(r"\| File \|.*?## 🐞 TEMUAN & CATATAN PENTING", new_mig_md + "\n## 🐞 TEMUAN & CATATAN PENTING", text, flags=re.DOTALL)

# Write back
with open("FITUR.md", "w") as f:
    f.write(text)

