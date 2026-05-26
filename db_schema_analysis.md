# Database Schema Audit: Supabase vs. POS Spec

> Live database queried on 2026-05-23. All 12 tables inspected.

---

## Legend

| Status | Meaning |
|--------|---------|
| ✅ Exists | Column/table exists and matches the spec |
| ⚠️ Gap | Column exists but has issues or isn't used by the app |
| ❌ Missing | Column/table required by the spec does not exist |
| 🆕 Extra | Column exists but is not in the spec (app-specific addition) |

---

## Tables Overview

| # | Table Name | Rows | Spec Sheet | Status |
|---|---|---|---|---|
| 1 | `kategori` | 17 | Sheet 15: Tabel Kategori | ✅ Good |
| 2 | `satuan` | 15 | Sheet 16: Tabel Satuan | ✅ Good |
| 3 | `metode_bayar` | 7 | Sheet 17: Tabel Metode Bayar | ✅ Good |
| 4 | `supplier` | 9 | Sheet 3: Daftar Supplier | ✅ Good |
| 5 | `pelanggan` | 8 | Sheet 4: Daftar Pelanggan | ⚠️ Missing UMUM |
| 6 | `pengguna` | 4 | Sheet 1: Manajemen Pengguna | ⚠️ Missing columns |
| 7 | `produk` | 68 | Sheet 2: Daftar Produk | ✅ Good |
| 8 | `barang_masuk` | 45 | Sheet 13/14: Barang Masuk | ✅ Good |
| 9 | `transaksi_keluar` | 11 | Sheet 5/6: Transaksi | ✅ Good |
| 10 | `detail_transaksi_keluar` | 32 | Sheet 8: Detail Transaksi | ⚠️ Missing columns |
| 11 | `stok_opname` | 0 | Sheet 10/11: Stok Opname | ⚠️ Exists but unused |
| 12 | `pengaturan` | 1 | Sheet 12: Pengaturan | ⚠️ Missing columns |

---

## Detailed Table Analysis

---

### 1. `kategori` ✅

| Column | Type | Spec Match |
|--------|------|------------|
| `id` | serial PK | ✅ |
| `nama` | text | ✅ |

**Verdict:** Fully matches spec. Has unique constraint on `nama`. 17 categories populated.

---

### 2. `satuan` ✅

| Column | Type | Spec Match |
|--------|------|------------|
| `id` | serial PK | ✅ |
| `nama` | text | ✅ |

**Verdict:** Fully matches. 15 units populated (spec has 6 default, this has 15 for building materials). Has unique constraint on `nama`.

---

### 3. `metode_bayar` ✅

| Column | Type | Spec Match |
|--------|------|------------|
| `id` | serial PK | ✅ |
| `nama` | text | ✅ |

**Verdict:** Matches spec. 7 methods (spec default is 9 — missing DP, OVO, Gopay, and some bank-specific debit entries). This is fine since entries are configurable.

---

### 4. `supplier` ✅

| Column | Type | Spec Match |
|--------|------|------------|
| `id` | serial PK | ✅ |
| `nama_supplier` | text | ✅ Maps to "Nama Supplier" |
| `alamat` | text | ✅ Maps to "Alamat" |
| `telepon` | text | ✅ Maps to "Telepon/HP" |
| `email` | text | ✅ Maps to "Email" |
| `keterangan` | text | ✅ Maps to "Keterangan" |
| `created_at` | timestamp | 🆕 App-specific |

**Verdict:** Fully matches spec, plus a useful `created_at`.

---

### 5. `pelanggan` ⚠️

| Column | Type | Spec Match |
|--------|------|------------|
| `id` | serial PK | ✅ |
| `nama_pelanggan` | text | ✅ Maps to "Nama Pelanggan" |
| `alamat` | text | ✅ Maps to "Alamat" |
| `no_hp` | text | ✅ Maps to "No. HP / WA" |
| `email` | text | ✅ Maps to "Email" |
| `keterangan` | text | ✅ Maps to "Keterangan" |
| `created_at` | timestamp | 🆕 App-specific |

**Issues:**
- ❌ **No `UMUM` default row** — Spec requires a default customer named "UMUM" with all fields set to "-" for anonymous transactions. Currently, the app uses `NULL` for id_pelanggan instead, which works but diverges from the spec.

---

### 6. `pengguna` ⚠️

| Column | Type | Spec Match |
|--------|------|------------|
| `id` | serial PK | ✅ |
| `username` | text | ✅ Maps to "Username" |
| `password` | text | ✅ SHA-256 hash stored |
| `level` | text | ✅ "ADMIN", "KASIR", "OWNER" |
| `aktif` | boolean | 🆕 Not in spec but useful |
| `created_at` | timestamp | 🆕 App-specific |

**Issues:**
- ❌ **`nama` column missing** — The app code (`pos/page.tsx` line 115) tries to query `pengguna.nama` to display cashier's full name. This column doesn't exist in the DB, so it falls back to `username`. Spec doesn't have a separate "nama" column either, but the app expects it.

> [!WARNING]
> **Security concern:** User roles are stored in `raw_user_meta_data` (line 26 of `create-auth-users.sql`: `'{"username":"admin","role":"ADMIN"}'`). Per Supabase security best practices, `user_metadata` is user-editable and **should never be used for authorization**. Roles should be in `raw_app_meta_data` instead.

---

### 7. `produk` ✅

| Column | Type | Spec Match |
|--------|------|------------|
| `id` | serial PK | ✅ |
| `nama_produk` | text | ✅ |
| `id_kategori` | int FK→kategori | ✅ |
| `id_satuan` | int FK→satuan | ✅ |
| `hitung_stok` | boolean | ✅ |
| `harga_modal` | numeric | ✅ |
| `harga_jual_satuan` | numeric | ✅ |
| `harga_jual_grosir` | numeric | ✅ |
| `harga_jual_promo` | numeric | ✅ Exists! (all NULL currently) |
| `diskon` | numeric | ✅ Default per-item discount |
| `barcode` | text (unique) | 🆕 Added via migration |
| `stok_minimum` | int | 🆕 App-specific (default 20) |
| `created_at` | timestamp | 🆕 |
| `updated_at` | timestamp | 🆕 |

**Key finding:** `harga_jual_promo` **DOES exist** in the database (all values are NULL). The gap analysis incorrectly stated it was missing from the DB. It's just not used by the app UI.

**Verdict:** Database fully supports the spec. The app code just needs to use `harga_jual_promo`.

---

### 8. `barang_masuk` ✅

| Column | Type | Spec Match |
|--------|------|------------|
| `id` | serial PK | ✅ |
| `tgl_masuk` | date | ✅ Maps to "Tanggal" |
| `id_supplier` | int FK→supplier | ✅ |
| `id_produk` | int FK→produk | ✅ |
| `harga_beli` | numeric | ✅ Maps to "Harga Beli" |
| `jumlah` | int | ✅ Maps to "Jumlah" |
| `total` | numeric | ✅ Maps to "Total" |
| `keterangan` | text | 🆕 Added via migration |
| `created_at` | timestamp | 🆕 |

**Verdict:** Fully matches spec. `keterangan` is a useful addition.

---

### 9. `transaksi_keluar` ✅

| Column | Type | Spec Match |
|--------|------|------------|
| `id` | serial PK | ✅ |
| `no_transaksi` | bigint | ✅ Auto-generated |
| `tgl_transaksi` | timestamp | ✅ |
| `id_kasir` | int FK→pengguna | ✅ |
| `id_pelanggan` | int FK→pelanggan (nullable) | ✅ |
| `id_metode_bayar` | int FK→metode_bayar | ✅ |
| `subtotal` | numeric | ✅ |
| `diskon_persen` | numeric | ✅ |
| `diskon_nominal` | numeric | ✅ |
| `pajak_persen` | numeric | ✅ |
| `pajak_nominal` | numeric | ✅ |
| `total` | numeric | ✅ |
| `bayar` | numeric | ✅ |
| `kembali` | numeric | ✅ |
| `dp` | numeric | ✅ |
| `sisa` | numeric | ✅ |
| `created_at` | timestamp | 🆕 |

**Verdict:** Perfectly matches spec. All 27 spec columns are represented through this table + detail table + FK joins.

---

### 10. `detail_transaksi_keluar` ⚠️

| Column | Type | Spec Match |
|--------|------|------------|
| `id` | serial PK | ✅ |
| `id_transaksi` | int FK→transaksi_keluar | ✅ |
| `id_produk` | int FK→produk | ✅ |
| `type_harga_jual` | text | ✅ "SATUAN"/"GROSIR" |
| `harga_modal` | numeric | ✅ |
| `harga_jual` | numeric | ✅ |
| `diskon_item` | numeric | ✅ (always 0 currently) |
| `qty` | int | ✅ |
| `jumlah` | numeric | ✅ |
| `kas_masuk` | numeric | ✅ |
| `profit` | numeric | ✅ |

**Missing columns (from spec but not critical):**
- ❌ `satuan` — Spec Sheet 6 has a "Satuan" column per-item. Not needed since it can be joined via `produk.id_satuan → satuan.nama`.
- ❌ `no_urut` — Spec has a sequential "Nomor Urut" per row. Not needed since `id` serves this purpose.

**Verdict:** Functionally complete. Missing columns are derivable via JOINs and not worth adding.

---

### 11. `stok_opname` ⚠️

| Column | Type | Spec Match |
|--------|------|------------|
| `id` | serial PK | ✅ |
| `tgl_opname` | date | ✅ Maps to "Tanggal" |
| `id_produk` | int FK→produk | ✅ |
| `stok_sistem` | int | ✅ Maps to "Stok Sistem" |
| `stok_fisik` | int | ✅ Maps to "Stok Fisik" |
| `selisih` | int | ✅ Maps to "Selisih" |
| `keterangan` | text | ✅ Maps to "Keterangan" |
| `created_at` | timestamp | 🆕 |

**Verdict:** Table schema is complete and matches the spec. **0 rows** — no UI has been built to use it yet. DB is ready, just needs the app pages.

---

### 12. `pengaturan` ⚠️

| Column | Type | Spec Match |
|--------|------|------------|
| `id` | int PK | ✅ |
| `nama_toko` | text | ✅ "Swalayan Besi Semarang" → "Toko Bangunan Sobat" |
| `alamat` | text | ✅ |
| `telepon` | text | ✅ |
| `email` | text | ✅ |
| `nama_kasir_aktif` | text | ✅ |
| `metode_diskon` | text | ✅ "Nominal"/"Persen" |
| `bank1_nama` | text | ✅ (NULL) |
| `bank1_rekening` | text | ✅ (NULL) |
| `bank1_atas_nama` | text | ✅ (NULL) |
| `bank2_nama` | text | ✅ (NULL) |
| `bank2_rekening` | text | ✅ (NULL) |
| `bank2_atas_nama` | text | ✅ (NULL) |
| `footer_struk_1` | text | ✅ |
| `footer_struk_2` | text | ✅ |
| `footer_struk_3` | text | ✅ |
| `footer_invoice_1` | text | ✅ |
| `footer_invoice_2` | text | ✅ |
| `footer_invoice_3` | text | ✅ |
| `updated_at` | timestamp | 🆕 |

**Missing columns (required by spec):**

| Missing Column | Spec Description | Priority |
|---|---|---|
| ❌ `pajak_persen` | Tax rate (e.g., 11 for PPn 11%) | 🔴 High |
| ❌ `jenis_nota` | Default nota format: "Struk 58mm" / "Invoice" / "Faktur" | 🟡 Medium |
| ❌ `metode_cetak` | "Tampil Print Preview" or direct print | 🟡 Low |
| ❌ `logo_nota` | Boolean: show logo on receipt | 🟡 Low |
| ❌ `hormat_kami_nama` | "Signed by" name on invoice footer | 🟡 Low |
| ❌ `kasir` | Default cashier name (separate from `nama_kasir_aktif`?) | 🟡 Low |

---

## RLS Policies

All 12 tables have RLS enabled with a single `auth_all` policy:
```sql
FOR ALL TO authenticated USING (true) WITH CHECK (true)
```

> [!WARNING]
> This means **any authenticated user** (KASIR, ADMIN, OWNER) can **read, insert, update, and delete** every row in every table. The spec defines user levels (ADMINISTRATOR, KASIR) with different access, but the database doesn't enforce this.

**Recommendations:**
- KASIR should NOT be able to delete transactions, modify settings, or manage users
- Only ADMIN/OWNER should access `pengaturan` and `pengguna`
- Consider adding role-based policies using `pengguna.level`

---

## Gap Analysis Corrections

Based on this database audit, the gap analysis needs these corrections:

| Gap Analysis Claim | Actual Finding |
|---|---|
| "`harga_jual_promo` column missing from DB" | ✅ **Column EXISTS** — `produk.harga_jual_promo` is in the DB (all NULL). Only the app UI doesn't use it. |
| "Stock is calculated, not stored" | ✅ Confirmed — no `stok` column on `produk`. Computed from `barang_masuk - detail_transaksi_keluar` |
| "stok_opname table exists" | ✅ Confirmed — table has proper columns, just 0 rows and no UI |
| "DP columns exist" | ✅ Confirmed — `transaksi_keluar.dp` and `transaksi_keluar.sisa` exist |

---

## Summary: Database Readiness

### ✅ What's Already Correct (No DB changes needed)

The database **already supports ~85%** of the spec. These features just need **app UI/API work**, not schema changes:

- Promo pricing (`harga_jual_promo` exists, just unused)
- Per-item discount (`diskon_item` exists, just always 0)
- DP/Down Payment (`dp` and `sisa` columns exist)
- Stock opname (`stok_opname` table is ready)
- Tax per transaction (`pajak_persen`, `pajak_nominal` on `transaksi_keluar`)
- Store info, bank info, footer text (all on `pengaturan`)
- Barcode scanning (barcode column exists with unique constraint)

### ❌ Schema Changes Still Needed

| Change | SQL Required | Why |
|---|---|---|
| Add `pajak_persen` to `pengaturan` | `ALTER TABLE pengaturan ADD COLUMN pajak_persen NUMERIC DEFAULT 0;` | Store-wide tax configuration |
| Add `jenis_nota` to `pengaturan` | `ALTER TABLE pengaturan ADD COLUMN jenis_nota TEXT DEFAULT 'Invoice';` | Default receipt format |
| Add `metode_cetak` to `pengaturan` | `ALTER TABLE pengaturan ADD COLUMN metode_cetak TEXT DEFAULT 'Preview';` | Print behavior |
| Add `logo_nota` to `pengaturan` | `ALTER TABLE pengaturan ADD COLUMN logo_nota BOOLEAN DEFAULT false;` | Logo toggle |
| Add `hormat_kami_nama` to `pengaturan` | `ALTER TABLE pengaturan ADD COLUMN hormat_kami_nama TEXT;` | Invoice signee |
| Add `nama` to `pengguna` | `ALTER TABLE pengguna ADD COLUMN nama TEXT;` | Display name (app already queries this) |
| Add `UMUM` customer row | `INSERT INTO pelanggan (nama_pelanggan, alamat, no_hp, email, keterangan) VALUES ('UMUM', '-', '-', '-', 'Pelanggan umum default');` | Default anonymous customer |
| Move roles to `app_metadata` | Update `create-auth-users.sql` to use `raw_app_meta_data` | 🔴 Security fix |
