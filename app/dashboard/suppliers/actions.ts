"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function addSupplier(data: any) {
  const supabase = await createClient();
  const { error } = await supabase.from("supplier").insert([data]);
  if (error) return { error: error.message };
  revalidatePath("/dashboard/suppliers");
  return { success: true };
}

export async function updateSupplier(id: number, data: any) {
  const supabase = await createClient();
  const { error } = await supabase.from("supplier").update(data).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/dashboard/suppliers");
  return { success: true };
}

export async function deleteSupplier(id: number) {
  const supabase = await createClient();
  const { error } = await supabase.from("supplier").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/dashboard/suppliers");
  return { success: true };
}
