const fs = require('fs');
const content = fs.readFileSync('app/dashboard/inventory/actions.ts', 'utf8');

const newAction = `
export async function forceDeleteProduct(id: number) {
  const ok = await requireAuth();
  if (!ok) return { error: "Unauthorized" };

  const supabase = await createClient();

  const { data: oldProduct } = await supabase
    .from("produk")
    .select("nama_produk, sku, barcode")
    .eq("id", id)
    .single();

  // 1. Cek: apakah ada riwayat penjualan?
  const { data: sales } = await supabase
    .from("detail_transaksi_keluar")
    .select("id")
    .eq("id_produk", id)
    .limit(1);
  if (sales && sales.length > 0) {
    return { error: "Produk sudah memiliki riwayat penjualan. Hapus paksa dibatalkan karena akan merusak laporan kasir." };
  }

  // 2. Cek: apakah ada riwayat retur?
  const { data: returs } = await supabase
    .from("retur_pembelian_detail")
    .select("id")
    .eq("id_produk", id)
    .limit(1);
  if (returs && returs.length > 0) {
    return { error: "Produk sudah diretur ke supplier. Hapus paksa dibatalkan." };
  }

  // 3. Cek: apakah menjadi master produk paket?
  const { data: paketRefs } = await supabase
    .from("produk")
    .select("id")
    .eq("id_produk_master", id)
    .limit(1);
  if (paketRefs && paketRefs.length > 0) {
    return { error: "Produk tidak bisa dihapus karena masih menjadi master dari produk paket." };
  }

  // 4. Hapus secara berurutan
  await supabase.from("event_promo_produk").delete().eq("id_produk", id);
  await supabase.from("stok_opname_sesi_detail").delete().eq("id_produk", id);
  await supabase.from("stok_opname").delete().eq("id_produk", id);
  await supabase.from("barang_masuk").delete().eq("id_produk", id);
  await supabase.from("riwayat_avco").delete().eq("id_produk", id);

  // 5. Hapus produk
  const { error } = await supabase.from("produk").delete().eq("id", id);
  if (error) {
    console.error("Failed to force delete product:", error);
    return { error: "Gagal menghapus produk: " + error.message };
  }

  await logActivity(supabase, {
    aksi: "DELETE",
    entitas: "produk",
    id_entitas: id,
    deskripsi: "Force delete produk beserta riwayat (barang masuk, dll). " + (oldProduct?.nama_produk || ""),
    data_lama: oldProduct ? (oldProduct as unknown as Record<string, unknown>) : null,
  });

  revalidatePath("/dashboard/inventory");
  return { success: true };
}

`;

const splitText = 'export async function deleteProducts(ids: number[]) {';
if (content.includes(splitText)) {
  const parts = content.split(splitText);
  fs.writeFileSync('app/dashboard/inventory/actions.ts', parts[0] + newAction + splitText + parts[1]);
  console.log('actions.ts patched successfully');
} else {
  console.log('split text not found');
}
