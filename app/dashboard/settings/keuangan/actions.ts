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
    
    if (error) return { error: error.message };
  } else {
    const { error } = await supabase
      .from("pengaturan_keuangan")
      .insert({
        modal_awal: params.modal_awal,
        tanggal_mulai: params.tanggal_mulai,
        nama_pemilik: params.nama_pemilik,
        npwp: params.npwp,
      });
    
    if (error) return { error: error.message };
  }

  revalidatePath("/dashboard/settings/keuangan");
  return { success: true };
}
