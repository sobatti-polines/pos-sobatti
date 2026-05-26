"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function addCustomer(data: any) {
  const supabase = await createClient();
  const { error } = await supabase.from("pelanggan").insert([data]);
  if (error) return { error: error.message };
  revalidatePath("/dashboard/customers");
  return { success: true };
}

export async function updateCustomer(id: number, data: any) {
  const supabase = await createClient();
  const { error } = await supabase.from("pelanggan").update(data).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/dashboard/customers");
  return { success: true };
}

export async function deleteCustomer(id: number, name: string) {
  if (name.toUpperCase() === "UMUM") {
    return { error: "Pelanggan UMUM tidak dapat dihapus" };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("pelanggan").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/dashboard/customers");
  return { success: true };
}
