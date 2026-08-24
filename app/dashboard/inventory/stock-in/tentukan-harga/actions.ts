"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { logActivity } from "@/lib/activity-log";
import type { PendingStockInItem } from "./types";

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

function requireOwner(pengguna: { level: string } | null): string | null {
  if (!pengguna) return "Unauthorized";
  if (pengguna.level !== "OWNER") {
    return "Akses ditolak — hanya OWNER";
  }
  return null;
}

// Schema untuk update harga barang masuk
const updateHargaSchema = z.object({
  id_barang_masuk: z.number().int().positive("ID barang masuk tidak valid"),
  harga_beli: z.number().min(0, "Harga beli tidak boleh negatif"),
});

const batchUpdateHargaSchema = z.object({
  items: z.array(updateHargaSchema).min(1, "Minimal 1 item harus diisi"),
});

const markNoPriceSchema = z.object({
  id_barang_masuk: z.number().int().positive("ID barang masuk tidak valid"),
});

/**
 * Tandai barang masuk sebagai "Tidak Ada Harga"
 */
export async function markTidakAdaHarga(data: z.infer<typeof markNoPriceSchema>) {
  const { supabase, pengguna } = await getAuthUser();
  if (!supabase) return { error: "Unauthorized" };

  const err = requireOwner(pengguna);
  if (err) return { error: err };

  const parsed = markNoPriceSchema.safeParse(data);
  if (!parsed.success) {
    const messages = parsed.error.issues.map((issue) => issue.message);
    return { error: messages.join(". ") };
  }

  // Update barang_masuk: tandai harga_ditentukan = true
  const { error: updateError } = await supabase
    .from("barang_masuk")
    .update({
      harga_ditentukan: true,
    })
    .eq("id", parsed.data.id_barang_masuk)
    .eq("status", "AKTIF");

  if (updateError) {
    console.error("Failed to mark no price:", updateError);
    return { error: "Gagal menandai barang masuk" };
  }

  await logActivity(supabase, {
    aksi: "UPDATE",
    entitas: "barang_masuk",
    id_entitas: parsed.data.id_barang_masuk,
    deskripsi: `Menandai Barang Masuk ID ${parsed.data.id_barang_masuk} sebagai tidak ada harga`,
    data_baru: { harga_ditentukan: true } as unknown as Record<string, unknown>,
  });

  revalidatePath("/dashboard/inventory");
  revalidatePath("/dashboard/inventory/stock-in/tentukan-harga");

  return { success: true };
}

/**
 * Ambil daftar barang masuk yang belum punya harga (harga_ditentukan = false)
 */
export async function getPendingStockIn() {
  const { supabase, pengguna } = await getAuthUser();
  if (!supabase) return { error: "Unauthorized" };

  const err = requireOwner(pengguna);
  if (err) return { error: err };

  // Ambil barang masuk AKTIF dengan total_cost = 0 atau harga_beli = 0
  const { data: pendingItems, error } = await supabase
    .from("barang_masuk")
    .select(`
      id,
      tgl_masuk,
      no_surat,
      supplied_unit,
      supplied_qty,
      applied_conversion_ratio,
      base_qty_added,
      total_cost,
      harga_beli,
      keterangan,
      id_supplier,
      id_produk,
      supplier(id, nama_supplier),
      produk(
        id,
        nama_produk,
        sku,
        barcode,
        conversion_ratio,
        stok_gudang,
        harga_pokok_avco,
        satuan(nama)
      )
    `)
    .eq("status", "AKTIF")
    .eq("harga_ditentukan", false)
    .order("tgl_masuk", { ascending: false })
    .order("id", { ascending: false });

  if (error) {
    console.error("Failed to fetch pending stock-in:", error);
    return { error: "Gagal mengambil data barang masuk" };
  }

  // Format data
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const items: PendingStockInItem[] = (pendingItems ?? []).map((item: any) => ({
    id: item.id,
    tgl_masuk: item.tgl_masuk,
    no_surat: item.no_surat,
    supplied_unit: item.supplied_unit,
    supplied_qty: item.supplied_qty,
    applied_conversion_ratio: item.applied_conversion_ratio,
    base_qty_added: item.base_qty_added,
    total_cost: item.total_cost,
    harga_beli: item.harga_beli,
    keterangan: item.keterangan,
    supplier: Array.isArray(item.supplier) ? item.supplier[0] ?? null : item.supplier ?? null,
    produk: Array.isArray(item.produk) ? item.produk[0] ?? null : item.produk ?? null,
  }));

  return { success: true, items };
}

/**
 * Update harga beli untuk satu atau beberapa barang masuk
 * dan hitung ulang AVCO
 */
export async function updateHargaBarangMasuk(data: z.infer<typeof batchUpdateHargaSchema>) {
  const { supabase, pengguna } = await getAuthUser();
  if (!supabase) return { error: "Unauthorized" };

  const err = requireOwner(pengguna);
  if (err) return { error: err };

  const parsed = batchUpdateHargaSchema.safeParse(data);
  if (!parsed.success) {
    const messages = parsed.error.issues.map((issue) => issue.message);
    return { error: messages.join(". ") };
  }

  // Proses setiap item
  const results: { id: number; success: boolean; error?: string }[] = [];

  for (const item of parsed.data.items) {
    try {
      // 1. Ambil data barang masuk
      const { data: bm, error: fetchError } = await supabase
        .from("barang_masuk")
        .select(`
          id,
          id_produk,
          base_qty_added,
          total_cost,
          harga_beli,
          status,
          produk(
            id,
            stok,
            stok_gudang,
            harga_pokok_avco,
            nilai_persediaan,
            conversion_ratio
          )
        `)
        .eq("id", item.id_barang_masuk)
        .single();

      if (fetchError || !bm) {
        results.push({ id: item.id_barang_masuk, success: false, error: "Barang masuk tidak ditemukan" });
        continue;
      }

      if (bm.status === "DIVOID") {
        results.push({ id: item.id_barang_masuk, success: false, error: "Barang masuk sudah dibatalkan" });
        continue;
      }

      // 2. Ambil data produk
      const produk = Array.isArray(bm.produk) ? bm.produk[0] : bm.produk;
      if (!produk) {
        results.push({ id: item.id_barang_masuk, success: false, error: "Produk tidak ditemukan" });
        continue;
      }

      // 3. Ambil riwayat AVCO sebelumnya (stok_sebelum, avco_sebelum)
      const { data: riwayat } = await supabase
        .from("riwayat_avco")
        .select("stok_sebelum, avco_sebelum")
        .eq("id_referensi", item.id_barang_masuk)
        .eq("jenis_mutasi", "pembelian")
        .single();

      const stokSebelum = riwayat?.stok_sebelum ?? 0;
      const avcoSebelum = riwayat?.avco_sebelum ?? 0;
      const qtyMasuk = bm.base_qty_added ?? 0;

      if (qtyMasuk <= 0) {
        results.push({ id: item.id_barang_masuk, success: false, error: "Qty masuk tidak valid" });
        continue;
      }

      // 4. Hitung AVCO baru
      const hargaBeliPerPcs = item.harga_beli / qtyMasuk;
      const totalNilaiSebelum = stokSebelum * avcoSebelum;
      const totalNilaiMasuk = item.harga_beli;
      const totalStokBaru = stokSebelum + qtyMasuk;

      let newAvco: number;
      if (totalStokBaru > 0) {
        newAvco = (totalNilaiSebelum + totalNilaiMasuk) / totalStokBaru;
      } else {
        newAvco = 0;
      }

      const newNilaiPersediaan = totalStokBaru * newAvco;

      // 5. Update barang_masuk
      const { error: updateBmError } = await supabase
        .from("barang_masuk")
        .update({
          total_cost: item.harga_beli,
          harga_beli: hargaBeliPerPcs,
          base_cost_per_piece: hargaBeliPerPcs,
        })
        .eq("id", item.id_barang_masuk);

      if (updateBmError) {
        console.error("Failed to update barang_masuk:", updateBmError);
        results.push({ id: item.id_barang_masuk, success: false, error: "Gagal update barang masuk" });
        continue;
      }

      // 6. Update riwayat AVCO
      const { error: updateRiwayatError } = await supabase
        .from("riwayat_avco")
        .update({
          harga_satuan_transaksi: hargaBeliPerPcs,
          avco_sesudah: newAvco,
          nilai_persediaan_sesudah: newNilaiPersediaan,
        })
        .eq("id_referensi", item.id_barang_masuk)
        .eq("jenis_mutasi", "pembelian");

      if (updateRiwayatError) {
        console.error("Failed to update riwayat_avco:", updateRiwayatError);
        // Lanjut meskipun gagal update riwayat
      }

      // 7. Update produk (AVCO & nilai_persediaan)
      const { error: updateProdukError } = await supabase
        .from("produk")
        .update({
          harga_pokok_avco: newAvco,
          nilai_persediaan: newNilaiPersediaan,
          harga_modal: produk.harga_pokok_avco === 0 || produk.harga_pokok_avco === null
            ? newAvco
            : produk.harga_pokok_avco,
          updated_at: new Date().toISOString(),
        })
        .eq("id", produk.id);

      if (updateProdukError) {
        console.error("Failed to update produk:", updateProdukError);
        results.push({ id: item.id_barang_masuk, success: false, error: "Gagal update produk" });
        continue;
      }

      results.push({ id: item.id_barang_masuk, success: true });
    } catch (error) {
      console.error("Error processing item:", error);
      results.push({ id: item.id_barang_masuk, success: false, error: "Terjadi kesalahan" });
    }
  }

  // Log aktivitas & update harga_ditentukan
  const successCount = results.filter((r) => r.success).length;
  const failCount = results.filter((r) => !r.success).length;

  if (successCount > 0) {
    // Tandai semua item yang berhasil sebagai harga_ditentukan = true
    const successIds = results.filter((r) => r.success).map((r) => r.id);
    await supabase
      .from("barang_masuk")
      .update({ harga_ditentukan: true })
      .in("id", successIds);

    await logActivity(supabase, {
      aksi: "UPDATE",
      entitas: "barang_masuk",
      deskripsi: `Menentukan harga untuk ${successCount} barang masuk${failCount > 0 ? ` (${failCount} gagal)` : ""}`,
      data_baru: {
        items: parsed.data.items.map((item) => ({
          id: item.id_barang_masuk,
          harga_beli: item.harga_beli,
        })),
      } as unknown as Record<string, unknown>,
    });
  }

  revalidatePath("/dashboard/inventory");
  revalidatePath("/dashboard/inventory/stock-in");
  revalidatePath("/dashboard/inventory/stock-in/history");
  revalidatePath("/dashboard/inventory/stock-in/tentukan-harga");

  const failedItems = results.filter((r) => !r.success);
  if (failedItems.length > 0) {
    const errorMessages = failedItems.map((r) => `ID ${r.id}: ${r.error}`).join("; ");
    return { success: true, warning: `${successCount} berhasil, ${failCount} gagal: ${errorMessages}` };
  }

  return { success: true, message: `${successCount} barang masuk berhasil diupdate` };
}
