"use server";

import { createClient } from "@/lib/supabase/server";
import { generateArusKas } from "@/lib/laporan-keuangan";
import { isAdminOrOwnerLike } from "@/lib/roles";

export async function fetchArusKas(startDate: string, endDate: string) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  const role = user.user_metadata?.role;
  if (!isAdminOrOwnerLike(role)) {
    return { error: "Forbidden" };
  }

  try {
    const data = await generateArusKas(supabase, startDate, endDate);
    return { data };
  } catch {
    return { error: "Gagal menghasilkan laporan Arus Kas" };
  }
}
