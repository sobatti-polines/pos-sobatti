"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

async function requireAuth() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;
  const { data: pengguna } = await supabase
    .from("pengguna")
    .select("level")
    .eq("username", user.email?.split("@")[0])
    .single();
  return pengguna?.level === "ADMIN" || pengguna?.level === "OWNER";
}

export async function addCustomer(data: {
  nama_pelanggan: string;
  alamat?: string | null;
  no_hp?: string | null;
  email?: string | null;
  keterangan?: string | null;
}) {
  const ok = await requireAuth();
  if (!ok) return { error: "Unauthorized" };

  const supabase = await createClient();
  const { error } = await supabase.from("pelanggan").insert([data]);
  if (error) {
    console.error("Failed to add customer:", error);
    return { error: "Gagal menambah pelanggan" };
  }
  revalidatePath("/dashboard/customers");
  return { success: true };
}

export async function updateCustomer(id: number, data: {
  nama_pelanggan: string;
  alamat?: string | null;
  no_hp?: string | null;
  email?: string | null;
  keterangan?: string | null;
}) {
  const ok = await requireAuth();
  if (!ok) return { error: "Unauthorized" };

  const supabase = await createClient();
  const { error } = await supabase.from("pelanggan").update(data).eq("id", id);
  if (error) {
    console.error("Failed to update customer:", error);
    return { error: "Gagal memperbarui pelanggan" };
  }
  revalidatePath("/dashboard/customers");
  return { success: true };
}

export async function deleteCustomer(id: number, name: string) {
  const ok = await requireAuth();
  if (!ok) return { error: "Unauthorized" };

  if (name.toUpperCase() === "UMUM") {
    return { error: "Pelanggan UMUM tidak dapat dihapus" };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("pelanggan").delete().eq("id", id);
  if (error) {
    console.error("Failed to delete customer:", error);
    return { error: "Gagal menghapus pelanggan" };
  }
  revalidatePath("/dashboard/customers");
  return { success: true };
}
