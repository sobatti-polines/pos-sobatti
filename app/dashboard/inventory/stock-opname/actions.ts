"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { logActivity, buildDeskripsi } from "@/lib/activity-log";

export async function saveStockOpname(data: {
  id_produk: number;
  stok_sistem: number;
  stok_fisik: number;
  selisih: number;
  keterangan: string;
}) {
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

  await logActivity(supabase, {
    aksi: "CREATE",
    entitas: "stok_opname",
    id_entitas: data.id_produk,
    deskripsi: buildDeskripsi({ aksi: "CREATE", entitas: "stok_opname", id_entitas: data.id_produk, data_baru: data as unknown as Record<string, unknown> }),
    data_baru: data as unknown as Record<string, unknown>,
  });

  revalidatePath("/dashboard/inventory");
  revalidatePath("/dashboard/inventory/stock-opname");
  return { success: true };
}

const opnameItemSchema = z.object({
  id_produk: z.number().int().positive("ID produk tidak valid"),
  stok_fisik: z.number().min(0, "Stok fisik tidak boleh negatif"),
  keterangan: z.string().optional(),
});

const bulkOpnameSchema = z.object({
  tgl_opname: z.string().min(1, "Tanggal harus diisi"),
  items: z.array(opnameItemSchema).min(1, "Minimal 1 item"),
});

export type BulkStockOpnameInput = z.infer<typeof bulkOpnameSchema>;

export async function saveBulkStockOpname(input: BulkStockOpnameInput) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { error: "Unauthorized" };
  }

  const parsed = bulkOpnameSchema.safeParse(input);
  if (!parsed.success) {
    const messages = parsed.error.issues.map(i => i.message);
    return { error: messages.join(". ") };
  }

  const { tgl_opname, items } = parsed.data;

  // Filter out invalid rows (no product selected)
  const validItems = items.filter(item => item.id_produk > 0 && item.stok_fisik >= 0);

  if (validItems.length === 0) {
    return { error: "Tidak ada data valid untuk disimpan" };
  }

  const { error: rpcError } = await supabase.rpc("process_stock_opname", {
    p_items: validItems.map((item) => ({
      id_produk: item.id_produk,
      stok_fisik: item.stok_fisik,
      keterangan: item.keterangan || null,
      tgl_opname,
    })),
  });

  if (rpcError) {
    console.error("Stock opname RPC error:", rpcError);
    return { error: "Gagal memproses stok opname: " + rpcError.message };
  }

  await logActivity(supabase, {
    aksi: "CREATE",
    entitas: "stok_opname",
    deskripsi: buildDeskripsi({ aksi: "CREATE", entitas: "stok_opname", data_baru: { jumlah_item: validItems.length } as unknown as Record<string, unknown> }),
  });

  revalidatePath("/dashboard/inventory/stock-opname");
  revalidatePath("/dashboard/inventory");
  return { success: true };
}
