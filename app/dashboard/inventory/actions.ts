"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

interface ProductData {
  nama_produk: string;
  id_kategori: number;
  id_satuan: number;
  hitung_stok: boolean;
  barcode: string | null;
  harga_modal: number;
  harga_jual_satuan: number;
  harga_jual_grosir: number;
  harga_jual_promo: number | null;
  diskon: number;
  stok_minimum: number;
}

export async function addProduct(data: ProductData) {
  const supabase = await createClient();
  const { error } = await supabase.from("produk").insert([data]);
  if (error) return { error: error.message };
  revalidatePath("/dashboard/inventory");
  return { success: true };
}

export async function updateProduct(id: number, data: ProductData) {
  const supabase = await createClient();
  const { error } = await supabase.from("produk").update(data).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/dashboard/inventory");
  return { success: true };
}

export async function deleteProduct(id: number) {
  const supabase = await createClient();
  const { error } = await supabase.from("produk").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/dashboard/inventory");
  return { success: true };
}

export async function restockDisplay(productId: number, qty: number) {
  const supabase = await createClient();

  if (qty <= 0) return { error: "Jumlah harus lebih dari 0" };

  const { data: product, error: fetchError } = await supabase
    .from("produk")
    .select("stok, stok_gudang")
    .eq("id", productId)
    .single();

  if (fetchError || !product) return { error: "Produk tidak ditemukan" };

  if (qty > product.stok_gudang) {
    return { error: `Stok gudang tidak mencukupi. Tersedia: ${product.stok_gudang}` };
  }

  const { error: updateError } = await supabase
    .from("produk")
    .update({
      stok: product.stok + qty,
      stok_gudang: product.stok_gudang - qty,
    })
    .eq("id", productId);

  if (updateError) return { error: updateError.message };

  revalidatePath("/dashboard/inventory");
  return { success: true };
}

export async function getProductMutationHistory(productId: number) {
  const supabase = await createClient();

  // 1. Fetch riwayat_avco — oldest first for sequential price comparison
  const { data: records, error } = await supabase
    .from("riwayat_avco")
    .select(
      "id, tanggal, jenis_mutasi, qty_masuk, qty_keluar, harga_satuan_transaksi, avco_sebelum, avco_sesudah, stok_sebelum, stok_sesudah, nilai_persediaan_sesudah, id_referensi"
    )
    .eq("id_produk", productId)
    .order("tanggal", { ascending: true })
    .limit(100);

  if (error) return { error: error.message };

  // 2. Batch-fetch supplier info for pembelian records
  const pembelianRefs = (records ?? [])
    .filter((r) => r.jenis_mutasi === "pembelian" && r.id_referensi != null)
    .map((r) => r.id_referensi)
    .filter(Boolean);

  const supplierMap: Record<number, { nama_supplier: string }> = {};

  if (pembelianRefs.length > 0) {
    const { data: barangMasuk } = await supabase
      .from("barang_masuk")
      .select("id, supplier!inner(nama_supplier)")
      .in("id", pembelianRefs);

    if (barangMasuk) {
      for (const bm of barangMasuk) {
        const s = (bm as any).supplier;
        supplierMap[bm.id] = s ?? { nama_supplier: "Supplier dihapus" };
      }
    }
  }

  // 3. Attach supplier to each record
  const enriched = (records ?? []).map((r) => ({
    ...r,
    supplier:
      r.jenis_mutasi === "pembelian" && r.id_referensi != null
        ? supplierMap[r.id_referensi] ?? null
        : null,
  }));

  return { data: enriched };
}
