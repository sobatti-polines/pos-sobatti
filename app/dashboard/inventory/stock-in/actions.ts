"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const stockInRowSchema = z.object({
  id_produk: z.number().int().positive("ID produk tidak valid"),
  supplied_qty: z.number().positive("Jumlah suplai harus lebih dari 0"),
  supplied_unit: z.string().min(1, "Satuan suplai harus diisi"),
  total_cost: z.number().positive("Total harga harus lebih dari 0"),
  tgl_masuk: z.string().min(1, "Tanggal harus diisi"),
  id_supplier: z.number().int().positive("Supplier harus dipilih"),
  keterangan: z.string().optional(),
});

export async function addStockIn(
  rows: z.infer<typeof stockInRowSchema>[],
  paymentType?: "Tunai" | "Kredit",
  tanggalJatuhTempo?: string | null
) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { error: "Unauthorized" };
  }

  // Validate every row
  for (let i = 0; i < rows.length; i++) {
    const parsed = stockInRowSchema.safeParse(rows[i]);
    if (!parsed.success) {
      const messages = parsed.error.issues
        .map((issue) => `Baris ${i + 1}: ${issue.message}`);
      return { error: messages.join(". ") };
    }
  }

  if (rows.length === 0) {
    return { error: "Minimal 1 item harus diisi" };
  }

  // Server-side: verify conversion_ratio for every product
  const productIds = [...new Set(rows.map((r) => r.id_produk))];
  const { data: products, error: prodError } = await supabase
    .from("produk")
    .select("id, conversion_ratio, default_purchase_unit, base_unit")
    .in("id", productIds);

  if (prodError) {
    return { error: "Gagal memvalidasi data produk: " + prodError.message };
  }

  const productMap = new Map(products?.map((p) => [p.id, p]) ?? []);
  for (const row of rows) {
    const prod = productMap.get(row.id_produk);
    if (!prod) {
      return { error: `Produk dengan ID ${row.id_produk} tidak ditemukan` };
    }
    if (!prod.conversion_ratio || prod.conversion_ratio < 1) {
      return { error: `Produk ID ${row.id_produk} belum memiliki rasio konversi yang valid` };
    }
  }

  // Call the atomic RPC — all inserts, AVCO calculation, UoM conversion,
  // and stock update happen in a single advisory-locked transaction
  const { data: rpcResult, error: rpcError } = await supabase.rpc(
    "process_barang_masuk",
    {
      p_items: rows.map((r) => ({
        id_produk: r.id_produk,
        supplied_qty: r.supplied_qty,
        supplied_unit: r.supplied_unit,
        total_cost: r.total_cost,
        tgl_masuk: r.tgl_masuk,
        id_supplier: r.id_supplier,
        keterangan: r.keterangan || null,
      })),
    }
  );

  if (rpcError) {
    return { error: rpcError.message };
  }

  const inserted = (rpcResult as any)?.inserted as
    | Array<{ id: number }>
    | undefined;

  // Handle hutang creation — soft-fail so the goods receipt is never rolled back
  if (inserted && inserted.length > 0 && paymentType === "Kredit") {
    const { createHutang } = await import("@/lib/hutang");
    const totalAmount = rows.reduce((acc, r) => acc + r.total_cost, 0);

    try {
      await createHutang(supabase, {
        id_supplier: rows[0].id_supplier,
        id_barang_masuk: inserted[0].id,
        tanggal_hutang: rows[0].tgl_masuk,
        tanggal_jatuh_tempo: tanggalJatuhTempo || null,
        jumlah_awal: totalAmount,
        catatan: "Otomatis dari Barang Masuk",
      });
    } catch (hutangErr) {
      const msg = hutangErr instanceof Error ? hutangErr.message : String(hutangErr);
      console.error("[addStockIn] Gagal membuat hutang dagang:", msg);
      return { success: true, warning: `Barang masuk berhasil, tapi hutang gagal dicatat: ${msg}` };
    }
  }

  revalidatePath("/dashboard/inventory");
  return { success: true };
}
