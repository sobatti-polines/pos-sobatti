# Instruksi Pengembangan Fitur: Konfigurasi Minimal Pembelian Poin Member

**Konteks Proyek:** POS Sobatti (Next.js 16 App Router, Supabase, Tailwind v4, Zustand).
**Tujuan:** Membuat parameter `poin_min_pembelian` yang bisa diatur dari halaman Pengaturan Toko, menggantikan nilai hardcoded `100000` di API checkout.

---

## 1. Migrasi Basis Data

Buat file `supabase/migrations/20260726_add_poin_min_pembelian.sql`:

```sql
ALTER TABLE pengaturan
ADD COLUMN poin_min_pembelian NUMERIC NOT NULL DEFAULT 100000;
```

## 2. Update Backend — API Checkout

### File: `app/api/pos/checkout/route.ts`

- Fetch `poin_min_pembelian` bersamaan dengan `pajak_persen`.
- Gunakan sebagai divisor kalkulasi poin: `Math.floor(Number(data.total) / poinMinPembelian)`.

## 3. Update Halaman Settings

### 3a. File: `app/dashboard/settings/store-form.tsx`

- **Interface `StoreSettings`:** Tambahkan `poin_min_pembelian: number`.
- **UI:** Tambah input "Min. Pembelian untuk 1 Poin (Rp)" di section Konfigurasi Transaksi.

### 3b. File: `app/dashboard/settings/store-actions.ts`

- **Object `updates`:** Tambahkan `poin_min_pembelian: parseFloat(formData.get("poin_min_pembelian") as string) || 100000`.

## 4. Daftar Lengkap File yang Diubah

| No | File | Action |
|----|------|--------|
| 1 | `supabase/migrations/20260726_add_poin_min_pembelian.sql` | **Buat** |
| 2 | `app/api/pos/checkout/route.ts` | **Edit** |
| 3 | `app/dashboard/settings/store-form.tsx` | **Edit** |
| 4 | `app/dashboard/settings/store-actions.ts` | **Edit** |

## 5. Aturan Eksekusi

1. Migration SQL bisa dijalankan langsung di Supabase SQL Editor.
2. Nilai default `100000` agar tidak mengubah perilaku sebelum user mengatur ulang.
3. Gunakan Bahasa Indonesia untuk semua label.
4. Build wajib dicek setelah semua perubahan.
