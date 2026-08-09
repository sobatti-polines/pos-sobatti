# Panduan Modul Stok Opname — Sobatti POS

**Versi**: 1.0
**Terakhir diperbarui**: 10 Agustus 2026
**Akses**: ADMIN / OWNER

---

## Daftar Isi

1. [Ringkasan](#ringkasan)
2. [Prasyarat](#prasyarat)
3. [Alur Bisnis](#alur-bisnis)
4. [Langkah 1 — Mulai Sesi](#langkah-1--mulai-sesi)
5. [Langkah 2 — Input Fisik (Penghitungan Lapangan)](#langkah-2--input-fisik-penghitungan-lapangan)
6. [Langkah 3 — Review & Terapkan](#langkah-3--review--terapkan)
7. [Lihat Riwayat](#lihat-riwayat)
8. [Lihat Laporan Stok Opname](#lihat-laporan-stok-opname)
9. [Contoh Skenario Nyata](#contoh-skenario-nyata)
10. [Aturan Penting & Perilaku Sistem](#aturan-penting--perilaku-sistem)
11. [Troubleshooting](#troubleshooting)

---

## Ringkasan

Modul Stok Opname memungkinkan Anda membandingkan stok fisik di toko dengan stok sistem, mengklasifikasi selisih, dan memperbarui stok secara permanen dengan audit trail (siapa, kapan, berapa nilai kerugiannya).

Alur kerja: **Mulai Sesi → Input Fisik → Review & Terapkan**.

---

## Prasyarat

- Login sebagai **ADMIN** atau **OWNER** (KASIR/KARYAWAN tidak bisa mengakses)
- Migration `20260831_stok_opname_sesi.sql` sudah dijalankan ke database
- Stok produk di sistem sudah sesuai kondisi terkini (jika belum, lakukan terlebih dahulu)

---

## Alur Bisnis

```
┌─────────────────┐     ┌─────────────────┐     ┌──────────────────┐
│  1. MULAI SESI  │ ──▶ │ 2. INPUT FISIK  │ ──▶ │ 3. REVIEW &      │
│  (Sesi DRAFT)   │     │ (Simpan Draft)  │     │    TERAPKAN      │
└─────────────────┘     └─────────────────┘     │ (Stok Berubah)   │
                                                └──────────────────┘
                                                        │
                                              ┌─────────┴─────────┐
                                              │  SELESAI  │  DIBATALKAN  │
                                              └───────────┴─────────────┘
```

- Stok produk **tidak berubah** sampai langkah 3 diklik "Terapkan"
- Anda boleh menyimpan draft berkali-kali, menambah/menghapus baris, atau membatalkan sesi

---

## Langkah 1 — Mulai Sesi

1. Buka menu **Inventaris → Stok Opname** di sidebar (desktop) atau menu hamburger (HP)
2. Di halaman muncul form "Mulai Sesi Stok Opname":
   - **Tanggal Opname** — default hari ini (zona Asia/Jakarta). Ubah jika opname untuk tanggal lain
   - **Keterangan** (opsional) — contoh: *"Opname akhir bulan Agustus 2026"*
3. Klik **"Mulai Opname"**

**Yang terjadi di backend:**
- Sistem membuat sesi baru dengan nomor otomatis format **OP-YYYYMMDD-NN** (contoh: `OP-20260810-01`), urutan per hari
- Status awal: **DRAFT**
- Sesi langsung terbuka di Step 2 (Input Fisik)

> **Penting:** Pada fase ini, stok produk BELUM berubah apa pun.

---

## Langkah 2 — Input Fisik (Penghitungan Lapangan)

Anda melihat tabel dengan kolom:

| # | Produk | Stok Sistem | Stok Fisik | Selisih | Klasifikasi | Keterangan |
|---|--------|-------------|------------|---------|-------------|------------|

### Menambah Produk

**Cara 1 — Tambah manual:**
1. Klik **"+ Tambah Baris"**
2. Di kolom **Produk**, ketik nama produk atau barcode
3. Pilih dari dropdown (stok saat ini terlihat di samping nama)

**Cara 2 — Import CSV:**
1. Klik **"Import CSV"**
2. Unggah file CSV dengan kolom: `SKU / Barcode, Stok Fisik, Keterangan`
3. Template bisa diunduh di modal (klik "Unduh Template")
4. Contoh isi CSV:
   ```
   SKU / Barcode,Stok Fisik,Keterangan
   SMN-GRS-50,48,2 zak bocor
   PKU-KY-03,18,Hitungan fisik gudang
   ```

### Mengisi Data

- **Stok Fisik** — angka hasil hitung nyata di toko (boleh desimal, gunakan titik: `48.5`)
- **Klasifikasi** — pilih salah satu:

  | Pilihan | Kapan Dipakai |
  |---------|---------------|
  | `-` | Belum diklasifikasi (default) |
  | `Kelebihan` | Stok fisik > stok sistem (surplus) |
  | `Salah Catat` | Kesalahan pencatatan/input |
  | `Rusak` | Barang rusak/tidak layak jual |
  | `Hilang` | Barang tidak ditemukan |
  | `Lainnya` | Alasan lain |

- **Keterangan** — catatan opsional (contoh: *"2 zak bocor"* atau *"terjadi kesalahan input awal"*)

### Selisih

Selisih dihitung **otomatis** per baris:

```
Selisih = Stok Fisik - Stok Sistem
```

- **0** — abu-abu (cocok)
- **Negatif** — merah (defisit/hilang/rusak)
- **Positif** — hijau (surplus/kelebihan)

### Menyimpan Draft

- Klik **"Simpan Draft"** di footer kanan
- Anda bisa menyimpan berkali-kali — setiap kali, data di-overwrite (bukan ditambah)
- **Stok produk TIDAK BERUBAH** saat draft disimpan

### Stok Berubah Selama Proses?

Jika kasir melakukan transaksi di tab lain, stok produk bisa berubah. Saat itu terjadi:

1. Klik **"Muat Ulang Stok"** di header
2. Semua `Stok Sistem` di baris akan terupdate ke nilai terkini dari database
3. Selisih otomatis terhitung ulang

> **Tips:** Lakukan "Muat Ulang Stok" tepat sebelum klik "Review & Terapkan" untuk memastikan data paling akurat.

---

## Langkah 3 — Review & Terapkan

Setelah yakin semua data benar, klik **"Review & Terapkan"**.

### Tampilan Review

**Kartu ringkasan:**
- Total Item — jumlah produk diperiksa
- Total Selisih — jumlah selisih total (unit)
- Surplus (Rp) — total nilai uang barang berlebih
- Defisit (Rp) — total nilai uang barang hilang/rusak

**Breakdown per Klasifikasi:**
Menampilkan jumlah item dan nilai (Rp) per klasifikasi. Contoh:
```
HILANG    2 item    -Rp 100.000
RUSAK     1 item    -Rp  50.000
```

**Tabel detail per Produk:**
Menampilkan nama produk, stok sistem, stok fisik, selisih, klasifikasi, dan nilai (Rp) untuk setiap item.

### Terapkan

1. Klik **"Terapkan Opname"**
2. Muncul modal konfirmasi:
   > "Apakah Anda yakin ingin menerapkan stok opname ini? Stok produk akan diperbarui secara permanen."
3. Klik **"Ya, Terapkan"**

**Yang terjadi di backend (satu transaksi atomik):**
1. Sistem memvalidasi sesi masih berstatus DRAFT
2. **Stok display** setiap produk diubah ke `stok_fisik` yang Anda masukkan
3. **Nilai persediaan** dihitung ulang (total stok × harga pokok)
4. Jika ada selisih, dicatat ke **riwayat AVCO** (jenis: koreksi) — ini berdampak ke Laporan Laba Rugi dan Neraca
5. Sesi diubah → status **SELESAI**, `applied_at` tercatat, total item/selisih/nilai final dihitung
6. Layar menampilkan **"Stok Opname Selesai"**

### Batalkan Sesi

Jika ada kesalahan sebelum terapkan:
1. Klik **"Batalkan Sesi"** di footer kiri
2. Semua baris draft dihapus
3. Status sesi → **DIBATALKAN**
4. **Stok produk TIDAK berubah** (tidak ada efek ke inventori)

---

## Lihat Riwayat

**Menu:** Inventaris → Stok Opname → Riwayat
**URL:** `/dashboard/inventory/stock-opname/history`

Riwayat menampilkan **setiap sesi** satu per satu dalam bentuk accordion (kartu yang bisa dibuka):

### Informasi per Sesi

| Field | Keterangan |
|-------|------------|
| No. Sesi | Contoh: `OP-20260810-01` |
| Status | Badge: amber (DRAFT), emerald (SELESAI), abu-abu (DIBATALKAN) |
| Tanggal | Tanggal sesi dibuat |
| Operator | Nama/username pembuat sesi |
| Jumlah Item | Total produk diperiksa |
| Total Nilai (Rp) | Total nilai selisih dalam Rupiah |

### Detail Item

Klik kartu sesi untuk membuka detail:
- Tabel: nama produk, stok sistem, stok fisik, selisih, klasifikasi, keterangan
- Informasi: kapan dibuat, kapan diterapkan, keterangan
- Tombol **Export CSV** atau **Export PDF** per sesi

### Pencarian & Filter

- **Cari** — ketik nomor sesi, nama produk, atau nama operator
- **Tanggal** — filter rentang tanggal (dari/sampai)
- **Export Semua** — unduh semua data yang terlihat sebagai CSV atau PDF

---

## Lihat Laporan Stok Opname

**Menu:** Laporan → Stok Opname
**URL:** `/dashboard/laporan/stok-opname`

Laporan ini menampilkan **data agregat** untuk analisis manajemen (bukan detail per sesi).

### Filter

- **Dari / Sampai** — rentang tanggal (default: bulan berjalan)
- Sistem otomatis hanya menampilkan sesi dengan status **SELESAI**

### Kartu Ringkasan

| Card | Keterangan |
|------|------------|
| Total Sesi | Jumlah sesi selesai dalam rentang |
| Total Item Diperiksa | Jumlah produk diperiksa (akumulasi) |
| Total Defisit (Rp) | Total nilai barang hilang/rusak dalam Rupiah |
| Total Surplus (Rp) | Total nilai barang berlebih dalam Rupiah |

### Tabel Bulanan

| Kolom | Keterangan |
|-------|------------|
| Bulan | Nama bulan (contoh: "Agustus 2026") |
| Sesi | Jumlah sesi selesai |
| Item | Total item diperiksa |
| Selisih | Total selisih (unit) |
| Defisit (Rp) | Total nilai kerugian |
| Surplus (Rp) | Total nilai kelebihan |
| Shrinkage % | Persentase kerugian terhadap total nilai |

**Shrinkage Rate** = |Defisit| / (|Defisit| + Surplus) × 100%

### Export

Klik tombol **Export** di pojok kanan atas untuk mengunduh laporan sebagai CSV atau PDF.

---

## Contoh Skenario Nyata

### Skenario: Opname Akhir Bulan

**Senin, 31 Agustus 2026 — Pukul 17.00 (toko sudah tutup)**

1. **Buka modul** → Inventaris → Stok Opname
2. **Mulai Sesi** → Tanggal: 31 Agustus 2026, Keterangan: "Opname bulanan Agustus" → Mulai Opname
3. **Tambah 25 produk** (via CSV import dari hasil hitung fisik karyawan)
4. **Isi stok fisik** untuk semua produk → lihat selisih
5. **Klasifikasi** selisih:
   - Semen Gresik 50kg: stok sistem 25, fisik 22 → selisih -3 → pilih **Hilang**, keterangan "2 zak bocor, 1 zak dipinjam"
   - Keramik 40x40: stok sistem 120, fisik 118 → selisih -2 → pilih **Rusak**, keterangan "2 pecah saat pengiriman"
   - Cat Dulux 5L: stok sistem 50, fisik 50 → selisih 0 → biarkan "-"
6. **Simpan Draft** → data tersimpan, stok BELUM berubah
7. **Review & Terapkan** → lihat ringkasan:
   - Total Item: 25, Total Selisih: -5
   - Defisit: -Rp 150.000 (Hilang 2 item, Rusak 1 item)
   - Shrinkage: 0,8% dari total nilai persediaan
8. **Klik "Terapkan Opname"** → konfirmasi → stok produk berubah, riwayat AVCO tercatat
9. **Cek Riwayat** → sesi `OP-20260831-01` muncul dengan status SELESAI
10. **Cek Laporan** → bulan Agustus menampilkan defisit -Rp 150.000

**Selasa, 1 September 2026 — Pukul 09.00**

- Owner buka **Laporan → Stok Opname** → melihat shrinkage rate 0,8%
- Owner buka **Laba Rugi** → nilai HPP sudah termasuk koreksi stok opname (barang hilang)

---

## Aturan Penting & Perilaku Sistem

### 1. Stok di-Snapshot saat Simpan Draft

`Stok Sistem` di setiap baris bukan diambil dari produk list awal — melainkan diambil dari database pada saat Anda klik **"Simpan Draft"**. Ini memastikan snapshot akurat.

Harga pokok juga disnapshot (`harga_pokok_snap`). Jadi meskipun apply dilakukan berjam-jam kemudian, nilai Rp selisih tetap menggunakan harga saat penghitungan.

### 2. Tidak Freeze Transaksi

Toko tetap beroperasi selama proses opname. Kasir bisa melakukan penjualan, barang masuk, dll. Karena itu, **stok bisa berubah** antara saat Anda input dan saat Anda apply.

**Solusi:** Gunakan **"Muat Ulang Stok"** tepat sebelum apply untuk mendapatkan stok terkini.

### 3. Apply = Permanen

Saat Anda klik "Terapkan Opname":
- Stok produk berubah secara permanen
- Riwayat AVCO tercatat (berdampak ke laporan keuangan)
- Sesi tidak bisa diedit lagi

### 4. Hanya Satu Aksi per Sesi

Sesi hanya bisa di-apply **satu kali**. Jika sudah SELESAI, tidak bisa diubah atau dirollback.

### 5. Role-Based Access

| Role | Akses |
|------|-------|
| OWNER | Mulai sesi, input, review, apply, batalkan, riwayat, laporan |
| ADMIN | Sama dengan OWNER |
| KASIR | Tidak bisa mengakses modul stok opname |
| KARYAWAN | Tidak bisa mengakses modul stok opname |

### 6. Audit Trail

Setiap aksi (buat sesi, apply, batalkan) otomatis dicatat ke tabel `log_aktivitas` dengan informasi:
- Siapa yang melakukan (operator)
- Aksi apa (CREATE/UPDATE/DELETE)
- Kapan (timestamp)
- Detail data

### 7. Advisory Lock

Saat apply, sistem menggunakan PostgreSQL advisory lock (`987654323`) untuk mencegah dua sesi di-apply secara bersamaan. Jika ada sesi lain sedang diproses, sesi kedua akan menunggu.

---

## Troubleshooting

### "Akses ditolak — hanya ADMIN/OWNER"

Anda login sebagai KASIR atau KARYAWAN. Hubungi admin untuk mengubah level akun Anda.

### "Sesi ini sudah diproses atau dibatalkan"

Ses已被 apply atau dibatalkan. Tidak bisa diubah lagi. Buat sesi baru jika perlu.

### "Gagal membuat sesi opname"

Kemungkinan nomor sesi sudah ada (race condition). Coba lagi — sistem akan generate nomor baru.

### "Stok berubah sejak input" (peringatan)

Ini bukan error — hanya info bahwa stok produk di database berbeda dari stok saat Anda pertama kali input. Klik **"Muat Ulang Stok"** untuk menyegarkan.

### Sesi DRAFT tertinggal

Sesi DRAFT tidak memengaruhi stok. Anda bisa:
- Membuat sesi baru (DRAFT lain tidak masalah)
- Atau membatalkan sesi DRAFT lama via Riwayat

### Tidak bisa melihat Laporan Stok Opname

Pastikan Anda mengakses dari menu **Laporan → Stok Opname** di sidebar. Jika tidak muncul, hubungi developer untuk memastikan migration sudah di-apply dan sidebar sudah ter-update.

---

## Perbedaan Riwayat vs Laporan

| Aspek | Riwayat | Laporan |
|-------|---------|---------|
| **Tujuan** | Detail operasional per sesi | Analisis nilai kerugian untuk management |
| **Grupasi** | Per sesi (satu baris = satu sesi) | Per bulan |
| **Data** | Termasuk sesi DRAFT & DIBATALKAN | Hanya sesi SELESAI |
| **Info Operator** | Ya (siapa membuat) | Tidak (fokus angka) |
| **Shrinkage Rate** | Tidak ada | Ada (% kerugian) |
| **Export** | Per sesi atau semua | Per rentang tanggal |

---

## Referensi

Panduan ini mengikuti praktik stock taking dari:
- [Mekari Jurnal — Cara Stock Opname yang Benar](https://www.jurnal.id/id/blog/2018-pengertian-tujuan-manfaat-stock-opname-beserta-contohnya)
- [HashMicro — Laporan Stock Opname](https://www.hashmicro.com/id/blog/pentingnya-laporan-stock-opname-beserta-cara-menyusunnya)
- [Timly — Stocktaking Procedure Deep Dive](https://timly.com/en/stocktaking/stocktaking-procedure-deep-dive/)
- [Stockount — Inventory Audit Process](https://www.stockount.com/articles/inventory-audit-process-step-by-step)
- [Fishbowl — How to Perform a Stocktake](https://www.fishbowlinventory.com/blog/stocktake)
- [Cleverence — Cycle Count Inventory Procedures](https://www.cleverence.com/articles/for-business/cycle-count-inventory-procedures-9274/)
- [KasirPintar — Panduan Lengkap Stock Opname](https://kasirpintar.co.id/solusi/detail/panduan-lengkap-stock-opname-cara-hitung-stok-barang-dan-hindari-selisih-inventori)
