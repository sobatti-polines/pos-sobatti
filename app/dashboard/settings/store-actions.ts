"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { logActivity, buildDeskripsi } from "@/lib/activity-log";

export type StoreSettingsState = {
  success?: boolean;
  error?: string;
  message?: string;
};

export async function updateStoreSettings(
  prevState: StoreSettingsState,
  formData: FormData
): Promise<StoreSettingsState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Unauthorized" };

  const updates = {
    nama_toko: formData.get("nama_toko") as string,
    alamat: formData.get("alamat") as string,
    telepon: formData.get("telepon") as string,
    email: formData.get("email") as string,
    metode_diskon: formData.get("metode_diskon") as string,
    pajak_persen: parseFloat(formData.get("pajak_persen") as string) || 0,
    poin_min_pembelian: parseFloat(formData.get("poin_min_pembelian") as string) || 100000,
    jenis_nota: formData.get("jenis_nota") as string,
    metode_cetak: formData.get("metode_cetak") as string,
    logo_nota: formData.get("logo_nota") === "true",
    bank1_nama: formData.get("bank1_nama") as string,
    bank1_rekening: formData.get("bank1_rekening") as string,
    bank1_atas_nama: formData.get("bank1_atas_nama") as string,
    bank2_nama: formData.get("bank2_nama") as string,
    bank2_rekening: formData.get("bank2_rekening") as string,
    bank2_atas_nama: formData.get("bank2_atas_nama") as string,
    footer_struk_1: formData.get("footer_struk_1") as string,
    footer_struk_2: formData.get("footer_struk_2") as string,
    footer_struk_3: formData.get("footer_struk_3") as string,
    footer_invoice_1: formData.get("footer_invoice_1") as string,
    footer_invoice_2: formData.get("footer_invoice_2") as string,
    footer_invoice_3: formData.get("footer_invoice_3") as string,
    hormat_kami_nama: formData.get("hormat_kami_nama") as string,
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase
    .from("pengaturan")
    .upsert({ id: 1, ...updates });

  if (error) {
    return { error: "Gagal memperbarui pengaturan toko: " + error.message };
  }

  // Sinkronkan metode bayar (POS & Pengeluaran) dengan bank yang dikonfigurasi,
  // supaya tipe pembayaran dinamis: Tunai, QRIS, Bank 1, Bank 2.
  await syncMetodeBayar(supabase, updates);

  await logActivity(supabase, {
    aksi: "UPDATE",
    entitas: "pengaturan",
    deskripsi: buildDeskripsi({ aksi: "UPDATE", entitas: "pengaturan", data_baru: updates as unknown as Record<string, unknown> }),
    data_baru: updates as unknown as Record<string, unknown>,
  });

  revalidatePath("/dashboard/settings");
  return { success: true, message: "Pengaturan toko berhasil diperbarui" };
}

/**
 * Sinkronkan tabel metode_bayar dengan nama bank dari pengaturan toko:
 * - Pastikan 'Tunai' & 'QRIS' selalu ada.
 * - Tambahkan baris untuk setiap bank yang dikonfigurasi (bank1_nama / bank2_nama).
 * - Hapus metode generik 'Transfer' bila tidak lagi dipakai transaksi (aman: bila
 *   masih direferensikan transaksi lama, operasi delete akan gagal dan diabaikan).
 */
async function syncMetodeBayar(
  supabase: Awaited<ReturnType<typeof createClient>>,
  updates: Record<string, unknown>
) {
  const bankNama = [updates.bank1_nama, updates.bank2_nama]
    .filter((n): n is string => typeof n === "string" && n.trim() !== "")
    .map((n) => n.trim());

  const { data: existing } = await supabase
    .from("metode_bayar")
    .select("nama");

  const existingNames = new Set((existing ?? []).map((m) => m.nama));

  const toInsert = ["Tunai", "QRIS", ...bankNama].filter(
    (n) => !existingNames.has(n)
  );

  if (toInsert.length > 0) {
    await supabase
      .from("metode_bayar")
      .insert(toInsert.map((nama) => ({ nama })));
  }

  // Hapus 'Transfer' generik bila tidak dipakai (ignore error FK bila dipakai historis)
  await supabase.from("metode_bayar").delete().eq("nama", "Transfer");
}
