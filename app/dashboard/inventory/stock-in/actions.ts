"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

interface StockInRow {
  id_produk: number;
  jumlah: number;
  harga_beli: number;
  total: number;
  tgl_masuk: string;
  id_supplier: number;
  keterangan: string;
}

export async function addStockIn(rows: StockInRow[]) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { error: "Unauthorized" };
  }

  const { error } = await supabase.from("barang_masuk").insert(
    rows.map((r) => ({
      id_produk: r.id_produk,
      jumlah: r.jumlah,
      harga_beli: r.harga_beli,
      total: r.total,
      tgl_masuk: r.tgl_masuk,
      id_supplier: r.id_supplier,
      keterangan: r.keterangan || null,
    }))
  );

  if (error) return { error: error.message };

  // Update physical stock in produk table
  for (const row of rows) {
    const { data: prod } = await supabase
      .from("produk")
      .select("stok, hitung_stok")
      .eq("id", row.id_produk)
      .single();
    
    if (prod?.hitung_stok) {
      const currentStok = prod.stok ?? 0;
      await supabase
        .from("produk")
        .update({ stok: currentStok + row.jumlah })
        .eq("id", row.id_produk);
    }
  }

  revalidatePath("/dashboard/inventory");
  return { success: true };
}
