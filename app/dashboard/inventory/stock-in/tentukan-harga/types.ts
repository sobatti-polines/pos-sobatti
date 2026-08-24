export interface PendingStockInItem {
  id: number;
  tgl_masuk: string;
  no_surat: string | null;
  supplied_unit: string | null;
  supplied_qty: number | null;
  applied_conversion_ratio: number | null;
  base_qty_added: number | null;
  total_cost: number;
  harga_beli: number;
  keterangan: string | null;
  supplier: { nama_supplier: string } | null;
  produk: {
    id: number;
    nama_produk: string;
    sku: string | null;
    barcode: string | null;
    conversion_ratio: number;
    stok_gudang: number;
    harga_pokok_avco: number | null;
    satuan: { nama: string } | null;
  } | null;
}
