# ✅ Checklist Migration Admin Stock-In

## Sebelum Migration
- [ ] Backup database (jika perlu)
- [ ] Pastikan tidak ada transaksi barang masuk sedang berjalan
- [ ] Buka file migration: `supabase/migrations/20260824_admin_stockin_no_price.sql`
- [ ] Buka file rollback: `supabase/migrations/rollback/20260824_admin_stockin_no_price_rollback.sql`

## Jalankan Migration
- [ ] Buka Supabase Dashboard → SQL Editor
- [ ] Copy-paste isi migration file
- [ ] Klik "Run"
- [ ] Tunggu hingga selesai (< 1 detik)

## Verifikasi
- [ ] Jalankan script: `supabase/migrations/verify/verify_admin_stockin.sql`
- [ ] Pastikan semua query menghasilkan output tanpa error
- [ ] Cek log error di Supabase Dashboard → Logs

## Test di Production
- [ ] Login sebagai ADMIN
- [ ] Buka `/dashboard/inventory/stock-in`
- [ ] Pastikan kolom harga TIDAK tampil
- [ ] Input barang masuk (hanya qty)
- [ ] Cek stok bertambah di gudang
- [ ] Login sebagai OWNER
- [ ] Buka `/dashboard/inventory/stock-in/tentukan-harga`
- [ ] Pastikan item yang baru diinput muncul di daftar
- [ ] Input harga beli
- [ ] Klik "Simpan & Hitung Ulang AVCO"
- [ ] Cek AVCO produk sudah terupdate

## Test di Local
- [ ] Jalankan migration ke local PostgreSQL
- [ ] Ulangi test di atas di local
- [ ] Pastikan hasil sama dengan production

## Rollback (Jika Perlu)
- [ ] Buka Supabase Dashboard → SQL Editor
- [ ] Copy-paste isi rollback file
- [ ] Klik "Run"
- [ ] Verifikasi fungsi sudah kembali ke versi lama
- [ ] Test ulang

## Selesai
- [ ] Semua test berhasil ✅
- [ ] Tidak ada error di log ✅
- [ ] Fitur berjalan sesuai harapan ✅

---

## 📁 File yang Dibuat

| File | Lokasi | Keterangan |
|------|--------|------------|
| Migration | `supabase/migrations/20260824_admin_stockin_no_price.sql` | Script utama |
| Rollback | `supabase/migrations/rollback/20260824_admin_stockin_no_price_rollback.sql` | Jika perlu rollback |
| Verifikasi | `supabase/migrations/verify/verify_admin_stockin.sql` | Cek apakah migration berhasil |
| Panduan | `PANDUAN_MIGRATION_ADMIN_STOCKIN.md` | Panduan lengkap |

---

## ⏱️ Estimasi Waktu

- Migration: < 1 detik
- Verifikasi: < 5 detik
- Testing: 5-10 menit
- **Total: < 15 menit**

---

## 🆘 Jika Ada Masalah

1. **Error saat migration**: Jalankan rollback script
2. **Admin tidak bisa input**: Clear cache, restart server
3. **AVCO tidak diupdate**: Cek apakah owner sudah assign harga
4. **Fitur tidak muncul**: Pastikan deployment sudah ter-deploy

---

**Status**: Ready to Run ✅  
**Dibuat**: 24 Agustus 2026
