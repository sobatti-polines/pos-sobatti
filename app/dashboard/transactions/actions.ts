"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { logActivity, buildDeskripsi } from "@/lib/activity-log";
import { isAdminOrOwnerLike } from "@/lib/roles";

export async function voidTransaction(id: number) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  const { data: pengguna } = await supabase
    .from("pengguna")
    .select("level")
    .eq("username", user.email?.split("@")[0])
    .single();
  if (!pengguna || !isAdminOrOwnerLike(pengguna.level))
    return { error: "Forbidden" };

  // 1. Fetch transaction details BEFORE deleting, so stock & AVCO can be restored
  const { data: details, error: fetchErr } = await supabase
    .from("detail_transaksi_keluar")
    .select("id_produk, qty, harga_pokok_satuan")
    .eq("id_transaksi", id);

  if (fetchErr) {
    console.error("Failed to fetch transaction details:", fetchErr);
    return { error: "Gagal mengambil detail transaksi" };
  }

  // 2. Restore stock & AVCO for each item (reverse of process_checkout)
  for (const d of details ?? []) {
    const { data: product, error: prodErr } = await supabase
      .from("produk")
      .select("stok, stok_gudang, harga_pokok_avco, nilai_persediaan, hitung_stok")
      .eq("id", d.id_produk)
      .single();

    if (prodErr || !product) {
      console.error("Failed to fetch product for void:", prodErr, d.id_produk);
      continue;
    }

    const qty = Number(d.qty ?? 0);
    if (qty <= 0 || product.hitung_stok === false) continue;

    // Re-add qty to display stock first, remainder to warehouse
    const newDisplayStok = Number(product.stok ?? 0) + qty;
    const currentAvco = Number(product.harga_pokok_avco ?? 0);
    const newNilaiPersediaan = (newDisplayStok + Number(product.stok_gudang ?? 0)) * currentAvco;

    const { error: updateErr } = await supabase
      .from("produk")
      .update({
        stok: newDisplayStok,
        nilai_persediaan: newNilaiPersediaan,
      })
      .eq("id", d.id_produk);

    if (updateErr) {
      console.error("Failed to restore stock on void:", updateErr);
      return { error: "Gagal mengembalikan stok produk" };
    }

    // Record AVCO correction so neraca (get_inventory_value_at_date) stays consistent
    await supabase.from("riwayat_avco").insert({
      id_produk: d.id_produk,
      jenis_mutasi: "retur_jual",
      id_referensi: id,
      qty_masuk: qty,
      harga_satuan_transaksi: Number(d.harga_pokok_satuan ?? 0),
      stok_sebelum: Number(product.stok ?? 0) + Number(product.stok_gudang ?? 0),
      avco_sebelum: currentAvco,
      stok_sesudah: newDisplayStok + Number(product.stok_gudang ?? 0),
      avco_sesudah: currentAvco,
      nilai_persediaan_sesudah: newNilaiPersediaan,
    });
  }

  // 3. Update status to 'dibatalkan' instead of deleting
  const { error: txError } = await supabase
    .from("transaksi_keluar")
    .update({ status: 'dibatalkan' })
    .eq("id", id);

  if (txError) {
    console.error("Failed to void transaction:", txError);
    return { error: "Gagal membatalkan transaksi" };
  }

  await logActivity(supabase, {
    aksi: "UPDATE",
    entitas: "transaksi_keluar",
    id_entitas: id,
    deskripsi: buildDeskripsi({ aksi: "UPDATE", entitas: "transaksi_keluar", id_entitas: id }) + " (Void / Dibatalkan)",
  });

  revalidatePath("/dashboard", "layout");
  revalidatePath("/pos", "layout");
  return { success: true };
}

export async function updatePaymentMethod(id: number, id_metode_bayar: number) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  const { data: pengguna } = await supabase
    .from("pengguna")
    .select("level")
    .eq("username", user.email?.split("@")[0])
    .single();
  
  if (!pengguna || !isAdminOrOwnerLike(pengguna.level))
    return { error: "Forbidden" };

  const { error } = await supabase
    .from("transaksi_keluar")
    .update({ id_metode_bayar })
    .eq("id", id);

  if (error) {
    console.error("Failed to update payment method:", error);
    return { error: "Gagal mengubah metode pembayaran" };
  }

  await logActivity(supabase, {
    aksi: "UPDATE",
    entitas: "transaksi_keluar",
    id_entitas: id,
    deskripsi: buildDeskripsi({ aksi: "UPDATE", entitas: "transaksi_keluar", id_entitas: id }) + " (Edit Metode Pembayaran)",
  });

  revalidatePath("/dashboard", "layout");
  revalidatePath("/pos", "layout");
  return { success: true };
}

export async function getTransactionDetails(id: number) {
  const supabase = await createClient();
  
  const { data, error } = await supabase
    .from("detail_transaksi_keluar")
    .select(`
      id,
      qty,
      qty_satuan,
      satuan_jual,
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
