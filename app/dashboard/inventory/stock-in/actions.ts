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

export async function addStockIn(
  rows: StockInRow[],
  paymentType?: "Tunai" | "Kredit",
  tanggalJatuhTempo?: string | null
) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { error: "Unauthorized" };
  }

  const { data: insertedRows, error } = await supabase.from("barang_masuk").insert(
    rows.map((r) => ({
      id_produk: r.id_produk,
      jumlah: r.jumlah,
      harga_beli: r.harga_beli,
      total: r.total,
      tgl_masuk: r.tgl_masuk,
      id_supplier: r.id_supplier,
      keterangan: r.keterangan || null,
    }))
  ).select("id, id_produk, jumlah, harga_beli");

  if (error) return { error: error.message };

  if (insertedRows && insertedRows.length > 0) {
    for (const row of insertedRows) {
      const { data: prod } = await supabase
        .from("produk")
        .select("hitung_stok")
        .eq("id", row.id_produk)
        .single();
      
      if (prod?.hitung_stok) {
        const { recordAVCOMutation } = await import("@/lib/avco");
        await recordAVCOMutation(supabase, {
          id_produk: row.id_produk,
          jenis_mutasi: "pembelian",
          id_referensi: row.id,
          qty_masuk: row.jumlah,
          harga_satuan_transaksi: row.harga_beli,
        });
      }
    }

    if (paymentType === "Kredit") {
      const { createHutang } = await import("@/lib/hutang");
      const totalAmount = rows.reduce((acc, r) => acc + r.total, 0);
      const supplierId = rows[0].id_supplier;
      const tglMasuk = rows[0].tgl_masuk;

      try {
        await createHutang(supabase, {
          id_supplier: supplierId,
          id_barang_masuk: insertedRows[0].id,
          tanggal_hutang: tglMasuk,
          tanggal_jatuh_tempo: tanggalJatuhTempo || null,
          jumlah_awal: totalAmount,
          catatan: "Otomatis dari Barang Masuk",
        });
      } catch (err: any) {
        console.error("Failed to create hutang:", err);
        // Continue, as goods are already received
      }
    }
  }

  revalidatePath("/dashboard/inventory");
  return { success: true };
}
