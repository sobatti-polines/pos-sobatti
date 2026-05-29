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
