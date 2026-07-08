"use server";

import { createClient } from "@/lib/supabase/server";
import { bayarPiutang } from "@/lib/piutang";
import { revalidatePath } from "next/cache";

export async function processBayarPiutang(params: {
  id_piutang: string;
  tanggal_bayar: string;
  jumlah_bayar: number;
  metode_bayar: string;
  catatan?: string;
}) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  const { data: pengguna } = await supabase
    .from("pengguna")
    .select("id")
    .eq("username", user.email?.split("@")[0])
    .single();

  if (!pengguna) {
    return { error: "User profile not found." };
  }

  try {
    await bayarPiutang(supabase, {
      ...params,
      id_pengguna: pengguna.id,
    });
    revalidatePath("/dashboard/piutang");
    return { success: true };
  } catch (err: any) {
    return { error: err.message || "Gagal memproses pembayaran" };
  }
}
