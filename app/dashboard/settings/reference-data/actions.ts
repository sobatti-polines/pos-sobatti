"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export type ReferenceActionState = {
  success?: boolean;
  error?: string;
  message?: string;
};

// Generic CRUD functions for reference tables (kategori, satuan, metode_bayar)
export async function createReferenceData(
  tableName: "kategori" | "satuan" | "metode_bayar",
  prevState: ReferenceActionState,
  formData: FormData
): Promise<ReferenceActionState> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user || (user.user_metadata?.role !== "ADMIN" && user.user_metadata?.role !== "OWNER")) {
    return { error: "Unauthorized" };
  }

  const nama = formData.get("nama") as string;
  if (!nama || nama.trim() === "") {
    return { error: "Nama tidak boleh kosong" };
  }

  const { error: dbError } = await supabase
    .from(tableName)
    .insert({ nama: nama.trim() });

  if (dbError) {
    if (dbError.code === "23505") { // Unique violation
      return { error: `Data dengan nama tersebut sudah ada` };
    }
    console.error("Failed to create reference data:", dbError);
    return { error: `Gagal menambah data` };
  }

  revalidatePath("/dashboard/settings/reference-data");
  return { success: true, message: "Data berhasil ditambahkan" };
}

export async function updateReferenceData(
  tableName: "kategori" | "satuan" | "metode_bayar",
  prevState: ReferenceActionState,
  formData: FormData
): Promise<ReferenceActionState> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user || (user.user_metadata?.role !== "ADMIN" && user.user_metadata?.role !== "OWNER")) {
    return { error: "Unauthorized" };
  }

  const id = parseInt(formData.get("id") as string, 10);
  const nama = formData.get("nama") as string;

  if (isNaN(id) || !nama || nama.trim() === "") {
    return { error: "Data tidak valid" };
  }

  const { error: dbError } = await supabase
    .from(tableName)
    .update({ nama: nama.trim() })
    .eq("id", id);

  if (dbError) {
    if (dbError.code === "23505") { // Unique violation
      return { error: `Data dengan nama tersebut sudah ada` };
    }
    console.error("Failed to update reference data:", dbError);
    return { error: `Gagal memperbarui data` };
  }

  revalidatePath("/dashboard/settings/reference-data");
  return { success: true, message: "Data berhasil diperbarui" };
}

export async function deleteReferenceData(
  tableName: "kategori" | "satuan" | "metode_bayar",
  id: number
): Promise<ReferenceActionState> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user || (user.user_metadata?.role !== "ADMIN" && user.user_metadata?.role !== "OWNER")) {
    return { error: "Unauthorized" };
  }

  const { error: dbError } = await supabase
    .from(tableName)
    .delete()
    .eq("id", id);

  if (dbError) {
    if (dbError.code === "23503") { // Foreign key violation
      return { error: `Data tidak dapat dihapus karena masih digunakan` };
    }
    console.error("Failed to delete reference data:", dbError);
    return { error: `Gagal menghapus data` };
  }

  revalidatePath("/dashboard/settings/reference-data");
  return { success: true, message: "Data berhasil dihapus" };
}
