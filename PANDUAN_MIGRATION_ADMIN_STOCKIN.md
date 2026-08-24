# 📋 Panduan Migration: Admin Stock-In Tanpa Harga

## ⚠️ STATUS: AMAN UNTUK PRODUCTION

Migration ini **AMAN** dijalankan di production yang sedang aktif karena:
- ✅ Hanya mengubah definisi fungsi PostgreSQL (CREATE OR REPLACE)
- ✅ Tidak mengubah struktur tabel
- ✅ Tidak ada data yang hilang atau terubah
- ✅ Menggunakan advisory lock untuk mencegah concurrent issues
- ✅ Rollback tersedia jika ada masalah

---

## 🚀 LANGKAH 1: Jalankan Migration (Supabase Production)

### Via Supabase Dashboard (Recommended)

1. **Buka Supabase Dashboard**
   - Login ke https://supabase.com/dashboard
   - Pilih project Anda

2. **Buka SQL Editor**
   - Klik menu "SQL Editor" di sidebar
   - Klik "New Query"

3. **Copy-Paste Migration**
   - Buka file: `supabase/migrations/20260824_admin_stockin_no_price.sql`
   - Copy seluruh isi file
   - Paste ke SQL Editor

4. **Jalankan Migration**
   - Klik tombol "Run" atau tekan Ctrl+Enter
   - Tunggu hingga selesai (biasanya < 1 detik)

5. **Verifikasi**
   ```sql
   SELECT proname, pg_get_function_result(oid) 
   FROM pg_proc 
   WHERE proname = 'process_barang_masuk';
   ```

### Via Supabase CLI (Alternatif)

```bash
# Pastikan sudah login
supabase login

# Jalankan migration ke production
supabase db push --linked

# Atau jalankan file SQL langsung
psql "postgresql://postgres:[YOUR-PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres" \
  -f supabase/migrations/20260824_admin_stockin_no_price.sql
```

---

## 🧪 LANGKAH 2: Testing di Local PostgreSQL

### Setup Local Database

```bash
# 1. Pastikan PostgreSQL berjalan
pg_isready

# 2. Buat database lokal (jika belum ada)
createdb pos_sobatti_local

# 3. Jalankan semua migration dari awal (untuk fresh install)
# Atau jalankan migration spesifik ini saja:

psql -U postgres -d pos_sobatti_local \
  -f supabase/migrations/20260824_admin_stockin_no_price.sql
```

### Testing Flow Admin

```sql
-- 1. Login sebagai ADMIN di browser
-- 2. Buka /dashboard/inventory/stock-in
-- 3. Input barang masuk (tanpa harga)
-- 4. Cek database:

-- Cek barang masuk tersimpan
SELECT id, id_produk, total_cost, harga_beli, base_qty_added
FROM barang_masuk 
ORDER BY id DESC 
LIMIT 5;

-- Cek stok bertambah
SELECT id, nama_produk, stok_gudang, harga_pokok_avco
FROM produk 
WHERE id = [ID_PRODUK_YANG_DITAMBAH];

-- Cek riwayat AVCO (harga_satuan_transaksi = 0)
SELECT id_referensi, qty_masuk, harga_satuan_transaksi, avco_sesudah
FROM riwayat_avco 
ORDER BY created_at DESC 
LIMIT 5;
```

### Testing Flow Owner

```sql
-- 1. Login sebagai OWNER di browser
-- 2. Buka /dashboard/inventory/stock-in/tentukan-harga
-- 3. Input harga untuk item yang belum ada harga
-- 4. Klik "Simpan & Hitung Ulang AVCO"
-- 5. Cek database:

-- Cek harga sudah terupdate
SELECT id, total_cost, harga_beli, base_cost_per_piece
FROM barang_masuk 
WHERE id = [ID_BARANG_MASUK];

-- Cek AVCO sudah dihitung ulang
SELECT id, nama_produk, stok_gudang, harga_pokok_avco, nilai_persediaan
FROM produk 
WHERE id = [ID_PRODUK];

-- Cek riwayat AVCO sudah terupdate
SELECT id_referensi, harga_satuan_transaksi, avco_sesudah, nilai_persediaan_sesudah
FROM riwayat_avco 
WHERE id_referensi = [ID_BARANG_MASUK];
```

---

## 🔄 ROLLBACK (Jika Ada Masalah)

### Kapan Perlu Rollback?

- Admin tidak bisa input barang masuk sama sekali
- Error "total_cost harus lebih dari 0" muncul untuk admin
- AVCO tidak dihitung dengan benar
- Ada bug yang mempengaruhi fitur lain

### Cara Rollback

1. **Buka Supabase SQL Editor**

2. **Copy-Paste Rollback Script**
   - Buka file: `supabase/migrations/rollback/20260824_admin_stockin_no_price_rollback.sql`
   - Copy seluruh isi file
   - Paste ke SQL Editor

3. **Jalankan Rollback**
   - Klik "Run"
   - Tunggu hingga selesai

4. **Verifikasi**
   ```sql
   -- Pastikan fungsi sudah kembali ke versi lama
   SELECT proname 
   FROM pg_proc 
   WHERE proname = 'process_barang_masuk';
   ```

5. **Test Ulang**
   - Login sebagai ADMIN
   - Coba input barang masuk (harus ada kolom harga lagi)

### Rollback di Local

```bash
psql -U postgres -d pos_sobatti_local \
  -f supabase/migrations/rollback/20260824_admin_stockin_no_price_rollback.sql
```

---

## 📊 Monitoring Setelah Migration

### Cek Log Error

```sql
-- Di Supabase Dashboard → Logs → Postgres
-- Filter: process_barang_masuk
-- Pastikan tidak ada error terkait fungsi ini
```

### Cek Barang Masuk Pending (Owner)

```sql
-- Jumlah barang masuk yang belum ditentukan harganya
SELECT COUNT(*) as pending_count
FROM barang_masuk
WHERE status = 'AKTIF'
AND (total_cost = 0 OR harga_beli = 0);

-- Detail barang masuk pending
SELECT 
  bm.id,
  bm.tgl_masuk,
  p.nama_produk,
  bm.base_qty_added,
  bm.total_cost,
  bm.harga_beli
FROM barang_masuk bm
JOIN produk p ON bm.id_produk = p.id
WHERE bm.status = 'AKTIF'
AND (bm.total_cost = 0 OR bm.harga_beli = 0)
ORDER BY bm.tgl_masuk DESC;
```

---

## 🎯 Rangkuman Perubahan

| Komponen | Perubahan | Dampak |
|----------|-----------|--------|
| `process_barang_masuk` RPC | Skip AVCO jika `total_cost = 0` | Admin bisa input stok tanpa harga |
| Stock-In Form | Sembunyikan kolom harga untuk admin | UI lebih bersih untuk admin |
| Tentukan Harga Page | Halaman baru untuk owner | Owner bisa assign harga kapan saja |
| Sidebar Navigation | Tambah link "Tentukan Harga" | Akses mudah untuk owner |

---

## ❓ Troubleshooting

### Error: "relation does not exist"
```sql
-- Pastikan tabel barang_masuk dan produk ada
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('barang_masuk', 'produk');
```

### Error: "function does not exist"
```sql
-- Pastikan fungsi sudah terbuat
SELECT proname FROM pg_proc 
WHERE proname IN ('process_barang_masuk', 'cancel_barang_masuk');
```

### Admin Masih Bisa Input Harga
- Clear browser cache
- Restart Next.js server
- Pastikan deployment sudah ter-deploy

### AVCO Tidak Diupdate
- Cek `total_cost` di tabel `barang_masuk`
- Jika masih 0, owner perlu assign harga via "Tentukan Harga"
- Jika sudah ada harga tapi AVCO tidak berubah, cek log error di Supabase

---

## 📞 Kontak

Jika ada masalah:
1. Cek error log di Supabase Dashboard → Logs
2. Jalankan rollback script jika perlu
3. Hubungi developer untuk bantuan lebih lanjut

---

**Dibuat**: 24 Agustus 2026  
**Versi**: 1.0  
**Status**: Ready for Production
