"use server";

import { createClient } from "@/lib/supabase/server";
import { bayarHutang } from "@/lib/hutang";
import { revalidatePath } from "next/cache";

export async function processBayarHutang(params: {
  id_hutang: string;
  tanggal_bayar: string;
  jumlah_bayar: number;
  metode_bayar: string;
  bukti_bayar?: string;
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
    await bayarHutang(supabase, {
      ...params,
      id_pengguna: pengguna.id,
    });
    revalidatePath("/dashboard/hutang");
    return { success: true };
  } catch (err: any) {
    return { error: err.message || "Gagal memproses pembayaran" };
  }
}
