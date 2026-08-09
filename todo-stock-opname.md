# TODO — Peningkatan Modul Stok Opname (Sobatti POS)

**Status**: SELESAI
**Prioritas**: Tinggi
**Dampak**: Alur bisnis stock opname sesuai standar praktik akuntansi & retail

---

## KONTEKS

Modul Stok Opname saat ini hanya memiliki **satu fase** — input fisik langsung mengubah stok + AVCO tanpa review. Tidak ada audit trail (siapa yang input), tidak ada klasifikasi selisih, tidak ada laporan nilai kerugian (Rp), tidak ada mekanisme draft→apply.

Alur bisnis stock taking yang benar (dari literatur: Mekari Jurnal, HashMicro, Timly, Stockount, Fishbowl, Cleverence, NRF):
1. **Persiapan & Cutoff** — snapshot stok sistem (freeze virtual, bukan freeze transaksi)
2. **Penghitungan Fisik** — input hasil hitung lapangan
3. **Review & Investigasi** — cek selisih, klasifikasi penyebab
4. **Terapkan (Posting)** — update stok + AVCO secara atomik, baru setelah review
5. **Laporan & Tindak Lanjut** — nilai selisih Rp, analisis shrinkage

**Keputusan desain:**
- Semua perubahan **additive** (migration/RPC/actions baru)
- RPC lama `process_stock_opname` **tidak dihapus** (dipertahankan sebagai fallback)
- UI lama diganti total menjadi alur sesi (3 langkah)
- **Tidak freeze transaksi** saat opname (snapshot saja — cocok untuk toko yang tetap beroperasi)
- **Tidak cycle count / scanner HP** untuk sekarang (future)

---

## TIER 1 — Alur Bisnis yang Benar

### 1.1 Migration Baru

**File**: `supabase/migrations/20260810_stok_opname_sesi.sql`

#### Tabel Baru: `sesi_stok_opname`

```sql
CREATE TABLE IF NOT EXISTS sesi_stok_opname (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  no_sesi     TEXT UNIQUE NOT NULL,            -- format: OP-YYYYMMDD-NN (otomatis)
  tgl_sesi    DATE NOT NULL,
  status      TEXT NOT NULL DEFAULT 'DRAFT'
              CHECK (status IN ('DRAFT','SELESAI','DIBATALKAN')),
  id_pengguna BIGINT NULL REFERENCES pengguna(id),  -- siapa yang membuat
  total_item      INT DEFAULT 0,
  total_selisih   NUMERIC DEFAULT 0,          -- jumlah selisih (unit)
  total_nilai     NUMERIC DEFAULT 0,          -- total nilai selisih (Rp)
  keterangan  TEXT,
  created_at  TIMESTAMPTZ DEFAULT now(),
  applied_at  TIMESTAMPTZ NULL
);
```

#### Kolom Baru di `stok_opname`

```sql
ALTER TABLE stok_opname ADD COLUMN IF NOT EXISTS id_sesi UUID NULL
  REFERENCES sesi_stok_opname(id) ON DELETE SET NULL;
ALTER TABLE stok_opname ADD COLUMN IF NOT EXISTS id_pengguna BIGINT NULL
  REFERENCES pengguna(id);
ALTER TABLE stok_opname ADD COLUMN IF NOT EXISTS klasifikasi TEXT NULL
  CHECK (klasifikasi IN ('KELEBIHAN','SALAH_CATAT','RUSAK','HILANG','LAINNYA'));
ALTER TABLE stok_opname ADD COLUMN IF NOT EXISTS harga_pokok_snap NUMERIC NULL;
```

**Alasan kolom `harga_pokok_snap`**: Saat input fisik, harga AVCO per item disimpan sebagai snapshot. Ketika sesi di-apply (bisa berjam/jam kemudian), nilai selisih (Rp) tetap akurat karena memakai harga saat penghitungan, bukan harga saat apply.

#### Index

```sql
CREATE INDEX IF NOT EXISTS idx_stok_opname_id_sesi ON stok_opname(id_sesi);
CREATE INDEX IF NOT EXISTS idx_stok_opname_klasifikasi ON stok_opname(klasifikasi);
CREATE INDEX IF NOT EXISTS idx_sesi_stok_opname_status ON sesi_stok_opname(status);
CREATE INDEX IF NOT EXISTS idx_sesi_stok_opname_tgl ON sesi_stok_opname(tgl_sesi);
```

#### RPC Baru

```sql
-- RPC 1: Terapkan sesi stok opname (fase final)
CREATE OR REPLACE FUNCTION process_stok_opname_apply(
  p_id_sesi UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_sesi RECORD;
  v_item RECORD;
  v_selisih NUMERIC;
  v_total_stok_sebelum NUMERIC;
  v_total_stok_sesudah NUMERIC;
  v_new_nilai NUMERIC;
  v_qty_masuk NUMERIC;
  v_qty_keluar NUMERIC;
  v_opname_id BIGINT;
  v_total_item INT := 0;
  v_total_selisih NUMERIC := 0;
  v_total_nilai NUMERIC := 0;
BEGIN
  PERFORM pg_advisory_xact_lock(987654323);

  SELECT * INTO v_sesi FROM sesi_stok_opname WHERE id = p_id_sesi;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Sesi opname tidak ditemukan');
  END IF;

  IF v_sesi.status != 'DRAFT' THEN
    RETURN jsonb_build_object('error', 'Sesi ini sudah diproses atau dibatalkan (status: ' || v_sesi.status || ')');
  END IF;

  FOR v_item IN
    SELECT so.*, p.stok, p.stok_gudang, p.harga_pokok_avco, p.nilai_persediaan
    FROM stok_opname so
    JOIN produk p ON p.id = so.id_produk
    WHERE so.id_sesi = p_id_sesi
    FOR UPDATE OF so, p
  LOOP
    -- Hitung selisih dari SNAPSHOT (bukan stok terkini)
    v_selisih := COALESCE(v_item.stok_fisik, 0) - COALESCE(v_item.stok_sistem, 0);

    v_total_stok_sebelum := COALESCE(v_item.stok, 0) + COALESCE(v_item.stok_gudang, 0);
    v_total_stok_sesudah := COALESCE(v_item.stok_fisik, 0) + COALESCE(v_item.stok_gudang, 0);

    -- Update produk (stok display)
    UPDATE produk
    SET stok = COALESCE(v_item.stok_fisik, 0),
        updated_at = now()
    WHERE id = v_item.id_produk;

    -- Hitung nilai_persediaan baru (dari harga_pokok_snap atau avco saat ini)
    v_new_nilai := v_total_stok_sesudah * COALESCE(v_item.harga_pokok_snap, v_item.harga_pokok_avco, 0);

    UPDATE produk
    SET nilai_persediaan = v_new_nilai
    WHERE id = v_item.id_produk;

    -- Catat riwayat AVCO jika ada selisih
    IF v_selisih != 0 THEN
      IF v_selisih > 0 THEN
        v_qty_masuk := v_selisih;
        v_qty_keluar := NULL;
      ELSE
        v_qty_masuk := NULL;
        v_qty_keluar := ABS(v_selisih);
      END IF;

      INSERT INTO riwayat_avco (
        id_produk, jenis_mutasi, id_referensi,
        qty_masuk, qty_keluar, harga_satuan_transaksi,
        stok_sebelum, avco_sebelum,
        stok_sesudah, avco_sesudah, nilai_persediaan_sesudah
      ) VALUES (
        v_item.id_produk,
        'koreksi',
        v_item.id,
        v_qty_masuk,
        v_qty_keluar,
        COALESCE(v_item.harga_pokok_snap, v_item.harga_pokok_avco, 0),
        v_total_stok_sebelum,
        COALESCE(v_item.harga_pokok_avco, 0),
        v_total_stok_sesudah,
        COALESCE(v_item.harga_pokok_avco, 0),
        v_new_nilai
      );

      -- Update stok_opname dengan id_referensi (riwayat_avco)
      UPDATE stok_opname SET selisih = v_selisih WHERE id = v_item.id;
    END IF;

    v_total_item := v_total_item + 1;
    v_total_selisih := v_total_selisih + v_selisih;
    v_total_nilai := v_total_nilai + (v_selisih * COALESCE(v_item.harga_pokok_snap, v_item.harga_pokok_avco, 0));
  END LOOP;

  -- Update header sesi
  UPDATE sesi_stok_opname
  SET status = 'SELESAI',
      applied_at = now(),
      total_item = v_total_item,
      total_selisih = v_total_selisih,
      total_nilai = v_total_nilai
  WHERE id = p_id_sesi;

  RETURN jsonb_build_object(
    'success', true,
    'total_item', v_total_item,
    'total_selisih', v_total_selisih,
    'total_nilai', v_total_nilai
  );
END;
$$;

-- RPC 2: Batalkan sesi (tidak menyentuh stok)
CREATE OR REPLACE FUNCTION batalkan_sesi_stok_opname(
  p_id_sesi UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_sesi RECORD;
BEGIN
  SELECT * INTO v_sesi FROM sesi_stok_opname WHERE id = p_id_sesi;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Sesi opname tidak ditemukan');
  END IF;

  IF v_sesi.status != 'DRAFT' THEN
    RETURN jsonb_build_object('error', 'Hanya sesi DRAFT yang bisa dibatalkan');
  END IF;

  UPDATE sesi_stok_opname SET status = 'DIBATALKAN' WHERE id = p_id_sesi;
  DELETE FROM stok_opname WHERE id_sesi = p_id_sesi;

  RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION process_stok_opname_apply(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION batalkan_sesi_stok_opname(UUID) TO authenticated;
```

---

### 1.2 Server Actions Baru

**File**: `app/dashboard/inventory/stock-opname/actions.ts` (rewrite total)

#### Fungsi yang Ditambah/Diganti

| Fungsi | Deskripsi |
|--------|-----------|
| `createSesiOpname({tgl_sesi, keterangan})` | Validasi role (ADMIN/OWNER), generate `no_sesi` (format `OP-YYYYMMDD-NN`, urutan per hari via query max + 1), insert sesi `DRAFT`, return `{id, no_sesi}` |
| `saveOpnameDraft({id_sesi, items})` | Validasi role, **server-side**: baca `stok` & `harga_pokok_avco` saat ini dari DB sebagai snapshot, insert `stok_opname` batch (satu transaksi). Setiap baris: `stok_sistem = stok aktual saat ini` (bukan dari client), `harga_pokok_snap = harga_pokok_avco` |
| `refreshSnapshot(id_sesi)` | Update `stok_sistem` semua baris draft dalam sesi ke stok terkini dari DB → `UPDATE stok_opname SET stok_sistem = (SELECT stok FROM produk WHERE id=id_produk) WHERE id_sesi = $1` |
| `applyOpname(p_id_sesi)` | Validasi role (ADMIN/OWNER) → panggil RPC `process_stok_opname_apply` → `logActivity` → revalidate |
| `batalkanOpname(p_id_sesi)` | Validasi role → panggil RPC `batalkan_sesi_stok_opname` → `logActivity` → revalidate |
| `hapusBarisOpname(id)` | Hapus baris draft (hanya jika sesi masih DRAFT) |

#### Fungsi yang DIHAPUS dari UI (RPC lama dipertahankan di DB)

| Fungsi | Status |
|--------|--------|
| `saveBulkStockOpname` | **Dihapus dari file actions** — tidak dipanggil UI baru |
| `saveStockOpname` | **Dihapus dari file actions** — legacy, tidak dipakai |

> RPC `process_stock_opname` tetap ada di database (tidak dihapus) sebagai fallback untuk keperluan manual/SQL Editor.

---

### 1.3 UI Wizard 3 Langkah

**File**: `app/dashboard/inventory/stock-opname/stock-opname-client.tsx` (rewrite total)

#### Langkah 1: Mulai Sesi

```
┌─────────────────────────────────────────────┐
│  Mulai Sesi Stok Opname                     │
│                                             │
│  Tanggal Opname: [________] (default hari)  │
│  Keterangan:     [________________________] │
│  [ Mulai Opname ]                           │
└─────────────────────────────────────────────┘
```

- Tanggal default: hari ini (Asia/Jakarta timezone)
- Tombol "Mulai Opname" → `createSesiOpname()` → redirect ke langkah 2

#### Langkah 2: Input Fisik

```
┌──────────────────────────────────────────────────────────────────────────────────────┐
│  Sesi: OP-20260810-01  │  Status: DRAFT  │  Tgl: 10 Agustus 2026                   │
├──────────────────────────────────────────────────────────────────────────────────────┤
│  #  │  Produk              │  Stok Sistem  │  Stok Fisik  │  Selisih  │  Klasif.   │  Keterangan  │  ❌ │
│  1  │  Semen Gresik 50kg  │  25           │  [__22___]   │  -3       │  [Hilang▾] │  2 zak bocor │  🗑  │
│  2  │  Keramik 40x40      │  120          │  [__118__]   │  -2       │  [Rusak▾]  │              │  🗑  │
│  3  │  Cat Dulux 5L        │  50           │  [__50___]   │  0        │  [-▾]      │              │  🗑  │
├──────────────────────────────────────────────────────────────────────────────────────┤
│  [+ Tambah Baris]   [ Import CSV ]   [ 🔄 Muat Ulang Stok Sistem ]                 │
├──────────────────────────────────────────────────────────────────────────────────────┤
│  Total Item: 3  │  Total Selisih: -5  │  [ Simpan Draft ]                           │
└──────────────────────────────────────────────────────────────────────────────────────┘
```

- **Kolom Klasifikasi** (pilihan):
  - `-` (belum diklasifikasi)
  - `KELEBIHAN` (stok fisik > sistem — surplus)
  - `SALAH CATAT` (kesalahan pencatatan)
  - `RUSAK` (barang rusak/tidak layak jual)
  - `HILANG` (barang tidak ditemukan)
  - `LAINNYA` (alasan lain)
- **Badge per item**:
  - Selisih 0 → abu-abu
  - Selisih negatif (defisit) → merah
  - Selisih positif (surplus) → hijau
- **Tombol "Muat Ulang Stok Sistem"**: panggil `refreshSnapshot(id_sesi)` → update semua `stok_sistem` di baris ke stok terkini dari DB
- **Banner per-item**: jika `stok_sistem` di baris ≠ `stok` terkini dari DB → tampilkan "⚠ Stok berubah sejak input"
- **CSV import**: tetap dipertahankan (polymorph dari modal import yang sudah ada)
- **Simpan Draft**: `saveOpnameDraft()` → insert/update baris ke DB, sesi tetap DRAFT

#### Langkah 3: Review & Terapkan

```
┌──────────────────────────────────────────────────────────────────────────────────────┐
│  Review Sesi: OP-20260810-01                                                          │
├──────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                      │
│  Ringkasan:                                                                          │
│  ┌────────────┬────────────┬────────────┬────────────────┐                          │
│  │ Total Item │ Selisih(Rp)│ Surplus(Rp)│ Defisit (Rp)   │                          │
│  │     3      │  -150,000  │      0     │   -150,000     │                          │
│  └────────────┴────────────┴────────────┴────────────────┘                          │
│                                                                                      │
│  Breakdown per Klasifikasi:                                                          │
│  ┌────────────────────┬────────┬────────────┐                                       │
│  │ Klasifikasi        │ Jumlah │ Nilai (Rp) │                                       │
│  │ HILANG             │   2    │ -100,000   │                                       │
│  │ RUSAK              │   1    │  -50,000   │                                       │
│  └────────────────────┴────────┴────────────┘                                       │
│                                                                                      │
│  Detail per Produk:                                                                  │
│  ┌────┬─────────────────┬────────┬────────┬────────┬─────────┬──────────┐           │
│  │ #  │ Produk          │ Sistem │ Fisik  │Selisih │Klasif.  │Nilai(Rp) │           │
│  │ 1  │ Semen Gresik   │   25   │  22    │  -3    │ HILANG  │ -90,000  │           │
│  │ 2  │ Keramik 40x40  │  120   │ 118    │  -2    │ RUSAK   │ -60,000  │           │
│  │ 3  │ Cat Dulux 5L   │   50   │  50    │   0    │ -       │      0   │           │
│  └────┴─────────────────┴────────┴────────┴────────┴─────────┴──────────┘           │
│                                                                                      │
│  ⚠ 1 item stok berubah sejak input — klik "Muat Ulang" sebelum terapkan             │
│                                                                                      │
│  [ Batalkan Sesi ]                          [ Terapkan Opname ]                     │
└──────────────────────────────────────────────────────────────────────────────────────┘
```

- **Modal konfirmasi** sebelum "Terapkan": "Apakah Anda yakin ingin menerapkan stok opname ini? Stok produk akan diperbarui."
- Setelah terapkan → status sesi = `SELESAI`, `applied_at` terisi
- **Setelah Terapkan**: tombol berubah jadi "Selesai" (tidak bisa diedit lagi)
- **"Batalkan Sesi"**: panggil `batalkanOpname()` → hapus semua baris, status = `DIBATALKAN`

---

### 1.4 Riwayat per Sesi

**File**: `app/dashboard/inventory/stock-opname/history/page.tsx` + `history-client.tsx`

#### Query Update

```typescript
const { data } = await supabase
  .from("sesi_stok_opname")
  .select(`
    id, no_sesi, tgl_sesi, status, keterangan,
    total_item, total_selisih, total_nilai,
    created_at, applied_at,
    pengguna(nama, username),
    stok_opname(
      id, id_produk, stok_sistem, stok_fisik, selisih,
      klasifikasi, harga_pokok_snap, keterangan,
      produk(nama_produk, sku)
    )
  `)
  .order("tgl_sesi", { ascending: false })
  .order("created_at", { ascending: false });
```

#### Tampilan

- **Card per sesi** (accordion):
  - Header: `OP-20260810-01` | `DRAFT` badge amber / `SELESAI` badge emerald / `DIBATALKAN` badge gray | Tgl: 10 Agst 2026 | Operator: Ahmad (kasir)
  - Body: tabel item (produk, sistem, fisik, selisih, klasifikasi, nilai Rp)
  - Footer: Total Item | Total Selisih | Total Nilai (Rp) | Tombol Export CSV/PDF

#### Export

- **Export per sesi**: CSV/PDF daftar item dalam sesi + ringkasan
- **Export per bulan**: gabungan semua sesi dalam bulan → total defisit (Rp), surplus (Rp)

---

## TIER 2 — Laporan & Analisis

### 2.1 Halaman Laporan Stok Opname

**Path baru**: `app/dashboard/laporan/stok-opname/page.tsx`

#### Filter
- Rentang tanggal (default: bulan berjalan)
- Klasifikasi (multi-select: HILANG, RUSAK, SALAH_CATAT, KELEBIHAN, LAINNYA)
- Status sesi (SELESAI saja)

#### Ringkasan
- Total sesi opname
- Total item diperiksa
- Total selisih (unit)
- **Total defisit (Rp)** — barang hilang/rusak
- **Total surplus (Rp)** — barang berlebih
- **Shrinkage rate** = total defisit / total nilai persediaan × 100%

#### Tabel Bulanan
| Bulan | Sesi | Item | Selisih(unit) | Defisit(Rp) | Surplus(Rp) | Shrinkage% |
|-------|------|------|---------------|-------------|-------------|------------|
| Agst 2026 | 1 | 45 | -12 | -450,000 | +50,000 | 0.8% |
| Jul 2026 | 2 | 88 | -5 | -200,000 | 0 | 0.3% |

### 2.2 Export

- CSV/PDF via `exportToCSV` / `exportToPDF` dari `@/lib/export-utils`
- Format laporan: kop Sobatti, filter, tabel, total, tanda tangan

---

## TIER 3 — Future (Opsional, Catatan Saja)

| Fitur | Catatan | Prioritas |
|-------|---------|-----------|
| **Cycle count per zona/kategori** | Filter produk per kategori saat Mulai Sesi; hanya tampilkan produk kategori itu | Rendah — toko kecil cukup full count bulanan |
| **Scanner HP untuk opname** | Reuse SSE relay `/scanner/[sessionId]` — scan barcode, otomatis pindah ke baris input | Rendah |
| **Dua verifikator** | Kolom `id_verifikator` di sesi; sesi baru di-apply jika sudah diverifikasi admin lain | Rendah — cukup role ADMIN/OWNER |
| **Notif selisih besar** | Jika selisih > X% atau > Rp threshold → notifikasi ke owner via WhatsApp/email | Rendah |

---

## VERIFIKASI & TEST

### Test Checklist (manual)

| # | Test | Expected |
|---|------|----------|
| 1 | Buka `/stock-opname`, klik "Mulai Opname" | Form tampil, tanggal default hari ini |
| 2 | Isi keterangan, klik "Mulai Opname" | Redirect ke langkah 2, sesi DRAFT dibuat |
| 3 | Tambah 2 item, isi stok fisik, simpan draft | Baris tersimpan, **stok produk BELUM BERUBAH** |
| 4 | Buka tab lain, ubah stok produk | Kembali ke tab opname → "⚠ Stok berubah sejak input" |
| 5 | Klik "Muat Ulang Stok Sistem" | `stok_sistem` di baris terupdate ke nilai baru |
| 6 | Klik "Terapkan Opname" → konfirmasi | Stok produk berubah, `riwayat_avco` tercatat (jenis `koreksi`), sesi = SELESAI |
| 7 | Buka riwayat → cari sesi | Sesi muncul dengan status SELESAI, operator, nilai Rp |
| 8 | Export CSV dari riwayat | File terunduh dengan data lengkap |
| 9 | Buka `/laporan/stok-opname` | Laporan tampil dengan filter & total defisit (Rp) |
| 10 | Buat sesi baru → klik "Batalkan" | Sesi = DIBATALKAN, stok produk **TIDAK BERUBAH** |
| 11 | Login sebagai KASIR → coba akses `/stock-opname` | Akses ditolak (hanya ADMIN/OWNER) |
| 12 | Build & lint | Bersih (error baru = 0) |

### Regression

| # | Test | Expected |
|---|------|----------|
| 1 | Checkout belanja kasir → stok berkurang | Tetap berfungsi normal |
| 2 | Barang masuk → stok gudang bertambah | Tetap berfungsi normal |
| 3 | Restock display (gudang→display) | Tetap berfungsi normal |
| 4 | Pindah ke gudang (display→gudang) | Tetap berfungsi normal |
| 5 | Isi stok paket | Tetap berfungsi normal |
| 6 | Laporan laba rugi & neraca | Nilai persediaan akurat |
| 7 | Detail produk → riwayat AVCO | Mutasi koreksi stok opname muncul |

---

## URUTAN EKSEKUSI

| # | Task | File | Tipe |
|---|------|------|------|
| 1 | Migration baru (tabel sesi + kolom + index + RPC) | `supabase/migrations/20260810_stok_opname_sesi.sql` | Migration |
| 2 | Rewrite actions (createSesi, saveDraft, refresh, apply, batalkan, hapus) | `app/dashboard/inventory/stock-opname/actions.ts` | Server Actions |
| 3 | Rewrite UI wizard 3 langkah | `app/dashboard/inventory/stock-opname/stock-opname-client.tsx` | Client Component |
| 4 | Update query history (per sesi + operator + klasifikasi + nilai) | `app/dashboard/inventory/stock-opname/history/page.tsx` | Server Component |
| 5 | Rewrite history client (accordion per sesi + export) | `app/dashboard/inventory/stock-opname/history/history-client.tsx` | Client Component |
| 6 | Halaman laporan stok opname baru | `app/dashboard/laporan/stok-opname/page.tsx` + `page-client.tsx` | Halaman Baru |
| 7 | Server action laporan (query aggregate) | `app/dashboard/laporan/stok-opname/actions.ts` | Server Actions |
| 8 | tsc + lint + build verifikasi | — | Verifikasi |
| 9 | Test checklist manual (12 item) | — | Testing |
| 10 | Regression test (7 item) | — | Testing |

---

## OUT OF SCOPE (Tidak Dilakukan)

| Item | Alasan |
|------|--------|
| Freeze transaksi global | Toko harus tetap beroperasi — snapshot & revalidasi lebih praktis |
| Hapus RPC `process_stock_opname` lama | Prinsip additive; RPC lama tetap ada di DB sebagai fallback |
| Cycle count per zona | Toko kecil cukup full count bulanan |
| Scanner HP untuk opname | Butuh implementasi SSE relay tambahan — future |
| Dua verifikator | Proses bisnis, bukan sistem — catatan opsional |
| Kolom `stok_fisik_gudang` | Gudang tidak dihitung terpisah saat ini — future jika diperlukan |

---

## REFERENSI

- [Mekari Jurnal — Cara Stock Opname yang Benar](https://www.jurnal.id/id/blog/2018-pengertian-tujuan-manfaat-stock-opname-beserta-contohnya)
- [HashMicro — Laporan Stock Opname](https://www.hashmicro.com/id/blog/pentingnya-laporan-stock-opname-beserta-cara-menyusunnya)
- [Timly — Stocktaking Procedure Deep Dive](https://timly.com/en/stocktaking/stocktaking-procedure-deep-dive/)
- [Stockount — Inventory Audit Process](https://www.stockount.com/articles/inventory-audit-process-step-by-step)
- [Fishbowl — How to Perform a Stocktake](https://www.fishbowlinventory.com/blog/stocktake)
- [Cleverence — Cycle Count Inventory Procedures](https://www.cleverence.com/articles/for-business/cycle-count-inventory-procedures-9274/)
- [KasirPintar — Panduan Lengkap Stock Opname](https://kasirpintar.co.id/solusi/detail/panduan-lengkap-stock-opname-cara-hitung-stok-barang-dan-hindari-selisih-inventori)
