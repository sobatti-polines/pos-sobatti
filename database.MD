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

## Table `produk`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `int4` | Primary |
| `nama_produk` | `varchar` |  Unique |
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

## Table `hutang_dagang`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `id_barang_masuk` | `int4` |  Nullable |
| `id_supplier` | `int4` |  |
| `tanggal_hutang` | `date` |  |
| `tanggal_jatuh_tempo` | `date` |  Nullable |
| `jumlah_awal` | `numeric` |  |
| `jumlah_terbayar` | `numeric` |  |
| `sisa_hutang` | `numeric` |  Nullable |
| `status` | `text` |  |
| `catatan` | `text` |  Nullable |
| `created_at` | `timestamptz` |  Nullable |
| `updated_at` | `timestamptz` |  Nullable |

## Table `pembayaran_hutang`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `id_hutang` | `uuid` |  |
| `tanggal_bayar` | `date` |  |
| `jumlah_bayar` | `numeric` |  |
| `metode_bayar` | `text` |  |
| `bukti_bayar` | `text` |  Nullable |
| `id_pengguna` | `int4` |  |
| `catatan` | `text` |  Nullable |
| `created_at` | `timestamptz` |  Nullable |

## Table `piutang_dagang`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `id_transaksi_keluar` | `int4` |  Nullable |
| `id_pelanggan` | `int4` |  |
| `tanggal_piutang` | `date` |  |
| `tanggal_jatuh_tempo` | `date` |  Nullable |
| `jumlah_awal` | `numeric` |  |
| `jumlah_terbayar` | `numeric` |  |
| `sisa_piutang` | `numeric` |  Nullable |
| `status` | `text` |  |
| `catatan` | `text` |  Nullable |
| `created_at` | `timestamptz` |  Nullable |
| `updated_at` | `timestamptz` |  Nullable |

## Table `pembayaran_piutang`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `id_piutang` | `uuid` |  |
| `tanggal_bayar` | `date` |  |
| `jumlah_bayar` | `numeric` |  |
| `metode_bayar` | `text` |  |
| `id_pengguna` | `int4` |  |
| `catatan` | `text` |  Nullable |
| `created_at` | `timestamptz` |  Nullable |

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

