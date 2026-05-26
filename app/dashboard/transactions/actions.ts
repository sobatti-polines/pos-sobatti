"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function voidTransaction(id: number) {
  const supabase = await createClient();

  // Delete details first due to foreign key constraints
  const { error: detailError } = await supabase
    .from("detail_transaksi_keluar")
    .delete()
    .eq("id_transaksi", id);

  if (detailError) {
    return { error: detailError.message };
  }

  const { error: txError } = await supabase
    .from("transaksi_keluar")
    .delete()
    .eq("id", id);

  if (txError) {
    return { error: txError.message };
  }

  revalidatePath("/dashboard/transactions");
  revalidatePath("/dashboard");
  return { success: true };
}

export async function getTransactionDetails(id: number) {
  const supabase = await createClient();
  
  const { data, error } = await supabase
    .from("detail_transaksi_keluar")
    .select(`
      id,
      qty,
      harga_jual,
      jumlah,
      produk(nama_produk)
    `)
    .eq("id_transaksi", id);
    
  if (error) return { error: error.message };
  return { data };
}
