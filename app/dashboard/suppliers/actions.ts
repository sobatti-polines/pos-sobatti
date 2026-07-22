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

export async function addSupplier(data: {
  nama_supplier: string;
  alamat?: string | null;
  telepon?: string | null;
  email?: string | null;
  keterangan?: string | null;
}) {
  const ok = await requireAuth();
  if (!ok) return { error: "Unauthorized" };

  const supabase = await createClient();
  const { error } = await supabase.from("supplier").insert([data]);
  if (error) {
    console.error("Failed to add supplier:", error);
    return { error: "Gagal menambah supplier" };
  }
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
  const ok = await requireAuth();
  if (!ok) return { error: "Unauthorized" };

  const supabase = await createClient();
  const { error } = await supabase.from("supplier").update(data).eq("id", id);
  if (error) {
    console.error("Failed to update supplier:", error);
    return { error: "Gagal memperbarui supplier" };
  }
  revalidatePath("/dashboard/suppliers");
  return { success: true };
}

export async function deleteSupplier(id: number) {
  const ok = await requireAuth();
  if (!ok) return { error: "Unauthorized" };

  const supabase = await createClient();
  const { error } = await supabase.from("supplier").delete().eq("id", id);
  if (error) {
    console.error("Failed to delete supplier:", error);
    return { error: "Gagal menghapus supplier" };
  }
  revalidatePath("/dashboard/suppliers");
  return { success: true };
}
