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

  await logActivity(supabase, {
    aksi: "CREATE",
    entitas: "pelanggan",
    deskripsi: buildDeskripsi({ aksi: "CREATE", entitas: "pelanggan", data_baru: data as unknown as Record<string, unknown> }),
    data_baru: data as unknown as Record<string, unknown>,
  });

  revalidatePath("/dashboard/customers");
  return { success: true };
}

export async function updateCustomer(id: number, data: {
  nama_pelanggan: string;
  alamat?: string | null;
  no_hp?: string | null;
  email?: string | null;
  keterangan?: string | null;
  point?: number | null;
}) {
  const ok = await requireAuth();
  if (!ok) return { error: "Unauthorized" };

  const supabase = await createClient();

  const { data: oldCustomer } = await supabase
    .from("pelanggan")
    .select("nama_pelanggan, alamat, no_hp, email, keterangan")
    .eq("id", id)
    .single();

  const { error } = await supabase.from("pelanggan").update(data).eq("id", id);
  if (error) {
    console.error("Failed to update customer:", error);
    return { error: "Gagal memperbarui pelanggan" };
  }

  await logActivity(supabase, {
    aksi: "UPDATE",
    entitas: "pelanggan",
    id_entitas: id,
    deskripsi: buildDeskripsi({ aksi: "UPDATE", entitas: "pelanggan", id_entitas: id, data_lama: oldCustomer ? (oldCustomer as unknown as Record<string, unknown>) : null, data_baru: data as unknown as Record<string, unknown> }),
    data_lama: oldCustomer ? (oldCustomer as unknown as Record<string, unknown>) : null,
    data_baru: data as unknown as Record<string, unknown>,
  });

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

  const { data: oldCustomer } = await supabase
    .from("pelanggan")
    .select("nama_pelanggan, no_hp")
    .eq("id", id)
    .single();

  const { error } = await supabase.from("pelanggan").delete().eq("id", id);
  if (error) {
    console.error("Failed to delete customer:", error);
    return { error: "Gagal menghapus pelanggan" };
  }

  await logActivity(supabase, {
    aksi: "DELETE",
    entitas: "pelanggan",
    id_entitas: id,
    deskripsi: buildDeskripsi({ aksi: "DELETE", entitas: "pelanggan", id_entitas: id, data_lama: oldCustomer ? (oldCustomer as unknown as Record<string, unknown>) : null }),
    data_lama: oldCustomer ? (oldCustomer as unknown as Record<string, unknown>) : null,
  });

  revalidatePath("/dashboard/customers");
  return { success: true };
}

export async function importCustomers(
  rows: Record<string, string>[]
) {
  const ok = await requireAuth();
  if (!ok) return { error: "Unauthorized" };

  if (!rows || rows.length === 0) {
    return { error: "Data impor kosong" };
  }

  const supabase = await createClient();

  const payload = rows.map((r) => ({
    nama_pelanggan: r["Nama Pelanggan"] || r["nama_pelanggan"] || "",
    alamat: r["Alamat"] || r["alamat"] || null,
    no_hp: r["No HP"] || r["No. HP"] || r["no_hp"] || r["Telepon"] || null,
    email: r["Email"] || r["email"] || null,
    keterangan: r["Keterangan"] || r["keterangan"] || null,
  })).filter((item) => item.nama_pelanggan.trim() !== "");

  if (payload.length === 0) {
    return { error: "Tidak ada baris data pelanggan yang valid (Nama Pelanggan wajib)" };
  }

  const { data: inserted, error } = await supabase
    .from("pelanggan")
    .insert(payload)
    .select("id");

  if (error) {
    console.error("Failed to import customers:", error);
    return { error: "Gagal menyimpan data pelanggan: " + error.message };
  }

  await logActivity(supabase, {
    aksi: "CREATE",
    entitas: "pelanggan",
    deskripsi: `Bulk import ${payload.length} pelanggan`,
    data_baru: { count: payload.length },
  });

  revalidatePath("/dashboard/customers");
  return { success: true, count: payload.length, message: `Berhasil mengimpor ${payload.length} data pelanggan.` };
}
