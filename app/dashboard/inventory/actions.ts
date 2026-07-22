"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

async function requireAuth() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;
  const { data: pengguna } = await supabase
    .from("pengguna")
    .select("level")
    .eq("username", user.email?.split("@")[0])
    .single();
  return pengguna?.level === "ADMIN" || pengguna?.level === "OWNER";
}

interface ProductData {
  nama_produk: string;
  id_kategori: number;
  id_satuan: number;
  hitung_stok: boolean;
  sku: string | null;
  barcode: string | null;
  harga_modal: number;
  harga_jual_satuan: number;
  harga_jual_grosir: number;
  harga_jual_promo: number | null;
  diskon: number;
  stok_minimum: number;
  base_unit?: string;
  default_purchase_unit?: string | null;
  conversion_ratio?: number;
}

export async function addProduct(data: ProductData) {
  const ok = await requireAuth();
  if (!ok) return { error: "Unauthorized" };

  const supabase = await createClient();
  const { error } = await supabase.from("produk").insert([data]);
  if (error) {
    console.error("Failed to add product:", error);
    return { error: "Gagal menambah produk" };
  }
  revalidatePath("/dashboard/inventory");
  return { success: true };
}

export async function updateProduct(id: number, data: ProductData) {
  const ok = await requireAuth();
  if (!ok) return { error: "Unauthorized" };

  const supabase = await createClient();
  const { error } = await supabase.from("produk").update(data).eq("id", id);
  if (error) {
    console.error("Failed to update product:", error);
    return { error: "Gagal memperbarui produk" };
  }
  revalidatePath("/dashboard/inventory");
  return { success: true };
}

export async function deleteProduct(id: number) {
  const ok = await requireAuth();
  if (!ok) return { error: "Unauthorized" };

  const supabase = await createClient();
  const { error } = await supabase.from("produk").delete().eq("id", id);
  if (error) {
    console.error("Failed to delete product:", error);
    return { error: "Gagal menghapus produk" };
  }
  revalidatePath("/dashboard/inventory");
  return { success: true };
}

export async function restockDisplay(productId: number, qty: number) {
  const ok = await requireAuth();
  if (!ok) return { error: "Unauthorized" };

  const supabase = await createClient();

  if (qty <= 0) return { error: "Jumlah harus lebih dari 0" };

  const { data: product, error: fetchError } = await supabase
    .from("produk")
    .select("stok, stok_gudang")
    .eq("id", productId)
    .single();

  if (fetchError || !product) {
    console.error("Failed to fetch product:", fetchError);
    return { error: "Produk tidak ditemukan" };
  }

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

  if (updateError) {
    console.error("Failed to restock display:", updateError);
    return { error: "Gagal memindahkan stok" };
  }

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
