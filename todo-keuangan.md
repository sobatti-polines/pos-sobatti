# TODO — Peningkatan Modul Keuangan & Laporan Keuangan (Sobatti POS)

**Status**: DONE — Fase A, B, dan C selesai (implementasi + verifikasi otomasi tsc/eslint). Menunggu verifikasi manual user: jalankan migration `20260812_keuangan_pengeluaran.sql` & uji skenario DB.
**Prioritas**: Tinggi
**Dampak**: Laporan keuangan (Laba Rugi, Neraca, Arus Kas, Laporan Kasir) konsisten, selalu balance, dan sesuai standar praktik retail UMKM (cash basis + perpetual AVCO)

**Cara pakai dokumen ini**: setiap baris `- [ ]` adalah SATU task independen yang bisa dikerjakan & di-commit sendiri. Centang (`- [x]`) setelah task selesai & diverifikasi. Batasi lingkup per task agar mudah di-review.

---

## KONTEKS

Modul keuangan saat ini terdiri dari:
- **Laba Rugi** (`lib/laporan-keuangan.ts:generateLabaRugi` + `app/dashboard/laporan/laba-rugi/*`)
- **Neraca** (`lib/laporan-keuangan.ts:generateNeraca` + `app/dashboard/laporan/neraca/*`)
- **Tutup Kasir** (`lib/laporan-kasir.ts:getDailyCashSummary` + `confirmTutupKasir` + `app/dashboard/tutup-kasir/*`)
- **Laporan Kasir Harian** (`app/dashboard/laporan-kasir/*`)
- **Pengaturan Keuangan** (`app/dashboard/settings/keuangan/*` + tabel `pengaturan_keuangan`)
- Fondasi: AVCO/HPP (`riwayat_avco`), flow stok opname & barang masuk & retur pembelian (sudah dirombak, SEMUA additive)

**Masalah/conflict yang ditemukan saat analisis:**
1. **Neraca tidak balance** bila ada penjualan non-tunai (QRIS/Transfer) — `kas` hanya menghitung laci tunai, sedangkan `laba_ditahan` menghitung semua transaksi.
2. **Koreksi stok (opname `koreksi`) & retur pembelian (`retur_beli`)** mengubah nilai persediaan (aset) tanpa menyentuh ekuitas → neraca tidak balance.
3. **Beban operasional = 0 permanen** (hardcode di `generateLabaRugi`) — tidak ada modul pengeluaran; laba bersih selalu = laba kotor.
4. **Selisih kas (over/short) tutup kasir** tidak masuk pembukuan (hanya disimpan di `saldo_kas_harian.selisih`).
5. **Tidak ada Laporan Arus Kas** (dibutuhkan konsultan pajak & standar retail).
6. **Kas di Neraca stale** bila tutup kasir belum pernah dijalankan (fallback ke `modal_awal` meski sudah banyak transaksi).
7. **Refund retur pembelian tidak masuk mutasi kas harian** → saldo sistem di hari retur tidak cocok dengan laci.
8. Piutang = 0 (fitur hutang/piutang dihapus) — aman karena kasir selalu lunas saat itu (keputusan user).

**Keputusan desain (dikonfirmasi user):**
- **Basis pencatatan**: Cash Basis + persediaan perpetual AVCO (tetap, selaras dengan tutup kasir & flow yang sudah dirombak).
- **Neraca**: Kas dibagi **Kas Tunai (laci)** + **Kas Bank/QRIS (non-tunai)**.
- **Piutang**: tetap 0 (kasir selalu lunas saat itu).
- **Modul Pengeluaran (beban operasional) + Arus Kas**: disepakati PERLU, dikerjakan di **Fase B** (setelah Fase A selesai) untuk mengontrol risiko.
- **Fase A = ZERO migration, ZERO perubahan RPC** checkout / barang_masuk / stock-opname / retur. Murni *restatement* (baca & agregasi tabel `transaksi_keluar`, `saldo_kas_harian`, `riwayat_avco`, `barang_masuk`, `retur_pembelian`, `stok_opname`, `pengaturan_keuangan`, `metode_bayar`).
- **Rekonsiliasi Neraca**: Laba Ditahan = profit penjualan **+ Σ selisih kas + Σ penyesuaian stok (opname & retur)**, plus baris **"Penyesuaian Neraca"** residual = Aset − (Kewajiban + Modal + Laba Ditahan) agar laporan SELALU balance dan anomaly terlihat eksplisit (bukan warning merah error).

---

## MASTER TASK BOARD

Ringkasan seluruh task per tier. Detail setiap task ada di bagian bawah masing-masing tier.

### Fase A — Konsistensi & Neraca Balance (tanpa migration, tanpa RPC)

| ID | Task | Dependensi | Effort |
|----|------|-----------|--------|
| K1-01 | `getDailyCashSummary`: inflow "Penerimaan Retur Pembelian" | — | S |
| K1-02 | Tutup Kasir UI: tampilkan rincian "Penerimaan Retur" | K1-01 | S |
| K1-03 | Helper agregasi Kas Tunai + Kas Bank (fungsi baru) | — | M |
| K1-04 | `generateNeraca`: Kas Tunai + Kas Bank + fallback kumulatif | K1-03 | M |
| K1-05 | `generateNeraca`: book Σ selisih kas ke Laba Ditahan | K1-03 | S |
| K1-06 | `generateNeraca`: book penyesuaian stok (opname+retur) ke Laba Ditahan | K1-03 | M |
| K1-07 | `generateNeraca`: baris "Penyesuaian Neraca" residual agar selalu balance | K1-04, K1-05, K1-06 | S |
| K1-08 | `generateLabaRugi`: baris "Selisih Kas" & "Koreksi/Selisih Stok" | K1-05, K1-06 | M |
| K1-09 | `generateLabaRugi`: refactor beban operasional dinamis (siap Fase B) | — | S |
| K1-10 | Neraca UI: Kas Tunai / Kas Bank / Selisih / Koreksi / Penyesuaian | K1-07 | M |
| K1-11 | Laba Rugi UI: baris selisih kas, koreksi stok, beban per kategori | K1-08, K1-09 | M |
| K1-12 | Export CSV & print update Laba Rugi + Neraca | K1-10, K1-11 | S |
| K1-13 | Uji konsistensi balance 3 skenario + tsc + lint | semua K1 | M |

### Fase B — Beban Operasional & Arus Kas (migration + fitur baru)

| ID | Task | Dependensi | Effort |
|----|------|-----------|--------|
| K2-01 | Migration: tabel `pengeluaran` + kategori beban + index + RLS | — | M |
| K2-02 | Action CRUD `pengeluaran` (create/update/delete/list) + log activity | K2-01 | L |
| K2-03 | Halaman input + daftar Pengeluaran (form + tabel + edit/void) | K2-02 | L |
| K2-04 | Sidebar/nav menu "Pengeluaran" | K2-03 | S |
| K2-05 | Laba Rugi multiple-step per kategori beban | K1-09, K2-01 | M |
| K2-06 | Tutup Kasir: pengeluaran tunai sebagai outflow | K2-02, K1-01 | M |
| K2-07 | `generateNeraca`: pengeluaran memengaruhi Kas (bila tunai) | K2-06 | S |
| K2-08 | `generateArusKas`: Laporan Arus Kas sederhana (operasi) | K2-02 | L |
| K2-09 | Halaman Arus Kas + menu navigasi | K2-08 | M |
| K2-10 | Export CSV + print Arus Kas | K2-09 | S |
| K2-11 | Uji konsistensi + tsc + lint | semua K2 | M |

### Fase C — Polish & Konsistensi Laporan

| ID | Task | Dependensi | Effort |
|----|------|-----------|--------|
| K3-01 | Header/nama toko konsisten di semua laporan dari `pengaturan` | K1-12 | S |
| K3-02 | Terbilang rupiah + blok tanda tangan di cetak formal | K3-01 | S |
| K3-03 | `revalidatePath` saat pengeluaran dibuat (dashboard + laporan) | K2-02 | S |
| K3-04 | Widget dashboard ringkasan keuangan (laba bersih bulan berjalan) | K2-05 | M |
| K3-05 | Catatan atas Laporan Keuangan (CaLK) sederhana | K3-01 | S |

---

## TIER 1 — FASE A: Konsistensi & Neraca Balance

> Prinsip: TIDAK ADA migration & TIDAK ADA perubahan RPC. Hanya restatement (baca + agregasi).

### 1.1 Mutasi Kas Harian — Refund Retur Pembelian

**K1-01 — Inflow "Penerimaan Retur Pembelian" di `getDailyCashSummary`** `- [x]`
- File: `lib/laporan-kasir.ts`
- Tambahkan ke `totalMasuk`: Σ `retur_pembelian.total_nilai` (asumsi refund tunai) pada tanggal yang sama (`.eq("tgl_retur", dateStr)`).
- Tambahkan `detail.penerimaan_retur` di struktur return.
- Catatan: barang masuk DIVOID sudah ter-exclude (filter `status = 'AKTIF'` di outflow) — pastikan tetap.

**K1-02 — UI Tutup Kasir menampilkan rincian "Penerimaan Retur"** `- [x]`
- File: `app/dashboard/tutup-kasir/tutup-kasir-client.tsx`
- Tambah baris di blok "Rincian Tunai": `Penerimaan Retur` (hanya tampil bila nilai > 0).
- Pastikan `expectedSaldoAkhir` & selisih memakai `summary.total_masuk` yang sudah termasuk retur.

### 1.2 Neraca — Kas Tunai + Kas Bank

**K1-03 — Helper agregasi Kas Tunai & Kas Bank** `- [x]`
- File: `lib/laporan-keuangan.ts`
- Fungsi baru (internal):
  - `getKasTunai(supabase, date)`: pakai `saldo_kas_harian.uang_aktual` (bila `dikonfirmasi = true`) → fallback `saldo_akhir` → fallback **kumulatif** `modal_awal + Σ(tunai masuk: bayar−kembali) − Σ(pembelian barang_masuk AKTIF)` sejak `tanggal_mulai`.
  - `getKasBankNonTunai(supabase, date)`: Σ `total` penjualan dengan `id_metode_bayar != id_tunai` (ambil id Tunai dari `metode_bayar`).
- Sertakan WIB day-boundary (pola `T00:00:00+07:00` / `T23:59:59+07:00`) yang sudah ada.

**K1-04 — `generateNeraca`: Kas Tunai + Kas Bank** `- [x]`
- File: `lib/laporan-keuangan.ts`
- Ganti blok `1a. Kas` memakai helper K1-03; tambah `aset.kas_tunai` dan `aset.kas_bank`.
- `aset.kas` (total) = kas_tunai + kas_bank (pertahankan untuk kompatibilitas lama jika ada konsumen).
- Fallback `modal_awal` yang stale dihapus → selalu kumulatif.

**K1-05 — Book selisih kas ke Laba Ditahan** `- [x]`
- File: `lib/laporan-keuangan.ts`
- `selisihKas = Σ saldo_kas_harian.selisih` (bila null, jadikan 0) dengan `tanggal <= date`.
- Tambahkan ke `ekuitas.laba_ditahan` dan tampilkan sebagai sub-line.

**K1-06 — Book penyesuaian stok (opname + retur) ke Laba Ditahan** `- [x]`
- File: `lib/laporan-keuangan.ts`
- `penyesuaianStok = Σ(barang_masuk AKTIF.total) − Σ(detail_retur_pembelian.jumlah) − (persediaan + Σ transaksi_keluar.total_hpp)` (rumus identitas perpetual: Pembelian Bersih − (Persediaan + HPP)).
- Nilai ini menangkap dampak neto koreksi opname + retur + void → tambahkan ke `ekuitas.laba_ditahan`.

**K1-07 — Baris "Penyesuaian Neraca" residual (garansi balance)** `- [x]`
- File: `lib/laporan-keuangan.ts`
- `penyesuaianNeraca = total_aset − (total_kewajiban + total_ekuitas)`.
- Tambahkan ke struktur return; `total_ekuitas` **tidak** diubah oleh residual ini (residual hanya untuk display/audit).
- Pastikan `total_aset` dan `total_kewajiban + total_ekuitas` dihitung eksplisit di return.

### 1.3 Laba Rugi — Beban & Pendapatan Penyesuaian

**K1-08 — Baris "Selisih Kas" & "Koreksi/Selisih Stok" di `generateLabaRugi`** `- [x]`
- File: `lib/laporan-keuangan.ts`
- Tambah pada periode: `penyesuaian.selisih_kas` dan `penyesuaian.koreksi_stok` (pakai logika K1-05/K1-06 untuk rentang periode).
- `laba_bersih` = laba_kotor − beban_operasional + Σ penyesuaian (selisih kas & koreksi stok, dengan tanda sesuai).

**K1-09 — Refactor beban operasional dinamis** `- [x]`
- File: `lib/laporan-keuangan.ts`
- Hapus hardcode `beban_operasional: 0` → baca dari tabel `pengeluaran` bila ada (Fase B); jika tabel/kategori kosong, hasilkan `[]` + total 0 (tanpa error).
- Struktur return disiapkan untuk array per kategori beban (nama, jumlah) agar Fase B tinggal isi data.

### 1.4 UI — Neraca & Laba Rugi

**K1-10 — UI Neraca menampilkan akun baru** `- [x]`
- File: `app/dashboard/laporan/neraca/neraca-client.tsx`
- "Kas & Setara Kas" → dua baris: "Kas Tunai (Laci)" + "Kas Bank / QRIS".
- Baris baru di Ekuitas: "Selisih Kas (kumulatif)" & "Penyesuaian Stok (opname/retur)".
- Tampilkan baris "Penyesuaian Neraca" (hijau bila ~0; amber bila != 0) — ganti block warning merah yang lama.
- Update `handleExport` CSV mengikuti struktur baru.

**K1-11 — UI Laba Rugi menampilkan penyesuaian** `- [x]`
- File: `app/dashboard/laporan/laba-rugi/laba-rugi-client.tsx`
- Tambah blok "Penyesuaian" (Selisih Kas, Koreksi/Selisih Stok).
- Beban Operasional menjadi per kategori (map dari `biaya.beban[]` bila ada).
- Update `handleExport` CSV.

**K1-12 — Export & print konsisten** `- [x]`
- File: `laba-rugi-client.tsx`, `neraca-client.tsx`
- Header/kolom CSV + print mengikuti struktur baru; `exportToCSV`/`ExportDropdown` tidak berubah API.

### 1.5 Verifikasi Fase A

**K1-13 — Uji konsistensi + tsc + lint** `- [x]`
- Jalankan `npx tsc --noEmit` (pastikan tidak ada error baru di file keuangan) & `npx eslint` file yang diubah.
- Uji data dummy (lihat bagian VERIFIKASI & TEST, Skenario 1-3): pastikan selisih Neraca = 0 pada 100% tunai, ada QRIS, dan ada opname+retur.
- Pastikan `getDashboardData` & widget lain yang memakai fungsi lama tidak rusak.

---

## TIER 2 — FASE B: Beban Operasional & Arus Kas

> Fase ini menambah tabel & halaman baru (additive). Fase A wajib selesai dulu.

### 2.1 Migration Pengeluaran

**K2-01 — Migration tabel `pengeluaran` + kategori beban + index + RLS** `- [x]`
- File: `supabase/migrations/2026xxxx_keuangan_pengeluaran.sql`
- `kategori_beban` (id, nama, kelompok — Gaji/Sewa/Listrik&Air/Transport/Lain-lain).
- `pengeluaran` (id, tanggal, id_kategori_beban, nama_pengeluaran, jumlah, metode_bayar TEXT, id_pengguna FK, keterangan, status [AKTIF/DIVOID], created_at, voided_at, voided_by, alasan_void).
- Index: tanggal, id_kategori_beban, status.
- RLS: enable + policy untuk authenticated (pola tabel lain).
- Tambahkan tabel ke realtime publikasi bila diperlukan (opsional, sesuaikan kebutuhan).

### 2.2 Actions Pengeluaran

**K2-02 — CRUD action `pengeluaran` + log activity** `- [x]`
- File: `app/dashboard/keuangan/pengeluaran/actions.ts` (ikuti pola `"use server"` + zod validasi + `getAuthUser` + role ADMIN/OWNER).
- `createPengeluaran`, `updatePengeluaran`, `voidPengeluaran`, `getPengeluaranList` (filter tanggal/kategori/status), `getKategoriBeban`.
- Void = soft-update (bukan DELETE), pola void barang masuk.
- `logActivity` untuk create/update/void.

### 2.3 UI Pengeluaran

**K2-03 — Halaman input + daftar Pengeluaran** `- [x]`
- File: `app/dashboard/keuangan/pengeluaran/page.tsx` + `pengeluaran-client.tsx`
- Form: tanggal, kategori beban (select), nama, jumlah, metode bayar (Tunai/Transfer/QRIS), keterangan.
- Daftar: DataTable (tanggal, kategori, nama, jumlah, metode, status, aksi edit/void), ringkasan total per periode.
- Empty/loading/error state + validasi server (jumlah > 0, tanggal wajib, kategori wajib).

**K2-04 — Menu navigasi "Pengeluaran"** `- [x]`
- File: `components/dashboard-sidebar.tsx` (+ `dashboard-mobile-nav.tsx` bila ada)
- Tambah item menu di grup laporan/keuangan; role ADMIN/OWNER.

### 2.4 Integrasi Laporan

**K2-05 — Laba Rugi multiple-step per kategori beban** `- [x]`
- File: `lib/laporan-keuangan.ts` (pakai struktur K1-09)
- `biaya.beban[]` diisi dari `pengeluaran` AKTIF pada periode, dikelompokkan per `kategori_beban`.
- `beban_operasional` = Σ beban; `laba_bersih` = laba_kotor − beban + penyesuaian.

**K2-06 — Tutup Kasir: pengeluaran tunai sebagai outflow** `- [x]`
- File: `lib/laporan-kasir.ts` + `tutup-kasir-client.tsx`
- `totalKeluar` += Σ `pengeluaran` AKTIF dengan `metode_bayar = 'Tunai'` pada tanggal tersebut.
- Rincian: "Pengeluaran Operasional" di blok Rincian Tunai.

**K2-07 — Neraca: pengeluaran memengaruhi Kas** `- [x]`
- File: `lib/laporan-keuangan.ts`
- Kas Tunai kumulatif di K1-03 dikurangi Σ pengeluaran tunai AKTIF sejak `tanggal_mulai`.

### 2.5 Arus Kas

**K2-08 — `generateArusKas(supabase, startDate, endDate)`** `- [x]`
- File: `lib/laporan-keuangan.ts`
- Struktur: Arus dari Aktivitas Operasi (penerimaan penjualan tunai, penerimaan retur, pembayaran pembelian, pembayaran pengeluaran operasional) → Kas Bersih Operasi.
- Kas awal (dari `getDailyCashSummary`/kumulatif) & kas akhir.
- Aktivitas Investasi/Pendanaan: kosong (placeholder, tidak wajib).

**K2-09 — Halaman Arus Kas + menu** `- [x]`
- File: `app/dashboard/keuangan/arus-kas/page.tsx` + `arus-kas-client.tsx` (form periode + tampilan + print + export).
- Tambah menu navigasi.

**K2-10 — Export CSV + print Arus Kas** `- [x]`
- File: `arus-kas-client.tsx` — `exportToCSV` + blok `print-area`.

### 2.6 Verifikasi Fase B

**K2-11 — Uji konsistensi + tsc + lint** `- [x]`
- Jalankan migration di Supabase (manual oleh user, sesuai konvensi repo).
- Uji: buat pengeluaran tunai → tutup kasir & neraca berubah benar; buat pengeluaran transfer → hanya laba rugi (bukan kas laci); void pengeluaran → kembali normal.
- `tsc --noEmit` + `eslint` file yang diubah.
- **Catatan (done otomatis)**: `tsc --noEmit` bersih untuk file keuangan (error ts hanya pre-existing di `tests/screenshot-responsive.spec.ts`); `eslint` bersih untuk file baru Arus Kas & file keuangan yang diubah. Bagian manual (run migration + uji skenario DB) tetap user, sesuaikan checklist di bawah.

---

## TIER 3 — FASE C: Polish & Konsistensi Laporan

**K3-01 — Header/nama toko konsisten di semua laporan** `- [x]`
- File: print header `laba-rugi-client.tsx`, `neraca-client.tsx`, `arus-kas-client.tsx`, `laporan-kasir-client.tsx`
- Ambil `nama_toko`/`alamat` dari tabel `pengaturan` (fungsi helper shared bila perlu).

**K3-02 — Terbilang rupiah + blok tanda tangan di cetak formal** `- [x]`
- File: `lib/terbilang.ts` (sudah ada `terbilangRupiah`) + client laporan
- Tampilkan "Terbilang: ..." di bawah total; blok tanda tangan (Pemilik / Dibuat oleh) konsisten.

**K3-03 — `revalidatePath` saat pengeluaran dibuat** `- [x]`
- File: `app/dashboard/keuangan/pengeluaran/actions.ts`
- `revalidatePath("/dashboard/laporan/laba-rugi")`, `("/dashboard/tutup-kasir")`, `("/dashboard")`, dan halaman pengeluaran.

**K3-04 — Widget dashboard ringkasan keuangan** `- [x]`
- File: `lib/dashboard.ts` + komponen baru (opsional)
- Kartu "Laba Bersih Bulan Ini" & "Beban Operasional Bulan Ini" (dari `generateLabaRugi` + pengeluaran).

**K3-05 — Catatan atas Laporan Keuangan (CaLK) sederhana** `- [x]`
- File: blok di tiap laporan (opsional)
- Ringkasan kebijakan: basis kas, AVCO, piutang/hutang dinonaktifkan, asumsi Kas Bank = penjualan non-tunai.

---

## VERIFIKASI & TEST

### Test Checklist (manual + otomatis)

- [ ] **Skenario 1 — 100% tunai**: lakukan pembelian (barang masuk) + beberapa transaksi tunai + tutup kasir. Neraca harus balance (selisih 0). Laba Rugi: laba_kotor = laba_bersih (bila belum ada pengeluaran).
- [ ] **Skenario 2 — Ada QRIS/Transfer**: transaksi dengan metode non-tunai. Neraca: Kas Bank/QRIS muncul, total balance (selisih 0).
- [ ] **Skenario 3 — Opname + Retur**: buat stok opname dengan selisih negatif & retur pembelian. Neraca tetap balance; Laba Rugi menampilkan baris Koreksi/Selisih Stok.
- [ ] **Skenario 4 — Selisih kas**: tutup kasir dengan uang aktual ≠ saldo sistem. Laba Rugi menampilkan Selisih Kas; Neraca tetap balance.
- [ ] **Tanpa tutup kasir sama sekali**: Neraca memakai kas kumulatif (bukan modal_awal stale) & tetap balance.
- [ ] Export CSV & print untuk Laba Rugi, Neraca (Fase A) benar & konsisten.
- [ ] `npx tsc --noEmit` bersih (tidak ada error baru di file keuangan).
- [ ] `npx eslint` bersih untuk file yang diubah (jangan tambahkan error baru).

### Fase B (saat dikerjakan)
- [ ] Pengeluaran tunai → masuk outflow tutup kasir & Neraca Kas.
- [ ] Pengeluaran transfer → hanya di Laba Rugi (tidak ubah kas laci).
- [ ] Void pengeluaran → hilang dari laporan, stok/lainnya tidak terpengaruh.
- [ ] Arus Kas total konsisten dengan selisih kas periode.

---

## CATATAN / RISIKO

- **Tidak ada perubahan RPC** `process_checkout`, `process_barang_masuk`, `process_stock_opname`, `process_retur_pembelian` di seluruh Fase A — tidak ada konflik dengan flow stok opname & barang masuk yang baru dirombak.
- Semua nilai uang NUMERIC; gunakan `Number()` saat agregasi (hindari string concatenation).
- Pertahankan WIB day-boundary (`+07:00`) di semua filter tanggal (pola sudah ada).
- Bahasa UI & pesan error tetap Bahasa Indonesia.
- Migration Fase B dijalankan manual di Supabase oleh user (konvensi repo).
- Asumsi yang didokumentasikan: Kas Bank = penjualan non-tunai; pembelian & pengeluaran diasumsikan dari kas tunai kecuali `metode_bayar` menyatakan lain (Fase B).
