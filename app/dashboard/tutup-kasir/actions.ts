"use server";

import { createClient } from "@/lib/supabase/server";
import { confirmTutupKasir, getDailyCashSummary } from "@/lib/laporan-kasir";
import { revalidatePath } from "next/cache";

export async function fetchCashSummary(date: string) {
  const supabase = await createClient();
  try {
    const summary = await getDailyCashSummary(supabase, date);
    return { data: summary };
  } catch (err: any) {
    return { error: err.message || "Gagal mengambil ringkasan kas" };
  }
}

export async function submitTutupKasir(params: {
  tanggal: string;
  saldo_awal: number;
  total_masuk: number;
  total_keluar: number;
  uang_aktual: number;
}) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  const { data: pengguna } = await supabase
    .from("pengguna")
    .select("id")
    .eq("username", user.email?.split("@")[0])
    .single();

  if (!pengguna) return { error: "User profile not found." };

  try {
    await confirmTutupKasir(supabase, {
      ...params,
      id_pengguna: pengguna.id,
    });
    revalidatePath("/dashboard/laporan-kasir");
    revalidatePath("/dashboard/tutup-kasir");
    return { success: true };
  } catch (err: any) {
    return { error: err.message || "Gagal konfirmasi tutup kasir" };
  }
}
