# Simulasi Kasir — Snapshot & Rollback

Panduan untuk melakukan **simulasi kasir dengan data dummy** — pembelian barang
(barang masuk) dan/atau transaksi penjualan POS — lalu mengembalikan (rollback)
semua data dummy beserta dampaknya ke stok, AVCO, dan poin member, sehingga
database kembali seperti sebelum simulasi.

> ⚠️ **Penting**: Script ini untuk **lingkungan pengujian** saja. Jangan jalankan
> rollback di database produksi yang sedang dipakai untuk aktivitas bisnis nyata.

---

## Alur yang terdampak saat simulasi (dari kode)

### Pembelian / Barang Masuk (RPC `process_barang_masuk`)

| Tabel | Aksi | Keterangan |
|-------|------|------------|
| `barang_masuk` | INSERT | 1 baris per item pembelian |
| `riwayat_avco` | INSERT | Mutasi `pembelian` |
| `produk` | UPDATE | `stok_gudang`, `harga_pokok_avco`, `nilai_persediaan`, `harga_modal` (jika kosong), `updated_at` |
| `log_aktivitas` | INSERT | Log aksi CREATE barang_masuk |

Void (`cancel_barang_masuk`) → `barang_masuk.status = 'DIVOID'` + mutasi AVCO `retur_beli` + log DELETE.
Retur pembelian (`process_retur_pembelian`) → `retur_pembelian` + `detail_retur_pembelian` + mutasi AVCO `retur_beli` + log CREATE.

### Penjualan / Checkout (RPC `process_checkout`)

| Tabel | Aksi | Keterangan |
|-------|------|------------|
| `transaksi_keluar` | INSERT | Header transaksi |
| `detail_transaksi_keluar` | INSERT | Item transaksi |
| `produk` | UPDATE | `stok` (display, fallback gudang), `harga_pokok_avco`, `nilai_persediaan` |
| `riwayat_avco` | INSERT | Mutasi `penjualan` |
| `pelanggan` | UPDATE | `point` +1 per kelipatan `poin_min_pembelian` (jika member) |
| `pelanggan` | INSERT | Member baru bila kasir mendaftarkan pelanggan di POS |

Seluruh dampak di atas **ditangani otomatis** oleh script rollback ini.

---

## Cara pakai

### 1. Snapshot (SEBELUM simulasi)

Buka **Supabase → SQL Editor**, jalankan `01_snapshot_sebelum_simulasi.sql`.

- Membuat 3 tabel: `_sim_snapshot_produk` (salinan stok & AVCO semua produk),
  `_sim_snapshot_pelanggan` (salinan poin member), dan `_sim_marker`
  (penanda waktu + ID maksimum barang_masuk).
- **Tidak menghapus / mengubah data apa pun** — aman.
- Jalankan sesegera mungkin sebelum simulasi, dan pastikan **tidak ada aktivitas
  bisnis nyata** di antara snapshot dan rollback (karena rollback menghapus semua
  data yang dibuat *setelah* waktu snapshot).

### 2. Lakukan simulasi

Lakukan simulasi seperti biasa lewat aplikasi — misalnya:
1. Input barang masuk dummy (**Inventaris → Barang Masuk**).
2. Transaksi kasir dummy (**POS**) — kasir menjual produk ke customer (member
   maupun non-member).
3. (Opsional) Void / retur pembelian untuk menguji alur tersebut.

Stok, AVCO, riwayat, poin member, dan log akan terisi otomatis.

### 3. Rollback (SETELAH simulasi selesai)

Jalankan `02_rollback_simulasi.sql` di SQL Editor yang sama.

Script akan:
1. Menghapus semua `transaksi_keluar` (+ detail), `barang_masuk`, `riwayat_avco`,
   `retur_pembelian` (+ detail), dan `log_aktivitas` yang dibuat sejak snapshot.
2. Menghapus **pelanggan baru** yang didaftarkan selama simulasi.
3. **Memulihkan `produk`** (stok, stok_gudang, harga_pokok_avco,
   nilai_persediaan, harga_modal) dan **poin member** ke kondisi persis
   sebelum simulasi.
4. Menampilkan query **verifikasi** — pastikan semua hasilnya `0`.

> Mengapa perlu snapshot? Karena AVCO dihitung berantai dari mutasi sebelumnya,
> memulihkan HPP dengan menghitung mundur manual sangat rawan salah. Menyalin
> state produk lalu mengembalikannya adalah cara yang deterministik dan aman.

---

## Opsional: simulasi yang lebih luas

Jika simulasi juga mencakup aktivitas lain, aktifkan blok yang sesuai di
**Bagian C** `02_rollback_simulasi.sql` (hapus tanda komentar):

| Aktivitas | Blok | Catatan |
|-----------|------|---------|
| Tutup kasir (`saldo_kas_harian`) | C.10 | Isi rentang tanggal simulasi |
| Pengeluaran operasional (`pengeluaran`) | C.11 | — |
| Stok opname (`stok_opname`, `sesi_stok_opname`) | C.12 | — |

Reset sequence (`barang_masuk`, `transaksi_keluar`) ada di **Bagian D**
(opsional, biasanya tidak perlu).

---

## Setelah selesai

Setelah yakin tidak perlu rollback lagi, bersihkan tabel bantu:

```sql
DROP TABLE IF EXISTS _sim_snapshot_produk;
DROP TABLE IF EXISTS _sim_snapshot_pelanggan;
DROP TABLE IF EXISTS _sim_marker;
```

> Catatan: snapshot baru (menjalankan ulang `01_...`) otomatis menimpa snapshot
> lama, jadi boleh diulang kapan saja.
