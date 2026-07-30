"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { logActivity, buildDeskripsi } from "@/lib/activity-log";

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

  await logActivity(supabase, {
    aksi: "CREATE",
    entitas: tableName,
    deskripsi: buildDeskripsi({ aksi: "CREATE", entitas: tableName, data_baru: { nama: nama.trim() } as unknown as Record<string, unknown> }),
    data_baru: { nama: nama.trim() } as unknown as Record<string, unknown>,
  });

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

  await logActivity(supabase, {
    aksi: "UPDATE",
    entitas: tableName,
    id_entitas: id,
    deskripsi: buildDeskripsi({ aksi: "UPDATE", entitas: tableName, id_entitas: id, data_baru: { nama: nama.trim() } as unknown as Record<string, unknown> }),
    data_baru: { nama: nama.trim() } as unknown as Record<string, unknown>,
  });

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

  await logActivity(supabase, {
    aksi: "DELETE",
    entitas: tableName,
    id_entitas: id,
    deskripsi: buildDeskripsi({ aksi: "DELETE", entitas: tableName, id_entitas: id }),
  });

  revalidatePath("/dashboard/settings/reference-data");
  return { success: true, message: "Data berhasil dihapus" };
}

export async function importReferenceData(
  tableName: "kategori" | "satuan" | "merk" | "metode_bayar",
  rows: Record<string, string>[]
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user || (user.user_metadata?.role !== "ADMIN" && user.user_metadata?.role !== "OWNER")) {
    return { error: "Unauthorized" };
  }

  if (!rows || rows.length === 0) {
    return { error: "Data impor kosong" };
  }

  const payload: any[] = [];

  for (const r of rows) {
    const nama = (r["Nama"] || r["nama"] || r["Nama Kategori"] || r["Nama Satuan"] || r["Nama Merk"] || r["Nama Metode Bayar"] || "").trim();
    if (!nama) continue;

    if (tableName === "merk") {
      const kodeRaw = (r["Kode"] || r["kode"] || r["Kode Merk"] || "").trim();
      const kode = kodeRaw || (nama.replace(/[^A-Za-z0-9]/g, "").slice(0, 4).toUpperCase() || "MRK");
      payload.push({ nama, kode });
    } else {
      payload.push({ nama });
    }
  }

  if (payload.length === 0) {
    return { error: "Tidak ada baris data referensi yang valid" };
  }

  const { error: dbError } = await supabase
    .from(tableName)
    .insert(payload);

  if (dbError) {
    console.error(`Failed to import ${tableName}:`, dbError);
    if (dbError.code === "23505") {
      return { error: "Beberapa data dengan Nama/Kode tersebut sudah ada di database" };
    }
    return { error: `Gagal menyimpan data ${tableName}: ${dbError.message}` };
  }

  await logActivity(supabase, {
    aksi: "CREATE",
    entitas: tableName,
    deskripsi: `Bulk import ${payload.length} ${tableName}`,
    data_baru: { count: payload.length },
  });

  revalidatePath("/dashboard/settings/reference-data");
  return { success: true, count: payload.length, message: `Berhasil mengimpor ${payload.length} data ${tableName}.` };
}
