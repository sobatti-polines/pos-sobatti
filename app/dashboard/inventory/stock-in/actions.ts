"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { logActivity, buildDeskripsi } from "@/lib/activity-log";

async function getAuthUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { supabase: null, pengguna: null };

  const username = user.email?.split("@")[0];
  const { data: pengguna } = await supabase
    .from("pengguna")
    .select("id, level, username")
    .eq("username", username)
    .single();

  return { supabase, pengguna };
}

function requireAdmin(pengguna: { level: string } | null): string | null {
  if (!pengguna) return "Unauthorized";
  if (pengguna.level !== "ADMIN" && pengguna.level !== "OWNER") {
    return "Akses ditolak — hanya ADMIN/OWNER";
  }
  return null;
}

const voidStockInSchema = z.object({
  id: z.number().int().positive("ID barang masuk tidak valid"),
  alasan: z.string().trim().min(1, "Alasan pembatalan wajib diisi"),
});

const updateStockInSchema = z.object({
  id: z.number().int().positive("ID barang masuk tidak valid"),
  tgl_masuk: z
    .string()
    .min(1, "Tanggal harus diisi")
    .refine((v) => !isNaN(new Date(v).getTime()), "Tanggal tidak valid"),
  no_surat: z.string().optional(),
  keterangan: z.string().optional(),
});

const returItemSchema = z.object({
  id_produk: z.number().int().positive("ID produk tidak valid"),
  qty_retur: z.number().positive("Qty retur harus lebih dari 0"),
  keterangan: z.string().optional(),
});

const createReturSchema = z.object({
  id_barang_masuk: z.number().int().positive("ID barang masuk tidak valid"),
  items: z.array(returItemSchema).min(1, "Minimal 1 item retur harus diisi"),
  keterangan: z.string().optional(),
});

const getBarangMasukSchema = z.object({
  id_barang_masuk: z.number().int().positive("ID barang masuk tidak valid"),
});

const stockInRowSchema = z.object({
  id_produk: z.number().int().positive("ID produk tidak valid"),
  supplied_qty: z.number().positive("Jumlah suplai harus lebih dari 0"),
  supplied_unit: z.string().min(1, "Satuan suplai harus diisi"),
  total_cost: z.number().positive("Total harga harus lebih dari 0"),
  tgl_masuk: z.string().min(1, "Tanggal harus diisi"),
  id_supplier: z.number().int().positive("Supplier harus dipilih"),
  keterangan: z.string().optional(),
  no_surat: z.string().optional(),
});

export async function addStockIn(
  rows: z.infer<typeof stockInRowSchema>[]
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
    .select("id, nama_produk, hitung_stok, conversion_ratio, default_purchase_unit, id_produk_master")
    .in("id", productIds);

  if (prodError) {
    console.error("Failed to validate products:", prodError);
    return { error: "Gagal memvalidasi data produk" };
  }

  const productMap = new Map(products?.map((p) => [p.id, p]) ?? []);
  for (const row of rows) {
    const prod = productMap.get(row.id_produk);
    if (!prod) {
      return { error: `Produk dengan ID ${row.id_produk} tidak ditemukan` };
    }
    if (prod.id_produk_master) {
      return { error: `Produk "${row.id_produk}" adalah produk paket — gunakan menu "Isi Stok Paket" di halaman Inventaris` };
    }
    if (prod.hitung_stok === false) {
      return { error: `Produk "${prod.nama_produk}" tidak terhitung stoknya — tidak bisa ditambahkan ke barang masuk` };
    }
    if (!prod.conversion_ratio || prod.conversion_ratio < 1) {
      return { error: `Produk ID ${row.id_produk} belum memiliki rasio konversi yang valid` };
    }
  }

  // Call the atomic RPC — all inserts, AVCO calculation, UoM conversion,
  // and stock update happen in a single advisory-locked transaction
  const { data, error: rpcError } = await supabase.rpc(
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
        no_surat: r.no_surat?.trim() || null,
      })),
    }
  );

  if (rpcError) {
    console.error("Stock-in RPC error:", rpcError);
    const msg = rpcError.message ?? "Unknown error";
    if (/does not exist/i.test(msg)) {
      return { error: "Gagal memproses barang masuk: skema database belum lengkap — pastikan semua migration sudah dijalankan. Detail: " + msg };
    }
    if (/division by zero/i.test(msg)) {
      return { error: "Gagal memproses barang masuk: rasio konversi produk (conversion_ratio) bernilai 0 — perbaiki rasio produk terlebih dahulu" };
    }
    if (/tidak terhitung stoknya/i.test(msg)) {
      return { error: "Produk tidak terhitung stoknya — tidak bisa ditambahkan ke barang masuk" };
    }
    return { error: "Gagal memproses barang masuk: " + msg };
  }

  await logActivity(supabase, {
    aksi: "CREATE",
    entitas: "barang_masuk",
    deskripsi: buildDeskripsi({ aksi: "CREATE", entitas: "barang_masuk", data_baru: { jumlah_item: rows.length } as unknown as Record<string, unknown> }),
    data_baru: { items: rows.map(r => ({ id_produk: r.id_produk, supplied_qty: r.supplied_qty, total_cost: r.total_cost })) } as unknown as Record<string, unknown>,
  });

  revalidatePath("/dashboard/inventory");
  revalidatePath("/dashboard/inventory/stock-in/history");

  // Inserted row ids (from RPC { success, inserted: [{ id, ... }] }) —
  // used by the form to offer "Cetak Dokumen" right after saving.
  const inserted = Array.isArray(
    (data as { inserted?: { id: number }[] } | null)?.inserted
  )
    ? (data as { inserted: { id: number }[] }).inserted.map((r) => r.id)
    : [];

  return { success: true, inserted };
}

export async function voidBarangMasuk(id: number, alasan: string) {
  const { supabase, pengguna } = await getAuthUser();
  if (!supabase) return { error: "Unauthorized" };

  const err = requireAdmin(pengguna);
  if (err) return { error: err };

  const parsed = voidStockInSchema.safeParse({ id, alasan });
  if (!parsed.success) {
    const messages = parsed.error.issues.map((issue) => issue.message);
    return { error: messages.join(". ") };
  }

  const { data, error: rpcError } = await supabase.rpc(
    "cancel_barang_masuk",
    {
      p_id_barang_masuk: parsed.data.id,
      p_id_pengguna: pengguna!.id,
      p_alasan: parsed.data.alasan,
    }
  );

  if (rpcError) {
    console.error("Void barang masuk RPC error:", rpcError);
    const msg = rpcError.message ?? "Unknown error";
    if (/does not exist/i.test(msg)) {
      return { error: "Gagal membatalkan barang masuk: fungsi database belum tersedia — pastikan semua migration sudah dijalankan. Detail: " + msg };
    }
    return { error: "Gagal membatalkan barang masuk: " + msg };
  }

  if (data?.error) {
    const msg = String(data.error);
    if (/sudah di-void/i.test(msg)) {
      return { error: "Barang masuk sudah dibatalkan sebelumnya" };
    }
    if (/tidak ditemukan/i.test(msg)) {
      return { error: "Barang masuk tidak ditemukan" };
    }
    return { error: "Gagal membatalkan barang masuk: " + msg };
  }

  await logActivity(supabase, {
    aksi: "DELETE",
    entitas: "barang_masuk",
    id_entitas: parsed.data.id,
    deskripsi: `Membatalkan Barang Masuk ID ${parsed.data.id}: ${parsed.data.alasan}`,
    data_lama: { id: parsed.data.id, alasan: parsed.data.alasan } as unknown as Record<string, unknown>,
  });

  revalidatePath("/dashboard/inventory");
  revalidatePath("/dashboard/inventory/stock-in/history");
  return { success: true };
}

export async function getBarangMasukForRetur(
  data: z.infer<typeof getBarangMasukSchema>
) {
  const { supabase, pengguna } = await getAuthUser();
  if (!supabase) return { error: "Unauthorized" };

  const err = requireAdmin(pengguna);
  if (err) return { error: err };

  const parsed = getBarangMasukSchema.safeParse(data);
  if (!parsed.success) {
    const messages = parsed.error.issues.map((issue) => issue.message);
    return { error: messages.join(". ") };
  }

  const { data: bm, error } = await supabase
    .from("barang_masuk")
    .select(`
      id,
      tgl_masuk,
      status,
      no_surat,
      supplied_unit,
      supplied_qty,
      applied_conversion_ratio,
      base_qty_added,
      total_cost,
      id_supplier,
      supplier(id, nama_supplier),
      produk(
        id,
        nama_produk,
        sku,
        conversion_ratio,
        default_purchase_unit,
        stok_gudang,
        satuan(nama)
      )
    `)
    .eq("id", parsed.data.id_barang_masuk)
    .single();

  if (error || !bm) {
    console.error("Get barang masuk for retur error:", error);
    return { error: "Barang masuk tidak ditemukan" };
  }

  if (bm.status === "DIVOID") {
    return { error: "Barang masuk sudah dibatalkan — tidak bisa dibuat retur" };
  }

  return {
    success: true,
    barangMasuk: {
      id: bm.id,
      tgl_masuk: bm.tgl_masuk,
      no_surat: bm.no_surat,
      supplied_unit: bm.supplied_unit,
      supplied_qty: bm.supplied_qty,
      applied_conversion_ratio: bm.applied_conversion_ratio,
      base_qty_added: bm.base_qty_added,
      total_cost: bm.total_cost,
      id_supplier: bm.id_supplier,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      supplier: Array.isArray(bm.supplier) ? bm.supplier[0] ?? null : (bm.supplier as any) ?? null,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      produk: Array.isArray(bm.produk) ? bm.produk[0] ?? null : (bm.produk as any) ?? null,
    },
  };
}

export async function createReturPembelian(
  data: z.infer<typeof createReturSchema>
) {
  const { supabase, pengguna } = await getAuthUser();
  if (!supabase) return { error: "Unauthorized" };

  const err = requireAdmin(pengguna);
  if (err) return { error: err };

  const parsed = createReturSchema.safeParse(data);
  if (!parsed.success) {
    const messages = parsed.error.issues.map((issue) => issue.message);
    return { error: messages.join(". ") };
  }

  // Cegah produk duplikat dalam satu retur — RPC akan menghitung qty double.
  const productIds = parsed.data.items.map((i) => i.id_produk);
  if (new Set(productIds).size !== productIds.length) {
    return { error: "Terdapat produk duplikat dalam satu retur" };
  }

  const { data: result, error: rpcError } = await supabase.rpc(
    "process_retur_pembelian",
    {
      p_id_barang_masuk: parsed.data.id_barang_masuk,
      p_id_pengguna: pengguna!.id,
      p_items: parsed.data.items.map((i) => ({
        id_produk: i.id_produk,
        qty_retur: i.qty_retur,
        keterangan: i.keterangan?.trim() || null,
      })),
      p_keterangan: parsed.data.keterangan?.trim() || null,
    }
  );

  if (rpcError) {
    console.error("Retur pembelian RPC error:", rpcError);
    const msg = rpcError.message ?? "Unknown error";
    if (/does not exist/i.test(msg)) {
      return { error: "Gagal membuat retur: fungsi database belum tersedia — pastikan semua migration sudah dijalankan. Detail: " + msg };
    }
    return { error: "Gagal membuat retur: " + msg };
  }

  if (result?.error) {
    const msg = String(result.error);
    if (/Barang masuk sudah dibatalkan/i.test(msg)) {
      return { error: "Barang masuk sudah dibatalkan — tidak bisa dibuat retur" };
    }
    if (/Item retur tidak boleh kosong/i.test(msg)) {
      return { error: "Item retur tidak boleh kosong" };
    }
    if (/Stok gudang tidak mencukupi/i.test(msg)) {
      return { error: msg };
    }
    if (/Qty retur harus lebih dari 0/i.test(msg)) {
      return { error: msg };
    }
    if (/Barang masuk tidak ditemukan/i.test(msg)) {
      return { error: "Barang masuk tidak ditemukan" };
    }
    if (/Produk tidak ditemukan/i.test(msg)) {
      return { error: msg };
    }
    return { error: "Gagal membuat retur: " + msg };
  }

  await logActivity(supabase, {
    aksi: "CREATE",
    entitas: "retur_pembelian",
    deskripsi: buildDeskripsi({
      aksi: "CREATE",
      entitas: "retur_pembelian",
      data_baru: {
        no_retur: result?.no_retur,
        jumlah_item: parsed.data.items.length,
      } as unknown as Record<string, unknown>,
    }),
    data_baru: {
      id_barang_masuk: parsed.data.id_barang_masuk,
      no_retur: result?.no_retur,
      jumlah_item: parsed.data.items.length,
    } as unknown as Record<string, unknown>,
  });

  revalidatePath("/dashboard/inventory");
  revalidatePath("/dashboard/inventory/stock-in/history");
  revalidatePath("/dashboard/inventory/stock-in/retur/history");
  return { success: true, ...result };
}

export async function updateBarangMasuk(data: z.infer<typeof updateStockInSchema>) {
  const { supabase, pengguna } = await getAuthUser();
  if (!supabase) return { error: "Unauthorized" };

  const err = requireAdmin(pengguna);
  if (err) return { error: err };

  const parsed = updateStockInSchema.safeParse(data);
  if (!parsed.success) {
    const messages = parsed.error.issues.map((issue) => issue.message);
    return { error: messages.join(". ") };
  }

  const { id, tgl_masuk, no_surat, keterangan } = parsed.data;

  const { data: existing, error: fetchError } = await supabase
    .from("barang_masuk")
    .select("id, status, tgl_masuk, keterangan, no_surat")
    .eq("id", id)
    .single();

  if (fetchError || !existing) {
    return { error: "Barang masuk tidak ditemukan" };
  }

  if (existing.status === "DIVOID") {
    return { error: "Barang masuk sudah dibatalkan — tidak bisa diedit" };
  }

  // Hanya field ringan: kembali qty/harga/produk/supplier TIDAK diizinkan di sini.
  // Untuk mengubah itu, void dahulu lalu input ulang.
  const { error: updateError } = await supabase
    .from("barang_masuk")
    .update({
      tgl_masuk,
      no_surat: no_surat?.trim() || null,
      keterangan: keterangan?.trim() || null,
    })
    .eq("id", id);

  if (updateError) {
    console.error("Update barang masuk error:", updateError);
    return { error: "Gagal mengubah barang masuk: " + updateError.message };
  }

  await logActivity(supabase, {
    aksi: "UPDATE",
    entitas: "barang_masuk",
    id_entitas: id,
    deskripsi: buildDeskripsi({
      aksi: "UPDATE",
      entitas: "barang_masuk",
      id_entitas: id,
      data_lama: {
        tgl_masuk: existing.tgl_masuk,
        no_surat: existing.no_surat,
        keterangan: existing.keterangan,
      } as unknown as Record<string, unknown>,
      data_baru: {
        tgl_masuk,
        no_surat: no_surat?.trim() || null,
        keterangan: keterangan?.trim() || null,
      } as unknown as Record<string, unknown>,
    }),
    data_lama: {
      tgl_masuk: existing.tgl_masuk,
      no_surat: existing.no_surat,
      keterangan: existing.keterangan,
    } as unknown as Record<string, unknown>,
    data_baru: {
      tgl_masuk,
      no_surat: no_surat?.trim() || null,
      keterangan: keterangan?.trim() || null,
    } as unknown as Record<string, unknown>,
  });

  revalidatePath("/dashboard/inventory");
  revalidatePath("/dashboard/inventory/stock-in/history");
  return { success: true };
}
