# Spesifikasi Aplikasi Kasir Excel VBA — Versi 3.0.5

> Dokumen ini adalah spesifikasi lengkap aplikasi Point of Sale (POS) berbasis Microsoft Excel VBA.
> Gunakan dokumen ini sebagai referensi untuk mereplikasi, memodifikasi, atau memigrasikan aplikasi ke platform lain.

---

## Ringkasan Aplikasi

| Atribut | Detail |
|---|---|
| Nama Aplikasi | Aplikasi Kasir Excel VBA |
| Versi | 3.0.5 |
| Platform | Microsoft Excel (Desktop, macro enabled) |
| Jumlah Sheet | 17 sheet |
| Contoh Toko | Swalayan Besi Semarang |
| Contoh Admin | ZULKIFLI (level: ADMINISTRATOR) |
| Username default | ADMIN |

---

## Arsitektur: Daftar Sheet dan Fungsinya

| No | Nama Sheet | Tipe | Fungsi |
|---|---|---|---|
| 1 | Manajemen Pengguna | Master | Data user, password, dan level akses |
| 2 | Daftar Produk | Master | Master barang dengan harga dan stok |
| 3 | Daftar Supplier | Master | Data pemasok/supplier |
| 4 | Daftar Pelanggan | Master | Data pelanggan terdaftar |
| 5 | Transaksi Kasir | Operasional | Form input penjualan (kasir) |
| 6 | Daftar Transaksi Keluar | Database | Riwayat semua transaksi penjualan |
| 7 | Cetak Nota | Output | Form cetak struk/invoice/faktur |
| 8 | Detail Transaksi Keluar | Database | Detail per item dari transaksi |
| 9 | Hapus Transaksi Keluar | Operasional | Koreksi/hapus transaksi |
| 10 | Input Stok Opname | Operasional | Form input pengecekan stok fisik |
| 11 | Daftar Stok Opname | Database | Riwayat hasil opname |
| 12 | Pengaturan | Konfigurasi | Konfigurasi toko, nota, pajak, diskon |
| 13 | Input Barang Masuk | Operasional | Form input pengadaan/pembelian stok |
| 14 | Daftar Barang Masuk | Database | Riwayat pembelian stok |
| 15 | Tabel Kategori | Referensi | Daftar kategori produk |
| 16 | Tabel Satuan | Referensi | Daftar satuan produk |
| 17 | Tabel Metode Bayar | Referensi | Daftar metode pembayaran |

---

## Detail Setiap Sheet

---

### Sheet 1: Manajemen Pengguna

**Fungsi:** Menyimpan data akun pengguna yang boleh mengakses aplikasi.

**Kolom data:**

| Kolom | Keterangan |
|---|---|
| Username | Nama login pengguna |
| Password | Password login (plain text) |
| Level | Level akses (contoh: ADMINISTRATOR) |

**Konfigurasi tambahan:**
- Terdapat opsi `Aktifkan Form Login` dengan nilai `Ya` / `Tidak`
- Jika `Tidak`, aplikasi langsung terbuka tanpa proses autentikasi

**Contoh data:**

| Username | Password | Level |
|---|---|---|
| ADMIN | ZULKIFLI | ADMINISTRATOR |

---

### Sheet 2: Daftar Produk

**Fungsi:** Master data semua produk yang dijual toko.

**Kolom data:**

| Kolom | Tipe | Keterangan |
|---|---|---|
| Nama Produk | Text | Nama barang (primary key) |
| Kategori | Dropdown | Referensi ke Tabel Kategori |
| Satuan | Dropdown | Referensi ke Tabel Satuan |
| Hitung Stok | Ya/Tidak | Apakah stok produk ini dilacak |
| Harga Modal | Angka | Harga beli/modal |
| Harga Jual Satuan | Angka | Harga jual normal eceran |
| Harga Jual Grosir | Angka | Harga jual untuk pembelian grosir |
| Harga Jual Promo | Angka | Harga jual saat promo |
| Diskon | Angka | Diskon default per item (%) |
| Stok | Angka | Jumlah stok saat ini (auto-update) |
| Harga Modal Stok | Angka | Total nilai modal stok (Harga Modal × Stok) |

**Header informatif:**
- Total Record: jumlah produk terdaftar
- Total nilai: jumlah total semua harga jual

**Contoh data:**

| Nama Produk | Kategori | Satuan | Hitung Stok | Harga Modal | Harga Jual Satuan | Harga Jual Grosir | Harga Jual Promo | Diskon | Stok |
|---|---|---|---|---|---|---|---|---|---|
| BERAS PREMIUM 5KG | SEMBAKO | Pcs | YA | 65000 | 75000 | 74000 | 73000 | 0 | 0 |
| GULA PASIR | SEMBAKO | Pcs | YA | 12000 | 14000 | 13000 | 12500 | 0 | 0 |
| MIE INSTANT | SEMBAKO | Pcs | YA | 2250 | 2800 | 2700 | 2500 | 0 | 0 |

---

### Sheet 3: Daftar Supplier

**Fungsi:** Master data supplier/pemasok barang.

**Kolom data:**

| Kolom | Keterangan |
|---|---|
| Nama Supplier | Nama perusahaan atau individu pemasok |
| Alamat | Alamat lengkap supplier |
| Telepon/HP | Nomor kontak |
| Email | Alamat email |
| Keterangan | Catatan tambahan (contoh: jenis barang yang dipasok) |

**Contoh data:**

| Nama Supplier | Alamat | Telepon/HP | Email | Keterangan |
|---|---|---|---|---|
| PT MAJU JAYA | Jl. Merdeka No. 123, Jakarta | 0862-3456-1111 | majujaya@gmail.com | Supplier Sembako |

---

### Sheet 4: Daftar Pelanggan

**Fungsi:** Master data pelanggan terdaftar. Digunakan saat input transaksi untuk memilih pelanggan.

**Kolom data:**

| Kolom | Keterangan |
|---|---|
| Nama Pelanggan | Nama pelanggan (primary key) |
| Alamat | Alamat pelanggan |
| No. HP / WA | Nomor HP/WhatsApp |
| Email | Alamat email |
| Keterangan | Catatan tambahan |

**Aturan khusus:**
- Selalu ada satu baris default: `UMUM` dengan semua kolom diisi `-`
- Pelanggan UMUM digunakan untuk transaksi tanpa identitas pembeli

**Contoh data:**

| Nama Pelanggan | Alamat | No. HP / WA | Email | Keterangan |
|---|---|---|---|---|
| UMUM | - | - | - | |
| ZULKIFLI LATIF | Jl. Merdeka No. 123, Makassar | 08091919191 | | |

---

### Sheet 5: Transaksi Kasir

**Fungsi:** Form utama input penjualan. Sheet ini adalah antarmuka kerja kasir sehari-hari.

**Header transaksi (area atas form):**

| Field | Keterangan |
|---|---|
| No. Transaksi | Auto-increment dari MAX(No_Transaksi) + 1, dimulai dari 10000001 |
| Tanggal / Jam | Auto-fill dengan `NOW()` |
| Sales | Nama sales/kasir aktif |
| Pelanggan | Dropdown dari Daftar Pelanggan (default: UMUM) |
| Nama Produk | Input produk yang dijual |
| Type Harga | Pilihan: Harga Jual Satuan / Grosir / Promo |
| Harga | Auto-fill dari Daftar Produk berdasarkan tipe harga |
| Stok | Auto-fill dari Daftar Produk |
| Diskon per item | Diambil dari Daftar Produk, bisa diubah manual |

**Tabel item transaksi (body form):**

| Kolom | Keterangan |
|---|---|
| No. | Nomor urut item |
| Nama Produk | Nama produk |
| Harga Modal | Auto-fill dari master produk |
| Type Harga Jual | Tipe harga yang dipilih |
| Harga | Harga jual yang berlaku |
| Diskon/Item | Diskon per satuan item |
| Qty | Jumlah yang dibeli |
| Satuan | Auto-fill dari master produk |
| Jumlah | Harga × Qty — Diskon |

**Area ringkasan pembayaran:**

| Field | Formula/Keterangan |
|---|---|
| Subtotal | `SUM(Jumlah semua item)` |
| Diskon (%) | Persentase diskon keseluruhan |
| Diskon (Nominal) | `Subtotal × Diskon%` |
| Pajak/PPn | Dihitung berdasarkan konfigurasi di Pengaturan |
| Total | `Subtotal - Diskon + Pajak` |
| Metode Bayar | Dropdown: Tunai / DP / QRIS / Debit / OVO / GoPay / dll. |
| Tunai/Bayar | Jumlah uang yang dibayarkan pelanggan |
| Kembalian | `Bayar - Total` (jika Tunai) |
| Sisa | `Total - DP` (jika metode DP) |

**Logika tipe harga:**
- `Harga Jual Satuan` → kolom 5 di Daftar Produk
- `Harga Jual Grosir` → kolom 6 di Daftar Produk
- `Harga Jual Promo` → kolom 7 di Daftar Produk
- `Harga Manual` → kasir input harga secara manual

**Contoh formula kunci (VBA/Excel):**
```excel
No. Transaksi     = IFERROR(MAX(No_Transaksi)+1, 10000001)
Harga             = IFERROR(VLOOKUP(NamaProduk, 'Daftar Produk'!A:K, MATCH(TipeHarga, ...), FALSE), 0)
Stok              = IFERROR(VLOOKUP(NamaProduk, 'Daftar Produk'!A:K, 10, FALSE), 0)
Diskon/Item       = IFERROR(VLOOKUP(NamaProduk, 'Daftar Produk'!A:K, 9, FALSE), 0)
Jumlah per item   = (Harga - Diskon) × Qty
Kembalian         = IF(MetodeBayar="Tunai", Bayar - Total, "")
Sisa DP           = IF(MetodeBayar="DP", Total - DP, "")
```

---

### Sheet 6: Daftar Transaksi Keluar

**Fungsi:** Database utama semua transaksi penjualan. Setiap kali kasir menyimpan transaksi, satu baris (per item) ditambahkan ke sheet ini secara otomatis oleh VBA.

**Kolom data (lengkap):**

| No | Nama Kolom | Keterangan |
|---|---|---|
| 1 | Nomor Urut | Urutan baris dalam database |
| 2 | No. Transaksi | ID transaksi (satu transaksi bisa banyak baris) |
| 3 | Tgl. Transaksi | Tanggal dan waktu transaksi |
| 4 | Kasir | Nama kasir yang melayani |
| 5 | (Kolom info toko 1) | Informasi toko tambahan |
| 6 | (Kolom info toko 2) | Informasi toko tambahan |
| 7 | Metode Bayar | Metode pembayaran yang digunakan |
| 8 | Nama Produk | Nama produk yang terjual |
| 9 | Harga Modal | Harga beli/modal produk |
| 10 | Type Harga Jual | Tipe harga yang digunakan |
| 11 | Harga Jual | Harga jual yang berlaku |
| 12 | Diskon Item | Diskon per item |
| 13 | Qty | Jumlah yang terjual |
| 14 | Satuan | Satuan produk |
| 15 | Jumlah | Total per baris item |
| 16 | Kas Masuk | Pendapatan kas dari item ini |
| 17 | Profit | Keuntungan (Harga Jual - Harga Modal) × Qty |
| 18 | Subtotal | Subtotal transaksi |
| 19 | Diskon Persen | Persentase diskon keseluruhan |
| 20 | Diskon Nominal | Nominal diskon keseluruhan |
| 21 | (Pajak Persen) | Persentase pajak |
| 22 | (Pajak Nominal) | Nominal pajak |
| 23 | Total | Total yang harus dibayar |
| 24 | Bayar | Jumlah yang dibayarkan |
| 25 | Kembali | Kembalian |
| 26 | DP | Jumlah down payment |
| 27 | Sisa | Sisa yang belum dibayar (untuk metode DP) |

**Fitur sheet:**
- Mendukung filter/autofilter Excel
- Row pertama menampilkan `SUBTOTAL()` untuk masing-masing kolom angka
- Total Record dihitung otomatis dengan `SUBTOTAL(103, ...)`

---

### Sheet 7: Cetak Nota

**Fungsi:** Mencetak ulang nota transaksi yang sudah tersimpan. Kasir cukup memasukkan nomor transaksi, data langsung ditarik dari `Daftar Transaksi Keluar`.

**Input:**
- `No. Transaksi`: diisi manual oleh kasir

**Output otomatis (via VLOOKUP):**
- Nama Pelanggan, No. HP/WA
- Tanggal, Jam, No. Nota, Kasir
- Semua item (nama produk, qty, satuan, harga, diskon, jumlah)
- Subtotal, diskon, pajak, total, bayar, kembalian/sisa

**Tiga format nota yang tersedia:**

#### Format 1: Struk Kasir 58mm
- Lebar sempit (58mm), cocok untuk printer thermal
- Tampilan ringkas: nama toko, tanggal, item, total, metode bayar, footer
- Footer 3 baris dapat dikustomisasi di Pengaturan

#### Format 2: Invoice
- Format dokumen resmi landscape/portrait
- Mencantumkan: logo/nama toko, alamat, telepon, email
- Mencantumkan: nama & alamat pelanggan
- Tabel item dengan kolom: Nama Produk, Qty, Satuan, Harga, Diskon/Item, Jumlah
- Area tanda tangan: Hormat Kami & Diterima Oleh
- Header: "INVOICE"

#### Format 3: Faktur Penjualan
- Identik dengan Invoice namun header bertuliskan "FAKTUR PENJUALAN"
- Cocok untuk transaksi B2B atau yang memerlukan dokumen formal

**Konfigurasi cetak (dari sheet Pengaturan):**
- Jenis Nota Transaksi: pilih default format
- Metode Cetak: `Tampil Print Preview` atau langsung cetak

---

### Sheet 8: Detail Transaksi Keluar

**Fungsi:** Menyimpan detail per item dari setiap transaksi. Sheet pendukung untuk keperluan analisis mendalam atau rekonsiliasi.

---

### Sheet 9: Hapus Transaksi Keluar

**Fungsi:** Fitur koreksi untuk menghapus transaksi yang salah input.

**Cara kerja:**
1. Masukkan `No. Transaksi` yang ingin dihapus
2. Sistem menampilkan preview seluruh detail transaksi tersebut:
   - Tanggal, Kasir, Pelanggan, Metode Bayar
   - Daftar item (nama, harga, diskon, qty, satuan, jumlah)
   - Ringkasan: subtotal, diskon, total, bayar, kembalian/sisa
3. Kasir/Admin mengkonfirmasi penghapusan
4. VBA menghapus baris-baris terkait dari `Daftar Transaksi Keluar`

**Formula kunci:**
```excel
Detail item  = VLOOKUP(KataKunci, 'Daftar Transaksi Keluar'!A:Q, kolom, FALSE)
Kata Kunci   = No.Transaksi & NomorUrut
```

---

### Sheet 10: Input Stok Opname

**Fungsi:** Form input untuk proses stok opname (pengecekan fisik stok).

**Field input:**

| Field | Keterangan |
|---|---|
| Tanggal * | Auto-fill dengan `TODAY()`, bisa diubah |
| Nama Produk * | Pilih dari Daftar Produk |
| Kategori | Auto-fill dari Daftar Produk |
| Satuan | Auto-fill dari Daftar Produk |
| Stok Sistem | Auto-fill: jumlah stok menurut sistem |
| Stok Fisik * | Input manual hasil hitung fisik |
| Selisih | `Stok Fisik - Stok Sistem` (otomatis) |
| Keterangan | Catatan opsional |

`*` = wajib diisi

**Formula selisih:**
```excel
Selisih = IF(VALUE(StokFisik)=0, 0, StokFisik - StokSistem)
```

---

### Sheet 11: Daftar Stok Opname

**Fungsi:** Database riwayat semua hasil opname yang pernah dilakukan.

**Kolom data:**

| Kolom | Keterangan |
|---|---|
| Tanggal | Tanggal opname |
| Nama Produk | Produk yang di-opname |
| Kategori | Kategori produk |
| Satuan | Satuan produk |
| Stok Sistem | Stok menurut sistem saat opname |
| Stok Fisik | Stok fisik hasil hitung manual |
| Selisih | Perbedaan (bisa negatif/positif) |
| Keterangan | Catatan tambahan |

---

### Sheet 12: Pengaturan

**Fungsi:** Pusat konfigurasi seluruh aplikasi. Perubahan di sini mempengaruhi semua modul lain.

**Bagian A: Informasi Toko**

| Parameter | Contoh Nilai | Keterangan |
|---|---|---|
| Nama Toko | Swalayan Besi Semarang | Tampil di semua nota |
| Alamat | Jl. Merdeka No. 123, Makassar | Tampil di nota |
| Telepon/HP | 085399065706 | Tampil di nota |
| Email | emailtes@email.com | Tampil di nota |
| Kasir | ADMIN | Nama kasir default |

**Bagian B: Konfigurasi Transaksi**

| Parameter | Nilai yang Mungkin | Keterangan |
|---|---|---|
| Metode Diskon | `Nominal` / `Persen` | Cara penerapan diskon keseluruhan |
| Pajak | Angka (0 = tanpa pajak) | Persentase pajak/PPn |
| Jenis Nota Transaksi | `Struk Kasir Ukuran 58 mm` / `Invoice` / `Faktur Penjualan` | Format nota default |
| Metode Cetak | `Tampil Print Preview` / (langsung cetak) | Perilaku tombol cetak |
| Logo pada Nota | Ya/Tidak | Apakah logo toko ditampilkan |

**Bagian C: Informasi Bank**

| Sub-bagian | Parameter | Contoh |
|---|---|---|
| Bank 1 | Nama Bank | BCA |
| Bank 1 | No. Rekening | 000011111111 |
| Bank 1 | Atas Nama | ZULKIFLI LATIF |
| Bank 2 | Nama Bank | (kosong) |
| Bank 2 | No. Rekening | (kosong) |
| Bank 2 | Atas Nama | (kosong) |

**Bagian D: Footer Nota**

| Jenis Footer | Baris | Contoh Teks |
|---|---|---|
| Struk Kasir | Baris 1 | Terima kasih atas kunjungan Anda! |
| Struk Kasir | Baris 2 | Kami tunggu kedatangan Anda kembali. |
| Struk Kasir | Baris 3 | Semoga hari Anda menyenangkan! :) |
| Invoice/Faktur | Baris 1 | Terima kasih atas kepercayaan Anda. |
| Invoice/Faktur | Baris 2 | Mohon simpan dokumen ini sebagai bukti transaksi. |
| Invoice/Faktur | Baris 3 | (kosong) |
| Hormat Kami | Nama TTD | (nama pejabat toko) |

---

### Sheet 13: Input Barang Masuk

**Fungsi:** Form mencatat pembelian/pengadaan stok dari supplier.

**Field input:**

| Field | Keterangan |
|---|---|
| Tanggal * | Auto-fill `TODAY()`, bisa diubah |
| Nama Supplier | Pilih dari Daftar Supplier (opsional) |
| Nama Produk * | Pilih dari Daftar Produk |
| Kategori | Auto-fill dari Daftar Produk |
| Satuan | Auto-fill dari Daftar Produk |
| Harga Beli | Input manual harga beli saat ini |
| Jumlah * | Jumlah unit yang dibeli |
| Total | `Harga Beli × Jumlah` (otomatis) |

**Formula:**
```excel
Kategori = IFERROR(VLOOKUP(NamaProduk, 'Daftar Produk'!A:C, 2, FALSE), "")
Satuan   = IFERROR(VLOOKUP(NamaProduk, 'Daftar Produk'!A:C, 3, FALSE), "")
Total    = HargaBeli × Jumlah
```

Setelah disimpan, VBA akan **menambah stok** produk terkait di `Daftar Produk` sebesar jumlah yang diinput.

---

### Sheet 14: Daftar Barang Masuk

**Fungsi:** Riwayat semua pengadaan stok yang pernah dilakukan.

**Kolom data:**

| Kolom | Keterangan |
|---|---|
| Tanggal | Tanggal pengadaan |
| Nama Supplier | Nama supplier |
| Nama Produk | Produk yang dibeli |
| Kategori | Kategori produk |
| Satuan | Satuan produk |
| Harga Beli | Harga beli per unit |
| Jumlah | Jumlah yang dibeli |
| Total | Nilai total pembelian |

**Fitur:**
- Total Record dan Total nilai ditampilkan di baris header dengan `SUBTOTAL()`
- Mendukung filter/autofilter

---

### Sheet 15: Tabel Kategori

**Fungsi:** Sumber data untuk dropdown kategori produk.

**Data default:**

```
MAKANAN & MINUMAN
SEMBAKO
PERAWATAN DIRI
ELEKTRONIK
PAKAIAN & AKSESORIS
PERALATAN
JASA
```

---

### Sheet 16: Tabel Satuan

**Fungsi:** Sumber data untuk dropdown satuan produk.

**Data default:**

```
Pcs
Kg
Liter
Pack
Botol
Bungkus
```

---

### Sheet 17: Tabel Metode Bayar

**Fungsi:** Sumber data untuk dropdown metode pembayaran.

**Data default:**

```
Tunai
DP
QRIS
Debit Mandiri
Debit BNI
Debit BCA
Debit BRI
OVO
Gopay
```

---

## Logika Bisnis Utama (Business Rules)

### Stok Otomatis
- Setiap transaksi penjualan tersimpan → stok produk berkurang sebesar qty terjual (hanya jika `Hitung Stok = YA`)
- Setiap input barang masuk tersimpan → stok produk bertambah sebesar jumlah yang dibeli
- Stok opname tidak otomatis mengubah stok sistem — hanya mencatat selisih. Koreksi stok dilakukan manual.

### Penomoran Transaksi
- No. Transaksi dimulai dari `10000001`
- Formula: `IFERROR(MAX(No_Transaksi) + 1, 10000001)`
- Nomor bersifat sequential, tidak bisa diulang

### Kalkulasi Profit
```
Profit per item = (Harga Jual - Harga Modal) × Qty - Diskon Item
```

### Diskon
- Diskon per item: diambil dari master produk, bisa diubah per transaksi
- Diskon keseluruhan: dalam persen atau nominal (sesuai konfigurasi Pengaturan)
- Keduanya bisa digunakan bersamaan dalam satu transaksi

### Metode DP (Down Payment)
- Total = nilai penuh transaksi
- DP = jumlah yang dibayarkan sekarang
- Sisa = Total - DP
- Sisa dicatat di database untuk keperluan tagihan berikutnya

### Terbilang
- Terdapat custom VBA function `Terbilangku()` yang mengubah angka menjadi kalimat Rupiah
- Contoh: `Terbilangku(164600)` → "Seratus Enam Puluh Empat Ribu Enam Ratus Rupiah"
- Digunakan di semua format nota

---

## Alur Penggunaan (User Flow)

### Setup Awal (Sekali Saja)
```
1. Buka file Excel, aktifkan macro
2. Isi Sheet Pengaturan (nama toko, alamat, telp, email, kasir)
3. Konfigurasi metode diskon dan pajak
4. Tambahkan produk di Daftar Produk
5. Tambahkan supplier di Daftar Supplier (opsional)
6. Tambahkan pelanggan di Daftar Pelanggan (opsional)
7. Atur user di Manajemen Pengguna
8. Atur metode bayar di Tabel Metode Bayar jika perlu
```

### Operasional Harian: Proses Kasir
```
1. Buka aplikasi → Login (jika diaktifkan)
2. Buka sheet Transaksi Kasir
3. Sistem auto-generate No. Transaksi baru
4. Pilih/isi Pelanggan (default: UMUM)
5. Input produk:
   a. Ketik nama produk → sistem auto-fill harga, satuan, stok, diskon
   b. Pilih tipe harga (Satuan / Grosir / Promo / Manual)
   c. Isi Qty
   d. Ubah diskon per item jika perlu
   e. Ulangi untuk produk berikutnya
6. Isi diskon keseluruhan (jika ada)
7. Pilih Metode Bayar
8. Isi jumlah bayar → sistem auto-hitung kembalian / sisa DP
9. Klik tombol SIMPAN (VBA menyimpan ke Daftar Transaksi Keluar)
10. Cetak nota jika diperlukan (pilih format: struk / invoice / faktur)
```

### Pengadaan Stok
```
1. Buka sheet Input Barang Masuk
2. Isi tanggal (auto-fill hari ini)
3. Pilih nama supplier (opsional)
4. Pilih nama produk → sistem auto-fill kategori & satuan
5. Isi harga beli dan jumlah → total otomatis dihitung
6. Klik SIMPAN → stok produk bertambah otomatis
```

### Stok Opname
```
1. Buka sheet Input Stok Opname
2. Pilih produk yang akan di-opname
3. Sistem menampilkan Stok Sistem (dari database)
4. Hitung stok fisik secara manual
5. Isi Stok Fisik → selisih otomatis dihitung
6. Isi keterangan jika ada
7. Klik SIMPAN → data masuk ke Daftar Stok Opname
```

### Cetak Ulang Nota
```
1. Buka sheet Cetak Nota
2. Isi No. Transaksi yang ingin dicetak ulang
3. Sistem otomatis menampilkan semua detail transaksi via VLOOKUP
4. Pilih format nota (struk / invoice / faktur)
5. Klik cetak
```

### Koreksi Transaksi
```
1. Buka sheet Hapus Transaksi Keluar
2. Masukkan No. Transaksi yang akan dihapus
3. Verifikasi detail transaksi yang tampil
4. Klik HAPUS → VBA menghapus semua baris terkait dari database
   CATATAN: stok tidak otomatis dikembalikan, perlu adjustment manual
```

---

## Persyaratan Teknis

| Aspek | Ketentuan |
|---|---|
| Platform | Microsoft Excel for Windows (versi 2016 ke atas direkomendasikan) |
| Macro | Harus diaktifkan (Enable Macros) |
| Excel Online | **Tidak didukung** (VBA tidak berjalan di browser) |
| Format file | `.xlsx` (tanpa VBA) atau `.xlsm` (dengan VBA aktif) — disarankan `.xlsm` |
| Printer | Mendukung printer thermal 58mm untuk format struk kasir |

---

## Fungsi VBA Kustom yang Dibutuhkan

### `Terbilangku(angka)`
Mengubah angka numerik menjadi teks terbilang dalam Bahasa Indonesia.

**Contoh:**
```vba
Terbilangku(75000)   → "Tujuh Puluh Lima Ribu"
Terbilangku(164600)  → "Seratus Enam Puluh Empat Ribu Enam Ratus"
```

**Digunakan di:**
- Struk Kasir: `"Terbilang: " & PROPER(Terbilangku(ROUND(Total, 0)) & " Rupiah")`
- Invoice dan Faktur: format serupa

### VBA Simpan Transaksi
Triggered dari tombol di sheet Transaksi Kasir. Logika:
1. Ambil semua data dari form kasir
2. Loop setiap baris item yang terisi
3. Append satu baris per item ke `Daftar Transaksi Keluar`
4. Update stok di `Daftar Produk` untuk setiap item (jika `Hitung Stok = YA`)
5. Clear form kasir untuk transaksi berikutnya

### VBA Simpan Barang Masuk
Triggered dari tombol di sheet Input Barang Masuk. Logika:
1. Ambil data dari form
2. Append satu baris ke `Daftar Barang Masuk`
3. Cari produk di `Daftar Produk` dan tambahkan stok sebesar jumlah yang diinput
4. Clear form

### VBA Simpan Stok Opname
Triggered dari tombol di sheet Input Stok Opname. Logika:
1. Ambil data dari form
2. Append satu baris ke `Daftar Stok Opname`
3. Clear form

### VBA Hapus Transaksi
Triggered dari tombol di sheet Hapus Transaksi Keluar. Logika:
1. Ambil No. Transaksi yang ingin dihapus
2. Loop seluruh baris di `Daftar Transaksi Keluar`
3. Hapus semua baris yang memiliki No. Transaksi tersebut
4. Refresh tampilan

---

## Struktur Named Range yang Direkomendasikan

| Named Range | Merujuk ke | Keterangan |
|---|---|---|
| `No_Transaksi` | `'Daftar Transaksi Keluar'!$B:$B` | Digunakan untuk MAX() penomoran |
| `DaftarProduk` | `'Daftar Produk'!$A:$K` | Digunakan untuk VLOOKUP produk |
| `DaftarPelanggan` | `'Daftar Pelanggan'!$A:$E` | Digunakan untuk VLOOKUP pelanggan |
| `TabelKategori` | `'Tabel Kategori'!$A:$A` | Sumber dropdown kategori |
| `TabelSatuan` | `'Tabel Satuan'!$A:$A` | Sumber dropdown satuan |
| `TabelMetodeBayar` | `'Tabel Metode Bayar'!$A:$A` | Sumber dropdown metode bayar |

---

## Catatan untuk Pengembangan Lebih Lanjut

- Aplikasi ini dapat dimigrasikan ke web app (Laravel, Next.js, dll.) dengan mempertahankan semua business rule di atas
- Database relasional yang direkomendasikan: PostgreSQL atau MySQL dengan tabel mengikuti struktur sheet di atas
- Fungsi `Terbilangku()` dapat direplikasi dengan library terbilang di berbagai bahasa pemrograman
- Untuk sistem multi-kasir/multi-cabang, perlu mekanisme sinkronisasi No. Transaksi agar tidak duplikasi
- Format nota bisa direplikasi dengan library PDF (seperti DomPDF di PHP, jsPDF di JavaScript, atau ReportLab di Python)
