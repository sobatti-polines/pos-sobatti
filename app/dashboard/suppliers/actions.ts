"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { logActivity, buildDeskripsi } from "@/lib/activity-log";

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

  await logActivity(supabase, {
    aksi: "CREATE",
    entitas: "supplier",
    deskripsi: buildDeskripsi({ aksi: "CREATE", entitas: "supplier", data_baru: data as unknown as Record<string, unknown> }),
    data_baru: data as unknown as Record<string, unknown>,
  });

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

  const { data: oldSupplier } = await supabase
    .from("supplier")
    .select("nama_supplier, alamat, telepon, email, keterangan")
    .eq("id", id)
    .single();

  const { error } = await supabase.from("supplier").update(data).eq("id", id);
  if (error) {
    console.error("Failed to update supplier:", error);
    return { error: "Gagal memperbarui supplier" };
  }

  await logActivity(supabase, {
    aksi: "UPDATE",
    entitas: "supplier",
    id_entitas: id,
    deskripsi: buildDeskripsi({ aksi: "UPDATE", entitas: "supplier", id_entitas: id, data_lama: oldSupplier ? (oldSupplier as unknown as Record<string, unknown>) : null, data_baru: data as unknown as Record<string, unknown> }),
    data_lama: oldSupplier ? (oldSupplier as unknown as Record<string, unknown>) : null,
    data_baru: data as unknown as Record<string, unknown>,
  });

  revalidatePath("/dashboard/suppliers");
  return { success: true };
}

export async function deleteSupplier(id: number) {
  const ok = await requireAuth();
  if (!ok) return { error: "Unauthorized" };

  const supabase = await createClient();

  const { data: oldSupplier } = await supabase
    .from("supplier")
    .select("nama_supplier, alamat, telepon, email, keterangan")
    .eq("id", id)
    .single();

  const { error } = await supabase.from("supplier").delete().eq("id", id);
  if (error) {
    console.error("Failed to delete supplier:", error);
    return { error: "Gagal menghapus supplier" };
  }

  await logActivity(supabase, {
    aksi: "DELETE",
    entitas: "supplier",
    id_entitas: id,
    deskripsi: buildDeskripsi({ aksi: "DELETE", entitas: "supplier", id_entitas: id, data_lama: oldSupplier ? (oldSupplier as unknown as Record<string, unknown>) : null }),
    data_lama: oldSupplier ? (oldSupplier as unknown as Record<string, unknown>) : null,
  });

  revalidatePath("/dashboard/suppliers");
  return { success: true };
}

export async function importSuppliers(
  rows: Record<string, string>[]
) {
  const ok = await requireAuth();
  if (!ok) return { error: "Unauthorized" };

  if (!rows || rows.length === 0) {
    return { error: "Data impor kosong" };
  }

  const supabase = await createClient();

  const payload = rows.map((r) => ({
    nama_supplier: r["Nama Supplier"] || r["nama_supplier"] || "",
    alamat: r["Alamat"] || r["alamat"] || null,
    telepon: r["No Telepon"] || r["No. Telepon"] || r["telepon"] || r["No HP"] || null,
    email: r["Email"] || r["email"] || null,
    keterangan: r["Keterangan"] || r["keterangan"] || null,
  })).filter((item) => item.nama_supplier.trim() !== "");

  if (payload.length === 0) {
    return { error: "Tidak ada baris data supplier yang valid (Nama Supplier wajib)" };
  }

  const { error } = await supabase
    .from("supplier")
    .insert(payload);

  if (error) {
    console.error("Failed to import suppliers:", error);
    return { error: "Gagal menyimpan data supplier: " + error.message };
  }

  await logActivity(supabase, {
    aksi: "CREATE",
    entitas: "supplier",
    deskripsi: `Bulk import ${payload.length} supplier`,
    data_baru: { count: payload.length },
  });

  revalidatePath("/dashboard/suppliers");
  return { success: true, count: payload.length, message: `Berhasil mengimpor ${payload.length} data supplier.` };
}
