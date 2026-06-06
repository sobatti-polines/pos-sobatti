# FEATURE_PLAN_AKUNTANSI.md
# Rencana Fitur: Modul Akuntansi & Laporan Keuangan — POS Sobatti

> **Konteks:** Dokumen ini adalah spesifikasi lengkap untuk implementasi modul akuntansi terintegrasi pada aplikasi POS Sobatti (Next.js 16 + Supabase). Dibuat berdasarkan permintaan konsultan pajak dan kebutuhan klien. Gunakan dokumen ini sebagai sumber kebenaran tunggal saat mengimplementasikan fitur-fitur di bawah.

---

## Daftar Isi

1. [Gambaran Besar & Filosofi](#1-gambaran-besar--filosofi)
2. [Modul A — Pembelian / Barang Masuk](#modul-a--pembelian--barang-masuk)
3. [Modul B — Hutang Dagang](#modul-b--hutang-dagang)
4. [Modul C — Penjualan / Barang Keluar](#modul-c--penjualan--barang-keluar)
5. [Modul D — Piutang & Kas](#modul-d--piutang--kas)
6. [Modul E — Persediaan Average (AVCO)](#modul-e--persediaan-average-avco)
7. [Modul F — Laporan Kasir (Daily Report)](#modul-f--laporan-kasir-daily-report)
8. [Modul G — Laporan Keuangan](#modul-g--laporan-keuangan)
   - [G1 — Profit & Loss (Laba Rugi)](#g1--profit--loss-laba-rugi)
   - [G2 — Balance Sheet (Neraca)](#g2--balance-sheet-neraca)
9. [Pilihan Integrasi: Full vs Partial](#9-pilihan-integrasi-full-vs-partial)
10. [Skema Database Baru](#10-skema-database-baru)
11. [Logika Jurnal Otomatis](#11-logika-jurnal-otomatis)
12. [Urutan Implementasi yang Disarankan](#12-urutan-implementasi-yang-disarankan)
13. [Konvensi Kode](#13-konvensi-kode)

---

## 1. Gambaran Besar & Filosofi

### Apa yang diminta konsultan pajak?

Konsultan pajak meminta POS Sobatti tidak hanya menjadi **kasir** (mencatat transaksi harian), tapi juga menjadi **sistem akuntansi ringan** yang bisa menghasilkan laporan keuangan standar. Ini penting untuk:

- Pelaporan pajak (PPh Badan / PPh 21)
- Audit internal toko
- Pengambilan keputusan bisnis (apakah toko untung atau rugi?)
- Memantau aset, hutang, dan modal secara real-time

### Konsep Dasar Akuntansi yang Wajib Dipahami Agent

| Istilah | Penjelasan Sederhana |
|---|---|
| **Debet** | Penambahan aset atau pengeluaran |
| **Kredit** | Pengurangan aset atau penambahan kewajiban/modal |
| **Jurnal** | Catatan setiap transaksi dalam format Debet/Kredit |
| **Buku Besar (Ledger)** | Kumpulan semua jurnal per akun |
| **Neraca (Balance Sheet)** | Foto keuangan di satu titik waktu: Aset = Hutang + Modal |
| **Laba Rugi (P&L)** | Pendapatan - Beban = Laba/Rugi dalam periode tertentu |
| **AVCO** | Average Cost — metode valuasi stok dengan harga rata-rata tertimbang |
| **HPP** | Harga Pokok Penjualan — biaya barang yang sudah terjual |

### Dua Mode Implementasi

```
MODE 1: TERINTEGRASI PENUH
   Setiap transaksi POS → otomatis buat jurnal akuntansi → otomatis masuk laporan keuangan
   Keuntungan: Real-time, tidak ada input ganda
   Tantangan: Kompleks, butuh mapping akun yang benar sejak awal

MODE 2: PARTIAL / CUSTOM
   Laporan keuangan dibuat dari agregasi data POS tanpa double-entry accounting penuh
   Keuntungan: Lebih cepat diimplementasi, lebih mudah dikoreksi
   Tantangan: Tidak bisa diaudit secara akuntansi formal
```

**Rekomendasi:** Mulai dengan **Mode 2 (Partial)** untuk launch cepat, kemudian upgrade ke **Mode 1 (Terintegrasi)** secara bertahap. Lihat [Bagian 9](#9-pilihan-integrasi-full-vs-partial) untuk detail.

---

## Modul A — Pembelian / Barang Masuk

### Apa ini?
Pencatatan setiap kali toko **membeli barang dari supplier** — berapa banyak (quantity) dan berapa nilainya (value dalam Rupiah).

### Data yang Harus Dicatat

```
Setiap record Barang Masuk harus menyimpan:
- id_barang_masuk       : UUID, primary key
- nomor_po              : string, "PO-YYYYMM-XXXX", sequential
- tanggal_pembelian     : date
- id_supplier           : FK ke tabel supplier
- id_pengguna           : FK ke tabel pengguna (siapa yang input)
- status                : enum('draft', 'diterima', 'parsial', 'dibatalkan')
- total_nilai           : numeric (IDR), dihitung otomatis dari detail
- catatan               : text, opsional
- created_at / updated_at
```

```
Setiap item dalam Barang Masuk (detail):
- id_detail_bm          : UUID
- id_barang_masuk       : FK
- id_produk             : FK ke tabel produk
- quantity_pesan        : numeric
- quantity_diterima     : numeric (bisa berbeda jika barang kurang)
- satuan                : string (ikut satuan produk)
- harga_beli_satuan     : numeric (IDR per unit)
- diskon_persen         : numeric, default 0
- subtotal              : numeric = quantity_diterima × harga_beli_satuan × (1 - diskon/100)
```

### Kalkulasi Value

```
subtotal_item = quantity_diterima × harga_beli_satuan × (1 - diskon_persen/100)
total_po      = SUM(subtotal_item semua detail)
```

### Alur Proses

```
1. Kasir/Admin buka halaman "Pembelian Baru"
2. Pilih supplier, isi tanggal
3. Tambah item: cari produk (barcode/nama), isi qty & harga beli
4. Simpan sebagai DRAFT (stok belum berubah)
5. Saat barang fisik datang → klik "Terima Barang"
   → status jadi 'diterima' atau 'parsial' (jika qty kurang)
   → stok produk bertambah (UPDATE stok di tabel produk)
   → harga AVCO produk dihitung ulang (lihat Modul E)
   → jurnal akuntansi dibuat (lihat Bagian 11)
6. Jika pembayaran belum lunas → buat record Hutang Dagang (lihat Modul B)
```

### Halaman UI yang Dibutuhkan

- `/dashboard/pembelian` — daftar semua PO dengan filter status, supplier, tanggal
- `/dashboard/pembelian/baru` — form buat PO baru
- `/dashboard/pembelian/[id]` — detail PO, tombol "Terima Barang", tombol "Bayar Hutang"

### File Kode yang Perlu Dibuat/Dimodifikasi

```
lib/pembelian.ts              — fungsi: createPO, receivePO, getPOList, getPODetail
app/dashboard/pembelian/      — halaman-halaman UI
supabase/migrations/          — tabel barang_masuk sudah ada, perlu kolom tambahan
```

---

## Modul B — Hutang Dagang

### Apa ini?
Ketika toko membeli barang dari supplier tapi **belum membayar lunas**, itu adalah **Hutang Dagang**. Modul ini melacak berapa yang masih harus dibayar kepada setiap supplier.

### Kapan Hutang Terbentuk?

Hutang terbentuk secara otomatis ketika:
1. Barang Masuk diterima TAPI metode pembayaran di PO adalah "Kredit/Tempo"
2. Admin membuat hutang manual (untuk input saldo awal hutang lama)

### Data yang Harus Dicatat

```
Tabel: hutang_dagang
- id_hutang             : UUID
- id_barang_masuk       : FK (nullable, untuk hutang manual tidak ada PO)
- id_supplier           : FK
- tanggal_hutang        : date (tanggal barang diterima)
- tanggal_jatuh_tempo   : date
- jumlah_awal           : numeric (IDR) — total hutang saat dibuat
- jumlah_terbayar       : numeric (IDR) — akumulasi pembayaran
- sisa_hutang           : numeric (computed: jumlah_awal - jumlah_terbayar)
- status                : enum('belum_lunas', 'lunas', 'lewat_jatuh_tempo')
- catatan               : text

Tabel: pembayaran_hutang
- id_pembayaran         : UUID
- id_hutang             : FK ke hutang_dagang
- tanggal_bayar         : date
- jumlah_bayar          : numeric (IDR)
- metode_bayar          : enum('tunai', 'transfer', 'cek', 'giro')
- bukti_bayar           : text (nomor referensi / nomor cek)
- id_pengguna           : FK (siapa yang mencatat pembayaran)
- catatan               : text
```

### Logika Status Hutang

```typescript
// Dijalankan via cron job harian atau trigger Supabase
function updateStatusHutang(hutang: HutangDagang): StatusHutang {
  if (hutang.sisa_hutang <= 0) return 'lunas';
  if (new Date() > hutang.tanggal_jatuh_tempo) return 'lewat_jatuh_tempo';
  return 'belum_lunas';
}
```

### Halaman UI yang Dibutuhkan

- `/dashboard/hutang` — daftar hutang dengan summary total hutang, filter status/supplier
- `/dashboard/hutang/[id]` — detail hutang, tombol "Bayar Sekarang", riwayat pembayaran
- Widget di Dashboard: "Total Hutang Jatuh Tempo Hari Ini / Minggu Ini"

### Laporan Hutang

```
Laporan Aging Hutang (untuk konsultan pajak):
- Belum jatuh tempo
- Lewat 1-30 hari
- Lewat 31-60 hari
- Lewat 61-90 hari
- Lewat > 90 hari
Total per kategori + grand total
```

---

## Modul C — Penjualan / Barang Keluar

### Apa ini?
Data penjualan **sudah ada** di tabel `transaksi_keluar` dan `detail_transaksi_keluar`. Yang perlu ditambahkan adalah:
1. Pencatatan **nilai HPP** (Harga Pokok Penjualan) per item saat checkout
2. **Quantity tracking** yang terhubung ke laporan keuangan

### Apa yang Perlu Ditambahkan ke Sistem yang Ada

```
Tabel detail_transaksi_keluar — tambah kolom:
- harga_pokok_satuan    : numeric — snapshot harga AVCO saat transaksi
- total_harga_pokok     : numeric — harga_pokok_satuan × quantity

Tabel transaksi_keluar — tambah kolom:
- total_hpp             : numeric — SUM dari total_harga_pokok semua item
- laba_kotor            : numeric — computed: total_penjualan - total_hpp
```

### Kenapa HPP Harus Di-snapshot?

Karena harga AVCO produk berubah setiap kali ada pembelian baru. HPP di suatu transaksi harus mencerminkan harga pokok **saat transaksi itu terjadi**, bukan harga sekarang.

### Logika saat Checkout

```typescript
// Di lib/pos.ts, saat fungsi checkout dipanggil:
async function processCheckout(cart: CartItem[]) {
  for (const item of cart) {
    const produk = await getProduk(item.id_produk);
    item.harga_pokok_satuan = produk.harga_pokok_avco; // snapshot!
    item.total_harga_pokok = item.harga_pokok_satuan × item.quantity;
  }
  // ... sisa logika checkout
}
```

### Laporan Penjualan (sudah ada, perlu ditambah kolom):

- Quantity terjual per produk per periode
- Value penjualan (harga jual)
- Value HPP (harga pokok)
- Laba kotor per produk
- Laba kotor per kategori

---

## Modul D — Piutang & Kas

### Apa ini?

**Piutang:** Ketika toko **menjual barang ke pelanggan dengan pembayaran belum lunas** (sistem kredit/hutang pelanggan).

**Kas:** Total uang tunai yang seharusnya ada di kas toko, dihitung dari semua transaksi.

### Piutang Dagang

```
Tabel: piutang_dagang
- id_piutang            : UUID
- id_transaksi_keluar   : FK (nullable, untuk piutang manual)
- id_pelanggan          : FK ke tabel pelanggan
- tanggal_piutang       : date
- tanggal_jatuh_tempo   : date
- jumlah_awal           : numeric (IDR)
- jumlah_terbayar       : numeric (IDR)
- sisa_piutang          : numeric (computed)
- status                : enum('belum_lunas', 'lunas', 'lewat_jatuh_tempo', 'macet')
- catatan               : text

Tabel: pembayaran_piutang
- id_pembayaran         : UUID
- id_piutang            : FK
- tanggal_bayar         : date
- jumlah_bayar          : numeric
- metode_bayar          : string
- id_pengguna           : FK
- catatan               : text
```

### Kapan Piutang Terbentuk?

Saat POS checkout dengan metode pembayaran **"Kredit"** atau **"DP + Kredit"**:
- Jika DP: bayar sebagian → sisa jadi piutang
- Jika full kredit: seluruh nilai transaksi jadi piutang

### Kas

Kas dihitung otomatis dari:

```
Saldo Kas = Saldo Awal
  + Total Penjualan Tunai masuk
  + Total Pembayaran Piutang masuk
  - Total Pembayaran Hutang keluar
  - Total Pengeluaran Operasional (jika ada modul pengeluaran)
```

```
Tabel: saldo_kas_harian  (opsional, untuk snapshot harian)
- tanggal       : date, unique
- saldo_awal    : numeric
- total_masuk   : numeric
- total_keluar  : numeric
- saldo_akhir   : numeric
- dikonfirmasi  : boolean (kasir tutup kasir harian)
- id_pengguna   : FK
```

### Halaman UI yang Dibutuhkan

- `/dashboard/piutang` — daftar piutang pelanggan, filter, aging
- `/dashboard/kas` — posisi kas hari ini + ringkasan mingguan

---

## Modul E — Persediaan Average (AVCO)

### Apa ini?
**AVCO (Average Cost / Weighted Average)** adalah metode menghitung **harga pokok stok** dengan cara merata-ratakan semua pembelian.

### Rumus AVCO

```
Harga AVCO Baru = (Stok Lama × Harga AVCO Lama + Qty Masuk × Harga Beli)
                  ÷ (Stok Lama + Qty Masuk)
```

**Contoh:**
```
Stok awal     : 10 unit @ Rp 5.000 = Rp 50.000
Beli baru     : 20 unit @ Rp 6.000 = Rp 120.000
              ─────────────────────────────────
Total         : 30 unit             Rp 170.000
AVCO baru     : Rp 170.000 ÷ 30   = Rp 5.667/unit
```

### Data yang Perlu Ditambahkan

```
Tabel produk — tambah kolom:
- harga_pokok_avco      : numeric — harga AVCO terkini (update setiap ada pembelian)
- nilai_persediaan      : numeric — computed: stok × harga_pokok_avco

Tabel baru: riwayat_avco
- id                    : UUID
- id_produk             : FK
- tanggal               : timestamp
- jenis_mutasi          : enum('pembelian', 'penjualan', 'koreksi', 'retur')
- id_referensi          : UUID (ID barang masuk atau transaksi keluar)
- qty_masuk             : numeric (positif jika masuk, null jika keluar)
- qty_keluar            : numeric (positif jika keluar, null jika masuk)
- harga_satuan_transaksi: numeric
- stok_sebelum          : numeric
- avco_sebelum          : numeric
- stok_sesudah          : numeric
- avco_sesudah          : numeric
- nilai_persediaan_sesudah: numeric
```

### Kapan AVCO Dihitung Ulang?

| Event | Action |
|---|---|
| Barang Masuk diterima | Hitung AVCO baru, update `produk.harga_pokok_avco` |
| Checkout / Barang Keluar | Catat HPP pakai AVCO saat itu (TIDAK ubah AVCO) |
| Stock Opname | Jika ada koreksi qty, AVCO tidak berubah (hanya qty) |
| Retur Penjualan | Stok bertambah, AVCO pakai nilai saat dijual |
| Retur Pembelian | Stok berkurang, hitung ulang AVCO |

### Laporan Persediaan

```
Laporan Kartu Stok per Produk:
Tanggal | Keterangan | Masuk Qty | Masuk Harga | Keluar Qty | Keluar Harga | Saldo Qty | Saldo Nilai | AVCO

Laporan Nilai Persediaan:
Kategori | Produk | Stok | AVCO | Nilai
Total nilai persediaan = aset lancar untuk Balance Sheet
```

---

## Modul F — Laporan Kasir (Daily Report)

### Apa ini?
Laporan harian yang sudah ada di POS Sobatti (dashboard), yang perlu **diperluas** menjadi laporan kasir formal yang bisa dicetak dan diarsip.

### Data yang Harus Ada di Laporan Kasir

```
LAPORAN KASIR HARIAN
Toko        : [nama toko dari pengaturan]
Kasir       : [nama pengguna]
Tanggal     : [tanggal]
Shift       : [opsional: Pagi/Siang/Malam]

─── RINGKASAN TRANSAKSI ───────────────────────────────
Total Transaksi          :  XX transaksi
Total Item Terjual       :  XX item (XX qty)
Total Penjualan Kotor    :  Rp XXX.XXX.XXX
Total Diskon             :  Rp   X.XXX.XXX
Total Penjualan Bersih   :  Rp XXX.XXX.XXX
Total HPP                :  Rp  XX.XXX.XXX
Laba Kotor               :  Rp  XX.XXX.XXX

─── RINCIAN METODE PEMBAYARAN ─────────────────────────
Tunai                    :  Rp XXX.XXX
Transfer Bank            :  Rp XXX.XXX
QRIS                     :  Rp XXX.XXX
Kredit/Piutang           :  Rp XXX.XXX
Subtotal                 :  Rp XXX.XXX

─── MUTASI KAS ────────────────────────────────────────
Saldo Kas Awal           :  Rp XXX.XXX
(+) Penerimaan Tunai     :  Rp XXX.XXX
(+) Penerimaan Piutang   :  Rp XXX.XXX
(-) Pembayaran Hutang    :  Rp XXX.XXX
(-) Pengeluaran          :  Rp XXX.XXX
Saldo Kas Akhir          :  Rp XXX.XXX

─── 10 PRODUK TERLARIS HARI INI ───────────────────────
No | Nama Produk | Qty | Total Nilai

Tanda tangan kasir: ___________  Tanggal: ___________
```

### Alur Tutup Kasir

```
1. Akhir shift → kasir buka halaman "Tutup Kasir"
2. Sistem tampilkan ringkasan otomatis dari data transaksi
3. Kasir input "Uang Tunai Aktual di Laci Kas"
4. Sistem hitung selisih (Over/Short)
5. Kasir konfirmasi → Laporan Kasir terkunci (tidak bisa diubah)
6. Tombol "Cetak Laporan Kasir"
7. Data dikirim ke modul Laporan Keuangan
```

### Halaman UI

- `/dashboard/tutup-kasir` — form tutup kasir harian
- `/dashboard/laporan-kasir` — daftar laporan kasir per hari, filter per kasir/tanggal
- `/dashboard/laporan-kasir/[id]` — detail laporan, tombol cetak

---

## Modul G — Laporan Keuangan

### G1 — Profit & Loss (Laporan Laba Rugi)

#### Apa ini?
Laporan yang menunjukkan **apakah toko untung atau rugi** dalam satu periode (biasanya bulanan atau tahunan).

#### Format Laporan Laba Rugi

```
LAPORAN LABA RUGI
[Nama Toko]
Periode: [Bulan/Tahun] atau [Tanggal Awal] s/d [Tanggal Akhir]

PENDAPATAN
  Penjualan Bersih                         Rp XXX.XXX.XXX
  (Penjualan Kotor - Retur - Diskon)
                                          ─────────────────
  Total Pendapatan                         Rp XXX.XXX.XXX

HARGA POKOK PENJUALAN (HPP)
  Persediaan Awal Periode                  Rp  XX.XXX.XXX
  (+) Pembelian Bersih                     Rp  XX.XXX.XXX
  (-) Persediaan Akhir Periode             Rp  XX.XXX.XXX
                                          ─────────────────
  Total HPP                                Rp  XX.XXX.XXX

LABA KOTOR                                 Rp  XX.XXX.XXX
  (Total Pendapatan - Total HPP)

BEBAN OPERASIONAL (opsional, jika ada modul pengeluaran)
  Gaji Karyawan                            Rp   X.XXX.XXX
  Sewa Tempat                              Rp   X.XXX.XXX
  Listrik & Air                            Rp     XXX.XXX
  Lain-lain                                Rp     XXX.XXX
                                          ─────────────────
  Total Beban Operasional                  Rp   X.XXX.XXX

LABA BERSIH SEBELUM PAJAK                  Rp  XX.XXX.XXX
  (-) Estimasi Pajak (PPh)                 Rp   X.XXX.XXX
LABA BERSIH SETELAH PAJAK                  Rp  XX.XXX.XXX
```

#### Sumber Data

| Item Laporan | Sumber Data di Database |
|---|---|
| Penjualan Bersih | `SUM(transaksi_keluar.total_bayar)` periode tertentu |
| HPP | `SUM(transaksi_keluar.total_hpp)` periode tertentu |
| Persediaan Awal | Nilai persediaan snapshot awal periode |
| Persediaan Akhir | `SUM(produk.stok × produk.harga_pokok_avco)` saat ini |
| Pembelian Bersih | `SUM(barang_masuk.total_nilai)` periode tertentu |

#### Halaman UI

- `/dashboard/laporan/laba-rugi` — form pilih periode, tampilkan laporan, tombol cetak/export

---

### G2 — Balance Sheet (Neraca)

#### Apa ini?
Laporan yang menunjukkan **posisi keuangan toko** pada satu titik waktu: apa yang dimiliki (Aset), apa yang dihutangi (Kewajiban), dan berapa modal bersih (Modal/Ekuitas).

#### Prinsip Neraca

```
TOTAL ASET = TOTAL KEWAJIBAN + TOTAL MODAL
```

Jika angka kanan dan kiri tidak sama → ada data yang salah.

#### Format Neraca

```
NERACA / BALANCE SHEET
[Nama Toko]
Per Tanggal: [Tanggal]

ASET
  Aset Lancar:
    Kas & Setara Kas                       Rp  XX.XXX.XXX
    Piutang Dagang                         Rp   X.XXX.XXX
    Persediaan Barang                      Rp  XX.XXX.XXX
    Aset Lancar Lainnya                    Rp           0
                                          ─────────────────
    Total Aset Lancar                      Rp  XX.XXX.XXX

  Aset Tetap (opsional, input manual):
    Peralatan & Inventaris                 Rp   X.XXX.XXX
    (-) Akumulasi Penyusutan               Rp    (XXX.XXX)
    Bangunan / Renovasi                    Rp   X.XXX.XXX
                                          ─────────────────
    Total Aset Tetap                       Rp   X.XXX.XXX

TOTAL ASET                                 Rp  XX.XXX.XXX

KEWAJIBAN
  Kewajiban Lancar:
    Hutang Dagang                          Rp   X.XXX.XXX
    Hutang Jangka Pendek Lainnya           Rp           0
                                          ─────────────────
    Total Kewajiban Lancar                 Rp   X.XXX.XXX

  Kewajiban Jangka Panjang:
    Hutang Bank / Pinjaman                 Rp           0
                                          ─────────────────
    Total Kewajiban                        Rp   X.XXX.XXX

MODAL / EKUITAS
  Modal Awal                               Rp  XX.XXX.XXX
  (+) Laba Bersih Periode Berjalan         Rp   X.XXX.XXX
  (-) Pengambilan Prive (jika ada)         Rp           0
                                          ─────────────────
  Total Modal                              Rp  XX.XXX.XXX

TOTAL KEWAJIBAN + MODAL                    Rp  XX.XXX.XXX
```

#### Sumber Data per Item Neraca

| Item | Sumber |
|---|---|
| Kas & Setara Kas | `saldo_kas_harian.saldo_akhir` terbaru, atau hitung otomatis dari mutasi |
| Piutang Dagang | `SUM(piutang_dagang.sisa_piutang)` dimana status != 'lunas' |
| Persediaan Barang | `SUM(produk.stok × produk.harga_pokok_avco)` |
| Hutang Dagang | `SUM(hutang_dagang.sisa_hutang)` dimana status != 'lunas' |
| Modal Awal | Input manual di `pengaturan` tabel (satu kali saat setup) |
| Laba Bersih | Diambil dari perhitungan P&L |

#### Item yang Input Manual (tidak bisa otomatis dari POS)

Beberapa item neraca perlu **input manual** oleh manajer/akuntan karena tidak tercatat di transaksi POS:

```
Tabel: aset_tetap
- id, nama_aset, nilai_perolehan, tanggal_perolehan
- umur_manfaat_tahun, metode_penyusutan
- nilai_buku_sekarang (dihitung otomatis)

Tabel: modal_awal
- tanggal, jumlah, keterangan
- id_pengguna

Tabel: pengambilan_prive
- tanggal, jumlah, keterangan, id_pengguna

Tabel: hutang_pinjaman
- id, nama_pemberi_hutang, jumlah_awal, sisa_hutang
- tanggal_jatuh_tempo, cicilan_per_bulan
```

---

## 9. Pilihan Integrasi: Full vs Partial

### Perbandingan

| Aspek | Mode Partial | Mode Full (Double-Entry) |
|---|---|---|
| Kecepatan implementasi | Cepat (2-3 minggu) | Lambat (1-2 bulan) |
| Akurasi akuntansi | 80-90% | 100% |
| Bisa diaudit formal | Tidak | Ya |
| Kompleksitas kode | Rendah | Tinggi |
| Risiko kesalahan | Rendah | Tinggi (salah mapping akun) |
| Cocok untuk | Toko retail kecil-menengah | Toko dengan kebutuhan audit formal |

### Rekomendasi Roadmap

```
FASE 1 (Sekarang, Mode Partial):
  ✓ Tambah HPP di detail transaksi (AVCO snapshot)
  ✓ Implementasi AVCO tracking
  ✓ Modul Hutang Dagang
  ✓ Laporan Kasir Harian
  ✓ Laporan Laba Rugi (dari data agregat, tanpa double-entry)
  ✓ Neraca sederhana (beberapa item manual)

FASE 2 (3-6 bulan kemudian, opsi upgrade ke Full):
  ○ Chart of Accounts (daftar akun)
  ○ Jurnal Otomatis setiap transaksi
  ○ Buku Besar
  ○ Trial Balance
  ○ Laporan Arus Kas
  ○ Koneksi ke software akuntansi (export ke format Accurate/Jurnal.id)
```

---

## 10. Skema Database Baru

### Migrasi yang Perlu Dibuat

```sql
-- File: 20260601000001_add_accounting_fields.sql

-- Tambah kolom HPP ke detail transaksi yang sudah ada
ALTER TABLE detail_transaksi_keluar
  ADD COLUMN harga_pokok_satuan NUMERIC(15,2) DEFAULT 0,
  ADD COLUMN total_harga_pokok  NUMERIC(15,2) DEFAULT 0;

ALTER TABLE transaksi_keluar
  ADD COLUMN total_hpp    NUMERIC(15,2) DEFAULT 0,
  ADD COLUMN laba_kotor   NUMERIC(15,2) DEFAULT 0;

-- Tambah kolom AVCO ke tabel produk
ALTER TABLE produk
  ADD COLUMN harga_pokok_avco    NUMERIC(15,2) DEFAULT 0,
  ADD COLUMN nilai_persediaan    NUMERIC(15,2) DEFAULT 0;
```

```sql
-- File: 20260601000002_create_hutang_piutang.sql

CREATE TABLE hutang_dagang (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_barang_masuk     UUID REFERENCES barang_masuk(id),
  id_supplier         UUID NOT NULL REFERENCES supplier(id),
  tanggal_hutang      DATE NOT NULL,
  tanggal_jatuh_tempo DATE,
  jumlah_awal         NUMERIC(15,2) NOT NULL,
  jumlah_terbayar     NUMERIC(15,2) NOT NULL DEFAULT 0,
  sisa_hutang         NUMERIC(15,2) GENERATED ALWAYS AS (jumlah_awal - jumlah_terbayar) STORED,
  status              TEXT NOT NULL DEFAULT 'belum_lunas'
                        CHECK (status IN ('belum_lunas', 'lunas', 'lewat_jatuh_tempo')),
  catatan             TEXT,
  created_at          TIMESTAMPTZ DEFAULT now(),
  updated_at          TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE pembayaran_hutang (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_hutang       UUID NOT NULL REFERENCES hutang_dagang(id),
  tanggal_bayar   DATE NOT NULL,
  jumlah_bayar    NUMERIC(15,2) NOT NULL,
  metode_bayar    TEXT NOT NULL,
  bukti_bayar     TEXT,
  id_pengguna     UUID NOT NULL REFERENCES pengguna(id),
  catatan         TEXT,
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE piutang_dagang (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_transaksi_keluar   UUID REFERENCES transaksi_keluar(id),
  id_pelanggan          UUID NOT NULL REFERENCES pelanggan(id),
  tanggal_piutang       DATE NOT NULL,
  tanggal_jatuh_tempo   DATE,
  jumlah_awal           NUMERIC(15,2) NOT NULL,
  jumlah_terbayar       NUMERIC(15,2) NOT NULL DEFAULT 0,
  sisa_piutang          NUMERIC(15,2) GENERATED ALWAYS AS (jumlah_awal - jumlah_terbayar) STORED,
  status                TEXT NOT NULL DEFAULT 'belum_lunas'
                          CHECK (status IN ('belum_lunas', 'lunas', 'lewat_jatuh_tempo', 'macet')),
  catatan               TEXT,
  created_at            TIMESTAMPTZ DEFAULT now(),
  updated_at            TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE pembayaran_piutang (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_piutang      UUID NOT NULL REFERENCES piutang_dagang(id),
  tanggal_bayar   DATE NOT NULL,
  jumlah_bayar    NUMERIC(15,2) NOT NULL,
  metode_bayar    TEXT NOT NULL,
  id_pengguna     UUID NOT NULL REFERENCES pengguna(id),
  catatan         TEXT,
  created_at      TIMESTAMPTZ DEFAULT now()
);
```

```sql
-- File: 20260601000003_create_avco_tracking.sql

CREATE TABLE riwayat_avco (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_produk                 UUID NOT NULL REFERENCES produk(id),
  tanggal                   TIMESTAMPTZ NOT NULL DEFAULT now(),
  jenis_mutasi              TEXT NOT NULL
                              CHECK (jenis_mutasi IN ('pembelian','penjualan','koreksi','retur_beli','retur_jual')),
  id_referensi              UUID,
  qty_masuk                 NUMERIC(12,3),
  qty_keluar                NUMERIC(12,3),
  harga_satuan_transaksi    NUMERIC(15,2),
  stok_sebelum              NUMERIC(12,3) NOT NULL,
  avco_sebelum              NUMERIC(15,2) NOT NULL,
  stok_sesudah              NUMERIC(12,3) NOT NULL,
  avco_sesudah              NUMERIC(15,2) NOT NULL,
  nilai_persediaan_sesudah  NUMERIC(15,2) NOT NULL
);

CREATE INDEX idx_riwayat_avco_produk ON riwayat_avco(id_produk, tanggal DESC);
```

```sql
-- File: 20260601000004_create_kas_dan_laporan.sql

CREATE TABLE saldo_kas_harian (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tanggal         DATE NOT NULL UNIQUE,
  saldo_awal      NUMERIC(15,2) NOT NULL DEFAULT 0,
  total_masuk     NUMERIC(15,2) NOT NULL DEFAULT 0,
  total_keluar    NUMERIC(15,2) NOT NULL DEFAULT 0,
  saldo_akhir     NUMERIC(15,2) GENERATED ALWAYS AS (saldo_awal + total_masuk - total_keluar) STORED,
  uang_aktual     NUMERIC(15,2),
  selisih         NUMERIC(15,2),
  dikonfirmasi    BOOLEAN DEFAULT FALSE,
  id_pengguna     UUID REFERENCES pengguna(id),
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE pengaturan_keuangan (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  modal_awal      NUMERIC(15,2) NOT NULL DEFAULT 0,
  tanggal_mulai   DATE NOT NULL,
  nama_pemilik    TEXT,
  npwp            TEXT,
  updated_at      TIMESTAMPTZ DEFAULT now()
);
```

---

## 11. Logika Jurnal Otomatis

> Bagian ini berlaku untuk **Mode Full (Double-Entry)**. Untuk Mode Partial, lewati bagian ini.

### Mapping Jurnal per Event

```
EVENT: Barang Masuk diterima (tunai)
  DEBET : Persediaan Barang        Rp XXX (nilai pembelian)
  KREDIT: Kas                      Rp XXX

EVENT: Barang Masuk diterima (kredit/hutang)
  DEBET : Persediaan Barang        Rp XXX
  KREDIT: Hutang Dagang            Rp XXX

EVENT: Bayar Hutang Dagang
  DEBET : Hutang Dagang            Rp XXX
  KREDIT: Kas                      Rp XXX

EVENT: Penjualan Tunai
  DEBET : Kas                      Rp XXX (harga jual)
  KREDIT: Pendapatan Penjualan     Rp XXX

  DEBET : Harga Pokok Penjualan    Rp XXX (AVCO)
  KREDIT: Persediaan Barang        Rp XXX

EVENT: Penjualan Kredit (piutang)
  DEBET : Piutang Dagang           Rp XXX
  KREDIT: Pendapatan Penjualan     Rp XXX

  DEBET : Harga Pokok Penjualan    Rp XXX
  KREDIT: Persediaan Barang        Rp XXX

EVENT: Terima Pembayaran Piutang
  DEBET : Kas                      Rp XXX
  KREDIT: Piutang Dagang           Rp XXX
```

---

## 12. Urutan Implementasi yang Disarankan

Implementasi secara berurutan. Jangan melompat ke langkah berikutnya sebelum langkah sebelumnya selesai dan ditest.

```
LANGKAH 1 — AVCO Foundation (prerequisite semua modul lain)
  [ ] Tambah kolom harga_pokok_avco dan nilai_persediaan ke tabel produk
  [ ] Buat tabel riwayat_avco
  [ ] Buat fungsi lib/avco.ts: calculateNewAVCO(), recordAVCOMutation()
  [ ] Update fungsi receiveBarangMasuk() di lib/pembelian.ts untuk trigger AVCO
  [ ] Update fungsi checkout() di lib/pos.ts untuk snapshot HPP
  [ ] Test: beli 10 unit @ 5000, beli lagi 20 unit @ 6000, cek AVCO = 5667

LANGKAH 2 — HPP di Transaksi
  [ ] Migrasi: tambah kolom harga_pokok_satuan dan total_harga_pokok ke detail_transaksi_keluar
  [ ] Migrasi: tambah kolom total_hpp dan laba_kotor ke transaksi_keluar
  [ ] Update fungsi checkout() untuk mengisi kolom baru ini
  [ ] Test: lakukan transaksi, cek apakah total_hpp terisi dengan benar

LANGKAH 3 — Hutang Dagang
  [ ] Buat migrasi tabel hutang_dagang dan pembayaran_hutang
  [ ] Buat lib/hutang.ts: createHutang(), bayarHutang(), getHutangList()
  [ ] Update alur Barang Masuk: jika metode bayar = kredit → createHutang() otomatis
  [ ] Buat halaman /dashboard/hutang (list + detail + form bayar)
  [ ] Test: terima barang dengan metode kredit, cek hutang terbentuk

LANGKAH 4 — Piutang Dagang
  [ ] Buat migrasi tabel piutang_dagang dan pembayaran_piutang
  [ ] Buat lib/piutang.ts: createPiutang(), bayarPiutang(), getPiutangList()
  [ ] Update alur POS checkout: jika metode bayar = kredit → createPiutang() otomatis
  [ ] Buat halaman /dashboard/piutang (list + detail + form bayar)
  [ ] Test: checkout dengan metode kredit, cek piutang terbentuk

LANGKAH 5 — Laporan Kasir Harian
  [ ] Buat tabel saldo_kas_harian
  [ ] Buat lib/laporan-kasir.ts: generateLaporanKasir(), konfirmasiTutupKasir()
  [ ] Buat halaman /dashboard/tutup-kasir
  [ ] Buat halaman /dashboard/laporan-kasir (list + detail + cetak)
  [ ] Test: tutup kasir, cetak laporan

LANGKAH 6 — Laporan Laba Rugi
  [ ] Buat lib/laporan-keuangan.ts: generateLabaRugi(periodeAwal, periodeAkhir)
  [ ] Buat halaman /dashboard/laporan/laba-rugi (form periode + tampilan + cetak)
  [ ] Test: bandingkan angka dengan kalkulasi manual

LANGKAH 7 — Neraca (Balance Sheet)
  [ ] Buat tabel pengaturan_keuangan (untuk modal awal)
  [ ] Buat form input modal awal (satu kali setup)
  [ ] Buat lib fungsi: generateNeraca(tanggal)
  [ ] Buat halaman /dashboard/laporan/neraca
  [ ] Test: pastikan Aset = Kewajiban + Modal (selisih = 0)

LANGKAH 8 — Polish & Print
  [ ] Buat komponen cetak untuk semua laporan (gunakan print CSS atau jsPDF)
  [ ] Tambah export Excel untuk laporan (gunakan SheetJS yang sudah ada)
  [ ] Review dengan konsultan pajak
```

---

## 13. Konvensi Kode

Ikuti konvensi yang sudah ada di proyek POS Sobatti:

```typescript
// lib/avco.ts — contoh struktur fungsi baru

import { createClient } from "@/lib/supabase/server";
import { formatIDR } from "@/lib/utils";

/**
 * Hitung AVCO baru setelah ada pembelian masuk.
 * Semua kalkulasi dalam IDR (integer, tanpa sen).
 */
export async function calculateNewAVCO(params: {
  id_produk: string;
  qty_masuk: number;
  harga_beli_satuan: number;
}): Promise<{ avco_baru: number; nilai_persediaan_baru: number }> {
  const supabase = await createClient();

  const { data: produk } = await supabase
    .from("produk")
    .select("stok, harga_pokok_avco")
    .eq("id", params.id_produk)
    .single();

  if (!produk) throw new Error(`Produk ${params.id_produk} tidak ditemukan`);

  const nilai_lama = produk.stok * produk.harga_pokok_avco;
  const nilai_masuk = params.qty_masuk * params.harga_beli_satuan;
  const qty_baru = produk.stok + params.qty_masuk;

  const avco_baru = qty_baru > 0
    ? Math.round((nilai_lama + nilai_masuk) / qty_baru)
    : params.harga_beli_satuan;

  return {
    avco_baru,
    nilai_persediaan_baru: qty_baru * avco_baru,
  };
}
```

```
Aturan tambahan untuk modul akuntansi:
- Semua nilai uang disimpan sebagai INTEGER (IDR, tanpa sen/desimal)
- Gunakan formatIDR() untuk semua tampilan angka ke user
- Gunakan terbilangRupiah() untuk cetak laporan formal
- Semua operasi yang mengubah stok dan keuangan harus dalam satu database transaction
- Setiap fungsi yang mengubah data keuangan harus mencatat id_pengguna (audit trail)
- Bahasa UI tetap Bahasa Indonesia
- Error messages tetap Bahasa Indonesia
```

---

## Glosarium

| Istilah | Singkatan | Penjelasan |
|---|---|---|
| Average Cost | AVCO | Metode valuasi stok: harga rata-rata tertimbang |
| Harga Pokok Penjualan | HPP | Biaya barang yang sudah terjual |
| Purchase Order | PO | Dokumen pembelian ke supplier |
| Profit & Loss | P&L | Laporan Laba Rugi |
| Balance Sheet | BS | Neraca Keuangan |
| Accounts Payable | AP | Hutang Dagang (ke supplier) |
| Accounts Receivable | AR | Piutang Dagang (dari pelanggan) |
| Down Payment | DP | Uang muka / bayar sebagian |

---

*Dokumen ini ditulis untuk AI agent dan developer yang mengerjakan POS Sobatti. Selalu referensikan `AGENTS.md`, `pos_app_spec.md`, dan `db_schema_analysis.md` yang sudah ada untuk konteks tambahan.*
