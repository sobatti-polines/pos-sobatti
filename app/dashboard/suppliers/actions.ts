"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function addSupplier(data: {
  nama_supplier: string;
  alamat?: string | null;
  telepon?: string | null;
  email?: string | null;
  keterangan?: string | null;
}) {
  const supabase = await createClient();
  const { error } = await supabase.from("supplier").insert([data]);
  if (error) return { error: error.message };
  revalidatePath("/dashboard/suppliers");
  return { success: true };
}

export async function updateSupplier(id: number, data: {
  nama_supplier: string;
  alamat?: string | null;
  telepon?: string | null;
  email?: string | null;
  keterangan?: string | null;
}) {
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
