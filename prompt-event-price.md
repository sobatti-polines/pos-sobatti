# PROMPT UNTUK AI AGENT: Fitur "Event Promo" (Diskon Otomatis Berbasis Tanggal)

## Konteks Proyek
Saya punya aplikasi POS System dengan tech stack **Next.js** + **PostgreSQL (Supabase)**.
Skema database yang SUDAH ADA (jangan diubah strukturnya kecuali disebutkan eksplisit di task):

- `produk` (id, nama_produk, id_kategori, id_satuan, harga_modal, harga_jual_satuan, harga_jual_grosir, **harga_jual_promo**, diskon, harga_jual_besar_satuan, harga_jual_besar_grosir, harga_jual_besar_promo, stok, barcode, sku, id_merk, dll)
- `transaksi_keluar` & `detail_transaksi_keluar` (transaksi penjualan/kasir)
- `pengguna`, `kategori`, `satuan`, `merk`, `supplier`, `pelanggan`, `metode_bayar`, `lokasi_area`, dll

⚠️ **PENTING — POTENSI KONFLIK YANG HARUS DIPERHATIKAN:**
Tabel `produk` **sudah punya kolom `harga_jual_promo`, `harga_jual_besar_promo`, dan `diskon`**. Kolom-kolom ini kemungkinan dipakai fitur promo manual yang sudah ada di aplikasi (misalnya kasir toggle manual "harga promo" per produk, tanpa berbasis tanggal). Fitur baru ini (**event promo berbasis tanggal**) TIDAK BOLEH menghapus, mengganti, atau menimpa kolom-kolom tersebut. Fitur ini harus dibangun sebagai **lapisan terpisah** (tabel baru + fungsi kalkulasi harga efektif), bukan menulis ulang ke kolom `harga_jual_promo` yang sudah ada. Jika ke depan ada kebutuhan menggabungkan logic keduanya, itu harus jadi keputusan eksplisit terpisah — jangan diasumsikan sendiri oleh AI agent.

## Tujuan Fitur
Membuat sistem "Event Promo" di mana admin toko bisa membuat event (misal: Diskon Natal, Promo 17 Agustus, Promo Ramadhan) dengan rentang tanggal mulai–selesai dan daftar produk yang kena diskon. Selama tanggal hari ini berada dalam rentang event yang aktif, harga produk tersebut otomatis terhitung sebagai harga promo — **tanpa cron job**, dihitung real-time saat query (computed pricing), supaya tidak ada risiko delay/gagal update jam 00:00.

## Prinsip Desain (WAJIB DIIKUTI)
1. **Tidak ada cron job** untuk mengubah harga fisik di kolom manapun. Harga event dihitung on-the-fly berdasarkan tanggal berjalan (`CURRENT_DATE`) via query/fungsi SQL.
2. Tabel produk (`produk`) **tidak boleh diubah skemanya**. Tidak menambah kolom baru ke `produk`.
3. Semua tabel baru harus mengikuti **konvensi penamaan yang sudah dipakai** di skema ini: snake_case, bahasa Indonesia (contoh: `nama`, `keterangan`, `created_at`, `id_produk`), primary key `uuid` dengan default `gen_random_uuid()` (mengikuti pola tabel-tabel baru seperti `riwayat_avco`, `saldo_kas_harian`).
4. RLS Policy harus mengikuti pola tabel-tabel terbaru di skema (bukan pola lama `auth_all`), yaitu policy terpisah per command: `SELECT`, `INSERT`, `UPDATE`, `DELETE`, semuanya untuk role `authenticated`, permissive, `true`/`true`. Ikuti contoh dari tabel-tabel lain di skema.
5. **AI agent DILARANG langsung menjalankan migration ke Supabase** (dilarang menggunakan `supabase db push`, `supabase migration up`, koneksi langsung ke database, atau tool apa pun yang mengeksekusi SQL ke instance Supabase saya). Semua perintah SQL migration **hanya dibuat sebagai file teks `.sql`** di dalam folder project (misalnya `supabase/migrations/`). Saya yang akan copy-paste manual ke Supabase SQL Editor.
6. Cegah konflik overlap: satu produk tidak boleh terdaftar di dua event promo yang tanggalnya tumpang tindih (overlap) sekaligus berstatus aktif — harus ada validasi ini (lihat Task 4).

---

## DAFTAR TODO TASK

### ✅ TASK 1 — Migration: Buat tabel `event_promo`
Buat file migration SQL **(hanya sebagai teks file, JANGAN dieksekusi)** untuk tabel baru:

```
event_promo
- id              uuid PK default gen_random_uuid()
- nama            varchar not null           -- contoh: "Diskon Natal 2026"
- tanggal_mulai   date not null
- tanggal_selesai date not null
- tipe_diskon     text not null               -- CHECK IN ('persen', 'nominal')
- nilai_diskon    numeric not null            -- CHECK (nilai_diskon > 0)
- aktif           bool not null default true
- keterangan      text nullable
- created_at      timestamptz not null default now()
- updated_at      timestamptz not null default now()
```

Tambahkan constraint:
- CHECK `tanggal_selesai >= tanggal_mulai`
- CHECK `tipe_diskon IN ('persen','nominal')`
- Jika `tipe_diskon = 'persen'`, `nilai_diskon` harus <= 100 (tambahkan CHECK constraint kondisional atau validasi di application layer — jelaskan pilihan yang diambil).

### ✅ TASK 2 — Migration: Buat tabel relasi `event_promo_produk`
Tabel penghubung many-to-many antara `event_promo` dan `produk`:

```
event_promo_produk
- id              uuid PK default gen_random_uuid()
- id_event_promo  uuid not null references event_promo(id) on delete cascade
- id_produk       int4 not null references produk(id) on delete cascade
- created_at      timestamptz not null default now()
- UNIQUE(id_event_promo, id_produk)
```

### ✅ TASK 3 — Migration: Index untuk performa
Tambahkan index pada:
- `event_promo (tanggal_mulai, tanggal_selesai)` — untuk mempercepat pengecekan event aktif
- `event_promo (aktif)`
- `event_promo_produk (id_produk)` — karena ini yang paling sering dipakai untuk lookup harga per produk saat checkout

### ✅ TASK 4 — Migration: Cegah overlap tanggal untuk produk yang sama
Buat validasi supaya satu `id_produk` tidak bisa terdaftar di dua `event_promo` berbeda yang:
- sama-sama `aktif = true`, DAN
- rentang tanggalnya saling overlap

Implementasikan sebagai salah satu dari (jelaskan trade-off yang dipilih di comment SQL):
- **Opsi A (direkomendasikan):** trigger function `BEFORE INSERT OR UPDATE` di `event_promo_produk` yang query ke `event_promo` + `event_promo_produk` lain untuk cek overlap tanggal, lalu `RAISE EXCEPTION` jika bentrok.
- **Opsi B:** exclusion constraint dengan extension `btree_gist` (`EXCLUDE USING gist (...)`), jika extension tersedia di Supabase project ini.

Pilih Opsi A jika tidak yakin extension `btree_gist` sudah aktif di project Supabase saya.

### ✅ TASK 5 — Migration: Fungsi SQL untuk hitung harga efektif produk
Buat SQL function `get_harga_efektif_produk(p_id_produk int4, p_tanggal date default current_date)` yang:
- Mengembalikan harga efektif produk pada tanggal tertentu (default hari ini) untuk **semua 6 varian harga** (`harga_jual_satuan`, `harga_jual_grosir`, `harga_jual_promo`, `harga_jual_besar_satuan`, `harga_jual_besar_grosir`, `harga_jual_besar_promo`).
- Logic: cek apakah `p_id_produk` terdaftar di `event_promo_produk` yang terhubung ke `event_promo` dengan `aktif = true` dan `p_tanggal BETWEEN tanggal_mulai AND tanggal_selesai`
  - Jika ADA event aktif: hitung diskon untuk keenam harga tersebut. Untuk tipe `persen`, kalikan masing-masing harga dengan `(1 - nilai_diskon/100)`. Untuk tipe `nominal`, kurangi masing-masing harga dengan `nilai_diskon`. Jangan sampai hasil di bawah 0 (gunakan `GREATEST(hasil, 0)`).
  - Jika TIDAK ADA event aktif: kembalikan keenam harga produk apa adanya dari tabel `produk` (tidak menyentuh kolom `harga_jual_promo` yang sudah ada).
- Return dalam bentuk table/record yang berisi keenam harga efektif tersebut, beserta info tambahan: `id_event_promo` dan `nama_event` yang sedang aktif (nullable), supaya UI bisa menampilkan badge "Promo Natal" dsb.

Tulis dalam bentuk view atau function (misal table function `RETURNS TABLE(...)`) — jelaskan pilihan yang diambil dan alasannya di comment SQL.

### ✅ TASK 6 — Migration: Update RPC `process_checkout`
Update fungsi RPC `process_checkout` agar ketika melakukan pengecekan/kalkulasi `harga_jual` untuk setiap item di `detail_transaksi_keluar`, fungsi menggunakan harga dari `get_harga_efektif_produk` (berdasarkan `type_harga_jual` dan `satuan_jual` yang dipilih) alih-alih mengambil langsung dari kolom tabel `produk`. Hal ini agar struk/kalkulasi transaksi terekam menggunakan harga diskon promo event secara otomatis.

### ✅ TASK 7 — Migration: RLS Policies
Tambahkan RLS policy untuk `event_promo` dan `event_promo_produk` (4 policy terpisah: select/insert/update/delete, role `authenticated`, permissive, `true`).

### ✅ TASK 8 — Kumpulkan semua migration di atas menjadi satu file teks
Gabungkan Task 1–7 menjadi satu file `.sql` yang terurut secara logis (tabel dulu, lalu index, lalu trigger/function, lalu update RPC, lalu RLS). Simpan sebagai **teks biasa di folder project** (misal `supabase/migrations/YYYYMMDDHHMMSS_add_event_promo.sql`), JANGAN dieksekusi ke database manapun. Tampilkan isi file lengkap ke saya untuk saya review dan paste manual ke Supabase SQL Editor.

### ✅ TASK 9 — Backend: API route Next.js untuk CRUD Event Promo (admin)
Buat API routes (App Router, `app/api/event-promo/...`) untuk:
- `GET /api/event-promo` — list semua event (dengan filter opsional `aktif`)
- `POST /api/event-promo` — buat event baru + assign produk (id_produk[])
- `PUT /api/event-promo/[id]` — update event
- `DELETE /api/event-promo/[id]` — hapus event
- `POST /api/event-promo/[id]/produk` — tambah produk ke event
- `DELETE /api/event-promo/[id]/produk/[id_produk]` — hapus produk dari event

Gunakan Supabase client yang sudah dipakai di project ini (cek pola koneksi existing sebelum membuat baru).

### ✅ TASK 10 — Backend: Endpoint/service ambil harga efektif produk
Buat service function (dipakai di halaman kasir & daftar produk) yang memanggil `get_harga_efektif_produk` untuk satu produk atau banyak produk sekaligus (batch), supaya halaman kasir tidak melakukan query berulang per item saat render list produk.

### ✅ TASK 11 — Frontend: Halaman admin kelola Event Promo
Buat halaman admin (list + form create/edit) untuk mengelola event promo: nama, tanggal mulai, tanggal selesai, tipe diskon, nilai diskon, pilih produk (multi-select dari tabel `produk`), toggle aktif/nonaktif.

### ✅ TASK 12 — Frontend: Tampilkan badge promo di halaman kasir & daftar produk
Saat produk yang sedang ada event aktif ditampilkan di halaman kasir/produk, tampilkan:
- Harga dicoret (harga normal) + harga promo
- Badge kecil nama event, contoh: "🎄 Diskon Natal"

### ✅ TASK 13 — Testing & Dokumentasi
- Tulis minimal test untuk fungsi `get_harga_efektif_produk` (kasus: tidak ada event, ada 1 event aktif, tanggal di luar rentang, dua event berbeda tanggal non-overlap).
- Tulis dokumentasi singkat (README section) menjelaskan cara kerja fitur ini untuk developer lain.

---

## ATURAN TAMBAHAN UNTUK AI AGENT
- Jangan asumsikan nama tabel/kolom di luar yang sudah disebutkan di dokumen ini — jika ragu, tanyakan dulu sebelum menulis migration.
- Jangan pernah menjalankan perintah yang terkoneksi langsung ke database Supabase saya (tidak ada `supabase db push`, tidak ada direct psql connection). Semua perubahan skema HANYA dalam bentuk file `.sql` yang saya review dan jalankan manual.
- Kerjakan task secara berurutan (Task 1 → 13), dan di akhir setiap task, tampilkan ringkasan apa yang sudah dibuat sebelum lanjut ke task berikutnya.
