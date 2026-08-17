# ALUR-FINAL — Panduan Simulasi Lengkap POS Sobatti

> Dokumen ini adalah **satu-satunya sumber alur simulasi** yang menggabungkan semua file simulasi/alur yang tersebar sebelumnya:
> `docs/testing/TESTING-*.md`, `docs/ALUR-KAS-ADMIN-DAN-KAS-KASIR.md`, `4_Alur_Data_Tabel_dan_Form.md`,
> `todo-*.md`, `TODO1..6.MD`, `FITUR.md`, `pos_app_spec.md`, `FEATURE_PLAN_AKUNTANSI.md`, `database.MD`, `AGENTS.md`.
>
> Tujuannya: **menjalankan simulasi dari awal sampai akhir** — setup, master data, operasional harian, inventaris,
> keuangan, laporan — dengan langkah yang rinci, berurutan, dan bisa diverifikasi. **Tidak ada fitur yang dianggap
> tidak penting**; semua tercantum. Jangan lewati langkah; centang `[ ]` setiap kali lolos.

---

## CARA PAKAI DOKUMEN INI

1. **Ikuti urutan fase** — Fase 0 → Fase 1 → … → Fase 8. Setiap fase membangun data di atas fase sebelumnya.
2. **Login sesuai peran** — tiap langkah menyebutkan role yang berhak. Gunakan akun sesuai tabel di Fase 1.5.
3. **Verifikasi setiap langkah** — tiap langkah punya bagian "Cek" (apa yang harus benar) dan "DB" (query opsional
   untuk memastikan data tersimpan benar).
4. **Jika ada yang gagal** — catat pesan errornya, jangan lanjut sebelum paham penyebabnya.
5. **Skenario akhir (Fase 9)** — simulasi utuh 1 siklus toko + uji konsistensi laporan keuangan.

---

## FASE 0 — SETUP AWAL (SEKALI SAJA)

> Tujuan: environment jalan, database terhubung, pengaturan toko & keuangan terisi. Hanya dilakukan sekali.

### 0.1 Environment & Dependensi

- [ ] Pastikan Node.js + npm terpasang (`node -v`, `npm -v`).
- [ ] `npm install` di root project (instal dependensi: Next.js 16, Supabase, Zustand, Zod, TanStack Table, ZXing, jsPDF, papaparse, jsbarcode, qrcode, date-fns, next-pwa).
- [ ] Siapkan `.env` dan `.env.local` (lihat 0.2).

### 0.2 Koneksi Database (Lokal vs Cloud)

File env yang dibaca aplikasi:

| Variabel | Lokasi | Fungsi |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `.env` / `.env.local` | URL Supabase (cloud atau local stack) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `.env` / `.env.local` | Key publik (browser) |
| `SERVICE_ROLE` | `.env.local` | Key rahasia — **hanya** dipakai `lib/supabase/admin.ts` |
| `STORE_LATITUDE`, `STORE_LONGITUDE` | `.env` | Koordinat toko untuk geofencing absensi |
| `MAX_ATTENDANCE_RADIUS` | `.env` | Radius geofencing (m), default 50 |
| `QR_EXPIRE_SECONDS` | `.env` | Masa berlaku QR absensi, default 30 |
| `ATTENDANCE_START_TIME` | `.env` | Jam mulai kerja (fallback batas telat) |

**Mode SIMULASI LOKAL (disarankan untuk testing):**

1. Jalankan local Supabase stack (butuh Docker):
   ```bash
   supabase start
   ```
   → Output memberi URL `postgresql://postgres:postgres@127.0.0.1:54322/postgres`,
   API `http://127.0.0.1:54321`, dan key lokal.
2. Restore data dummy (jika sudah punya dump):
   ```bash
   psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -f supabase/schema_dump.sql
   psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -f supabase/data_dump.sql
   ```
   > ⚠️ Jika `supabase start` gagal di migrasi (mis. `relation "detail_transaksi_keluar" does not exist`),
   > itu karena rantai migrasi repo tidak lengkap (tabel inti dibuat langsung di cloud). Matikan migrasi otomatis
   > di `supabase/config.toml` → `[db.migrations] enabled = false`, restart, lalu restore dump.
3. Isi `.env.local` dengan nilai **lokal** (comment blok cloud):
   ```bash
   NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
   NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key local dari supabase start>
   SERVICE_ROLE=<secret key local dari supabase start>
   ```

**Mode CLOUD (Vercel / produksi):**

- Di Vercel → Settings → Environment Variables, set 3 variabel di atas dengan nilai **cloud** dari dashboard Supabase.
- `.env*` tidak pernah ter-commit (sudah di `.gitignore`), jadi nilai lokal tidak bocor ke Vercel.
- Cara pindah cepat di lokal: comment/uncomment blok di `.env.local`, lalu restart `npm run dev`.

### 0.3 Jalankan Aplikasi

- [ ] `npm run dev` → buka `http://localhost:3000`.
- [ ] Halaman login tampil (bukan error).

### 0.4 Pengaturan Toko (ADMIN/OWNER) — `/dashboard/settings`

**Info Toko** (`store-form.tsx` → tabel `pengaturan` id=1):
- [ ] `nama_toko` (contoh: "Toko Sobatti"), `alamat`, `telepon`, `email`, `nama_kasir_aktif` (opsional).
- [ ] **Konfigurasi Transaksi**: `metode_diskon` (Nominal/Persen), `pajak_persen` (mis. 0 atau 11),
      `jenis_nota` (Struk 58mm/Invoice/Faktur), `metode_cetak`, `logo_nota` (Ya/Tidak),
      `poin_min_pembelian` (min. belanja untuk 1 poin, default 100000).
- [ ] **Bank**: bank1 & bank2 (nama, rekening, atas_nama).
- [ ] **Footer**: `footer_struk_1..3`, `footer_invoice_1..3`, `hormat_kami_nama`.
- [ ] **Simpan** → toast sukses.

> DB: `pengaturan` id=1 ter-update. Invoice/struk akan memakai nilai ini.

### 0.5 Pengaturan Keuangan (ADMIN/OWNER) — `/dashboard/settings/keuangan`

- [ ] Isi `modal_awal` (contoh: 10000000), `tanggal_mulai` (hari ini), `nama_pemilik`, `npwp` (opsional).
- [ ] **Simpan** → tersimpan di tabel `pengaturan_keuangan`.

> Modal awal dipakai Neraca (Ekuitas) dan fallback kas saat belum ada tutup kasir.

---

## FASE 1 — MASTER DATA (SEKALI / AWAL)

> Urutan penting: **referensi → produk → supplier/pelanggan → pengguna**. Semua via dashboard (ADMIN/OWNER).

### 1.1 Data Referensi — `/dashboard/settings/reference-data` (3 tab)

**Tab Kategori** (tabel `kategori`):
- [ ] Tambah: "SEMEN", "BESI BAJA", "CAT", "PIPA", "ATAP", "PAKU & BAUT".
- [ ] Edit salah satu nama → tersimpan.
- [ ] Hapus satu kategori yang belum dipakai produk → terhapus.
- [ ] Import CSV kategori (template: kolom `nama`) → baris bertambah.

**Tab Satuan** (tabel `satuan`):
- [ ] Tambah: "Pcs", "Kg", "Lusin", "Roll", "Set", "Sak", "Liter".
- [ ] Edit & hapus yang tidak terpakai.
- [ ] Import CSV satuan.

**Tab Metode Bayar** (tabel `metode_bayar`):
- [ ] Pastikan ada: "Tunai", "QRIS", + bank dari pengaturan (mis. "BCA", "Mandiri").
- [ ] Tambah/ubah/hapus metode sesuai kebutuhan.
- [ ] **Catatan**: nama bank di-sync dari `pengaturan.bank1_nama`/`bank2_nama` saat pengaturan toko disimpan.

### 1.2 Merk (opsional, via halaman inventaris / referensi)

- [ ] Tambah merk: "Semen Gresik" (kode `SEMG`), "Trisakti" (kode `TRSK`).
  Tabel `merk`: `nama` UNIQUE + `kode` UNIQUE (4 karakter).

### 1.3 Produk — `/dashboard/inventory` (tabel `produk`)

**Tambah Produk (form/edit inline):**
- [ ] `nama_produk`, `sku` (UNIQUE, mis. "SEM-001"), `barcode` (opsional, UNIQUE).
- [ ] `id_kategori`, `id_satuan` (satuan dasar inventory — contoh: Pcs).
- [ ] `hitung_stok` = Aktif (atau Tidak untuk jasa/tidak dilacak).
- [ ] `harga_modal` (modal awal), `harga_pokok_avco` (diisi otomatis oleh sistem saat barang masuk),
      `harga_jual_satuan`, `harga_jual_grosir`, `harga_jual_promo`, `diskon` (default %).
- [ ] `stok_minimum` (ambang display, default 5), `stok_minimum_gudang` (opsional).
- [ ] **UoM**: `default_purchase_unit` (mis. "Lusin"), `conversion_ratio` (mis. 12).
- [ ] **Multi-unit jual (opsional)**: `jual_satuan` (mis. "Roll"), `harga_jual_besar_*` dihitung otomatis
      = harga kecil × `conversion_ratio` (jangan diinput manual).
- [ ] `id_merk` (opsional), `id_lokasi_area` (opsional), `id_produk_master`/`qty_per_unit` (untuk paket, opsional).
- [ ] Simpan → muncul di tabel.

**Bulk data:**
- [ ] Import CSV produk (template: SKU, Barcode, Item, Kategori, Lokasi, Stok, Harga Modal, HPP, 3 Harga Jual, dll)
      via modal ImportCSVModal → preview + validasi per baris.

**Aksi per baris:**
- [ ] Restock display (pindah gudang → display) — tombol per baris.
- [ ] Pindah display → gudang.
- [ ] Buka detail produk (sheet): tab Info + tab **Kartu Stok & Mutasi** (riwayat HPP/AVCO per jenis mutasi,
      qty, harga beli, supplier).
- [ ] Generate barcode produk (CODE128) via `/api/inventory/barcode` → tampil di detail.

> DB: cek `SELECT count(*) FROM produk;` — sesuai jumlah yang diinput.

### 1.4 Supplier — `/dashboard/suppliers` (tabel `supplier`)

- [ ] Tambah: "PT Maju Jaya" (alamat, telepon, email, keterangan).
- [ ] Edit & hapus satu supplier.
- [ ] Import CSV supplier.

### 1.5 Pelanggan — `/dashboard/customers` (tabel `pelanggan`)

- [ ] Pastikan baris **"UMUM"** ada (default walk-in) — **tidak boleh dihapus**.
- [ ] Tambah: "Budi Santoso" (alamat, no_hp, email, keterangan, poin awal 0).
- [ ] Edit & hapus (selain UMUM).
- [ ] Import CSV pelanggan (kolom poin ikut di export/import).

### 1.6 Pengguna — `/dashboard/settings/users` (OWNER only) (tabel `pengguna` + Supabase Auth)

> **PENTING**: setiap user dibuat di **dua tempat sekaligus** — Supabase Auth (`auth.users`) untuk login,
> dan tabel `pengguna` untuk role/level. Password login yang asli hanya di Auth; kolom `password` di `pengguna`
> hanyalah placeholder ("auth-managed").

- [ ] Tambah user (minimal 1 per role):
  | Username | Password | Level | Redirect login |
  |---|---|---|---|
  | `owner` | `owner123` | OWNER | `/dashboard` |
  | `admin` | `admin123` | ADMIN | `/dashboard` |
  | `kasir1` | `kasir123` | KASIR | `/pos` |
  | `kasir2` | `kasir123` | KASIR | `/pos` |
  | `karyawan` | `karyawan123` | KARYAWAN | `/dashboard/attendance/scan` |
- [ ] Edit user: ganti level, toggle `aktif` (nonaktif = tidak bisa login), ganti password (opsional).
- [ ] Hapus user (tidak bisa hapus diri sendiri).
- [ ] Import CSV pengguna (template: Username, Password, Nama Lengkap, Level, Status).

> DB: `SELECT id, username, level, aktif FROM pengguna;` — 5+ baris.
> Auth: akun `*@sobats.com` terdaftar (email = username tanpa simbol + `@sobats.com`).

---

## FASE 2 — LOGIN & DASHBOARD

### 2.1 Login — `/` (halaman root)

- [ ] Buka `http://localhost:3000/` → form login.
- [ ] Login sebagai `admin` / `admin123` → redirect ke `/dashboard`.
- [ ] Login sebagai `kasir1` / `kasir123` → redirect ke `/pos`.
- [ ] Login sebagai `karyawan` / `karyawan123` → redirect ke `/dashboard/attendance/scan`.
- [ ] Username salah / password salah → error "Username/Email atau kata sandi salah".
- [ ] User `aktif=false` → error "Akun Anda dinonaktifkan".
- [ ] Login pakai email penuh (`admin@sobats.com`) juga bisa.

> Alur: `POST /api/auth/login` → `signInWithPassword` (Auth) → cek `pengguna.aktif` → set cookie SSR → redirect per role.

### 2.2 Profil Pengguna — `/dashboard/settings` (semua role)

- [ ] Ubah nama / username sendiri → validasi username unik + sync ke Auth (`updateProfile`).
- [ ] Ganti password sendiri → tersimpan di Supabase Auth (bukan tabel `pengguna`).
- [ ] Tautan cepat ke Manajemen Pengguna & Data Referensi (tampil sesuai role).

### 2.3 Dashboard — `/dashboard` (OWNER/ADMIN; KASIR lihat ringkasan; KARYAWAN lihat statistik absensi)

- [ ] **Kartu revenue hari ini vs kemarin** (+ % perubahan).
- [ ] **Jumlah order & avg ticket** hari ini.
- [ ] **Sparkline penjualan 14 hari**.
- [ ] **5 transaksi terbaru** (status Selesai/Sebagian/Tertunda).
- [ ] **Aktivitas terbaru** (10 log terakhir, waktu relatif, badge aksi).
- [ ] **Widget stok menipis** (5 item teratas, link "Stok Ulang").
- [ ] **Widget absensi** (status BELUM ABSEN/HADIR/TERLAMBAT + jam, tombol Scan) — hidden untuk OWNER.
- [ ] (KARYAWAN) Kartu statistik absensi bulanan (total/hadir/telat).
- [ ] Sidebar role-aware (RBAC: menu disesuaikan per role) + badge low stock di menu Inventaris
      (updates realtime via subscribe tabel `produk`); mobile nav slide-over (responsive).

---

## FASE 3 — ABSENSI (SEMUA ROLE KECUALI OWNER BISA SCAN; OWNER GENERATE QR)

### 3.1 Generate QR Absensi (OWNER only) — `/dashboard/attendance/generate-qr`

- [ ] Buka halaman → QR tampil 300px + countdown.
- [ ] QR **auto-refresh setiap 30 detik** (token baru, expired 30-60 detik sesuai `QR_EXPIRE_SECONDS`).
- [ ] Token dibuat di tabel `qr_session` (token UUID unik, `expired_at`, `is_active=true`).
- [ ] Letakkan QR di tempat yang bisa dipindai pegawai.

> ⚠️ PENTING: QR wajib di-generate **di hari yang sama** sebelum pegawai check-in, karena batas "TELAT"
> dihitung dari **waktu QR absensi pertama hari itu + 10 menit**.

### 3.2 Scan QR Check-in — `/dashboard/attendance/scan` (ADMIN/KASIR/KARYAWAN)

**Prasyarat**: HP/PC dengan kamera + izin GPS; posisi dalam radius toko (geofencing).

- [ ] Buka `/dashboard/attendance/scan` → kamera aktif (ZXing).
- [ ] Pindai QR dari 3.1.
- [ ] Browser minta izin GPS → izinkan.
- [ ] **Sukses**: status `HADIR` (atau `TELAT` jika lewat batas), `telat_menit` tercatat.
- [ ] Coba pindai QR yang sama lagi → ditolak (token sudah dipakai / anti-replay).
- [ ] Coba di luar radius toko → ditolak (geofencing Haversine > `MAX_ATTENDANCE_RADIUS`).
- [ ] Coba QR expired → ditolak.
- [ ] Check-in dua kali hari yang sama → ditolak "Already checked in today".

> DB: `absensi` bertambah (id_pengguna, tanggal, jam_masuk, status, telat_menit, latitude, longitude, device_info).
> Token `qr_session.is_active` jadi false setelah dipakai.

### 3.3 Check-out — scan QR lagi di halaman yang sama

- [ ] Pindai QR (perlu QR baru jika yang lama sudah terpakai).
- [ ] Sukses → `jam_pulang` tercatat (tanpa validasi GPS).
- [ ] Check-out sebelum check-in → ditolak.

### 3.4 Riwayat Absensi Pribadi — `/dashboard/attendance/history` (ADMIN/KASIR/KARYAWAN)

- [ ] Tabel riwayat 31 hari terakhir (tanggal, masuk, pulang, status, telat).
- [ ] Statistik: total, hadir, telat, total menit telat.
- [ ] Filter tanggal + Export CSV/PDF.

### 3.5 Laporan Absensi Pegawai — `/dashboard/attendance/report` (OWNER only, ADMIN/OWNER via API)

- [ ] Tabel semua pegawai (search, filter start/end, pagination).
- [ ] Statistik agregat + Export CSV.

---

## FASE 4 — SIKLUS HARIAN KASIR (POS + KAS KASIR)

> Ini inti operasional. Urutan: **buka sesi kasir → jual → tutup kasir**.

### 4.1 Buka Sesi Kasir (KASIR only) — `/dashboard/tutup-kasir`

- [ ] Login sebagai `kasir1` → menu **Kas Kasir** di sidebar.
- [ ] Pilih tanggal shift (default hari ini).
- [ ] Isi **Uang Awal Sesi** (float) — contoh `200000`.
- [ ] Klik **"Buka Sesi Kasir"**.
  - ✅ Baris baru `saldo_kas_harian` (`uang_awal=200000`, `saldo_awal=200000`, `dikonfirmasi=false`).
- [ ] Klik buka lagi di tanggal sama → ditolak **"Sesi kasir sudah dibuka hari ini"**.

> ⛔ KASIR yang **tidak** membuka sesi tetap bisa jual di POS, tapi tutup kasir tidak bisa dikonfirmasi
> tanpa sesi. Alur normal: buka sesi dulu di pagi hari.

### 4.2 Penjualan di POS — `/pos` (KASIR)

**Katalog & Pencarian:**
- [ ] Grid produk dengan warna per kategori; search (nama/kategori/id/barcode/SKU); filter kategori.
- [ ] Klik produk → masuk keranjang (default satuan dasar, tipe harga SATUAN).
- [ ] Produk dengan `jual_satuan` → muncul dialog pilih satuan (contoh: Pcs atau Roll).

**Keranjang & Numpad:**
- [ ] Numpad on-screen: 0-9, delete, `.` — berlaku untuk qty & jumlah bayar.
- [ ] Item aktif (terpilih) → qty +/− (min 0 = hapus otomatis); subtotal live.
- [ ] Ganti **tipe harga** per item: Satuan / Grosir / Promo (ikon label di cart).
- [ ] Set **diskon item** via numpad (Rp/pcs, dikurangkan sebelum dikali qty).
- [ ] Ganti **satuan jual** item aktif (base ↔ besar) — qty_satuan otomatis terhitung.
- [ ] Cek stok produk (modal, display + gudang) — ikon PackageSearch.
- [ ] Scanner barcode:
  - **Kamera**: modal scan ZXing.
  - **Hardware/USB**: ketik/scan → buffer 150ms + Enter → auto add ke cart.
  - **Via HP (SSE)**: klik "Scan via HP" → QR muncul → scan dengan HP → barcode terkirim ke sesi POS.
- [ ] Indikator WiFi + IP server (dari `/api/network-ip`) untuk panduan koneksi scanner HP
      (barcode scanner hardware USB juga didukung: buffer 150ms + Enter → auto add ke cart).
- [ ] Banner stok menipis di atas (dismiss per sesi).

**Pelanggan & Member:**
- [ ] Pilih pelanggan (dropdown, default UMUM).
- [ ] **Cari Member by No HP** — modal → ketik no_hp → kartu member (nama, no_hp, poin) → "Pilih Member".
- [ ] **Daftar Member Baru** — modal (nama + no_hp min 10 digit, cek duplikat 409) → poin awal 0.
- [ ] Badge poin di bawah nama pelanggan jika `point > 0`.

**Metode Bayar & Pembayaran:**
- [ ] Pilih metode bayar (dari tabel `metode_bayar`): Tunai / QRIS / Bank.
- [ ] **Tunai**: input jumlah bayar via numpad → kembalian otomatis.
- [ ] **DP**: centang/toggle DP → input DP → `sisa = total - dp` tersimpan.
- [ ] Pajak otomatis dari `pengaturan.pajak_persen` (ditampilkan di ringkasan).

**Checkout:**
- [ ] Klik **Bayar** → `POST /api/pos/checkout` → RPC `process_checkout` (advisory lock 987654321).
  - no_transaksi `YYYYMM+NNNN` (WIB, per bulan).
  - Potong stok: display dulu, fallback gudang (hanya `hitung_stok=true`).
  - Validasi stok: qty > total stok → ditolak "Stok tidak mencukupi".
  - Catat HPP (snapshot AVCO) + laba kotor + riwayat_avco.
- [ ] **Poin member**: jika member terpilih, `poin = floor(total / poin_min_pembelian)` ditambahkan via `increment_point`.
- [ ] Sukses → **redirect ke invoice** `/pos/invoice/[id]`; cart di-reset.

### 4.3 Invoice & Struk — `/pos/invoice/[id]`

- [ ] **Invoice A4**: kop toko (nama, alamat, telepon, email), data transaksi (no, tanggal, kasir, pelanggan,
      metode bayar), tabel item (produk, qty, satuan, harga, diskon, jumlah), subtotal, diskon, pajak, total,
      bayar, kembali/sisa, **terbilang**, info bank, footer, tanda tangan (Hormat Kami).
- [ ] **Faktur Penjualan**: varian header "FAKTUR PENJUALAN" (`?type=faktur` atau sesuai `jenis_nota`).
- [ ] **Struk thermal 58mm**: `/pos/invoice/[id]/receipt` — minimalis, tanpa simbol Rp, tanggal
      `dd/MM/yy HH:mm`, terbilang, footer struk.
- [ ] Tombol cetak (metode sesuai `pengaturan.metode_cetak`).
- [ ] `id` tidak ada → halaman 404.

### 4.4 Tutup Kasir (KASIR only) — `/dashboard/tutup-kasir`

- [ ] Buka halaman → sistem menampilkan ringkasan sesi:
  - Uang Awal, Pemasukan (penjualan Tunai), Penerimaan Retur, Pengeluaran (0 untuk laci), Saldo Akhir,
    **Penambahan Hari Ini** = Saldo Akhir − Uang Awal.
- [ ] Hitung fisik laci → isi **Fisik Laci (Uang Aktual)**.
- [ ] Selisih otomatis = aktual − saldo sistem (0 = aman; ≠0 = over/short tercatat).
- [ ] Klik **"Simpan Tutup Kasir"** → `saldo_kas_harian` di-update (`total_masuk`, `uang_aktual`, `selisih`,
      `dikonfirmasi=true`).
- [ ] Print laporan kasir.

---

## FASE 5 — INVENTARIS & BARANG MASUK (ADMIN/OWNER)

### 5.1 Barang Masuk — `/dashboard/inventory/stock-in`

**Prasyarat**: supplier ada, produk ada, `hitung_stok=aktif`.

- [ ] Pilih **Supplier**, **Tanggal Masuk**, isi **No. Faktur/Nota** (opsional, contoh `FK-20260810-001`).
- [ ] Tambah baris item:
  - Produk (combo search nama/barcode/SKU).
  - **Satuan Suplai** (otomatis dari `default_purchase_unit`, fallback satuan dasar).
  - **Qty Suplai** (dalam satuan suplai), **Total Harga**.
  - Indikator konversi real-time: `"Barang masuk: 2 Lusin. (Rasio: 1 Lusin = 12 Pcs). Total masuk gudang: 24 Pcs."`
- [ ] **Scan barcode** di form (keyboard/USB/HP) → produk terisi otomatis + fokus ke qty.
- [ ] Klik **Simpan** → RPC `process_barang_masuk` (advisory lock 987654322):
  - `base_qty_added = supplied_qty × conversion_ratio` → tambah ke **stok_gudang**.
  - AVCO dihitung ulang (weighted average), `riwayat_avco` dicatat (`pembelian`).
  - `harga_modal` disinkron dari AVCO **hanya jika saat ini NULL/0**.
- [ ] **Produk `hitung_stok=false`** → ditolak "Produk ... tidak terhitung stoknya".
- [ ] Setelah simpan: banner sukses + tombol **"Cetak Dokumen"** (surat jalan).

> DB: `barang_masuk` + `riwayat_avco` bertambah; `produk.stok_gudang` naik; `harga_pokok_avco`/`nilai_persediaan` ter-update.

### 5.2 Riwayat Barang Masuk — `/dashboard/inventory/stock-in/history`

- [ ] Kolom: No. Faktur, Tanggal, Waktu Input (created_at, sortable), Supplier, Produk, Qty Suplai, Base Qty,
      Harga, Total, Status.
- [ ] Search (produk/no_surat), filter supplier & tanggal, sort.
- [ ] **Total Nilai Pembelian** = hanya baris **AKTIF** (DIVOID dikecualikan).
- [ ] Export CSV & PDF (termasuk kolom No. Faktur & Status).
- [ ] Urut default: `tgl_masuk DESC, created_at DESC` (terbaru di atas).

### 5.3 Edit & Void Barang Masuk

**Edit (ringan):**
- [ ] Klik pensil → dialog edit `tgl_masuk`, `no_surat`, `keterangan` saja.
- [ ] **Tidak** mengubah qty/harga/produk/supplier (stok & AVCO tidak tersentuh).
- [ ] Baris DIVOID tidak bisa diedit.

**Void (pembatalan):**
- [ ] Klik ikon void → modal konfirmasi + **Alasan wajib** → "Ya, Batalkan".
- [ ] RPC `cancel_barang_masuk` (jurnal balik):
  - `stok_gudang` dikembalikan (tidak pernah negatif — GREATEST 0).
  - AVCO dihitung ulang (reverse weighted average), `riwayat_avco` jenis `retur_beli` dicatat.
- [ ] Baris jadi **DIVOID** (strikethrough), tombol edit/void hilang; printer tetap tersedia.
- [ ] Void dua kali → ditolak.
- [ ] Barang masuk DIVOID tidak dihitung di total pembelian & laporan kas harian.

### 5.4 Cetak Surat Jalan — `/dashboard/inventory/stock-in/print/[id]`

- [ ] Dari riwayat, klik ikon printer → halaman Surat Jalan A4.
- [ ] Header: "Surat Jalan", nama toko + alamat + telepon (dari pengaturan), No. Faktur, tanggal.
- [ ] Info supplier, nomor dokumen, jumlah item.
- [ ] Tabel: No, Produk (+SKU), Qty Suplai, Base Qty, Harga/Pcs, Total (konversi UoM benar).
- [ ] Ringkasan: Total + "Terbilang: ...".
- [ ] Blok tanda tangan Penerima & Supplier; footer dari pengaturan.
- [ ] Baris DIVOID tercoret + tidak dihitung + catatan.
- [ ] Tombol "Cetak Dokumen" / Ctrl+P → preview A4 multi-halaman tanpa sidebar.
- [ ] id tidak valid → 404.

### 5.5 Ulangi Pembelian (Reorder) — `/dashboard/inventory/stock-in?reorder=<id>`

- [ ] Di riwayat, baris AKTIF → ikon ulangi → form ter-prefill (supplier, item, qty suplai, total harga,
      tgl hari ini, No. Faktur kosong) + banner "Ulangi Pembelian" + tombol "Buat Baru".
- [ ] Ubah qty → simpan → barang masuk baru; sumber tidak berubah.
- [ ] "Buat Baru" → form kosong.
- [ ] Baris DIVOID tidak menampilkan tombol ulangi.

### 5.6 Retur Pembelian — `/dashboard/inventory/stock-in/retur`

- [ ] Buka Retur Barang → daftar barang masuk **AKTIF** (search produk/no_surat/supplier, filter supplier/tanggal).
- [ ] Baris dengan stok gudang > 0 → klik **Retur** → dialog: **Qty Retur** (maks = min(base_qty_added, stok_gudang))
      + keterangan.
- [ ] Simpan → RPC `process_retur_pembelian` (lock 987654322):
  - `no_retur = RB-YYYYMMDD-NN` (WIB).
  - `stok_gudang` berkurang; AVCO reverse; `riwayat_avco` jenis `retur_beli`.
  - **Kas Admin bertambah** sebesar total_nilai retur (uang kembali).
- [ ] Retur qty > stok gudang → ditolak "Stok gudang tidak mencukupi".
- [ ] Barang masuk DIVOID → tidak muncul sebagai kandidat retur.
- [ ] **Riwayat Retur** — `/dashboard/inventory/stock-in/retur/history`: No. Retur, Tanggal, Supplier,
      Barang Masuk, Item, Total Nilai, Operator, Keterangan; search/filter/export CSV-PDF; tombol "Buat Retur".

### 5.7 Stok Opname — `/dashboard/inventory/stock-opname`

**Alur bisnis**: snapshot stok saat input (bukan saat apply) → toko tetap beroperasi → apply permanen.

**Langkah 1 — Mulai Sesi:**
- [ ] Buka Stok Opname → form "Mulai Sesi" (tanggal default WIB hari ini, keterangan opsional).
- [ ] Klik **Mulai Opname** → redirect ke input fisik, nomor sesi `OP-YYYYMMDD-NN`.
- [ ] Sesi DRAFT dibuat; stok produk **belum berubah**.

**Langkah 2 — Input Fisik:**
- [ ] "+ Tambah Baris" → cari produk → **Stok Sistem** auto-fill → input **Stok Fisik** → **Selisih** otomatis
      (`fisik − sistem`, warna: 0 abu, negatif merah, positif hijau).
- [ ] Klasifikasi (Hilang/Rusak/Kelebihan/dll) + keterangan per baris.
- [ ] **Import CSV** (SKU/Barcode, Stok Fisik, Keterangan).
- [ ] **Simpan Draft** → baris tersimpan, sesi tetap DRAFT, stok DB tidak berubah.
- [ ] Jika stok berubah sejak input (dicek via tab lain) → banner "⚠ Stok berubah sejak input" →
      klik **Muat Ulang Stok Sistem**.

**Langkah 3 — Review & Terapkan:**
- [ ] Review: kartu ringkasan (Total Item, Total Selisih, Surplus Rp, Defisit Rp), breakdown per klasifikasi,
      tabel detail.
- [ ] Klik **Terapkan Opname** → konfirmasi → RPC `process_stok_opname` (lock 987654323):
  - `stok` display = `stok_fisik`; `riwayat_avco` jenis `koreksi`; sesi → SELESAI; tidak bisa diedit.
- [ ] Cek di Inventaris: stok produk berubah; detail produk → tab Riwayat AVCO ada mutasi `koreksi`.

**Batalkan Sesi DRAFT:**
- [ ] Klik **Batalkan Sesi** → status DIBATALKAN, baris draft dihapus, stok tidak berubah.

**Riwayat & Laporan:**
- [ ] Riwayat (`/dashboard/inventory/stock-opname/history`): daftar sesi (SELESAI/DIBATALKAN), accordion detail,
      search, filter tanggal, export CSV/PDF per sesi & semua.
- [ ] Laporan (`/dashboard/laporan/stok-opname`): hanya sesi **SELESAI**, kartu ringkasan, tabel bulanan +
      **Shrinkage %** = `|Defisit| / (|Defisit| + Surplus) × 100%`, export.

---

## FASE 6 — TRANSAKSI & KOREKSI (ADMIN/OWNER)

### 6.1 Riwayat Transaksi — `/dashboard/transactions`

- [ ] Tabel: no_transaksi, tanggal, total, bayar/kembali, pelanggan, kasir, metode bayar, status.
- [ ] Search + filter metode bayar + rentang tanggal.
- [ ] Klik baris → **detail transaksi** (sheet/modal, tanpa halaman terpisah).
- [ ] Ikon Receipt → buka invoice transaksi.
- [ ] Export CSV & PDF.

### 6.2 Void Transaksi

- [ ] Klik ikon void → modal konfirmasi → **Ya, Hapus**.
- [ ] **Catatan**: stok **TIDAK dikembalikan** (sesuai spesifikasi) — koreksi stok manual bila perlu.
- [ ] Role: hanya yang berhak (ADMIN/OWNER).

---

## FASE 7 — KEUANGAN: PENGELUARAN, KAS ADMIN, ARUS KAS (ADMIN/OWNER)

> Model dua kas: **Kas Kasir (laci)** = float + penjualan tunai; **Kas Admin (operasional)** = top-up owner
> − pengeluaran Tunai + refund retur. Pembelian barang TIDAK dipantau kas (dibayar owner langsung).

### 7.1 Pengeluaran Operasional — `/dashboard/keuangan/pengeluaran`

- [ ] Tambah pengeluaran: tanggal, **kategori beban** (ATK, Konsumsi, Kebersihan, Gaji, dll dari tabel `kategori_beban`),
      nama, jumlah, keterangan.
- [ ] **Metode bayar otomatis "Tunai"** — seluruh pengeluaran operasional dibayar dari **Kas Admin**
      (tidak ada pilihan metode lagi di form; data lama tetap tampil).
- [ ] Simpan → `pengeluaran` status AKTIF → **Kas Admin berkurang** otomatis.
- [ ] Daftar pengeluaran: DataTable (tanggal, kategori, nama, jumlah, status), ringkasan total periode,
      edit (jika belum DIVOID), **Void** (soft-update + alasan).
- [ ] Void pengeluaran → hilang dari laporan; Kas Admin kembali.

### 7.2 Kas Admin — `/dashboard/keuangan/kas-admin`

- [ ] Kartu ringkasan: **Saldo Saat Ini**, Masuk Bulan Ini, Keluar Bulan Ini.
- [ ] **Penambahan Saldo (top-up owner)** — kapan pun dibutuhkan: tanggal, jumlah, keterangan →
      baris `kas_admin_topup` → saldo bertambah.
- [ ] Tabel **Mutasi Kas Admin**:
  - 🟣 Top-up Owner (MASUK) — bisa **diedit** (pensil) / **dihapus** (tong sampah) jika salah input.
  - 🔵 Refund Retur (MASUK) — otomatis dari retur pembelian.
  - 🟠 Pengeluaran (KELUAR) — otomatis dari pengeluaran Tunai AKTIF.
- [ ] Export CSV.

> Rumus: `Kas Admin = Σ top-up + Σ refund retur − Σ pengeluaran Tunai AKTIF`.

### 7.3 Arus Kas — `/dashboard/keuangan/arus-kas`

- [ ] Pilih periode → laporan:
  - **Kas Awal** = Kas Kasir + Kas Admin.
  - **Arus Operasi**: Penerimaan Penjualan Tunai, Penerimaan Retur, Total Penerimaan;
    Pembayaran Pengeluaran Operasional (dari Kas Admin), Total Pembayaran; **Kas Bersih Operasi**.
  - **Arus Investasi**: total (placeholder 0).
  - **Arus Pendanaan**: **Penambahan Kas Admin (Top-up Owner)** + total.
  - **Kas Akhir** + **Konsistensi** (saldo akhir sistem tutup kasir vs kas akhir).
- [ ] Catatan kaki (CaLK): kas basis, AVCO, piutang/hutang = 0, pembelian tidak dipantau kas.
- [ ] Export CSV & print.

### 7.4 Riwayat Kas Harian — `/dashboard/laporan-kasir` (ADMIN/OWNER)

- [ ] Tabel per tanggal: Uang Awal, Masuk, Penambahan, Sistem, Aktual, Selisih, Kasir, Status.
- [ ] Search + export CSV + print.
- [ ] **Khusus OWNER**: tombol pensil → **"Edit Saldo Sesi Kasir"** — koreksi uang awal & uang aktual
      (total penjualan tidak berubah; saldo akhir & selisih dihitung ulang).

### 7.5 Laporan Kas Gabungan — `/dashboard/laporan/kas` (ADMIN/OWNER)

- [ ] Pilih periode → kartu **Saldo Akhir**: Kas Kasir (laci) + Kas Admin (operasional) + Kas Bank/QRIS.
- [ ] Kartu **Pergerakan Periode**: penambahan kasir, selisih kasir, uang masuk/keluar kas admin.
- [ ] Tabel rinci Kas Kasir harian + Mutasi Kas Admin (dengan saldo berjalan).
- [ ] Export CSV / Cetak.

---

## FASE 8 — LAPORAN KEUANGAN & ANALISIS (ADMIN/OWNER)

### 8.1 Laporan Penjualan — `/dashboard/reports` + API

- [ ] **Ringkasan** (`/dashboard/reports`): preset Hari Ini / 7 Hari / 30 Hari / Semua; kartu penjualan,
      jumlah transaksi; **top produk** (best seller by qty & revenue); daftar stok menipis.
- [ ] **API** `GET /api/laporan/penjualan`: pagination (max 200), filter pelanggan/metode/kasir, search, sort,
      `include_items`, meta (total, HPP, laba kotor, diskon, pajak, avg).
- [ ] **Rekap** `GET /api/laporan/penjualan/rekap`: group_by hari/kasir/metode_bayar/pelanggan.
- [ ] **Detail** `GET /api/laporan/penjualan/[id]`: relasi lengkap.
- [ ] **Export CSV** `GET /api/laporan/penjualan/export`: 15 kolom, filename `penjualan_<start>_<end>.csv`.

### 8.2 Laba Rugi — `/dashboard/laporan/laba-rugi`

- [ ] Pilih rentang tanggal.
- [ ] Struktur: Pendapatan Kotor → Diskon → Pendapatan Bersih → HPP (total_hpp) → **Laba Kotor** →
      Beban Operasional **per kategori** → **Penyesuaian** (Selisih Kas, Koreksi/Selisih Stok) → **Laba Bersih**.
- [ ] Print (header toko dari pengaturan, terbilang, blok tanda tangan) + Export CSV.

### 8.3 Neraca — `/dashboard/laporan/neraca`

- [ ] Pilih tanggal.
- [ ] **ASET**: Kas Tunai (laci) + Kas Admin (operasional) + Kas Bank/QRIS (non-tunai) + **Persediaan**
      (via RPC `get_inventory_value_at_date`). Piutang = 0.
- [ ] **KEWAJIBAN**: 0 (hutang dinonaktifkan).
- [ ] **EKUITAS**: Modal Awal + Penambahan Modal (Top-up Owner) + **Laba Ditahan** (termasuk sub-line
      Selisih Kas & Penyesuaian Stok) + **Penyesuaian Neraca** (residual agar selalu balance).
- [ ] **Harus balance**: total Aset = total Kewajiban + Ekuitas + Penyesuaian Neraca (hijau bila ~0,
      amber bila ≠ 0).
- [ ] Print + Export CSV.

### 8.4 Log Aktivitas — `/dashboard/log-aktivitas`

- [ ] Tabel `log_aktivitas` (waktu, pengguna, aksi CREATE/UPDATE/DELETE, entitas, deskripsi, data lama/baru, IP).
- [ ] Search + filter entitas/aksi/tanggal.

---

## FASE 9 — FITUR PENDUKUNG (EVENT PROMO, TOOLS, SCANNER, PWA)

### 9.1 Event Promo — `/dashboard/event-promo` (ADMIN/OWNER)

**Manajemen:**
- [ ] "+ Tambah Event": nama, rentang tanggal, tipe diskon (Persen/Nominal), nilai, pilih produk, status Aktif.
- [ ] **Overlap dicegah**: produk yang sama di 2 event aktif dengan tanggal beririsan → ditolak
      ("Produk A sudah terdaftar di event aktif lain pada rentang tanggal tersebut").
- [ ] Overlap diizinkan jika salah satu event **tidak aktif**.
- [ ] Edit event (ubah nilai diskon, tambah produk) → tersimpan.
- [ ] Hapus event → hilang dari daftar.

**Efek di aplikasi:**
- [ ] `/dashboard/inventory`: harga promo tampil dengan coretan (harga normal dicoret), badge `🏷 Nama Event`.
- [ ] `/pos`: harga item saat masuk cart = **harga efektif setelah diskon event** (computed pricing);
      badge promo di item; semua layer harga (Satuan/Grosir/Promo) ikut terdiskon.
- [ ] Checkout → invoice menampilkan harga promo.
- [ ] Event expired (tanggal selesai lewat) → harga kembali normal otomatis (tanpa cron, dihitung on-the-fly
      via API `get_harga_efektif_produk` / `/api/event-promo/efektif`).

### 9.2 Tools Cetak Label

- [ ] **Price Tag Generator** — `/dashboard/label-generator`: label harga 60×37mm / 37×60mm, barcode CODE128
      (fallback SKU), harga merah, footer logo, 4 slider ukuran font, preview, **download PNG per item &
      batch ZIP**, print.
- [ ] **Cetak Label Produk** — `/dashboard/product-label`: stiker 33×15mm (nama 2 baris, barcode + teks,
      harga IDR), qty per item (default 3), 3 slider ukuran, print.
- [ ] **Sheet Barcode A4** — `/pos/test-barcode`: 30 label/halaman (3×10) dari import CSV, print.
- [ ] Demo price tag publik — `/demo-price-tag`.
- [ ] Redirect `/label-generator` → `/dashboard/label-generator`.

### 9.3 Scanner Barcode via HP (SSE Relay)

- [ ] Di POS / form barang masuk, klik "Scan via HP" → modal QR + "Menunggu koneksi...".
- [ ] HP (satu jaringan LAN) pindai QR → buka `/scanner/<sessionId>` → izinkan kamera → "Terhubung".
- [ ] Scan barcode di HP → dalam ±1-2 detik produk masuk ke POS (feedback hijau, satuan terisi, fokus qty).
- [ ] Barcode tidak dikenal → "Produk tidak ditemukan".
- [ ] Sesi idle 5 menit → expired; tutup modal → koneksi putus; buka lagi → QR baru.

### 9.4 PWA & Teknis

- [ ] `app/manifest.ts` (nama app, icon 192/512, theme) — PWA installable.
- [ ] Service worker next-pwa (disabled di dev) — **catatan**: caching attendance masih TODO.

---

## FASE 10 — SKENARIO SIMULASI UTUH (END-TO-END)

> Jalankan berurutan di **satu hari yang sama** agar konsisten dengan laporan. Gunakan data bersih
> (restore ulang DB jika perlu). Tujuan: memverifikasi konsistensi seluruh sistem.

### Skenario A — Siklus Harian Toko (kasir)

1. [ ] (OWNER) Generate QR absensi di `/dashboard/attendance/generate-qr`.
2. [ ] (KASIR1) Scan QR → check-in HADIR; (KARYAWAN) scan → check-in.
3. [ ] (KASIR1) Buka sesi kasir: uang awal **200.000**.
4. [ ] (ADMIN) Barang masuk: Produk A `5 pcs` @ 5.000 (total 25.000) + Produk B `2 lusin` @ 60.000/lusin
      (base 24 pcs). No. Faktur `FK-SIM-001`.
5. [ ] (KASIR1) Jual 3 pcs Produk A @ harga satuan (Tunai 20.000) → cek invoice.
6. [ ] (KASIR1) Jual 1 lusin Produk B (pilih satuan jual besar) QRIS → invoice.
7. [ ] (KASIR1) Tutup kasir: fisik laci = 200.000 + 20.000 − 0 = **220.000** → selisih 0 → simpan.
8. [ ] (ADMIN) Cek dashboard: revenue hari ini = 20.000 + total jual B; transaksi terbaru 2.
9. [ ] (KASIR1) Scan QR lagi → check-out pulang.

### Skenario B — Koreksi & Retur

1. [ ] (ADMIN) Void barang masuk `FK-SIM-001` baris Produk A → stok gudang kembali; total pembelian turun.
2. [ ] (ADMIN) Retur 2 pcs Produk B (dari barang masuk yang tersisa) → stok gudang −2; Kas Admin +nilai retur;
      riwayat retur tercatat.
3. [ ] (ADMIN) Stok opname: buat sesi → set stok fisik Produk A = 2 (defisit 1 dari 3 di display) → apply →
      riwayat AVCO `koreksi` tercatat.
4. [ ] (ADMIN) Void transaksi POS pertama → transaksi hilang dari riwayat; stok tidak dikembalikan (sesuai aturan).

### Skenario C — Keuangan & Kas Admin

1. [ ] (ADMIN) Top-up Kas Admin 500.000 ("modal operasional") → saldo Kas Admin naik.
2. [ ] (ADMIN) Pengeluaran "Sabun & pembersih" 100.000 (Tunai, kategori Kebersihan) → Kas Admin turun.
3. [ ] (ADMIN) Buka `/dashboard/keuangan/kas-admin` → mutasi: Top-up +500.000, Pengeluaran −100.000,
      Refund retur +nilai; **Saldo Saat Ini** benar.
4. [ ] (OWNER) Edit saldo sesi kasir yang salah input (pensil di `/dashboard/laporan-kasir`).

### Skenario D — Laporan Konsisten

1. [ ] **Laba Rugi** (rentang hari ini): pendapatan = transaksi aktif; HPP benar; beban = pengeluaran AKTIF;
      penyesuaian = selisih kas + koreksi stok; laba bersih masuk akal.
2. [ ] **Neraca** (hari ini): Kas Tunai + Kas Admin + Kas Bank/QRIS + Persediaan = Kewajiban (0) + Modal Awal
      + Top-up + Laba Ditahan + Penyesuaian Neraca → **selisih 0**.
3. [ ] **Arus Kas**: kas awal = Kas Kasir + Kas Admin; kas akhir konsisten dengan neraca.
4. [ ] **Laporan Kas** (`/dashboard/laporan/kas`): saldo akhir ketiga kas tampil benar.
5. [ ] **Riwayat Kas Harian**: baris hari ini lengkap (uang awal, masuk, penambahan, aktual, selisih).
6. [ ] **Log Aktivitas**: semua aksi di atas tercatat (CREATE/UPDATE/DELETE + deskripsi).

### Skenario E — Event Promo & Member

1. [ ] (ADMIN) Buat event "Promo Akhir Bulan" 10% untuk Produk A (aktif, rentang hari ini-+3 hari).
2. [ ] (KASIR1) Buka POS → harga Produk A terdiskon 10% + badge; checkout ke member (no_hp terdaftar) →
      poin bertambah `floor(total / poin_min_pembelian)`.
3. [ ] (KASIR1) Cari member by no HP → poin tampil di badge.
4. [ ] (ADMIN) Matikan event / ubah tanggal selesai ke kemarin → harga kembali normal.

---

## FASE 11 — ROLLBACK / CLEANUP DATA SIMULASI

> Jalankan hanya jika ingin membersihkan data **hari ini** (mis. untuk mengulang simulasi).
> ⚠️ JANGAN jalankan di produksi jika ada transaksi asli hari ini.

```sql
BEGIN;

-- 1. Pengeluaran dummy
DELETE FROM pengeluaran WHERE created_at >= CURRENT_DATE;

-- 2. Transaksi POS dummy (detail dulu, baru header)
DELETE FROM detail_transaksi_keluar WHERE id_transaksi IN
  (SELECT id FROM transaksi_keluar WHERE tgl_transaksi >= CURRENT_DATE);
DELETE FROM transaksi_keluar WHERE tgl_transaksi >= CURRENT_DATE;

-- 3. Barang masuk & retur dummy
DELETE FROM detail_retur_pembelian WHERE id_retur IN
  (SELECT id FROM retur_pembelian WHERE tgl_retur >= CURRENT_DATE);
DELETE FROM retur_pembelian WHERE tgl_retur >= CURRENT_DATE;
DELETE FROM barang_masuk WHERE created_at >= CURRENT_DATE;

-- 4. Stok opname dummy (detail sesi + stok_opname + sesi)
DELETE FROM stok_opname WHERE tgl_opname >= CURRENT_DATE;
DELETE FROM sesi_stok_opname WHERE tgl_sesi >= CURRENT_DATE;

-- 5. Saldo kas harian & top-up dummy
DELETE FROM saldo_kas_harian WHERE tanggal >= CURRENT_DATE;
DELETE FROM kas_admin_topup WHERE tanggal >= CURRENT_DATE;

-- 6. Riwayat AVCO dummy
DELETE FROM riwayat_avco WHERE tanggal >= CURRENT_DATE;

-- 7. Event promo dummy (produk relasi dulu)
DELETE FROM event_promo_produk WHERE id_event_promo IN
  (SELECT id FROM event_promo WHERE tanggal_mulai >= CURRENT_DATE);
DELETE FROM event_promo WHERE tanggal_mulai >= CURRENT_DATE;

-- (Opsional, hati-hati) reset stok & HPP semua produk ke 0:
-- UPDATE produk SET stok = 0, stok_gudang = 0, harga_pokok_avco = 0,
--        nilai_persediaan = 0, harga_modal = 0;

COMMIT;
```

> Setelah cleanup, ulangi Fase 10 dari awal jika ingin simulasi ulang.

---

## LAMPIRAN A — DAFTAR HALAMAN (URL) & ROLE

| Halaman | URL | Role |
|---|---|---|
| Login | `/` | Semua |
| POS / Kasir | `/pos` | KASIR (+ADMIN/OWNER bisa akses) |
| Invoice | `/pos/invoice/[id]` | Semua (dari transaksi) |
| Struk thermal | `/pos/invoice/[id]/receipt` | Semua |
| Dashboard | `/dashboard` | OWNER/ADMIN/KASIR (ringkasan) |
| Riwayat Transaksi | `/dashboard/transactions` | ADMIN/OWNER |
| Pelanggan | `/dashboard/customers` | ADMIN/OWNER |
| Supplier | `/dashboard/suppliers` | ADMIN/OWNER |
| Inventaris (Produk) | `/dashboard/inventory` | ADMIN/OWNER |
| Barang Masuk | `/dashboard/inventory/stock-in` | ADMIN/OWNER |
| Riwayat Barang Masuk | `/dashboard/inventory/stock-in/history` | ADMIN/OWNER |
| Surat Jalan | `/dashboard/inventory/stock-in/print/[id]` | ADMIN/OWNER |
| Retur Barang | `/dashboard/inventory/stock-in/retur` | ADMIN/OWNER |
| Riwayat Retur | `/dashboard/inventory/stock-in/retur/history` | ADMIN/OWNER |
| Stok Opname | `/dashboard/inventory/stock-opname` | ADMIN/OWNER |
| Riwayat Opname | `/dashboard/inventory/stock-opname/history` | ADMIN/OWNER |
| Laporan Ringkasan | `/dashboard/reports` | ADMIN/OWNER |
| Laporan Laba Rugi | `/dashboard/laporan/laba-rugi` | ADMIN/OWNER |
| Laporan Neraca | `/dashboard/laporan/neraca` | ADMIN/OWNER |
| Laporan Stok Opname | `/dashboard/laporan/stok-opname` | ADMIN/OWNER |
| Laporan Kas | `/dashboard/laporan/kas` | ADMIN/OWNER |
| Kas Admin | `/dashboard/keuangan/kas-admin` | ADMIN/OWNER |
| Pengeluaran | `/dashboard/keuangan/pengeluaran` | ADMIN/OWNER |
| Arus Kas | `/dashboard/keuangan/arus-kas` | ADMIN/OWNER |
| Tutup Kasir (Kas Kasir) | `/dashboard/tutup-kasir` | KASIR |
| Riwayat Kas Harian | `/dashboard/laporan-kasir` | ADMIN/OWNER |
| Event Promo | `/dashboard/event-promo` | ADMIN/OWNER |
| Generate QR Absensi | `/dashboard/attendance/generate-qr` | OWNER |
| Scan QR Absensi | `/dashboard/attendance/scan` | ADMIN/KASIR/KARYAWAN |
| Riwayat Absensi | `/dashboard/attendance/history` | ADMIN/KASIR/KARYAWAN |
| Laporan Absensi Pegawai | `/dashboard/attendance/report` | OWNER |
| Log Aktivitas | `/dashboard/log-aktivitas` | ADMIN/OWNER |
| Label Generator | `/dashboard/label-generator` | ADMIN/OWNER |
| Cetak Label Produk | `/dashboard/product-label` | ADMIN/OWNER |
| Pengaturan | `/dashboard/settings` | ADMIN/OWNER |
| Pengaturan Keuangan | `/dashboard/settings/keuangan` | ADMIN/OWNER |
| Data Referensi | `/dashboard/settings/reference-data` | ADMIN/OWNER |
| Manajemen Pengguna | `/dashboard/settings/users` | OWNER |
| Bantuan | `/dashboard/support` | Semua |
| Scanner HP | `/scanner/[sessionId]` | Publik sesi |
| Sheet Barcode A4 | `/pos/test-barcode` | — |
| Demo Price Tag | `/demo-price-tag` | Publik |

## LAMPIRAN B — DAFTAR API ROUTE

| Method | Endpoint | Fungsi |
|---|---|---|
| POST | `/api/auth/login` | Login (Auth + cek aktif + cookie) |
| GET | `/api/pos/products` | Produk kasir (search/pagination/cache 60s) |
| GET | `/api/pos/barcode` | Cari produk by barcode/id/nama |
| GET | `/api/pos/customers` | Pelanggan (+ poin) |
| GET | `/api/pos/member-search` | Cari member by no_hp |
| POST | `/api/pos/member-register` | Daftar member baru (anti duplikat) |
| GET | `/api/pos/payment-methods` | Metode bayar |
| POST | `/api/pos/checkout` | Checkout → RPC + poin member |
| GET | `/api/low-stock` | Produk stok menipis (cache 30s) |
| GET | `/api/network-ip` | IP server untuk scanner HP |
| GET | `/api/scanner/[sessionId]/events` | SSE stream barcode |
| POST | `/api/scanner/[sessionId]` | Push barcode ke sesi |
| GET | `/api/attendance/today` | Status absensi hari ini |
| POST | `/api/attendance/checkin` | Check-in (QR + GPS + telat) |
| POST | `/api/attendance/checkout` | Check-out |
| GET | `/api/attendance/history` | Riwayat pribadi |
| POST | `/api/attendance/generate-qr` | Generate QR (OWNER) |
| GET | `/api/admin/attendance` | Laporan pegawai (ADMIN/OWNER) |
| GET | `/api/laporan/penjualan` | Laporan penjualan (pagination/filter/meta) |
| GET | `/api/laporan/penjualan/[id]` | Detail transaksi |
| GET | `/api/laporan/penjualan/rekap` | Rekap group_by |
| GET | `/api/laporan/penjualan/export` | Export CSV |
| GET | `/api/event-promo/efektif` | Harga efektif promo (produk) |
| GET/POST | `/api/event-promo` (+ `/[id]`, `/[id]/produk`) | CRUD event promo |

## LAMPIRAN C — DAFTAR TABEL DATABASE (PUBLIC)

`kategori`, `satuan`, `merk`, `metode_bayar`, `pengguna`, `supplier`, `pelanggan`, `produk`,
`transaksi_keluar`, `detail_transaksi_keluar`, `barang_masuk`, `stok_opname`, `pengaturan`,
`absensi`, `qr_session`, `riwayat_avco`, `saldo_kas_harian`, `pengaturan_keuangan`,
`log_aktivitas`, `sesi_stok_opname`, `lokasi_area`, `retur_pembelian`, `detail_retur_pembelian`,
`kategori_beban`, `pengeluaran`, `event_promo`, `event_promo_produk`, `kas_admin_topup`.

> Tabel hutang/piutang (`hutang_dagang`, `piutang_dagang`, `pembayaran_*`) sudah **di-drop** —
> kolom `dp`/`sisa` tetap ada di transaksi untuk DP, tapi tidak ada entri piutang.

## LAMPIRAN D — RPC FUNCTIONS & LOCK

| RPC | Lock | Fungsi |
|---|---|---|
| `process_checkout` | `987654321` | Checkout: no_transaksi WIB, subtotal/diskon/pajak/total, stok display→gudang, AVCO |
| `process_barang_masuk` | `987654322` | Barang masuk: UoM/legacy, stok_gudang, AVCO, no_surat, guard hitung_stok |
| `cancel_barang_masuk` | `987654322` | Void: jurnal balik AVCO, status DIVOID |
| `process_retur_pembelian` | `987654322` | Retur: no_retur WIB, stok_gudang −, AVCO reverse, Kas Admin + |
| `process_stock_opname` | `987654323` | Opname bulk: stok display = fisik, AVCO `koreksi` |
| `increment_point` | — | Tambah poin member atomik |
| `reset_pelanggan_id_seq` | — | Reset sequence pelanggan (workaround konflik 23505 saat daftar member) |
| `tambah_log_aktivitas` | — | Insert log (SECURITY DEFINER, bypass RLS) |
| `get_inventory_value_at_date` | — | Nilai persediaan per tanggal (neraca) |

## LAMPIRAN E — KOMPONEN TEKNIS PENDUKUNG

- **DataTable generik** (`components/data-table.tsx` + hook `useTable`): search, sort, filter, pagination,
  edit inline, delete modal, mobile cards — dipakai di hampir semua halaman dashboard.
- **ImportCSVModal** (`components/import-csv-modal.tsx`): drag-drop, preview + validasi per baris, template.
- **RLS + SECURITY DEFINER**: semua tabel RLS aktif; RPC checkout/barang masuk/opname/log bypass RLS.
- **Advisory locks**: 987654321 (checkout), 987654322 (barang masuk/void/retur), 987654323 (opname).
- **Zustand** (`stores/pos-store.ts`): state POS (cart, numpad, checkout) + **Zod/RHF** untuk validasi form.
- **Realtime**: `useLowStockRealtime()` — fetch `/api/low-stock` (cache 30s) + subscribe perubahan `produk`.
- **Cache headers**: `/api/pos/products` (60s), `/api/low-stock` (30s) — stale-while-revalidate.
- **PWA**: next-pwa (`dest: public`, disabled di dev), manifest di `app/manifest.ts`.

## LAMPIRAN F — RUMUS PENTING

```
Total per item        = (harga_jual − diskon_item) × qty
Subtotal              = Σ jumlah item
Diskon global         = subtotal × diskon_persen%  (atau nominal sesuai metode_diskon)
Pajak                 = (subtotal − diskon) × pajak_persen%
Total                 = subtotal − diskon + pajak
Kembali               = bayar − total (Tunai)
Sisa (DP)             = total − dp

HPP per item          = harga_pokok_avco × qty (snapshot saat checkout)
Laba kotor transaksi  = total − total_hpp
AVCO baru (masuk)     = (stok_lama×avco_lama + qty_masuk×harga_beli) ÷ (stok_lama + qty_masuk)
Base qty barang masuk = supplied_qty × conversion_ratio
Harga besar otomatis  = harga kecil × conversion_ratio
Kas Kasir (neraca)    = Σ(bayar − kembali) penjualan Tunai
Kas Admin (neraca)    = Σ top-up + Σ refund retur − Σ pengeluaran Tunai AKTIF
Kas Bank/QRIS         = Σ total penjualan non-tunai
Shrinkage % (opname)  = |Defisit| ÷ (|Defisit| + Surplus) × 100%
```

---

## CHECKLIST KELENGKAPAN (VERIFIKASI 3X)

> Jalankan checklist ini setelah menyelesaikan seluruh Fase 10 — setiap item harus sudah pernah diuji.

- [ ] **F0**: env, database, pengaturan toko & keuangan ✅
- [ ] **F1**: kategori, satuan, metode bayar, merk, produk (+UoM +barcode +SKU), supplier, pelanggan (UMUM), pengguna (5 role) ✅
- [ ] **F2**: login per role + dashboard lengkap (widget, low stock, aktivitas, absensi) ✅
- [ ] **F3**: generate QR (owner), check-in (HADIR/TELAT/duplikat/expired/geofencing), check-out, riwayat, laporan ✅
- [ ] **F4**: buka sesi kasir, POS (cari, cart, numpad, 3 tier harga, diskon item, member, DP, pajak, checkout), invoice/struk/faktur, tutup kasir ✅
- [ ] **F5**: barang masuk (+UoM +no_surat +scan), riwayat, edit/void, surat jalan, reorder, retur, stok opname (sesi→fisik→review→apply→riwayat→laporan) ✅
- [ ] **F6**: riwayat transaksi, detail, void ✅
- [ ] **F7**: pengeluaran (Tunai→Kas Admin), kas admin (top-up/edit/hapus), arus kas, riwayat kas harian, laporan kas, koreksi OWNER ✅
- [ ] **F8**: laporan penjualan (ringkasan+API), laba rugi, neraca (balance), log aktivitas ✅
- [ ] **F9**: event promo (CRUD+overlap+harga efektif+expired), label tools, scanner HP SSE, PWA ✅
- [ ] **F10**: skenario utuh A-E konsisten (kasir→inventaris→keuangan→laporan) ✅
- [ ] **Regresi**: checkout normal, barang masuk normal, restock display, opname, laba rugi/neraca, tutup kasir — semua tetap jalan setelah fitur lain diuji ✅

---

*Dokumen ini disusun dari gabungan seluruh file simulasi & spesifikasi project. Jika ada langkah yang gagal saat
simulasi, catat error-nya dan laporkan untuk diperbaiki — jangan lanjut ke langkah berikutnya sebelum paham penyebabnya.*
