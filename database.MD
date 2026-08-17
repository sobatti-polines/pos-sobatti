
## Table `kategori`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `int4` | Primary |
| `nama` | `varchar` |  Unique |

## Table `satuan`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `int4` | Primary |
| `nama` | `varchar` |  Unique |

## Table `metode_bayar`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `int4` | Primary |
| `nama` | `varchar` |  Unique |

## Table `pengguna`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `int4` | Primary |
| `username` | `varchar` |  Unique |
| `password` | `varchar` |  |
| `level` | `varchar` |  |
| `aktif` | `bool` |  |
| `created_at` | `timestamp` |  |
| `nama` | `text` |  Nullable |

## Table `supplier`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `int4` | Primary |
| `nama_supplier` | `varchar` |  |
| `alamat` | `text` |  Nullable |
| `telepon` | `varchar` |  Nullable |
| `email` | `varchar` |  Nullable |
| `keterangan` | `text` |  Nullable |
| `created_at` | `timestamp` |  |

## Table `pelanggan`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `int4` | Primary |
| `nama_pelanggan` | `varchar` |  |
| `alamat` | `text` |  Nullable |
| `no_hp` | `varchar` |  Nullable |
| `email` | `varchar` |  Nullable |
| `keterangan` | `text` |  Nullable |
| `created_at` | `timestamp` |  |
| `point` | `int4` |  |

## Table `produk`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `int4` | Primary |
| `nama_produk` | `varchar` |  |
| `id_kategori` | `int4` |  Nullable |
| `id_satuan` | `int4` |  Nullable |
| `hitung_stok` | `bool` |  |
| `harga_modal` | `numeric` |  |
| `harga_jual_satuan` | `numeric` |  |
| `harga_jual_grosir` | `numeric` |  Nullable |
| `harga_jual_promo` | `numeric` |  Nullable |
| `diskon` | `numeric` |  |
| `created_at` | `timestamp` |  |
| `updated_at` | `timestamp` |  |
| `stok_minimum` | `int4` |  |
| `barcode` | `text` |  Nullable Unique |
| `stok` | `numeric` |  Nullable |
| `harga_pokok_avco` | `numeric` |  Nullable |
| `nilai_persediaan` | `numeric` |  Nullable |
| `stok_gudang` | `numeric` |  Nullable |
| `sku` | `varchar` |  Nullable Unique |
| `id_merk` | `int4` |  Nullable |
| `default_purchase_unit` | `varchar` |  Nullable |
| `conversion_ratio` | `numeric` |  |
| `jual_satuan` | `text` |  Nullable |
| `harga_jual_besar_satuan` | `numeric` |  Nullable |
| `harga_jual_besar_grosir` | `numeric` |  Nullable |
| `harga_jual_besar_promo` | `numeric` |  Nullable |
| `id_produk_master` | `int4` |  Nullable |
| `qty_per_unit` | `numeric` |  Nullable |
| `id_lokasi_area` | `int4` |  Nullable |
| `jenis_isi_paket` | `text` |  Nullable |
| `isi_satuan` | `text` |  Nullable |
| `stok_minimum_gudang` | `numeric` |  Nullable |

## Table `transaksi_keluar`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `int4` | Primary |
| `no_transaksi` | `int8` |  Unique |
| `tgl_transaksi` | `timestamp` |  |
| `id_kasir` | `int4` |  |
| `id_pelanggan` | `int4` |  Nullable |
| `id_metode_bayar` | `int4` |  Nullable |
| `subtotal` | `numeric` |  |
| `diskon_persen` | `numeric` |  |
| `diskon_nominal` | `numeric` |  |
| `pajak_persen` | `numeric` |  |
| `pajak_nominal` | `numeric` |  |
| `total` | `numeric` |  |
| `bayar` | `numeric` |  |
| `kembali` | `numeric` |  |
| `dp` | `numeric` |  |
| `sisa` | `numeric` |  |
| `created_at` | `timestamp` |  |
| `total_hpp` | `numeric` |  Nullable |
| `laba_kotor` | `numeric` |  Nullable |

## Table `detail_transaksi_keluar`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `int4` | Primary |
| `id_transaksi` | `int4` |  |
| `id_produk` | `int4` |  |
| `type_harga_jual` | `varchar` |  Nullable |
| `harga_modal` | `numeric` |  |
| `harga_jual` | `numeric` |  |
| `diskon_item` | `numeric` |  |
| `qty` | `numeric` |  |
| `jumlah` | `numeric` |  |
| `kas_masuk` | `numeric` |  |
| `profit` | `numeric` |  |
| `harga_pokok_satuan` | `numeric` |  Nullable |
| `total_harga_pokok` | `numeric` |  Nullable |
| `satuan_jual` | `text` |  Nullable |
| `qty_satuan` | `int4` |  Nullable |
| `jual_ratio` | `numeric` |  Nullable |

## Table `barang_masuk`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `int4` | Primary |
| `tgl_masuk` | `date` |  |
| `id_supplier` | `int4` |  Nullable |
| `id_produk` | `int4` |  |
| `harga_beli` | `numeric` |  |
| `jumlah` | `numeric` |  |
| `total` | `numeric` |  |
| `created_at` | `timestamp` |  |
| `keterangan` | `text` |  Nullable |
| `supplied_unit` | `varchar` |  Nullable |
| `supplied_qty` | `numeric` |  Nullable |
| `applied_conversion_ratio` | `numeric` |  Nullable |
| `base_qty_added` | `numeric` |  Nullable |
| `total_cost` | `numeric` |  Nullable |
| `base_cost_per_piece` | `numeric` |  Nullable |
| `no_surat` | `text` |  Nullable |
| `status` | `text` |  |
| `voided_at` | `timestamptz` |  Nullable |
| `voided_by` | `int8` |  Nullable |
| `alasan_void` | `text` |  Nullable |

## Table `stok_opname`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `int4` | Primary |
| `tgl_opname` | `date` |  |
| `id_produk` | `int4` |  |
| `stok_sistem` | `numeric` |  |
| `stok_fisik` | `numeric` |  |
| `selisih` | `numeric` |  |
| `keterangan` | `text` |  Nullable |
| `created_at` | `timestamp` |  |
| `id_sesi` | `uuid` |  Nullable |
| `id_pengguna` | `int8` |  Nullable |
| `klasifikasi` | `text` |  Nullable |
| `harga_pokok_snap` | `numeric` |  Nullable |

## Table `pengaturan`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `int4` | Primary |
| `nama_toko` | `varchar` |  Nullable |
| `alamat` | `text` |  Nullable |
| `telepon` | `varchar` |  Nullable |
| `email` | `varchar` |  Nullable |
| `nama_kasir_aktif` | `varchar` |  Nullable |
| `metode_diskon` | `varchar` |  Nullable |
| `bank1_nama` | `varchar` |  Nullable |
| `bank1_rekening` | `varchar` |  Nullable |
| `bank1_atas_nama` | `varchar` |  Nullable |
| `bank2_nama` | `varchar` |  Nullable |
| `bank2_rekening` | `varchar` |  Nullable |
| `bank2_atas_nama` | `varchar` |  Nullable |
| `footer_struk_1` | `varchar` |  Nullable |
| `footer_struk_2` | `varchar` |  Nullable |
| `footer_struk_3` | `varchar` |  Nullable |
| `footer_invoice_1` | `varchar` |  Nullable |
| `footer_invoice_2` | `varchar` |  Nullable |
| `footer_invoice_3` | `varchar` |  Nullable |
| `updated_at` | `timestamp` |  |
| `pajak_persen` | `numeric` |  Nullable |
| `jenis_nota` | `text` |  Nullable |
| `metode_cetak` | `text` |  Nullable |
| `logo_nota` | `bool` |  Nullable |
| `hormat_kami_nama` | `text` |  Nullable |
| `poin_min_pembelian` | `numeric` |  |

## Table `absensi`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `int8` | Primary |
| `id_pengguna` | `int4` |  |
| `tanggal` | `date` |  |
| `jam_masuk` | `timestamp` |  Nullable |
| `jam_pulang` | `timestamp` |  Nullable |
| `status` | `varchar` |  |
| `telat_menit` | `int4` |  Nullable |
| `latitude` | `numeric` |  Nullable |
| `longitude` | `numeric` |  Nullable |
| `foto_masuk` | `text` |  Nullable |
| `foto_pulang` | `text` |  Nullable |
| `device_info` | `text` |  Nullable |
| `created_at` | `timestamp` |  Nullable |

## Table `qr_session`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `int8` | Primary |
| `token` | `text` |  Unique |
| `expired_at` | `timestamptz` |  |
| `is_active` | `bool` |  Nullable |
| `created_by` | `int4` |  Nullable |
| `created_at` | `timestamp` |  Nullable |

## Table `riwayat_avco`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `id_produk` | `int4` |  |
| `tanggal` | `timestamptz` |  |
| `jenis_mutasi` | `text` |  |
| `id_referensi` | `int4` |  Nullable |
| `qty_masuk` | `numeric` |  Nullable |
| `qty_keluar` | `numeric` |  Nullable |
| `harga_satuan_transaksi` | `numeric` |  Nullable |
| `stok_sebelum` | `numeric` |  |
| `avco_sebelum` | `numeric` |  |
| `stok_sesudah` | `numeric` |  |
| `avco_sesudah` | `numeric` |  |
| `nilai_persediaan_sesudah` | `numeric` |  |
| `id_referensi_uuid` | `uuid` |  Nullable |

## Table `saldo_kas_harian`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `tanggal` | `date` |  Unique |
| `saldo_awal` | `numeric` |  |
| `total_masuk` | `numeric` |  |
| `total_keluar` | `numeric` |  |
| `saldo_akhir` | `numeric` |  Nullable |
| `uang_aktual` | `numeric` |  Nullable |
| `selisih` | `numeric` |  Nullable |
| `dikonfirmasi` | `bool` |  Nullable |
| `id_pengguna` | `int4` |  Nullable |
| `created_at` | `timestamptz` |  Nullable |
| `uang_awal` | `numeric` |  Nullable |

## Table `pengaturan_keuangan`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `modal_awal` | `numeric` |  |
| `tanggal_mulai` | `date` |  |
| `nama_pemilik` | `text` |  Nullable |
| `npwp` | `text` |  Nullable |
| `updated_at` | `timestamptz` |  Nullable |

## Table `merk`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `int4` | Primary |
| `nama` | `varchar` |  Unique |
| `kode` | `varchar` |  Unique |

## Table `log_aktivitas`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `id_pengguna` | `int4` |  |
| `aksi` | `text` |  |
| `entitas` | `text` |  |
| `id_entitas` | `int4` |  Nullable |
| `deskripsi` | `text` |  |
| `data_lama` | `jsonb` |  Nullable |
| `data_baru` | `jsonb` |  Nullable |
| `ip_address` | `text` |  Nullable |
| `created_at` | `timestamptz` |  |

## Table `sesi_stok_opname`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `no_sesi` | `text` |  Unique |
| `tgl_sesi` | `date` |  |
| `status` | `text` |  |
| `id_pengguna` | `int8` |  Nullable |
| `total_item` | `int4` |  Nullable |
| `total_selisih` | `numeric` |  Nullable |
| `total_nilai` | `numeric` |  Nullable |
| `keterangan` | `text` |  Nullable |
| `created_at` | `timestamptz` |  Nullable |
| `applied_at` | `timestamptz` |  Nullable |

## Table `lokasi_area`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `int4` | Primary |
| `nama` | `varchar` |  Unique |

## Table `retur_pembelian`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `no_retur` | `text` |  Unique |
| `tgl_retur` | `date` |  |
| `id_barang_masuk` | `int8` |  |
| `id_supplier` | `int8` |  Nullable |
| `id_pengguna` | `int8` |  Nullable |
| `total_nilai` | `numeric` |  Nullable |
| `keterangan` | `text` |  Nullable |
| `created_at` | `timestamptz` |  Nullable |

## Table `detail_retur_pembelian`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `id_retur` | `uuid` |  |
| `id_produk` | `int8` |  |
| `qty_retur` | `numeric` |  |
| `harga_pokok` | `numeric` |  |
| `jumlah` | `numeric` |  |
| `keterangan` | `text` |  Nullable |

## Table `kategori_beban`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `int4` | Primary |
| `nama` | `varchar` |  Unique |
| `kelompok` | `text` |  Nullable |

## Table `pengeluaran`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `tanggal` | `date` |  |
| `id_kategori_beban` | `int4` |  |
| `nama_pengeluaran` | `text` |  |
| `jumlah` | `numeric` |  |
| `metode_bayar` | `text` |  |
| `id_pengguna` | `int4` |  |
| `keterangan` | `text` |  Nullable |
| `status` | `text` |  |
| `created_at` | `timestamptz` |  |
| `voided_at` | `timestamptz` |  Nullable |
| `voided_by` | `int4` |  Nullable |
| `alasan_void` | `text` |  Nullable |

## Table `event_promo`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `nama` | `varchar` |  |
| `tanggal_mulai` | `date` |  |
| `tanggal_selesai` | `date` |  |
| `tipe_diskon` | `text` |  |
| `nilai_diskon` | `numeric` |  |
| `aktif` | `bool` |  |
| `keterangan` | `text` |  Nullable |
| `created_at` | `timestamptz` |  |
| `updated_at` | `timestamptz` |  |

## Table `event_promo_produk`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `id_event_promo` | `uuid` |  |
| `id_produk` | `int4` |  |
| `created_at` | `timestamptz` |  |

## Table `kas_admin_topup`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `tanggal` | `date` |  |
| `jumlah` | `numeric` |  |
| `keterangan` | `text` |  Nullable |
| `id_pengguna` | `int4` |  Nullable |
| `created_at` | `timestamptz` |  |

## RLS Policies

### `barang_masuk`

| Policy | Command | Roles | Action | USING | WITH CHECK |
|--------|---------|-------|--------|-------|------------|
| `auth_all` | ALL | authenticated | PERMISSIVE | `true` | `true` |

### `detail_transaksi_keluar`

| Policy | Command | Roles | Action | USING | WITH CHECK |
|--------|---------|-------|--------|-------|------------|
| `auth_all` | ALL | authenticated | PERMISSIVE | `true` | `true` |

### `kategori`

| Policy | Command | Roles | Action | USING | WITH CHECK |
|--------|---------|-------|--------|-------|------------|
| `auth_all` | ALL | authenticated | PERMISSIVE | `true` | `true` |

### `metode_bayar`

| Policy | Command | Roles | Action | USING | WITH CHECK |
|--------|---------|-------|--------|-------|------------|
| `auth_all` | ALL | authenticated | PERMISSIVE | `true` | `true` |

### `pelanggan`

| Policy | Command | Roles | Action | USING | WITH CHECK |
|--------|---------|-------|--------|-------|------------|
| `auth_all` | ALL | authenticated | PERMISSIVE | `true` | `true` |

### `pengaturan`

| Policy | Command | Roles | Action | USING | WITH CHECK |
|--------|---------|-------|--------|-------|------------|
| `auth_all` | ALL | authenticated | PERMISSIVE | `true` | `true` |

### `pengguna`

| Policy | Command | Roles | Action | USING | WITH CHECK |
|--------|---------|-------|--------|-------|------------|
| `auth_all` | ALL | authenticated | PERMISSIVE | `true` | `true` |

### `produk`

| Policy | Command | Roles | Action | USING | WITH CHECK |
|--------|---------|-------|--------|-------|------------|
| `auth_all` | ALL | authenticated | PERMISSIVE | `true` | `true` |

### `satuan`

| Policy | Command | Roles | Action | USING | WITH CHECK |
|--------|---------|-------|--------|-------|------------|
| `auth_all` | ALL | authenticated | PERMISSIVE | `true` | `true` |

### `stok_opname`

| Policy | Command | Roles | Action | USING | WITH CHECK |
|--------|---------|-------|--------|-------|------------|
| `auth_all` | ALL | authenticated | PERMISSIVE | `true` | `true` |
| `authenticated users can select stok_opname` | SELECT | authenticated | PERMISSIVE | `true` | — |
| `authenticated users can insert stok_opname` | INSERT | authenticated | PERMISSIVE | — | `true` |
| `authenticated users can update stok_opname` | UPDATE | authenticated | PERMISSIVE | `true` | `true` |
| `authenticated users can delete stok_opname` | DELETE | authenticated | PERMISSIVE | `true` | — |

### `supplier`

| Policy | Command | Roles | Action | USING | WITH CHECK |
|--------|---------|-------|--------|-------|------------|
| `auth_all` | ALL | authenticated | PERMISSIVE | `true` | `true` |

### `transaksi_keluar`

| Policy | Command | Roles | Action | USING | WITH CHECK |
|--------|---------|-------|--------|-------|------------|
| `auth_all` | ALL | authenticated | PERMISSIVE | `true` | `true` |

### `qr_session`

| Policy | Command | Roles | Action | USING | WITH CHECK |
|--------|---------|-------|--------|-------|------------|
| `auth_all` | ALL | authenticated | PERMISSIVE | `true` | `true` |

### `absensi`

| Policy | Command | Roles | Action | USING | WITH CHECK |
|--------|---------|-------|--------|-------|------------|
| `auth_all` | ALL | authenticated | PERMISSIVE | `true` | `true` |

### `riwayat_avco`

| Policy | Command | Roles | Action | USING | WITH CHECK |
|--------|---------|-------|--------|-------|------------|
| `Authenticated users can insert riwayat_avco` | INSERT | authenticated | PERMISSIVE | — | `true` |
| `Authenticated users can select riwayat_avco` | SELECT | authenticated | PERMISSIVE | `true` | — |

### `log_aktivitas`

| Policy | Command | Roles | Action | USING | WITH CHECK |
|--------|---------|-------|--------|-------|------------|
| `auth_can_select_log_aktivitas` | SELECT | authenticated | PERMISSIVE | `true` | — |

### `sesi_stok_opname`

| Policy | Command | Roles | Action | USING | WITH CHECK |
|--------|---------|-------|--------|-------|------------|
| `authenticated users can select sesi_stok_opname` | SELECT | authenticated | PERMISSIVE | `true` | — |
| `authenticated users can insert sesi_stok_opname` | INSERT | authenticated | PERMISSIVE | — | `true` |
| `authenticated users can update sesi_stok_opname` | UPDATE | authenticated | PERMISSIVE | `true` | `true` |
| `authenticated users can delete sesi_stok_opname` | DELETE | authenticated | PERMISSIVE | `true` | — |

### `retur_pembelian`

| Policy | Command | Roles | Action | USING | WITH CHECK |
|--------|---------|-------|--------|-------|------------|
| `authenticated users can select retur_pembelian` | SELECT | authenticated | PERMISSIVE | `true` | — |
| `authenticated users can insert retur_pembelian` | INSERT | authenticated | PERMISSIVE | — | `true` |

### `detail_retur_pembelian`

| Policy | Command | Roles | Action | USING | WITH CHECK |
|--------|---------|-------|--------|-------|------------|
| `authenticated users can select detail_retur_pembelian` | SELECT | authenticated | PERMISSIVE | `true` | — |
| `authenticated users can insert detail_retur_pembelian` | INSERT | authenticated | PERMISSIVE | — | `true` |

### `saldo_kas_harian`

| Policy | Command | Roles | Action | USING | WITH CHECK |
|--------|---------|-------|--------|-------|------------|
| `authenticated users can select saldo_kas_harian` | SELECT | authenticated | PERMISSIVE | `true` | — |
| `authenticated users can insert saldo_kas_harian` | INSERT | authenticated | PERMISSIVE | — | `true` |
| `authenticated users can update saldo_kas_harian` | UPDATE | authenticated | PERMISSIVE | `true` | `true` |
| `authenticated users can delete saldo_kas_harian` | DELETE | authenticated | PERMISSIVE | `true` | — |

### `pengaturan_keuangan`

| Policy | Command | Roles | Action | USING | WITH CHECK |
|--------|---------|-------|--------|-------|------------|
| `authenticated users can select pengaturan_keuangan` | SELECT | authenticated | PERMISSIVE | `true` | — |
| `authenticated users can insert pengaturan_keuangan` | INSERT | authenticated | PERMISSIVE | — | `true` |
| `authenticated users can update pengaturan_keuangan` | UPDATE | authenticated | PERMISSIVE | `true` | `true` |
| `authenticated users can delete pengaturan_keuangan` | DELETE | authenticated | PERMISSIVE | `true` | — |

### `event_promo_produk`

| Policy | Command | Roles | Action | USING | WITH CHECK |
|--------|---------|-------|--------|-------|------------|
| `Enable DELETE on event_promo_produk` | DELETE | authenticated | PERMISSIVE | `true` | — |
| `Enable SELECT on event_promo_produk` | SELECT | authenticated | PERMISSIVE | `true` | — |
| `Enable INSERT on event_promo_produk` | INSERT | authenticated | PERMISSIVE | — | `true` |
| `Enable UPDATE on event_promo_produk` | UPDATE | authenticated | PERMISSIVE | `true` | `true` |

### `kas_admin_topup`

| Policy | Command | Roles | Action | USING | WITH CHECK |
|--------|---------|-------|--------|-------|------------|
| `authenticated users can select kas_admin_topup` | SELECT | authenticated | PERMISSIVE | `true` | — |
| `authenticated users can insert kas_admin_topup` | INSERT | authenticated | PERMISSIVE | — | `true` |
| `authenticated users can update kas_admin_topup` | UPDATE | authenticated | PERMISSIVE | `true` | — |
| `authenticated users can delete kas_admin_topup` | DELETE | authenticated | PERMISSIVE | `true` | — |

### `merk`

| Policy | Command | Roles | Action | USING | WITH CHECK |
|--------|---------|-------|--------|-------|------------|
| `authenticated users can select merk` | SELECT | authenticated | PERMISSIVE | `true` | — |
| `authenticated users can insert merk` | INSERT | authenticated | PERMISSIVE | — | `true` |
| `authenticated users can update merk` | UPDATE | authenticated | PERMISSIVE | `true` | `true` |
| `authenticated users can delete merk` | DELETE | authenticated | PERMISSIVE | `true` | — |

### `lokasi_area`

| Policy | Command | Roles | Action | USING | WITH CHECK |
|--------|---------|-------|--------|-------|------------|
| `authenticated users can select lokasi_area` | SELECT | authenticated | PERMISSIVE | `true` | — |
| `authenticated users can insert lokasi_area` | INSERT | authenticated | PERMISSIVE | — | `true` |
| `authenticated users can update lokasi_area` | UPDATE | authenticated | PERMISSIVE | `true` | `true` |
| `authenticated users can delete lokasi_area` | DELETE | authenticated | PERMISSIVE | `true` | — |

### `kategori_beban`

| Policy | Command | Roles | Action | USING | WITH CHECK |
|--------|---------|-------|--------|-------|------------|
| `authenticated users can select kategori_beban` | SELECT | authenticated | PERMISSIVE | `true` | — |
| `authenticated users can insert kategori_beban` | INSERT | authenticated | PERMISSIVE | — | `true` |
| `authenticated users can update kategori_beban` | UPDATE | authenticated | PERMISSIVE | `true` | — |
| `authenticated users can delete kategori_beban` | DELETE | authenticated | PERMISSIVE | `true` | — |

### `pengeluaran`

| Policy | Command | Roles | Action | USING | WITH CHECK |
|--------|---------|-------|--------|-------|------------|
| `authenticated users can select pengeluaran` | SELECT | authenticated | PERMISSIVE | `true` | — |
| `authenticated users can insert pengeluaran` | INSERT | authenticated | PERMISSIVE | — | `true` |
| `authenticated users can update pengeluaran` | UPDATE | authenticated | PERMISSIVE | `true` | — |
| `authenticated users can delete pengeluaran` | DELETE | authenticated | PERMISSIVE | `true` | — |

### `event_promo`

| Policy | Command | Roles | Action | USING | WITH CHECK |
|--------|---------|-------|--------|-------|------------|
| `Enable SELECT on event_promo` | SELECT | authenticated | PERMISSIVE | `true` | — |
| `Enable INSERT on event_promo` | INSERT | authenticated | PERMISSIVE | — | `true` |
| `Enable UPDATE on event_promo` | UPDATE | authenticated | PERMISSIVE | `true` | `true` |
| `Enable DELETE on event_promo` | DELETE | authenticated | PERMISSIVE | `true` | — |

