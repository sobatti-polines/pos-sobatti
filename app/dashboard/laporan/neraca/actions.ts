"use server";

import { createClient } from "@/lib/supabase/server";
import { generateNeraca } from "@/lib/laporan-keuangan";
import { isAdminOrOwnerLike } from "@/lib/roles";

export async function fetchNeraca(date: string) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  const role = user.user_metadata?.role;
  if (!isAdminOrOwnerLike(role)) {
    return { error: "Forbidden" };
  }

  try {
    const data = await generateNeraca(supabase, date);
    return { data };
  // eslint-disable-next-line @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any
  } catch (err: any) {
    return { error: "Gagal menghasilkan laporan Neraca" };
  }
}
