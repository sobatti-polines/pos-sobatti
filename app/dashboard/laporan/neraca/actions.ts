"use server";

import { createClient } from "@/lib/supabase/server";
import { generateNeraca } from "@/lib/laporan-keuangan";

export async function fetchNeraca(date: string) {
  const supabase = await createClient();
  try {
    const data = await generateNeraca(supabase, date);
    return { data };
  } catch (err: any) {
    return { error: err.message || "Gagal menghasilkan laporan Neraca" };
  }
}
