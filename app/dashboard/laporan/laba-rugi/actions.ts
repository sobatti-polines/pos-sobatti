"use server";

import { createClient } from "@/lib/supabase/server";
import { generateLabaRugi } from "@/lib/laporan-keuangan";

export async function fetchLabaRugi(startDate: string, endDate: string) {
  const supabase = await createClient();
  try {
    const data = await generateLabaRugi(supabase, startDate, endDate);
    return { data };
  } catch (err: any) {
    return { error: err.message || "Gagal menghasilkan laporan Laba Rugi" };
  }
}
