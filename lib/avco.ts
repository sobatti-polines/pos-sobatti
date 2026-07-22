import { SupabaseClient } from "@supabase/supabase-js";

export function calculateNewAVCO(
  currentQty: number,
  currentAvco: number,
  incomingQty: number,
  incomingPrice: number
): { newAvco: number; newTotalValue: number; newQty: number } {
  const currentTotalValue = currentQty * currentAvco;
  const incomingTotalValue = incomingQty * incomingPrice;
  const newQty = currentQty + incomingQty;
  const newTotalValue = currentTotalValue + incomingTotalValue;
  const newAvco = newQty > 0 ? newTotalValue / newQty : 0;
  
  return { newAvco, newTotalValue, newQty };
}

export async function recordAVCOMutation(
  supabase: SupabaseClient,
  params: {
    id_produk: number;
    jenis_mutasi: 'pembelian' | 'penjualan' | 'koreksi' | 'retur_beli' | 'retur_jual';
    id_referensi?: number;
    qty_masuk?: number;
    qty_keluar?: number;
    harga_satuan_transaksi: number;
  }
) {
  // Get current product stock, warehouse stock, and avco
  const { data: prod, error: prodErr } = await supabase
    .from("produk")
    .select("stok, stok_gudang, harga_pokok_avco, nilai_persediaan")
    .eq("id", params.id_produk)
    .single();

  if (prodErr || !prod) {
    console.error("Product not found for AVCO mutation:", prodErr);
    throw new Error("Gagal memproses mutasi AVCO: produk tidak ditemukan");
  }

  const currentDisplayStok = prod.stok ?? 0;
  const currentGudangStok = prod.stok_gudang ?? 0;
  const currentTotalStok = currentDisplayStok + currentGudangStok;
  const currentAvco = prod.harga_pokok_avco ?? 0;

  let newGudangStok = currentGudangStok;
  let newDisplayStok = currentDisplayStok;
  let newAvco = currentAvco;
  let newNilaiPersediaan = prod.nilai_persediaan ?? (currentTotalStok * currentAvco);

  const qtyMasuk = params.qty_masuk ?? 0;
  const qtyKeluar = params.qty_keluar ?? 0;

  if (params.jenis_mutasi === 'pembelian' && qtyMasuk > 0) {
    // Pembelian adds to warehouse stock, AVCO calculated from total stock
    const calc = calculateNewAVCO(currentTotalStok, currentAvco, qtyMasuk, params.harga_satuan_transaksi);
    newGudangStok = currentGudangStok + qtyMasuk;
    newAvco = calc.newAvco;
    newNilaiPersediaan = calc.newTotalValue;
  } else if (params.jenis_mutasi === 'penjualan' && qtyKeluar > 0) {
    newDisplayStok = currentDisplayStok - qtyKeluar;
    newNilaiPersediaan = (newDisplayStok + currentGudangStok) * currentAvco;
  } else {
    const newTotal = currentTotalStok + qtyMasuk - qtyKeluar;
    if (qtyMasuk > 0) {
      newGudangStok += qtyMasuk;
      newNilaiPersediaan += qtyMasuk * params.harga_satuan_transaksi;
      newAvco = newTotal > 0 ? newNilaiPersediaan / newTotal : 0;
    } else if (qtyKeluar > 0) {
      newDisplayStok -= qtyKeluar;
      if (newDisplayStok < 0) {
        newGudangStok += newDisplayStok;
        newDisplayStok = 0;
      }
      newNilaiPersediaan -= qtyKeluar * currentAvco;
    }
  }

  const newTotalStok = newDisplayStok + newGudangStok;

  // Insert to riwayat_avco
  const { error: historyErr } = await supabase.from("riwayat_avco").insert({
    id_produk: params.id_produk,
    jenis_mutasi: params.jenis_mutasi,
    id_referensi: params.id_referensi,
    qty_masuk: qtyMasuk > 0 ? qtyMasuk : null,
    qty_keluar: qtyKeluar > 0 ? qtyKeluar : null,
    harga_satuan_transaksi: params.harga_satuan_transaksi,
    stok_sebelum: currentTotalStok,
    avco_sebelum: currentAvco,
    stok_sesudah: newTotalStok,
    avco_sesudah: newAvco,
    nilai_persediaan_sesudah: newNilaiPersediaan
  });

  if (historyErr) {
    console.error("Failed to record AVCO history:", historyErr);
    throw new Error("Gagal menyimpan riwayat AVCO");
  }

  // Update produk
  const { error: updateErr } = await supabase
    .from("produk")
    .update({
      stok: newDisplayStok,
      stok_gudang: newGudangStok,
      harga_pokok_avco: newAvco,
      nilai_persediaan: newNilaiPersediaan
    })
    .eq("id", params.id_produk);

  if (updateErr) {
    console.error("Failed to update product AVCO:", updateErr);
    throw new Error("Gagal memperbarui harga pokok AVCO");
  }
}
