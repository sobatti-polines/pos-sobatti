"use server";

import { createClient } from "@/lib/supabase/server";
import { confirmTutupKasir, getDailyCashSummary } from "@/lib/laporan-kasir";
import { revalidatePath } from "next/cache";

export async function fetchCashSummary(date: string) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  const role = user.user_metadata?.role;
  if (role !== "OWNER" && role !== "ADMIN") {
    return { error: "Forbidden" };
  }

  try {
    const summary = await getDailyCashSummary(supabase, date);
    return { data: summary };
  } catch (err: any) {
    return { error: "Gagal mengambil ringkasan kas" };
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
    console.error("Failed to confirm tutup kasir:", err);
    return { error: "Gagal konfirmasi tutup kasir" };
  }
}
