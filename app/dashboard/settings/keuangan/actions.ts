"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function saveFinanceSettings(params: {
  modal_awal: number;
  tanggal_mulai: string;
  nama_pemilik?: string;
  npwp?: string;
}) {
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

  const { data: existing } = await supabase.from("pengaturan_keuangan").select("id").maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from("pengaturan_keuangan")
      .update({
        modal_awal: params.modal_awal,
        tanggal_mulai: params.tanggal_mulai,
        nama_pemilik: params.nama_pemilik,
        npwp: params.npwp,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id);
    
    if (error) {
      console.error("Failed to save finance settings:", error);
      return { error: "Gagal menyimpan pengaturan keuangan" };
    }
  } else {
    const { error } = await supabase
      .from("pengaturan_keuangan")
      .insert({
        modal_awal: params.modal_awal,
        tanggal_mulai: params.tanggal_mulai,
        nama_pemilik: params.nama_pemilik,
        npwp: params.npwp,
      });
    
    if (error) {
      console.error("Failed to save finance settings:", error);
      return { error: "Gagal menyimpan pengaturan keuangan" };
    }
  }

  revalidatePath("/dashboard/settings/keuangan");
  return { success: true };
}
