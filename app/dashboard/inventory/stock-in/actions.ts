"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const stockInRowSchema = z.object({
  id_produk: z.number().int().positive("ID produk tidak valid"),
  jumlah: z.number().positive("Jumlah harus lebih dari 0"),
  harga_beli: z.number().positive("Harga beli harus lebih dari 0"),
  total: z.number().nonnegative(),
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

  // Call the atomic RPC — all inserts, AVCO calculation, and stock update
  // happen in a single advisory-locked transaction
  const { data: rpcResult, error: rpcError } = await supabase.rpc(
    "process_barang_masuk",
    {
      p_items: rows.map((r) => ({
        id_produk: r.id_produk,
        jumlah: r.jumlah,
        harga_beli: r.harga_beli,
        total: r.total,
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
    const totalAmount = rows.reduce((acc, r) => acc + r.total, 0);

    try {
      await createHutang(supabase, {
        id_supplier: rows[0].id_supplier,
        id_barang_masuk: inserted[0].id,
        tanggal_hutang: rows[0].tgl_masuk,
        tanggal_jatuh_tempo: tanggalJatuhTempo || null,
        jumlah_awal: totalAmount,
        catatan: "Otomatis dari Barang Masuk",
      });
    } catch {
      // Goods already received; hutang can be created manually if needed
    }
  }

  revalidatePath("/dashboard/inventory");
  return { success: true };
}
