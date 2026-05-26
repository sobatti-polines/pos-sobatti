"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function addProduct(data: any) {
  const supabase = await createClient();
  const { error } = await supabase.from("produk").insert([data]);
  if (error) return { error: error.message };
  revalidatePath("/dashboard/inventory");
  return { success: true };
}

export async function updateProduct(id: number, data: any) {
  const supabase = await createClient();
  const { error } = await supabase.from("produk").update(data).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/dashboard/inventory");
  return { success: true };
}

export async function deleteProduct(id: number) {
  const supabase = await createClient();
  const { error } = await supabase.from("produk").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/dashboard/inventory");
  return { success: true };
}
