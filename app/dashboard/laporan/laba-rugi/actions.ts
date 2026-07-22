"use server";

import { createClient } from "@/lib/supabase/server";
import { generateLabaRugi } from "@/lib/laporan-keuangan";

export async function fetchLabaRugi(startDate: string, endDate: string) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  const role = user.user_metadata?.role;
  if (role !== "OWNER" && role !== "ADMIN") {
    return { error: "Forbidden" };
  }

  try {
    const data = await generateLabaRugi(supabase, startDate, endDate);
    return { data };
  } catch (err: any) {
    return { error: "Gagal menghasilkan laporan Laba Rugi" };
  }
}
