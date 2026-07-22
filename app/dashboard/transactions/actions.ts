"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function voidTransaction(id: number) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  const { data: pengguna } = await supabase
    .from("pengguna")
    .select("level")
    .eq("username", user.email?.split("@")[0])
    .single();
  if (!pengguna || (pengguna.level !== "ADMIN" && pengguna.level !== "OWNER"))
    return { error: "Forbidden" };

  // Delete details first due to foreign key constraints
  const { error: detailError } = await supabase
    .from("detail_transaksi_keluar")
    .delete()
    .eq("id_transaksi", id);

  if (detailError) {
    console.error("Failed to void transaction details:", detailError);
    return { error: "Gagal menghapus transaksi" };
  }

  const { error: txError } = await supabase
    .from("transaksi_keluar")
    .delete()
    .eq("id", id);

  if (txError) {
    console.error("Failed to void transaction:", txError);
    return { error: "Gagal menghapus transaksi" };
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
    
  if (error) {
    console.error("Failed to get transaction details:", error);
    return { error: "Gagal mengambil detail transaksi" };
  }
  return { data };
}
