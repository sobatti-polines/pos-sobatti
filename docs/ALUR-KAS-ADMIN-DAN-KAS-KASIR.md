# Alur Modul Kas — Kas Admin & Kas Kasir (POS Sobatti)

Dokumen ini menjelaskan **alur lengkap** pencatatan kas dua-dua (Kas Admin & Kas Kasir):
ke mana harus pergi (URL), apa yang dilakukan, siapa yang berhak, dan apa yang terjadi
di dalam sistem/database setiap langkahnya.

> **Prasyarat**: jalankan migration `supabase/migrations/20260906_kas_admin_dan_uang_awal.sql`
> di Supabase SQL Editor **sebelum** memakai fitur ini.

---

## 1. Ringkasan Model Dua Kas

| Kas | Definisi | Dipegang oleh | Isi |
|-----|----------|---------------|-----|
| **Kas Kasir (laci)** | Uang di laci mesin kasir | Kasir | Uang awal (float) + hasil penjualan tunai |
| **Kas Admin (kotak operasional)** | Uang operasional harian toko | Admin/Owner | Top-up dari owner − pengeluaran (ATK, konsumsi, kebersihan, dll) + refund retur |

**Prinsip yang disepakati:**
- Laci kasir **hanya** berisi float + penjualan tunai. Tidak ada pengeluaran dari laci.
- Pembelian barang (barang masuk) **tidak dipantau** dari kedua kas (dibayar langsung owner).
- Pengeluaran operasional (metode **Tunai**) otomatis **mengurangi Kas Admin**.
- Refund retur pembelian otomatis **menambah Kas Admin**.
- Top-up Kas Admin dilakukan **kapan pun dibutuhkan** (bukan tiap pagi) — saldo berjalan (rollover).

---

## 2. Role & Hak Akses

| Role | Buka/Tutup Kas Kasir | Kas Admin (top-up) | Pengeluaran | Riwayat Kas Harian & Laporan Kas | Edit/Koreksi Saldo |
|------|:---:|:---:|:---:|:---:|:---:|
| **OWNER** | ❌ | ✅ | ✅ | ✅ | ✅ (**khusus owner** — koreksi salah input) |
| **ADMIN** | ❌ | ✅ (minta kas ke owner) | ✅ | ✅ | ❌ |
| **KASIR** | ✅ (hanya ini) | ❌ | ❌ | ❌ | ❌ |
| **KARYAWAN** | ❌ | ❌ | ❌ | ❌ | ❌ |

**Ringkasan:**
- **OWNER** bisa semua **kecuali** buka/tutup kas kasir — tetapi **bisa mengedit saldo**
  bila admin/kasir salah input (koreksi uang awal & uang aktual sesi kasir, edit top-up kas admin).
- **ADMIN** bisa semua **kecuali** buka/tutup kas kasir — **bisa meminta kas** ke owner
  (top-up Kas Admin) dan melihat semua laporan kas.
- **KASIR** **hanya** bisa membuka/menutup kas kasir (dari aplikasi POS).

> **Menu di sidebar hanya tampil untuk role yang bisa mengaksesnya** (tidak ada menu mati):
> - Menu **Kas Kasir** (`/dashboard/tutup-kasir`) → **hanya KASIR** yang melihatnya.
> - Menu **Kas Admin**, **Riwayat Kas Harian**, **Laporan Kas** → **ADMIN & OWNER**.
> - Role **KASIR** tidak melihat menu Kas Admin / Pengeluaran / laporan kas sama sekali.
>
> **Aturan akses juga diterapkan di sisi server** (bukan sekadar menu):
> - Aksi `bukaSesiKasir` / `submitTutupKasir` hanya menerima role **KASIR** — ADMIN/OWNER ditolak.
> - Aksi `editSesiKasir` (koreksi saldo) **hanya OWNER**.
> - Halaman `/dashboard/tutup-kasir` → redirect ke `/dashboard` jika bukan KASIR.
> - Halaman `/dashboard/laporan-kasir` & `/dashboard/laporan/kas` → ADMIN/OWNER saja.

---

## 3. Flow Kas Kasir (Siklus Harian)

> Tujuan: mencatat uang awal sesi, akumulasi penjualan tunai, dan **penambahan hari ini**
> (hasil penjualan tunai yang akan disetor ke owner).

### 3.1 Login
1. Buka URL **`/`** (halaman login).
2. Masukkan username & password → klik **Masuk**.
   - Kasir diarahkan ke **`/pos`**.
   - Admin/Owner diarahkan ke **`/dashboard`**.

### 3.2 Buka Sesi Kasir (awal hari) — hanya oleh KASIR
1. Kasir login → diarahkan ke **`/pos`** (aplikasi POS).
2. Buka URL **`/dashboard/tutup-kasir`** (menu **Kas Kasir**).
3. Pilih tanggal shift (default hari ini).
4. Jika sesi belum dibuka, sistem menampilkan panel **"Buka Sesi Kasir"**.
5. Isi **Uang Awal Sesi (Rp)** — misal `200000` (uang kembalian yang ditaruh di laci).
6. Klik **"Buka Sesi Kasir"**.
   - ✅ Sesi tersimpan: `saldo_kas_harian` mendapat baris baru (`uang_awal = 200.000`,
     `saldo_awal = 200.000`, `dikonfirmasi = false`).
   - Tampilan berubah menjadi panel **"Tutup Kasir"**.
   - ⛔ **Sekali saja per tanggal**: jika pada tanggal yang sama sudah pernah dibuka,
     sistem **menolak** dengan notifikasi **"Sesi kasir sudah dibuka hari ini"** —
     kasir **tidak bisa menambahkan uang kas lagi** pada tanggal tersebut.

### 3.3 Transaksi Penjualan (sepanjang hari)
1. Buka URL **`/pos`** (menu **Penjualan**).
2. Cari produk / scan barcode → tambah ke keranjang → pilih metode bayar **Tunai** → input jumlah bayar → checkout.
3. Sistem (`process_checkout`) otomatis:
   - Mencatat `transaksi_keluar` + `detail_transaksi_keluar` (total, bayar, kembali).
   - Mengurangi stok & mencatat HPP/AVCO (`riwayat_avco`).
   - Penjualan **Tunai** menambah saldo laci (bayar − kembali).

### 3.4 Tutup Kasir (akhir hari)
1. Buka kembali URL **`/dashboard/tutup-kasir`**.
2. Sistem menampilkan ringkasan:
   - **Uang Awal Sesi** = 200.000
   - **Pemasukan (Penjualan)** = total penjualan tunai hari itu, misal 1.000.000
   - **Pengeluaran** = 0 (laci tidak dipakai untuk pengeluaran)
   - **Saldo Akhir** = 1.200.000
   - **Penambahan Hari Ini** = **+1.000.000** (Saldo Akhir − Uang Awal)
3. Hitung fisik laci, lalu isi **Fisik Laci (Uang Aktual)** — misal `1200000`.
4. Sistem menampilkan **Selisih** (aktual − saldo sistem). Selisih 0 = aman.
5. Klik **"Simpan Tutup Kasir"**.
   - ✅ `saldo_kas_harian` di-update: `total_masuk = 1.000.000`, `uang_aktual = 1.200.000`,
     `selisih = 0`, `dikonfirmasi = true`.
   - Jika aktual ≠ sistem (misal 1.195.000 → selisih −5.000), selisih tercatat dan
     nanti masuk laporan sebagai penyesuaian.

### 3.5 Lihat Riwayat Kas Harian — ADMIN & OWNER
1. Buka URL **`/dashboard/laporan-kasir`** (menu **Riwayat Kas Harian**) — ADMIN/OWNER.
2. Terlihat tabel per tanggal: **Uang Awal**, **Masuk**, **Penambahan**, **Sistem**,
   **Aktual**, **Selisih**, **Kasir**.
3. Bisa export CSV / cetak.
4. **Khusus OWNER**: tombol **pensil** di kolom **Aksi** → dialog **"Edit Saldo Sesi Kasir"**
   untuk **mengoreksi** uang awal & uang aktual bila kasir/admin salah input
   (total penjualan tidak diubah; saldo akhir & selisih dihitung ulang otomatis).

**Contoh sesuai kebutuhan Anda:**
> Hari 1: kasir buka sesi dengan uang awal **200.000** → setelah penjualan laci menjadi
> **1.200.000** → **penambahan hari ini = 1.000.000**. Hari 2: kasir buka sesi lagi
> dengan uang awal (float) yang sama, misal 200.000.

---

## 4. Flow Kas Admin (Operasional Owner)

> Tujuan: mencatat uang masuk (top-up owner & refund retur) dan uang keluar
> (pengeluaran operasional Tunai). Saldo berjalan otomatis.

### 4.1 Penambahan Saldo (top-up dari owner) — kapan pun dibutuhkan
1. Buka URL **`/dashboard/keuangan/kas-admin`** (menu **Kas Admin**) — ADMIN/OWNER.
2. Di panel **"Penambahan Saldo"**:
   - **Tanggal**: hari ini (default) — bisa tanggal lain.
   - **Jumlah (Rp)**: misal `100000`.
   - **Keterangan** (opsional): misal "untuk belanja kebersihan".
3. Klik **"Simpan Penambahan"**.
   - ✅ Baris baru di tabel `kas_admin_topup` → **Saldo Saat Ini** bertambah.
   - Contoh: Senin top-up 500.000 → Kamis sisa 100.000 → Jumat top-up 100.000
     (saldo jadi 200.000) → belanja 200.000 (saldo 0).

### 4.2 Pengeluaran Operasional (otomatis mengurangi Kas Admin)
1. Buka URL **`/dashboard/keuangan/pengeluaran`** (menu **Pengeluaran**) — ADMIN/OWNER.
2. Klik tambah pengeluaran:
   - **Kategori**: ATK / Konsumsi / Kebersihan.
   - **Nama**: misal "Sabun & pembersih lantai".
   - **Jumlah**: misal `200000`.
   - **Metode Bayar**: pilih **Tunai** (hanya metode Tunai yang mengurangi Kas Admin;
     Transfer/QRIS tidak menyentuh kas admin).
3. Simpan.
   - ✅ Baris di tabel `pengeluaran` (status AKTIF) → **Kas Admin berkurang** otomatis.

### 4.3 Refund Retur Pembelian (otomatis menambah Kas Admin)
1. Retur dibuat di **`/dashboard/inventory/stock-in/retur`**.
2. Sistem mencatat `retur_pembelian` + `detail_retur_pembelian`.
3. Kas Admin otomatis **bertambah** sebesar `total_nilai` retur (uang kembali ke kas operasional).

### 4.4 Lihat Saldo & Mutasi
1. Buka URL **`/dashboard/keuangan/kas-admin`**.
2. Kartu ringkasan: **Saldo Saat Ini**, **Masuk Bulan Ini**, **Keluar Bulan Ini**.
3. Tabel **Mutasi Kas Admin**: setiap baris berlabel sumber —
   - 🟣 **Top-up Owner** (MASUK) — bisa **diedit** (ikon pensil) atau **dihapus** (ikon tong sampah) jika salah input.
   - 🔵 **Refund Retur** (MASUK).
   - 🟠 **Pengeluaran** (KELUAR).
4. Klik **Export** untuk CSV.

### 4.5 Mengoreksi / Membatalkan Penambahan Saldo yang Salah
1. Di tabel mutasi, baris **Top-up Owner**:
   - Klik ikon **pensil** → form berubah jadi **"Edit Penambahan Saldo"** → perbaiki
     tanggal/jumlah/keterangan → **"Simpan Perubahan"**.
   - Atau klik ikon **hapus** → konfirmasi → baris dihapus → saldo menyesuaikan.
2. Semua koreksi tercatat di **Log Aktivitas** (`/dashboard/log-aktivitas`).

---

## 5. Integrasi dengan Laporan Keuangan

| Laporan | URL | Yang berubah / diperlihatkan | Akses |
|---------|-----|------------------------------|-------|
| **Laporan Kas** (gabungan kedua kas) | `/dashboard/laporan/kas` | Kartu saldo akhir Kas Kasir + Kas Admin + Kas Bank; ringkasan pergerakan (penambahan kasir, selisih kasir, uang masuk/keluar kas admin); tabel rinci Kas Kasir harian & mutasi Kas Admin berjalan | ADMIN/OWNER |
| **Neraca** | `/dashboard/laporan/neraca` | Aset: **Kas Kasir (laci)** + **Kas Admin (operasional)** + **Kas Bank/QRIS** + Persediaan. Ekuitas: Modal Awal + **Penambahan Modal (Top-up Owner)** + Laba Ditahan | OWNER/ADMIN |
| **Laba Rugi** | `/dashboard/laporan/laba-rugi` | Beban operasional per kategori; penyesuaian **Selisih Kas** (dari tutup kasir) & **Koreksi Stok** | OWNER/ADMIN |
| **Arus Kas** | `/dashboard/keuangan/arus-kas` | Kas awal = Kas Kasir + Kas Admin; penerimaan penjualan tunai & retur; pembayaran pengeluaran operasional; **top-up owner = arus pendanaan** | OWNER/ADMIN |
| **Riwayat Kas Harian** | `/dashboard/laporan-kasir` | Kolom **Uang Awal** & **Penambahan** per hari; tombol **edit saldo** (pensil) **khusus OWNER** | ADMIN/OWNER |
| **Kas Admin** | `/dashboard/keuangan/kas-admin` | Saldo & mutasi kas admin; top-up bisa diedit/dihapus | ADMIN/OWNER |

### 5.1 Flow Pantauan Uang oleh Admin/Owner (halaman Laporan Kas)
1. Buka URL **`/dashboard/laporan/kas`** (menu **Laporan → Laporan Kas**).

### 5.1 Flow Pantauan Uang oleh OWNER (halaman Laporan Kas)
1. Buka URL **`/dashboard/laporan/kas`** (menu **Laporan → Laporan Kas**).
2. Atur periode (default: awal bulan s.d. hari ini) → klik **"Tampilkan Laporan"**.
3. Baca kartu **Saldo Akhir**: Kas Kasir (laci), Kas Admin (operasional), Kas Bank/QRIS.
4. Baca kartu **Pergerakan Periode**: penambahan kas kasir, selisih kas kasir, uang masuk
   & uang keluar kas admin.
5. Tabel **Rincian Kas Kasir Harian**: lihat siapa kasirnya, uang awal, penambahan per hari,
   saldo akhir, uang aktual, selisih, status (Buka/Tutup).
6. Tabel **Mutasi Kas Admin**: setiap top-up / refund / pengeluaran dengan saldo berjalan.
7. Export CSV (via dropdown **Export**) atau **Cetak Laporan** (print).

---

## 6. Yang Terjadi di Database (per Langkah)

| Langkah | Tabel | Kolom/Isi |
|---------|-------|-----------|
| Buka sesi kasir | `saldo_kas_harian` | insert/upsert: `tanggal`, `uang_awal`, `saldo_awal = uang_awal`, `total_masuk = 0`, `total_keluar = 0`, `dikonfirmasi = false` |
| Penjualan tunai | `transaksi_keluar` + `detail_transaksi_keluar` + `riwayat_avco` | header total/bayar/kembali; detail item; stok & AVCO berkurang |
| Tutup kasir | `saldo_kas_harian` | update: `total_masuk = Σ(bayar − kembali) penjualan Tunai`, `total_keluar = 0`, `uang_aktual`, `selisih = uang_aktual − saldo_akhir`, `dikonfirmasi = true` |
| Top-up kas admin | `kas_admin_topup` | insert: `tanggal`, `jumlah`, `keterangan`, `id_pengguna` |
| Pengeluaran operasional (Tunai) | `pengeluaran` | insert status AKTIF, metode Tunai → otomatis mengurangi Kas Admin (dihitung saat laporan) |
| Refund retur | `retur_pembelian` + `detail_retur_pembelian` | otomatis menambah Kas Admin |

**Rumus saldo:**

```
Kas Kasir (neraca) = Σ (bayar − kembali) penjualan Tunai (kumulatif)
Kas Admin (neraca) = Σ top-up + Σ refund retur − Σ pengeluaran Tunai AKTIF
Kas Bank/QRIS      = Σ total penjualan non-tunai
Penambahan Kasir   = Saldo Akhir sesi − Uang Awal sesi
```

---

## 7. Catatan & Asumsi Penting

1. **Migration wajib dijalankan** sebelum fitur dipakai:
   `supabase/migrations/20260906_kas_admin_dan_uang_awal.sql`.
2. **Pembelian barang tidak dipantau kas** — karena itu baris *Penyesuaian Neraca*
   (residual) umumnya **tidak 0** bila ada pembelian. Ini disengaja agar neraca selalu
   balance dan selisihnya terlihat eksplisit (bukan error).
3. **Uang awal (float) kasir** tidak dihitung sebagai kas usaha di Neraca — hanya uang
   kembalian milik owner yang tetap di laci (dijelaskan di Catatan atas Laporan Keuangan).
4. **Refund retur** masuk ke **Kas Admin**, bukan laci kasir.
5. **Pengeluaran non-Tunai** (Transfer/QRIS) mengurangi Laba Rugi tetapi tidak mengubah
   Kas Admin (tidak menyentuh kotak kas fisik).
6. **Selisih kasir** (lebih/kurang saat tutup) dicatat dan menjadi penyesuaian di
   Laba Rugi & Neraca.
7. Semua aksi (buka/tutup sesi, top-up, edit/hapus top-up, koreksi saldo kasir) tercatat
   di **Log Aktivitas** (`/dashboard/log-aktivitas`).
8. **Menu sidebar mengikuti hak akses** — menu yang tidak bisa diakses role tertentu
   tidak ditampilkan (Kas Kasir hanya untuk KASIR; Kas Admin & laporan kas untuk ADMIN/OWNER).

---

## 8. Checklist Penggunaan Harian

**Kasir:**
- [ ] Buka `/dashboard/tutup-kasir` → isi uang awal → **Buka Sesi Kasir** (sekali per hari; jika sudah dibuka, sistem menolak)
- [ ] Jual di `/pos` sepanjang hari
- [ ] Sore: hitung laci → `/dashboard/tutup-kasir` → isi uang aktual → **Simpan Tutup Kasir**

**Admin:**
- [ ] Buka `/dashboard/keuangan/kas-admin` → tambah saldo (minta kas ke owner) bila kas admin menipis
- [ ] Catat pengeluaran operasional di `/dashboard/keuangan/pengeluaran` (metode Tunai)
- [ ] Pantau mutasi & riwayat: `/dashboard/keuangan/kas-admin`, `/dashboard/laporan-kasir`,
      `/dashboard/laporan/kas`, `/dashboard/keuangan/arus-kas`

**Owner:**
- [ ] Pantau pergerakan uang harian di **`/dashboard/laporan/kas`** (Laporan Kas — gabungan kedua kas)
- [ ] Jika admin/kasir salah input: koreksi saldo sesi kasir di `/dashboard/laporan-kasir` (tombol pensil),
      atau edit/hapus top-up di `/dashboard/keuangan/kas-admin`
- [ ] Review laporan lain: `/dashboard/laporan/laba-rugi`, `/dashboard/laporan/neraca`,
      `/dashboard/keuangan/arus-kas`
