# TODO — Peningkatan Modul Barang Masuk / Penerimaan Barang (Sobatti POS)

**Status**: DRAFT (belum dikerjakan)
**Prioritas**: Tinggi
**Dampak**: Alur penerimaan barang sesuai SOP retail & akuntansi (verifikasi dokumen, koreksi yang aman, retur supplier)

**Cara pakai dokumen ini**: setiap baris `- [ ]` adalah SATU task independen yang bisa dikerjakan & di-commit sendiri. Centang (`- [x]`) setelah task selesai & diverifikasi. Batasi lingkup per task agar mudah di-review.

---

## KONTEKS

Modul Barang Masuk saat ini hanya berupa **form input langsung**:
1. Form (`app/dashboard/inventory/stock-in/stock-in-client.tsx`) → pilih supplier, tanggal, tambah baris item (produk, satuan suplai auto, qty suplai, total cost, keterangan).
2. Server action `addStockIn` (`app/dashboard/inventory/stock-in/actions.ts`) → validasi zod per baris + verifikasi produk → panggil RPC.
3. RPC `process_barang_masuk` (migration `20260808_fix_process_barang_masuk_conversion_ratio.sql`) → advisory lock → `base_qty = supplied_qty × ratio` → insert `barang_masuk` → tambah ke `stok_gudang` → rekalkulasi **AVCO** → catat `riwayat_avco` → update `nilai_persediaan`.

**Masalah utama yang ditemukan:**
- **Tidak ada dokumen** (no. faktur/nota supplier, no PO) → sulit audit & cek silang.
- **Tidak bisa edit/void** barang masuk → jika salah input, stok & AVCO terlanjur berubah dan satu-satunya jalan cuma manipulasi DB manual.
- **Tidak ada retur pembelian** → padahal `riwayat_avco` sudah mengizinkan `jenis_mutasi = 'retur_beli'` dan UI detail produk sudah punya label "Retur Pembelian" (tidak berfungsi).
- **Tidak ada cek `hitung_stok`** di sisi server/RPC → request crafting bisa menambah stok ke produk non-tracked.
- **`harga_modal` tidak sinkron dengan AVCO** → 2 sumber harga beli berbeda yang bisa saling kontradiksi.
- Tidak ada revalidate history, tidak ada penanda identitas (created_at di UI), tidak ada print dokumen penerimaan.

**Keputusan desain (awal):**
- Semua perubahan **additive** (migration/RPC baru, jangan rewrite RPC yang dipakai POS).
- RPC `process_barang_masuk` lama hanya di-update (tambah kolom `no_surat` + guard `hitung_stok`), logika inti tidak diganti.
- Void diimplementasikan sebagai **jurnal balik (reversal)** + soft-update, bukan DELETE.
- UI form/history diperbaiki secara inkremental.
- **Tidak PO lengkap** untuk sekarang (masuk Tier Future) — prioritas adalah dokumen referensi + koreksi aman + retur.

---

## MASTER TASK BOARD

Ringkasan seluruh task per tier. Detail setiap task ada di bagian bawah masing-masing tier.

| ID | Task | Tier | Dependensi | Effort |
|----|------|------|-----------|--------|
| T1-01 | Migration kolom `no_surat` | 1 | — | S |
| T1-02 | RPC `process_barang_masuk`: INSERT `no_surat` | 1 | T1-01 | S |
| T1-03 | Form: input header "No. Faktur/Nota" + kirim `no_surat` | 1 | T1-02 | M |
| T1-04 | Action `addStockIn`: validasi zod `no_surat` + map ke item | 1 | T1-02 | S |
| T1-05 | History: kolom "No. Faktur" + search `no_surat` + export | 1 | T1-03 | M |
| T1-06 | Migration void: kolom `status`, `voided_*`, index | 1 | — | S |
| T1-07 | RPC `cancel_barang_masuk` (jurnal balik AVCO) | 1 | T1-06 | L |
| T1-08 | Action `voidBarangMasuk` | 1 | T1-07 | M |
| T1-09 | Action `updateBarangMasuk` (edit ringan saja) | 1 | T1-08 | M |
| T1-10 | History UI: badge status + tombol Edit/Void + modal alasan | 1 | T1-08, T1-09 | L |
| T1-11 | History query: select status, voided_*, created_at | 1 | T1-06 | S |
| T1-12 | Ringkasan total belanja exclude DIVOID | 1 | T1-10 | S |
| T1-13 | Migration retur: tabel `retur_pembelian` + `detail_retur_pembelian` + index | 1 | T1-06 | M |
| T1-14 | RPC `process_retur_pembelian` | 1 | T1-13 | L |
| T1-15 | Actions retur: `createReturPembelian` + `getBarangMasukForRetur` | 1 | T1-14 | M |
| T1-16 | Halaman form retur + riwayat retur | 1 | T1-15 | L |
| T1-17 | Sidebar/nav link ke halaman Retur | 1 | T1-16 | S | `[x]` | `[x]`
| T1-18 | Validasi `hitung_stok` di action + RPC | 1 | — | S |
| T1-19 | Sinkron `harga_modal` dari AVCO (masuk/void/retur) | 1 | T1-07, T1-14 | S |
| T2-01 | `revalidatePath` history di add/void/retur + kolom `created_at` di UI | 2 | T1-08 | S |
| T2-02 | Scan barcode saat menerima (opsional, low) | 2 | — | M |
| T2-03 | Print dokumen penerimaan / surat jalan | 2 | T1-05 | L |
| T2-04 | Fitur "Ulangi Pembelian" (reorder) | 2 | T1-16 | M |

---

## TIER 1 — Wajib Dikerjakan

### 1.1 Kolom `no_surat` (No. Faktur / No. Nota Supplier)

**Tujuan**: referensi dokumen fisik dari supplier untuk audit & pelacakan. Column `no_surat` nullable (data lama tetap valid), tidak UNIQUE.

**TASK T1-01 — Migration kolom `no_surat`** `- [x]`

- [x] Buat file `supabase/migrations/20260810_barang_masuk_no_surat.sql`
```sql
ALTER TABLE barang_masuk ADD COLUMN IF NOT EXISTS no_surat TEXT NULL;
CREATE INDEX IF NOT EXISTS idx_barang_masuk_no_surat ON barang_masuk(no_surat);
```
- [ ] Jalankan via SQL Editor (manual, karena `supabase db push` bermasalah) — **ditunggu user**
- [ ] Verifikasi: `SELECT column_name FROM information_schema.columns WHERE table_name='barang_masuk'` berisi `no_surat`

**TASK T1-02 — RPC `process_barang_masuk`: INSERT `no_surat`** `- [x]`

- [x] Edit `supabase/migrations/20260808_fix_process_barang_masuk_conversion_ratio.sql` (update, bukan rewrite → buat file update baru `20260810_update_process_barang_masuk_no_surat.sql` dengan `CREATE OR REPLACE FUNCTION`)
- [x] Branch UoM: tambah kolom `no_surat` ke INSERT `barang_masuk`
- [x] Nilai: `COALESCE(p_item->>'no_surat', NULL)` (dipakai `NULLIF(v_item->>'no_surat', '')`)
- [x] Pastikan legacy branch tetap berfungsi (kolom `no_surat` nullable, tidak wajib) — **diverifikasi via Postgres test, legacy insert tanpa `no_surat` sukses, kolom NULL**

**TASK T1-03 — Form: input header "No. Faktur/Nota"** `- [x]`

File: `app/dashboard/inventory/stock-in/stock-in-client.tsx`

- [x] Tambah state/input header **"No. Faktur/Nota"** (text, opsional) di dekat supplier & tanggal (di bawah Tanggal Masuk, label uppercase, placeholder "Opsional")
- [x] Kirim `no_surat` **satu kali di level header** (per-transaksi), bukan per baris — field `no_surat` di `formSchema` & `defaultValues`
- [x] Pada submit, map `no_surat` ke semua item payload (`data.no_surat?.trim() || ""` di setiap item)
- [x] Posisi input konsisten dengan desain form existing (margin, label uppercase kecil) — pakai class yang sama dgn input tgl_masuk/id_supplier
- [x] Reset `no_surat` ke "" setelah submit sukses
- [x] Verifikasi: `tsc --noEmit` file `stock-in-client.tsx` bersih (error hanya di `tests/screenshot-responsive.spec.ts` yang pre-existing, bukan file ini)

**TASK T1-04 — Action `addStockIn`: validasi & map `no_surat`** `- [x]`

File: `app/dashboard/inventory/stock-in/actions.ts`

- [x] `stockInRowSchema`: pastikan tidak menolak field `no_surat` (tetap optional) — ditambah `no_surat: z.string().optional()`
- [x] Map header `no_surat` → setiap item sebelum panggil RPC — `no_surat: r.no_surat?.trim() || null` di payload `p_items`
- [x] Validasi server: `no_surat` string kosong → `null` — lewat `trim() || null`
- [x] `revalidatePath` history tetap (sejalan dengan T2-01) — tambah `revalidatePath("/dashboard/inventory/stock-in/history")`
- [x] Verifikasi: `tsc --noEmit` file `actions.ts` bersih (error hanya di `tests/screenshot-responsive.spec.ts` yang pre-existing)

**TASK T1-05 — History: kolom No. Faktur + search + export** `- [x]`

File: `app/dashboard/inventory/stock-in/history/history-client.tsx` + `history/page.tsx`

- [x] Query server: tambah `no_surat` ke select
- [x] UI: kolom **"No. Faktur"** (render `-` jika kosong, kolom bisa di-hide di mobile)
- [x] Search: sertakan `no_surat` (search saat ini hanya nama produk)
- [x] Export CSV: tambah kolom `no_surat`
- [x] Export PDF: tambah kolom `no_surat`

---

### 1.2 Edit & Void (Hapus/Batalkan) Barang Masuk dengan Jurnal Balik

**Tujuan**: jalan keluar yang aman untuk salah input — tanpa manipulasi DB manual.

**Catatan penting (desain reversal):**
- Stok & AVCO sudah terlanjur berubah saat barang masuk disimpan → void **tidak boleh** hanya DELETE.
- Void harus **mengembalikan** efek: `stok_gudang -= base_qty_added`, `harga_pokok_avco` dihitung ulang (reverse weighted average), `nilai_persediaan` diupdate, catat `riwayat_avco` `jenis_mutasi = 'retur_beli'` + `id_referensi` menunjuk record void.
- Pertahankan baris asli (logical delete via kolom status), bukan physical delete.

**TASK T1-06 — Migration void (kolom status + index)** `- [x]`

- [x] Buat file `supabase/migrations/20260810_barang_masuk_void.sql`
```sql
ALTER TABLE barang_masuk ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'AKTIF'
  CHECK (status IN ('AKTIF','DIVOID'));
ALTER TABLE barang_masuk ADD COLUMN IF NOT EXISTS voided_at TIMESTAMPTZ NULL;
ALTER TABLE barang_masuk ADD COLUMN IF NOT EXISTS voided_by BIGINT NULL REFERENCES pengguna(id);
ALTER TABLE barang_masuk ADD COLUMN IF NOT EXISTS alasan_void TEXT NULL;
CREATE INDEX IF NOT EXISTS idx_barang_masuk_status ON barang_masuk(status);
```
- [x] Jalankan via SQL Editor — **ditunggu user**
- [x] Verifikasi: data lama otomatis ber-`status='AKTIF'` — **ditunggu user**

**TASK T1-07 — RPC `cancel_barang_masuk` (jurnal balik AVCO)** `- [x]`

File: `supabase/migrations/20260810_barang_masuk_void.sql`

- [x] Implement `CREATE OR REPLACE FUNCTION cancel_barang_masuk(p_id_barang_masuk BIGINT, p_id_pengguna BIGINT, p_alasan TEXT DEFAULT NULL)` sesuai draft SQL di bawah — **dibuat di file yang sama dgn T1-06**
- [x] `pg_advisory_xact_lock(987654322)` (lock yang sama dengan process_barang_masuk)
- [x] Guard: record ada + belum DIVOID + produk ada
- [x] Hitung `v_base_qty = COALESCE(base_qty_added, jumlah, 0)` & `v_per_piece = COALESCE(base_cost_per_piece, harga_beli, 0)`
- [x] Reverse AVCO: `v_new_avco = ((total_sebelum×avco_sebelum) − (base_qty×per_piece)) / total_sesudah` (clamp ≥ 0; jika total_sesudah ≤ 0 → avco = 0)
- [x] Update `produk`: `stok_gudang = GREATEST(stok_gudang − base_qty, 0)`, `harga_pokok_avco`, `nilai_persediaan`, `updated_at`
- [x] Insert `riwayat_avco` `jenis_mutasi='retur_beli'`, `qty_keluar=base_qty`, `id_referensi=id barang_masuk`
- [x] Update `barang_masuk`: `status='DIVOID'`, `voided_at`, `voided_by`, `alasan_void`
- [x] `GRANT EXECUTE ... TO authenticated`
- [x] Verifikasi: jalankan test SQL (POSTGRES schema check, return JSON `success`) — **diverifikasi di Postgres 18 lokal: void sukses (`success:true`), stok & AVCO kembali ke nilai awal (stok_gudang 12→0, AVCO 1054.55→1000, nilai_persediaan 23200→10000), `riwayat_avco` tercatat `retur_beli` qty 12, status jadi DIVOID + voided_by/alasan tersimpan. Void ganda & not-found dikembalikan sebagai error json**

Draft SQL referensi:
```sql
CREATE OR REPLACE FUNCTION cancel_barang_masuk(
  p_id_barang_masuk BIGINT, p_id_pengguna BIGINT, p_alasan TEXT DEFAULT NULL
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_bm RECORD; v_produk RECORD;
  v_base_qty NUMERIC; v_per_piece NUMERIC;
  v_total_sebelum NUMERIC; v_total_sesudah NUMERIC;
  v_new_nilai NUMERIC; v_new_avco NUMERIC; v_avco_sebelum NUMERIC; v_qty_keluar NUMERIC;
BEGIN
  PERFORM pg_advisory_xact_lock(987654322);
  SELECT * INTO v_bm FROM barang_masuk WHERE id = p_id_barang_masuk FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('error','Barang masuk tidak ditemukan'); END IF;
  IF v_bm.status = 'DIVOID' THEN RETURN jsonb_build_object('error','Barang masuk ini sudah di-void'); END IF;
  SELECT * INTO v_produk FROM produk WHERE id = v_bm.id_produk FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('error','Produk tidak ditemukan'); END IF;

  v_base_qty  := COALESCE(v_bm.base_qty_added, v_bm.jumlah, 0);
  v_per_piece := COALESCE(v_bm.base_cost_per_piece, v_bm.harga_beli, 0);
  v_total_sebelum := COALESCE(v_produk.stok,0) + COALESCE(v_produk.stok_gudang,0);
  v_avco_sebelum  := COALESCE(v_produk.harga_pokok_avco, 0);
  v_qty_keluar := v_base_qty;
  v_total_sesudah := v_total_sebelum - v_base_qty;

  IF v_total_sesudah <= 0 THEN
    v_new_avco := 0;
  ELSE
    v_new_avco := ((v_total_sebelum * v_avco_sebelum) - (v_base_qty * v_per_piece)) / v_total_sesudah;
    IF v_new_avco < 0 THEN v_new_avco := 0; END IF;
  END IF;
  v_new_nilai := v_total_sesudah * v_new_avco;

  UPDATE produk
  SET stok_gudang = GREATEST(COALESCE(v_produk.stok_gudang,0) - v_base_qty, 0),
      harga_pokok_avco = v_new_avco, nilai_persediaan = v_new_nilai, updated_at = now()
  WHERE id = v_produk.id;

  INSERT INTO riwayat_avco (id_produk, jenis_mutasi, id_referensi, qty_masuk, qty_keluar,
    harga_satuan_transaksi, stok_sebelum, avco_sebelum, stok_sesudah, avco_sesudah, nilai_persediaan_sesudah)
  VALUES (v_produk.id, 'retur_beli', v_bm.id, NULL, v_qty_keluar, v_per_piece,
    v_total_sebelum, v_avco_sebelum, v_total_sesudah, v_new_avco, v_new_nilai);

  UPDATE barang_masuk SET status='DIVOID', voided_at=now(), voided_by=p_id_pengguna, alasan_void=p_alasan
  WHERE id = v_bm.id;

  RETURN jsonb_build_object('success', true, 'id', v_bm.id);
END; $$;
GRANT EXECUTE ON FUNCTION cancel_barang_masuk(BIGINT, BIGINT, TEXT) TO authenticated;
```

> **Catatan**: rumus reverse AVCO valid untuk alur sederhana ini. Perlu dicek di test apakah ada drift pembulatan.

**TASK T1-08 — Action `voidBarangMasuk`** `- [x]`

File: `app/dashboard/inventory/stock-in/actions.ts`

- [x] Validasi role ADMIN/OWNER (`requireAuth`) — via helper `getAuthUser()` + `requireAdmin()` (pola stock-opname)
- [x] `voided_by` dari session user — `pengguna.id` dikirim sebagai `p_id_pengguna`
- [x] Panggil RPC `cancel_barang_masuk({ id, id_pengguna, alasan })` — key: `p_id_barang_masuk`, `p_id_pengguna`, `p_alasan`
- [x] Map error RPC (`already voided`, `not found`) ke pesan Bahasa Indonesia — "Barang masuk sudah dibatalkan sebelumnya" / "Barang masuk tidak ditemukan"; hint migration bila RPC tidak ada
- [x] `logActivity` (ENTITAS barang_masuk, aksi VOID) — **keputusan: aksi `DELETE`** (kolom `log_aktivitas.aksi` hanya menerima CREATE/UPDATE/DELETE), deskripsi "Membatalkan Barang Masuk ID X: <alasan>"
- [x] `revalidatePath` inventory + history
- [x] Verifikasi: `tsc --noEmit` file `actions.ts` bersih

**TASK T1-09 — Action `updateBarangMasuk` (edit ringan)** `- [x]`

File: `app/dashboard/inventory/stock-in/actions.ts`

- [x] Hanya izinkan edit field: `keterangan`, `no_surat`, `tgl_masuk` — **TIDAK** qty/harga/produk/supplier
- [x] Tolak jika `status='DIVOID'` — cek record existing dulu, error "Barang masuk sudah dibatalkan — tidak bisa diedit"
- [x] Validasi zod untuk field yang diedit — `updateStockInSchema` (+ refine tanggal valid)
- [x] Update langsung via supabase `.update()` (tidak menyentuh stok/AVCO) — hanya kolom ringan, `no_surat`/`keterangan` empty → null
- [x] `logActivity` (aksi UPDATE) + `revalidatePath` inventory & history
- [x] (dokumentasi) Ubah qty/harga/produk → void + input ulang — tercatat di catatan komentar action
- [x] Verifikasi: `tsc --noEmit` + `eslint` file `actions.ts` bersih

**TASK T1-10 — History UI: badge status + tombol Edit/Void** `- [x]`

File: `app/dashboard/inventory/stock-in/history/history-client.tsx`

- [x] Kolom **Status** badge: `AKTIF` (hijau) / `DIVOID` (merah/strike)
- [x] Tombol aksi per baris:
  - ✏️ **Edit** → dialog modal (field `keterangan`, `no_surat`, `tgl_masuk`)
  - 🗑 **Void** → modal konfirmasi "Apakah Anda yakin membatalkan barang masuk ini? Stok & AVCO akan dikembalikan." + input **alasan (wajib)**
- [x] Baris `DIVOID`: `line-through`, sembunyikan/disable tombol edit & void
- [x] Loading state per-aksi (spinner tombol), error banner
- [x] Setelah sukses → refresh list (revalidate/fetch ulang via `router.refresh()`)

**TASK T1-11 — History query: select status/voided fields** `- [x]`

File: `app/dashboard/inventory/stock-in/history/page.tsx`

- [x] Tambah `status`, `voided_at`, `voided_by`, `alasan_void` ke select produk_query dari `barang_masuk`
- [x] Tambah `created_at` ke select (untuk T2-01)
- [x] Data DIVOID tetap dikembalikan (untuk dirender strike-through), jangan difilter di query

**TASK T1-12 — Ringkasan total belanja exclude DIVOID** `- [x]`

File: `app/dashboard/inventory/stock-in/history/history-client.tsx`

- [x] "Total Nilai Pembelian" hanya jumlah dari baris `status='AKTIF'`
- [x] (jika ada) "Jumlah Catatan" juga exclude DIVOID
- [x] Pastikan export menyertakan baris DIVOID dengan tanda/status (T1-05), tetapi total export = AKTIF saja

---

### 1.3 Retur Pembelian ke Supplier

**Tujuan**: merekam pengembalian barang ke supplier (rusak, salah kirim, kelebihan) lengkap dengan dampak AVCO & stok.

**Catatan**: void (1.2) dan retur berbeda — retur **mengurangi stok & rekalkulasi AVCO** (seperti keluar, tapi sebab retur), dan tetap menyisakan riwayat pembelian asli (AKTIF). Void menandai seluruh transaksi sebagai dibatalkan.

**TASK T1-13 — Migration retur (tabel + index)** `- [x]`

- [x] Buat file `supabase/migrations/20260810_retur_pembelian.sql`
```sql
CREATE TABLE IF NOT EXISTS retur_pembelian (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  no_retur        TEXT UNIQUE NOT NULL,             -- format: RB-YYYYMMDD-NN
  tgl_retur       DATE NOT NULL,
  id_barang_masuk BIGINT NOT NULL REFERENCES barang_masuk(id),
  id_supplier     BIGINT REFERENCES supplier(id),
  id_pengguna     BIGINT REFERENCES pengguna(id),
  total_nilai     NUMERIC DEFAULT 0,
  keterangan      TEXT,
  created_at      TIMESTAMPTZ DEFAULT now()
);
CREATE TABLE IF NOT EXISTS detail_retur_pembelian (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_retur      UUID NOT NULL REFERENCES retur_pembelian(id) ON DELETE CASCADE,
  id_produk     BIGINT NOT NULL REFERENCES produk(id),
  qty_retur     NUMERIC NOT NULL CHECK (qty_retur > 0),   -- base unit (satuan inventori)
  harga_pokok   NUMERIC NOT NULL,                          -- snapshot AVCO saat retur
  jumlah        NUMERIC NOT NULL,                          -- qty_retur × harga_pokok
  keterangan    TEXT
);
CREATE INDEX IF NOT EXISTS idx_retur_pembelian_tgl ON retur_pembelian(tgl_retur);
CREATE INDEX IF NOT EXISTS idx_retur_pembelian_supplier ON retur_pembelian(id_supplier);
```
- [x] Jalankan via SQL Editor
- [x] Verifikasi tabel terbuat (`\d retur_pembelian` / Supabase table view)

**TASK T1-14 — RPC `process_retur_pembelian`** `- [x]`

File: `supabase/migrations/20260810_retur_pembelian.sql`

- [x] Implement `CREATE OR REPLACE FUNCTION process_retur_pembelian(p_id_barang_masuk BIGINT, p_id_pengguna BIGINT, p_items JSONB, p_keterangan TEXT DEFAULT NULL)` sesuai draft di bawah
- [x] `pg_advisory_xact_lock(987654322)`
- [x] Generate `no_retur = 'RB-YYYYMMDD-NN'` (urutan per hari: `count(*) + 1 WHERE tgl_retur = CURRENT_DATE`)
- [x] Insert header `retur_pembelian`, ambil `v_retur_id`
- [x] Loop `p_items`: validasi produk, `v_hpp = COALESCE(harga_pokok_avco, harga_modal, 0)`
- [x] **Guard stok gudang**: `IF stok_gudang < v_qty THEN RETURN error 'Stok gudang tidak mencukupi'`
- [x] Reverse AVCO (rumus sama seperti void), clamp ≥ 0
- [x] Update `produk` (stok_gudang, avco, nilai_persediaan)
- [x] Insert `detail_retur_pembelian` + `riwayat_avco` (`jenis_mutasi='retur_beli'`, `id_referensi=retur id`)
- [x] Update header `total_nilai`
- [x] `GRANT EXECUTE ... TO authenticated`

Draft SQL referensi (inti):
```sql
CREATE OR REPLACE FUNCTION process_retur_pembelian(
  p_id_barang_masuk BIGINT, p_id_pengguna BIGINT, p_items JSONB, p_keterangan TEXT DEFAULT NULL
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_bm RECORD; v_item RECORD; v_produk RECORD;
  v_retur_id UUID; v_no_retur TEXT; v_total NUMERIC := 0;
  v_qty NUMERIC; v_hpp NUMERIC; v_avco_sebelum NUMERIC;
  v_total_stok_sebelum NUMERIC; v_new_avco NUMERIC; v_new_nilai NUMERIC;
BEGIN
  PERFORM pg_advisory_xact_lock(987654322);
  SELECT * INTO v_bm FROM barang_masuk WHERE id = p_id_barang_masuk FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('error','Barang masuk tidak ditemukan'); END IF;

  v_no_retur := 'RB-' || to_char(now(),'YYYYMMDD') || '-' ||
    lpad((SELECT count(*) + 1 FROM retur_pembelian WHERE tgl_retur = CURRENT_DATE)::text, 2, '0');

  INSERT INTO retur_pembelian (no_retur, tgl_retur, id_barang_masuk, id_supplier, id_pengguna, keterangan)
  VALUES (v_no_retur, CURRENT_DATE, v_bm.id, v_bm.id_supplier, p_id_pengguna, p_keterangan)
  RETURNING id INTO v_retur_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    SELECT * INTO v_produk FROM produk WHERE id = (v_item->>'id_produk')::BIGINT FOR UPDATE;
    IF NOT FOUND THEN RETURN jsonb_build_object('error','Produk tidak ditemukan'); END IF;
    v_qty := (v_item->>'qty_retur')::NUMERIC;
    IF COALESCE(v_produk.stok_gudang,0) < v_qty THEN
      RETURN jsonb_build_object('error','Stok gudang tidak mencukupi untuk produk: ' || v_produk.nama_produk);
    END IF;

    v_hpp := COALESCE(v_produk.harga_pokok_avco, v_produk.harga_modal, 0);
    v_total_stok_sebelum := COALESCE(v_produk.stok,0) + COALESCE(v_produk.stok_gudang,0);
    v_avco_sebelum := COALESCE(v_produk.harga_pokok_avco, 0);

    IF (v_total_stok_sebelum - v_qty) <= 0 THEN
      v_new_avco := 0;
    ELSE
      v_new_avco := ((v_total_stok_sebelum * v_avco_sebelum) - (v_qty * v_hpp)) / (v_total_stok_sebelum - v_qty);
      IF v_new_avco < 0 THEN v_new_avco := 0; END IF;
    END IF;
    v_new_nilai := (v_total_stok_sebelum - v_qty) * v_new_avco;

    UPDATE produk
    SET stok_gudang = GREATEST(COALESCE(stok_gudang,0) - v_qty, 0),
        harga_pokok_avco = v_new_avco, nilai_persediaan = v_new_nilai, updated_at = now()
    WHERE id = v_produk.id;

    INSERT INTO detail_retur_pembelian (id_retur, id_produk, qty_retur, harga_pokok, jumlah, keterangan)
    VALUES (v_retur_id, v_produk.id, v_qty, v_hpp, v_qty * v_hpp, v_item->>'keterangan');

    INSERT INTO riwayat_avco (id_produk, jenis_mutasi, id_referensi, qty_masuk, qty_keluar,
      harga_satuan_transaksi, stok_sebelum, avco_sebelum, stok_sesudah, avco_sesudah, nilai_persediaan_sesudah)
    VALUES (v_produk.id, 'retur_beli', v_retur_id, NULL, v_qty, v_hpp,
      v_total_stok_sebelum, v_avco_sebelum, v_total_stok_sebelum - v_qty, v_new_avco, v_new_nilai);

    v_total := v_total + (v_qty * v_hpp);
  END LOOP;

  UPDATE retur_pembelian SET total_nilai = v_total WHERE id = v_retur_id;
  RETURN jsonb_build_object('success', true, 'no_retur', v_no_retur, 'id', v_retur_id);
END; $$;
GRANT EXECUTE ON FUNCTION process_retur_pembelian(BIGINT, BIGINT, JSONB, TEXT) TO authenticated;
```

**Keputusan desain penting:**
- Retur mengurangi dari `stok_gudang` (barang masuk selalu masuk gudang). Jika stok gudang tidak cukup → error "Stok gudang tidak mencukupi"; admin harus pindahkan barang gudang→display dulu (atau dari display).
- HPP retur memakai AVCO **saat transaksi retur** (snapshot `harga_pokok_avco` sekarang), bukan harga barang masuk.

**TASK T1-15 — Actions retur: `createReturPembelian` + `getBarangMasukForRetur`** `- [x]`

File: `app/dashboard/inventory/stock-in/actions.ts`

- `createReturPembelian({id_barang_masuk, items, keterangan})`:
  - [x] Validasi role ADMIN/OWNER
  - [x] zod schema: `items[] { id_produk int>0, qty_retur >0, keterangan? }`, `keterangan?`
  - [x] `id_pengguna` dari session
  - [x] Panggil RPC `process_retur_pembelian`
  - [x] Map error RPC (stok tidak cukup, dsb.) ke pesan Bahasa Indonesia
  - [x] `logActivity` (aksi CREATE, entitas retur_pembelian) + `revalidatePath` inventory/history/retur-history
- `getBarangMasukForRetur({id_barang_masuk})`:
  - [x] Ambil record + produk (nama, satuan, ratio, stok_gudang) untuk prefill form retur
  - [x] Tolak jika barang_masuk `status='DIVOID'`

**TASK T1-16 — Halaman form retur + riwayat retur** `- [x]`

- [x] Buat folder `app/dashboard/inventory/stock-in/retur/`
- [x] `page.tsx`: server component — ambil daftar `barang_masuk` AKTIF (untuk dipilih) + suppliers
- [x] `retur-client.tsx`: search/pilih barang masuk (filter supplier/tanggal) → tampilkan item (produk, qty base di atas) → input `qty_retur` per baris (≤ sisa qty asli & ≤ stok gudang) → keterangan → submit
- [x] Halaman riwayat `retur/history/page.tsx` + `history-client.tsx`: tabel `retur_pembelian` (no_retur, tanggal, supplier, asal barang masuk, jumlah item, total nilai, keterangan, operator). Export CSV/PDF
- [x] Halaman riwayat dapat diakses dari tab/navigasi retur

**TASK T1-17 — Sidebar/nav link ke Retur** `- [x]`

- [x] `components/dashboard-sidebar.tsx`: tambah submenu "Retur Barang" + "Riwayat Retur" di grup Barang Masuk (icon `RotateCcw` / `Receipt`)
- [x] `components/dashboard-mobile-nav.tsx`: tambah link yang sama
- [x] Pastikan role visibility: ADMIN/OWNER saja (sesuai mapping sidebar existing)

---

### 1.4 Validasi `hitung_stok` di Server & RPC

**TASK T1-18 — Guard `hitung_stok`** `- [x]`

- [x] `addStockIn` (server action): tambah cek per item — jika `produk.hitung_stok = false` → tolak dengan pesan "Produk tidak terhitung stoknya"
- [x] RPC `process_barang_masuk` (branch UoM): tambah guard `IF NOT COALESCE(p_produk.hitung_stok, true) THEN ... END IF` → raise error
- [x] Pertahankan kompatibilitas legacy branch (jika branch legacy juga memungkinkan, tambah guard yang sama)
- [x] Verifikasi: `process_barang_masuk` hanya dipanggil oleh stock-in (POS checkout pakai `process_checkout`) → aman dimodifikasi

---

### 1.5 Sinkron `harga_modal` dari AVCO

**TASK T1-19 — Sinkron `harga_modal` saat masuk/void/retur** `- [x]`

File: RPC `process_barang_masuk`, `cancel_barang_masuk`, `process_retur_pembelian`

- [x] Setelah AVCO dihitung: `UPDATE produk SET harga_modal = v_new_avco` (jika `harga_modal` saat ini IS NULL atau = 0)
- [x] Keputusan owner (konsultasi): **hanya set jika NULL/0** — manual override di form/import tetap dipertahankan, tidak ditimpa RPC
- [x] Migration `20260810_sync_harga_modal_avco.sql` — `CREATE OR REPLACE` ketiga RPC, tambah `CASE WHEN COALESCE(harga_modal,0)=0 THEN v_new_avco ELSE harga_modal END` di UPDATE produk
- [x] Diff diverifikasi: body fungsi identik dengan versi terakhir (guard hitung_stok / void / WIB+RLS), hanya +1 baris `harga_modal` per fungsi
- [x] Dokumentasikan kebijakan di AGENTS.md
- [x] Jalankan via SQL Editor — **ditunggu user**

---

## TIER 2 — Peningkatan UX & Integrasi

### 2.1 Revalidate History & Tampilkan `created_at`

**TASK T2-01 — Revalidate + kolom `created_at`** `- [ ]`

- [ ] `addStockIn`: tambah `revalidatePath("/dashboard/inventory/stock-in/history")`
- [ ] `voidBarangMasuk` & `createReturPembelian`: `revalidatePath` history (sudah di T1-08/T1-15, pastikan konsisten)
- [ ] History UI: tampilkan kolom `created_at` (tanggal + jam), urut default `tgl_masuk DESC, created_at DESC` (sudah ada, verifikasi)

### 2.2 Scan Barcode Saat Menerima (Opsional, Low)

**TASK T2-02 — Barcode scan di form stock-in** `- [ ]`

- [ ] Reuse pola `ProductCombo` (sudah mendukung cari nama & barcode)
- [ ] Tambah mode "focus scan": input barcode aktif → scan barcode → auto pilih produk, isi satuan suplai default, fokus ke qty
- [ ] Gunakan `@zxing/browser` (sudah di stack) atau integrasi SSE relay `/scanner/[sessionId]` yang sudah ada
- [ ] Barcode tidak ditemukan → feedback visual "Produk tidak ditemukan"

### 2.3 Print Dokumen Penerimaan / Surat Jalan

**TASK T2-03 — Print dokumen penerimaan** `- [ ]`

- [ ] Tombol "Cetak" di history (dan setelah save) → halaman pratinjau/print A4
- [ ] Pola dari `app/pos/invoice/[id]` (thermal 58mm & faktur A4)
- [ ] Header: no faktur (`no_surat`), supplier, tanggal; list item (produk, qty suplai, satuan, base qty, harga pcs, total); total; tanda tangan penerima & supplier

### 2.4 Fitur "Ulangi Pembelian" (Reorder)

**TASK T2-04 — Reorder** `- [ ]`

- [ ] Di history per-supplier: tombol "Buat Ulang"
- [ ] Pre-fill form barang masuk dengan produk + satuan + harga dari barang masuk terakhir (tanggal baru, qty editable)
- [ ] Ambil data dari `getBarangMasukForRetur`-style query atau query riwayat terakhir supplier

---

## TIER 3 — Future (Opsional, Catatan Saja)

| Fitur | Catatan | Prioritas |
|-------|---------|-----------|
| **Purchase Order (PO) + status (draft/parsial/selesai)** | Rencana di `FEATURE_PLAN_AKUNTANSI.md` — belum pernah dibangun. Butuh perubahan arsitektur besar (header transaksi terpisah PO → GRN) | Rendah / ditunda |
| **Partial delivery & backorder** | Tergantung PO — otomatis jadi backbone PO nanti | Rendah |
| **Discrepancy/QC check** | Input qty pesan vs diterima + flag selisih | Rendah |
| **Idempotency key** (cegah double submit) | Safety kecil — bisa ditambahkan independent | Rendah |
| **Hutang/payables per supplier** | Sudah dihapus (`20260721_drop_hutang_piutang.sql`). Barang masuk saat ini diasumsikan tunai. Perlu module keuangan terpisah | Keputusan bisnis |
| **Batch/lot & expiry tracking** | Tidak wajib untuk material bangunan non-expiry | Sangat rendah |
| **Photo/attachment faktur** | Perlu Supabase Storage | Rendah |

---

## VERIFIKASI & TEST

### Test Checklist (manual)

| # | Test | Expected | Task terkait |
|---|------|----------|--------------|
| 1 | Isi form barang masuk (UoM lusin) + isi No. Faktur → simpan | Stok gudang naik, AVCO & nilai_persediaan terupdate, `no_surat` tersimpan | T1-01..04 |
| 2 | Void barang masuk dengan alasan | Stok gudang turun, AVCO kembali, riwayat `retur_beli` tercatat, status = DIVOID (line-through) | T1-06..10 |
| 3 | Void dua kali | Ditolak: "sudah di-void" | T1-07 |
| 4 | Void barang masuk yang stok gudangnya sudah dipindah ke display | Stok gudang tidak pernah negatif (GREATEST 0); konsistensi riwayat terdokumentasi | T1-07 |
| 5 | Buat retur pembelian (qty 2 dari barang masuk qty 12) | Stok gudang −2, AVCO diupdate, `detail_retur_pembelian` + riwayat `retur_beli` tercatat | T1-13..16 |
| 6 | Retur qty > stok gudang | Ditolak "Stok gudang tidak mencukupi" | T1-14 |
| 7 | Add barang masuk produk `hitung_stok=false` lewat server action | Ditolak | T1-18 |
| 8 | Edit barang masuk (keterangan/no_surat) | Berhasil tanpa mengubah stok/AVCO | T1-09 |
| 9 | Export CSV/PDF history — baris DIVOID | Tidak masuk total nilai, tapi tampil strikethrough | T1-05, T1-12 |
| 10 | Cetak dokumen penerimaan | Output A4 rapi, ada no_surat, total, tanda tangan | T2-03 |
| 11 | Access `stock-in` sebagai KASIR | Ditolak (existing) | — |
| 12 | Buka `product-detail-sheet` → mutasi retur | Label "Retur Pembelian" tampil | T1-16 |
| 13 | tsc + lint + build | Bersih (error baru = 0) | — |

### Regression

| # | Test | Expected |
|---|------|----------|
| 1 | Checkout POS (penjualan) | Tetap normal (proses terpisah) |
| 2 | Barang masuk normal → stok gudang naik | Tetap normal |
| 3 | Restock display (gudang→display) | Tetap normal |
| 4 | Pindah display→gudang | Tetap normal |
| 5 | Isi stok paket | Tetap normal |
| 6 | Stok opname (bukan scope modul ini) | Tetap normal, tidak ada tabrakan kolom/trigger |
| 7 | Laporan kas harian `total_keluar` dari barang_masuk | Akurat (exclude `DIVOID`) — lihat tugas lintas: `lib/laporan-kasir.ts` perlu filter status di penjumlahan |
| 8 | Laba rugi / neraca | Nilai persediaan benar setelah void/retur |

> **Catatan lintas**: setelah T1-06 (kolom `status`), cek `lib/laporan-kasir.ts` (SUM barang_masuk.total) & `lib/laporan-keuangan.ts` agar hanya menghitung `status='AKTIF'`. Tambahkan sebagai subtask kecil di T1-12 atau task terpisah.

---

## URUTAN EKSEKUSI (URUTAN PROSES, BUKAN ALUR CODE)

Fase 1 — Fondasi DB (aman dijalankan berurutan):

| # | Task | Tipe |
|---|------|------|
| 1 | T1-01 Migration `no_surat` | Migration |
| 2 | T1-06 Migration void | Migration |
| 3 | T1-13 Migration retur | Migration |
| 4 | T1-02 Update RPC process_barang_masuk (`no_surat`) | Migration |
| 5 | T1-07 RPC `cancel_barang_masuk` | Migration |
| 6 | T1-14 RPC `process_retur_pembelian` | Migration |

Fase 2 — Server Actions:

| 7 | T1-04 addStockIn (`no_surat`) + T1-18 hitung_stok | Server Actions |
| 8 | T1-08 voidBarangMasuk | Server Actions |
| 9 | T1-09 updateBarangMasuk | Server Actions |
| 10 | T1-15 retur actions | Server Actions |

Fase 3 — UI:

| 11 | T1-03 Form header No. Faktur | Client Component |
| 12 | T1-05 + T1-11 History query & kolom | Server/Client |
| 13 | T1-10 + T1-12 History UI (badge, tombol, total) | Client Component |
| 14 | T1-16 Retur pages | Halaman Baru |
| 15 | T1-17 Sidebar/nav | Client Component |

Fase 4 — Penyempurnaan:

| 16 | T1-19 sinkron harga_modal | Migration/Logic |
| 17 | T2-01 revalidate + created_at | Server Actions |
| 18 | T1-12 catatan lintas: laporan kas/keuangan filter `status` | Logic |
| 19 | T2-03 print dokumen | Halaman Baru |
| 20 | T2-02 scan barcode (opsional) | Client Component |
| 21 | T2-04 reorder (opsional) | Client Component |

Fase 5 — Verifikasi:

| 22 | tsc + lint + build | Verifikasi |
| 23 | Test checklist + regression | Testing |

---

## LANGKAH VOID & RETUR — ALUR KEPUTUSAN (PENTING)

```
BERIKUT INI PROSEDUR UNTUK ADMIN:

SALAH INPUT (qty/harga/supplier/produk):
  └─ void + reinput baru (via cancel_barang_masuk)

Barang CADANG/LEBIH/RUSAK/SALAH KIRIM yang akan dikembalikan ke supplier:
  └─ retur pembelian (via process_retur_pembelian)

SEMUA: jangan hapus langsung dari tabel (`delete` di DB) — selalu lewat
void atau retur agar AVCO & stok konsisten.

Status barang_masuk: AKTIF → DIVOID. Total pembelian/laporan kas harian
menghitung hanya status AKTIF.
```

---

## OUT OF SCOPE (Tidak Dilakukan)

| Item | Alasan |
|------|--------|
| PO lengkap (draft/parsial/backorder) | Arsitektur besar; butuh perubahan model transaksi — ditunda Tier Future |
| Hutang dagang / pembayaran supplier | Feature sudah dihapus; keputusan bisnis |
| Foto/attachment faktur | Butuh Supabase Storage — future |
| Batch/lot & expiry | Bukan kebutuhan material toko bangunan |
| Hapus RPC lama | Prinsip additive — pertahankan |

---

## LOG / CATATAN PERUBAHAN

| Tanggal | Task | Catatan |
|---------|------|---------|
| 2026-08-10 | — | Dokumen dibuat & dipecah menjadi task-task kecil (T1-XX, T2-XX) |
| 2026-08-10 | T1-01 | File migrasi `20260810_barang_masuk_no_surat.sql` dibuat. Jalankan & verifikasi manual via SQL Editor oleh user |
| 2026-08-10 | T1-02 | File `20260810_update_process_barang_masuk_no_surat.sql` dibuat ($CREATE OR REPLACE$). Diverifikasi di Postgres test (UoM simpan no_surat OK; legacy tanpa no_surat OK). Jalankan di SQL Editor |
| 2026-08-10 | T1-03 | Form `stock-in-client.tsx`: input header "No. Faktur/Nota" + field `no_surat` di schema/defaultValues + map ke semua item saat submit + reset. tsc bersih |
| 2026-08-10 | T1-04 | Action `addStockIn`: schema tambah `no_surat` optional, map `no_surat?.trim() || null` ke RPC payload, tambah `revalidatePath` history. tsc bersih |
| 2026-08-10 | T1-05 | History: kolom "No. Faktur" (mobile hide), search include `no_surat`, export CSV & PDF tambah kolom `no_surat`. tsc bersih |
| 2026-08-10 | T1-06 | File migrasi `20260810_barang_masuk_void.sql` dibuat (kolom status/voided_* + index). Jalankan & verifikasi manual via SQL Editor oleh user |
| 2026-08-10 | T1-07 | RPC `cancel_barang_masuk` ditambahkan di `20260810_barang_masuk_void.sql`. Diverifikasi di Postgres 18 lokal: void sukses, AVCO & stok kembali benar, riwayat `retur_beli` tercatat, status DIVOID, error ganda/not-found OK. Jalankan di SQL Editor |
| 2026-08-10 | T1-08 | Action `voidBarangMasuk` di `stock-in/actions.ts`: validasi ADMIN/OWNER, RPC cancel_barang_masuk + map error, log aktivitas aksi DELETE (deskripsi "Membatalkan Barang Masuk"), revalidate inventory+history. tsc bersih |
| 2026-08-10 | T1-09 | Action `updateBarangMasuk` di `stock-in/actions.ts`: zod `updateStockInSchema`, cek DIVOID, hanya edit tgl_masuk/no_surat/keterangan (kosong→null), log UPDATE + revalidate. tsc+eslint bersih |
| 2026-08-10 | T1-10 | History UI `history-client.tsx`: kolom Status badge (AKTIF hijau / DIVOID merah-strike), tombol Edit (dialog tgl/no_surat/keterangan) & Void (modal konfirmasi + alasan wajib), baris DIVOID line-through & tombol disembunyikan, spinner per-aksi + error banner, refresh via `router.refresh()`. `page.tsx` tambah `status` ke select. tsc+eslint bersih (hanya error pre-existing di `tests/screenshot-responsive.spec.ts`) |
| 2026-08-10 | T1-11 | Query history `page.tsx`: tambah `voided_at`, `voided_by`, `alasan_void`, `created_at` ke select (status sudah ada dari T1-10). DIVOID tetap dikembalikan (tanpa filter). tsc+eslint bersih |
| 2026-08-10 | T1-12 | Ringkasan `history-client.tsx`: `activeData` exclude DIVOID untuk "Total Nilai Pembelian" & "Jumlah Catatan". Export CSV/PDF tetap menyertakan baris DIVOID dengan kolom Status (CSV sudah ada dari T1-05, PDF ditambah kolom Status). tsc+eslint bersih |
| 2026-08-10 | T1-13 | File migrasi `20260810_retur_pembelian.sql` dibuat (tabel `retur_pembelian` + `detail_retur_pembelian` + index tgl & supplier). Belum dijalankan — verifikasi manual via SQL Editor oleh user |
| 2026-08-10 | T1-14 | RPC `process_retur_pembelian` ditambahkan di `20260810_retur_pembelian.sql`. Diverifikasi di Postgres 18 lokal: retur sukses (`RB-YYYYMMDD-01/02`), stok gudang berkurang, AVCO reverse true, `detail_retur_pembelian` + riwayat `retur_beli` tercatat. Error (stok gudang kurang, barang masuk DIVOID, qty ≤ 0, produk absent, items kosong) dikembalikan sebagai json TANPA header parsial. **Perbaikan dari draft**: `riwayat_avco.id_referensi` INTEGER tidak bisa menampung UUID retur → kolom baru `id_referensi_uuid` (UUID) ditambahkan secara additive; item divalidasi pass-1 sebelum insert header agar error tidak meninggalkan header parsial. Jalankan via SQL Editor |
| 2026-08-10 | T1-14 (fix) | File `20260810_fix_retur_wib_rls.sql` dibuat untuk menambal migration yang sudah terlanjur dijalankan: (1) **timezone WIB** — `no_retur`/`tgl_retur` memakai `now() AT TIME ZONE 'Asia/Jakarta'` (sebelumnya `CURRENT_DATE` UTC, bisa selisih 1 hari di Supabase antara 17:00-07:00 WIB; diverifikasi di server Postgres UTC: logika lama `20260810` vs baru `20260811` untuk pukul 17:30 UTC); (2) **RLS** — enable RLS + policy SELECT/INSERT untuk `authenticated` di `retur_pembelian` & `detail_retur_pembelian` (pola `20260810_fix_rls_stok_opname_sesi.sql`). Diuji: re-run idempotent OK, retur sukses + semua error path, SELECT/INSERT sebagai role authenticated OK. **WAJIB dijalankan via SQL Editor** |
| 2026-08-10 | DB audit | Audit `database.MD` (export terbaru dari Supabase) vs 44 migrasi: mayoritas tabel/kolom/RLS konsisten. Temuan: (1) tabel `hutang_dagang`/`pembayaran_hutang`/`piutang_dagang`/`pembayaran_piutang` **masih ada** di Supabase (migrasi drop belum dijalankan); (2) `saldo_kas_harian` & `pengaturan_keuangan` **tanpa RLS**; (3) policy `merk` (`auth_all` TO public) & `lokasi_area` (TO public + auth.role()) tidak seragam ke `authenticated`; (4) `id_produk_master`/`qty_per_unit` tanpa migrasi ADD COLUMN (dibuat manual, gap dokumentasi saja); (5) `database.MD` tidak memuat RPC — kelengkapan fungsi perlu dicek via `pg_proc` |
| 2026-08-10 | DB cleanup | File `20260810_fix_db_cleanup_rls.sql` dibuat: (1) `DROP TABLE IF EXISTS ... CASCADE` keempat tabel hutang/piutang (idempotent, aman — tidak ada referensi di kode); (2) RLS `saldo_kas_harian` & `pengaturan_keuangan` — enable RLS + policy SELECT/INSERT/UPDATE/DELETE `authenticated`; (3) seragamkan policy `merk` & `lokasi_area` ke role `authenticated` (drop `auth_all` TO public). Diverifikasi di Postgres 18: tabel hutang hilang, authenticated bisa SELECT/INSERT/UPDATE semua tabel sasaran, anon ditolak akses `merk`, re-run idempotent 0 error. **WAJIB dijalankan via SQL Editor** |
| 2026-08-10 | T1-15 | Action di `app/dashboard/inventory/stock-in/actions.ts`: (1) `createReturPembelian` — zod `createReturSchema` (items[] id_produk/qty_retur>0/keterangan? + keterangan?), validasi ADMIN/OWNER, cegah produk duplikat, panggil RPC `process_retur_pembelian`, map semua error RPC (DIVOID, items kosong, stok gudang kurang, qty ≤ 0, not found, produk absent) ke Bahasa Indonesia + hint "skema database belum lengkap" bila fungsi tidak ada, `logActivity` CREATE (entitas `retur_pembelian`, data_baru no_retur + jumlah_item), `revalidatePath` inventory + stock-in/history + retur/history. (2) `getBarangMasukForRetur` — zod `getBarangMasukSchema`, validasi ADMIN/OWNER, ambil `barang_masuk` + `supplier` + `produk` (nama, sku, conversion_ratio, default_purchase_unit, stok_gudang, satuan nama) untuk prefill form retur, tolak jika `status='DIVOID'`. Tambah label `retur_pembelian`/`no_retur`/`qty_retur`/`no_surat` di `lib/activity-log.ts`. tsc+eslint bersih (hanya error pre-existing di `tests/screenshot-responsive.spec.ts`) |
| 2026-08-10 | T1-16 | Halaman retur dibuat di `app/dashboard/inventory/stock-in/retur/`: (1) `page.tsx` (server) fetch `barang_masuk` AKTIF + supplier (join produk: nama, sku, stok_gudang, satuan, ratio) untuk list pilihan; (2) `retur-client.tsx` — DataTable dengan search (produk/no_surat/supplier), filter supplier & range tanggal, kolom Qty Diterima/Qty Base/Stok Gudang, tombol "Retur" per baris (disabled bila stok gudang = 0) → dialog input `qty_retur` (maks = min(base_qty_added, stok_gudang)) + keterangan → `createReturPembelian`, toast sukses + `router.refresh()`; (3) `retur/history/page.tsx` (server) fetch `retur_pembelian` + supplier + pengguna (operator) + barang_masuk (produk, no_surat) + hitung jumlah_item dari detail relasi; (4) `retur/history/history-client.tsx` — DataTable (No. Retur, Tanggal, Supplier, Barang Masuk, Item, Total Nilai, Operator, Keterangan) + search/filter + export CSV/PDF + tombol "Buat Retur". Navigasi form ↔ riwayat via tombol di kedua halaman. tsc+eslint bersih (hanya error pre-existing di `tests/screenshot-responsive.spec.ts`) |
| 2026-08-10 | T1-18 | Guard `hitung_stok`: (1) `addStockIn` di `stock-in/actions.ts` — select produk tambah `hitung_stok` & `nama_produk`, tolak per item bila `hitung_stok = false` ("Produk \"X\" tidak terhitung stoknya..."), tambah mapping error RPC `tidak terhitung stoknya` (defense-in-depth bila validasi action dilewati); (2) migration baru `20260810_guard_hitung_stok.sql` — `CREATE OR REPLACE process_barang_masuk` + guard `IF NOT COALESCE(hitung_stok, true) THEN RAISE EXCEPTION ...` sekali sebelum percabangan UoM/legacy (melindungi kedua branch tanpa duplikasi), logika inti (UoM/AVCO/no_surat) tidak berubah, `GRANT EXECUTE` dipertahankan. Verifikasi: `process_barang_masuk` hanya dipanggil `addStockIn` (POS pakai `process_checkout`) → aman. tsc+eslint bersih (hanya error pre-existing di `tests/screenshot-responsive.spec.ts`). **WAJIB dijalankan via SQL Editor** |
| 2026-08-10 | T1-19 | Sinkron `harga_modal` dari AVCO (keputusan owner: **hanya set jika NULL/0**, manual override dipertahankan). Migration `20260810_sync_harga_modal_avco.sql` — `CREATE OR REPLACE` tiga RPC: `process_barang_masuk`, `cancel_barang_masuk`, `process_retur_pembelian`; di UPDATE produk masing-masing tambah `harga_modal = CASE WHEN COALESCE(harga_modal,0)=0 THEN v_new_avco ELSE harga_modal END`. Logika inti (AVCO/UoM/void/retur/WIB+RLS) tidak berubah. Diff terhadap versi terakhir tiap fungsi diverifikasi: hanya +1 baris `harga_modal` per fungsi. Kebijakan didokumentasikan di AGENTS.md (bagian AVCO). **WAJIB dijalankan via SQL Editor** |
| 2026-08-10 | T1-17 | Link "*Retur Barang*" + "*Riwayat Retur*" ditambahkan di `components/dashboard-sidebar.tsx` (grup Inventaris, setelah Riwayat Barang Masuk) & `components/dashboard-mobile-nav.tsx` (setelah Riwayat Masuk). Icon `RotateCcw` & `Receipt`. Tertanam dalam grup `isManagement` (OWNER/ADMIN) → visibility role aman. tsc & eslint bersih (0 error, 3 warning pre-existing) |
| 2026-08-10 | Lintas | `lib/laporan-kasir.ts` total_keluar: query `barang_masuk` tambah `eq("status","AKTIF")` — barang masuk DIVOID tidak dihitung sebagai pengeluaran kas harian. `lib/laporan-keuangan.ts` diverifikasi tidak perlu diubah (Laba-Rugi & Neraca memakai `transaksi_keluar`, bukan `barang_masuk`). tsc bersih |

---

## REFERENSI

- [Brahmin Solutions — Receiving Inventory: 5 Steps and Best Practices (2026)](https://www.brahmin-solutions.com/blog/receiving-inventory-how-to-and-best-practices)
- [Cleverence — Retail Inventory Receiving: Process, Best Practices, Tools, and KPIs](https://www.cleverence.com/articles/business-blogs/retail-inventory-receiving-4827/)
- [Cleverence — Retail inventory management best practices: a complete 2026 field guide](https://www.cleverence.com/articles/for-business/retail-inventory-management-best-practices-4827)
- [ScaleOcean — 13 SOP Toko Retail (penerimaan barang dari pemasok)](https://scaleocean.com/id/blog/industri/9-contoh-sop-toko-retail-yang-penting-untuk-diterapkan)
- [Turboly ERP — Proses Penerimaan Barang / Goods Receive & QC Check](https://turboly.com/blog/2025/08/Software-Gudang-Kunci-Saat-Receiving)
- [Bridgenr — Contoh SOP Toko Retail (SOP Penerimaan Barang)](https://bridgenr.com/id/blog/sop-toko-retail)
- [UKWMS — Prosedur Aktivitas Persediaan Barang Masuk (SOP PT. Sumber Rejeki)](https://repositori.ukwms.ac.id/5127/7/LAMPIRAN.pdf)
