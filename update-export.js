const fs = require('fs');
let file = fs.readFileSync('app/dashboard/inventory/inventory-client.tsx', 'utf8');

const csvTarget = `    const headers = [
      "Nama Produk",
      "SKU / Kode Produk",
      "Barcode",
      "Kategori",
      "Satuan Dasar",
      "Merk / Brand",
      "Lokasi / Rak",
      "Hitung Stok (ya/tidak)",
      "Harga Modal / Beli",
      "Harga Jual Eceran",
      "Harga Jual Grosir",
      "Harga Jual Promo",
      "Diskon per Item (Rp)",
      "Stok di Rak / Display",
      "Stok di Gudang",
      "Stok Minimum",
      "Stok Minimum Gudang",
      "Satuan Beli dari Supplier",
      "Isi per Satuan Beli",
      "Satuan Jual Besar",
      "Produk Master (ID)",
      "Qty Isi per Paket",
      "Jenis Isi Paket",
      "Satuan Isi Paket",
      "HPP (AVCO)",
      "Total Aset",
      "Harga Besar",
    ];`;

const csvReplacement = `    const allHeaders = [
      "Nama Produk",
      "SKU / Kode Produk",
      "Barcode",
      "Kategori",
      "Satuan Dasar",
      "Merk / Brand",
      "Lokasi / Rak",
      "Hitung Stok (ya/tidak)",
      "Harga Modal / Beli",
      "Harga Jual Eceran",
      "Harga Jual Grosir",
      "Harga Jual Promo",
      "Diskon per Item (Rp)",
      "Stok di Rak / Display",
      "Stok di Gudang",
      "Stok Minimum",
      "Stok Minimum Gudang",
      "Satuan Beli dari Supplier",
      "Isi per Satuan Beli",
      "Satuan Jual Besar",
      "Produk Master (ID)",
      "Qty Isi per Paket",
      "Jenis Isi Paket",
      "Satuan Isi Paket",
      "HPP (AVCO)",
      "Total Aset",
      "Harga Besar",
    ];
    const headers = isOwner ? allHeaders : allHeaders.filter((_, i) => ![8, 24, 25].includes(i));`;

const csvDataTarget = `    const data = filteredData.map(p => [
      p.nama_produk,
      p.sku || "",
      p.barcode || "",
      p.kategori?.nama || "",
      p.satuan?.nama || "",
      merks.find((m) => m.id === p.id_merk)?.nama || "",
      p.lokasi_area?.nama || "",
      p.hitung_stok ? "ya" : "tidak",
      p.harga_modal ?? 0,
      p.harga_jual_satuan ?? 0,
      p.harga_jual_grosir ?? 0,
      p.harga_jual_promo ?? "",
      p.diskon ?? 0,
      p.stock ?? 0,
      p.stok_gudang ?? 0,
      p.stok_minimum ?? 5,
      p.stok_minimum_gudang ?? "",
      p.default_purchase_unit ?? "",
      p.conversion_ratio ?? 1,
      p.jual_satuan ?? "",
      p.id_produk_master ?? "",
      p.qty_per_unit ?? "",
      p.jenis_isi_paket ?? "",
      p.isi_satuan ?? "",
      p.harga_pokok_avco ?? 0,
      p.nilai_persediaan ?? 0,
      bigPriceOf(p) ?? "",
    ]);`;

const csvDataReplacement = `    const data = filteredData.map(p => {
      const row = [
        p.nama_produk,
        p.sku || "",
        p.barcode || "",
        p.kategori?.nama || "",
        p.satuan?.nama || "",
        merks.find((m) => m.id === p.id_merk)?.nama || "",
        p.lokasi_area?.nama || "",
        p.hitung_stok ? "ya" : "tidak",
        p.harga_modal ?? 0,
        p.harga_jual_satuan ?? 0,
        p.harga_jual_grosir ?? 0,
        p.harga_jual_promo ?? "",
        p.diskon ?? 0,
        p.stock ?? 0,
        p.stok_gudang ?? 0,
        p.stok_minimum ?? 5,
        p.stok_minimum_gudang ?? "",
        p.default_purchase_unit ?? "",
        p.conversion_ratio ?? 1,
        p.jual_satuan ?? "",
        p.id_produk_master ?? "",
        p.qty_per_unit ?? "",
        p.jenis_isi_paket ?? "",
        p.isi_satuan ?? "",
        p.harga_pokok_avco ?? 0,
        p.nilai_persediaan ?? 0,
        bigPriceOf(p) ?? "",
      ];
      return isOwner ? row : row.filter((_, i) => ![8, 24, 25].includes(i));
    });`;

const pdfTarget = `    const headers = ["SKU", "Barcode", "Item", "Kategori", "Lokasi", "Stok Display", "Stok Gudang", "Harga Modal", "HPP (AVCO)", "Total Aset", "Harga Retail", "Harga Grosir", "Harga Promo", "Harga Besar"];`;
const pdfReplacement = `    const allHeaders = ["SKU", "Barcode", "Item", "Kategori", "Lokasi", "Stok Display", "Stok Gudang", "Harga Modal", "HPP (AVCO)", "Total Aset", "Harga Retail", "Harga Grosir", "Harga Promo", "Harga Besar"];
    const headers = isOwner ? allHeaders : allHeaders.filter((_, i) => ![7, 8, 9].includes(i));`;

const pdfDataTarget = `    const data = filteredData.map(p => [
      p.sku || "-", p.barcode || "-", p.nama_produk, p.kategori?.nama || "-",
      p.lokasi_area?.nama || "-",
      p.hitung_stok ? String(p.stock || 0) : "Tidak dilacak", p.hitung_stok ? String(p.stok_gudang) : "-",
      formatIDR(p.harga_modal), formatIDR(p.harga_pokok_avco), formatIDR(p.nilai_persediaan),
      formatIDR(p.harga_jual_satuan), formatIDR(p.harga_jual_grosir), p.harga_jual_promo ? formatIDR(p.harga_jual_promo) : "-",
      bigPriceOf(p) != null ? formatIDR(bigPriceOf(p)!) : "-"
    ]);`;
const pdfDataReplacement = `    const data = filteredData.map(p => {
      const row = [
        p.sku || "-", p.barcode || "-", p.nama_produk, p.kategori?.nama || "-",
        p.lokasi_area?.nama || "-",
        p.hitung_stok ? String(p.stock || 0) : "Tidak dilacak", p.hitung_stok ? String(p.stok_gudang) : "-",
        formatIDR(p.harga_modal), formatIDR(p.harga_pokok_avco), formatIDR(p.nilai_persediaan),
        formatIDR(p.harga_jual_satuan), formatIDR(p.harga_jual_grosir), p.harga_jual_promo ? formatIDR(p.harga_jual_promo) : "-",
        bigPriceOf(p) != null ? formatIDR(bigPriceOf(p)!) : "-"
      ];
      return isOwner ? row : row.filter((_, i) => ![7, 8, 9].includes(i));
    });`;

file = file.replace(csvTarget, csvReplacement);
file = file.replace(csvDataTarget, csvDataReplacement);
file = file.replace(pdfTarget, pdfReplacement);
file = file.replace(pdfDataTarget, pdfDataReplacement);

fs.writeFileSync('app/dashboard/inventory/inventory-client.tsx', file);
console.log('done updating inventory-client.tsx');
