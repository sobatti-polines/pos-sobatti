"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

interface StockOpnameData {
  id_produk: number;
  stok_sistem: number;
  stok_fisik: number;
  selisih: number;
  keterangan: string;
}

export async function saveStockOpname(data: StockOpnameData) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  const { error } = await supabase
    .from("stok_opname")
    .insert({
      id_produk: data.id_produk,
      stok_sistem: data.stok_sistem,
      stok_fisik: data.stok_fisik,
      selisih: data.selisih,
      keterangan: data.keterangan || null,
      tgl_opname: new Date().toISOString().split('T')[0]
    });

  if (error) {
    console.error("Failed to save stock opname:", error);
    return { error: "Gagal menyimpan stok opname" };
  }

  revalidatePath("/dashboard/inventory");
  revalidatePath("/dashboard/inventory/stock-opname");
  return { success: true };
}
