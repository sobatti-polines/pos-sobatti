"use server";

import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { logActivity, buildDeskripsi } from "@/lib/activity-log";

export type UserActionState = {
  success?: boolean;
  error?: string;
  message?: string;
};

// Ensure we have a default domain for auth
const AUTH_DOMAIN = "sobats.com";

function getAuthEmail(username: string) {
  return `${username.toLowerCase().replace(/[^a-z0-9]/g, '')}@${AUTH_DOMAIN}`;
}

export async function createUser(
  prevState: UserActionState,
  formData: FormData
): Promise<UserActionState> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user || user.user_metadata?.role !== "OWNER") {
    return { error: "Unauthorized" };
  }

  const username = formData.get("username") as string;
  const password = formData.get("password") as string;
  const level = formData.get("level") as string;
  const nama = formData.get("nama") as string;
  const aktif = formData.get("aktif") === "true";

  if (!username || !password || !level) {
    return { error: "Semua kolom wajib diisi" };
  }

  const email = getAuthEmail(username);

  // 1. Create in Supabase Auth
  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { role: level, username },
  });

  if (authError) {
    return { error: "Gagal membuat Auth User: " + authError.message };
  }

  // 2. Insert into pengguna table
  // Note: we store a dummy password hash here or just plain text as actual auth uses Supabase
  const { error: dbError } = await supabase
    .from("pengguna")
    .insert({
      username,
      password: "auth-managed", // Placeholder
      level,
      aktif,
      nama: nama || username,
    });

  if (dbError) {
    // Rollback auth user
    if (authData.user) {
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
    }
    return { error: "Gagal menyimpan pengguna ke database: " + dbError.message };
  }

  await logActivity(supabase, {
    aksi: "CREATE",
    entitas: "pengguna",
    deskripsi: buildDeskripsi({ aksi: "CREATE", entitas: "pengguna", data_baru: { username, level, nama: nama || username, aktif } as unknown as Record<string, unknown> }),
    data_baru: { username, level, nama: nama || username, aktif } as unknown as Record<string, unknown>,
  });

  revalidatePath("/dashboard/settings/users");
  return { success: true, message: "Pengguna berhasil ditambahkan" };
}

export async function updateUser(
  prevState: UserActionState,
  formData: FormData
): Promise<UserActionState> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user || user.user_metadata?.role !== "OWNER") {
    return { error: "Unauthorized" };
  }

  const id = parseInt(formData.get("id") as string, 10);
  const oldUsername = formData.get("old_username") as string;
  const username = formData.get("username") as string;
  const password = formData.get("password") as string; // Optional
  const level = formData.get("level") as string;
  const nama = formData.get("nama") as string;
  const aktif = formData.get("aktif") === "true";

  if (isNaN(id) || !username || !level) {
    return { error: "Data tidak valid" };
  }

  // 1. Find the Auth User
  const oldEmail = getAuthEmail(oldUsername);
  const newEmail = getAuthEmail(username);
  
  const { data: usersData, error: listError } = await supabaseAdmin.auth.admin.listUsers();
  
  if (!listError && usersData?.users) {
    const authUser = usersData.users.find(u => u.email === oldEmail);
    if (authUser) {
      // Update Auth User
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const updatePayload: any = {
        email: newEmail,
        user_metadata: { role: level, username },
      };
      if (password) {
        updatePayload.password = password;
      }
      await supabaseAdmin.auth.admin.updateUserById(authUser.id, updatePayload);
    }
  }

  // 2. Fetch old data for log
  const { data: oldUser } = await supabase
    .from("pengguna")
    .select("username, level, aktif, nama")
    .eq("id", id)
    .single();

  // 3. Update pengguna table
  const { error: dbError } = await supabase
    .from("pengguna")
    .update({
      username,
      level,
      aktif,
      nama: nama || username,
    })
    .eq("id", id);

  if (dbError) {
    return { error: "Gagal memperbarui pengguna: " + dbError.message };
  }

  await logActivity(supabase, {
    aksi: "UPDATE",
    entitas: "pengguna",
    id_entitas: id,
    deskripsi: buildDeskripsi({ aksi: "UPDATE", entitas: "pengguna", id_entitas: id, data_lama: oldUser ? (oldUser as unknown as Record<string, unknown>) : null, data_baru: { username, level, nama: nama || username, aktif } as unknown as Record<string, unknown> }),
    data_lama: oldUser ? (oldUser as unknown as Record<string, unknown>) : null,
    data_baru: { username, level, nama: nama || username, aktif } as unknown as Record<string, unknown>,
  });

  revalidatePath("/dashboard/settings/users");
  return { success: true, message: "Pengguna berhasil diperbarui" };
}

export async function deleteUser(id: number, username: string): Promise<UserActionState> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user || user.user_metadata?.role !== "OWNER") {
    return { error: "Unauthorized" };
  }

  // Prevent deleting oneself
  if (user.user_metadata?.username === username) {
    return { error: "Tidak dapat menghapus akun sendiri" };
  }

  // Fetch user data for log
  const { data: deletedUser } = await supabase
    .from("pengguna")
    .select("level, nama")
    .eq("id", id)
    .single();

  // 1. Delete from database
  const { error: dbError } = await supabase
    .from("pengguna")
    .delete()
    .eq("id", id);

  if (dbError) {
    return { error: "Gagal menghapus pengguna: " + dbError.message };
  }

  // 2. Delete from Auth
  const email = getAuthEmail(username);
  const { data: usersData } = await supabaseAdmin.auth.admin.listUsers();
  if (usersData?.users) {
    const authUser = usersData.users.find(u => u.email === email);
    if (authUser) {
      await supabaseAdmin.auth.admin.deleteUser(authUser.id);
    }
  }

  await logActivity(supabase, {
    aksi: "DELETE",
    entitas: "pengguna",
    id_entitas: id,
    deskripsi: buildDeskripsi({ aksi: "DELETE", entitas: "pengguna", id_entitas: id, data_lama: { username, level: deletedUser?.level, nama: deletedUser?.nama } as unknown as Record<string, unknown> }),
    data_lama: { username, level: deletedUser?.level, nama: deletedUser?.nama } as unknown as Record<string, unknown>,
  });

  revalidatePath("/dashboard/settings/users");
  return { success: true, message: "Pengguna berhasil dihapus" };
}

export async function importUsers(
  rows: Record<string, string>[]
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user || user.user_metadata?.role !== "OWNER") {
    return { error: "Unauthorized: Hanya OWNER yang dapat mengimpor pengguna" };
  }

  if (!rows || rows.length === 0) {
    return { error: "Data impor kosong" };
  }

  let count = 0;
  const errors: string[] = [];

  for (const [idx, r] of rows.entries()) {
    const username = (r["Username"] || r["username"] || "").trim();
    const password = (r["Password"] || r["password"] || "").trim();
    const nama = (r["Nama Lengkap"] || r["Nama"] || r["nama"] || username).trim();
    const rawLevel = (r["Level"] || r["Role"] || r["level"] || "KASIR").trim().toUpperCase();
    const level = ["ADMIN", "KASIR", "OWNER", "KARYAWAN"].includes(rawLevel) ? rawLevel : "KASIR";
    const statusRaw = (r["Status"] || r["status"] || "aktif").trim().toLowerCase();
    const aktif = statusRaw === "aktif" || statusRaw === "true" || statusRaw === "1";

    if (!username || !password) {
      errors.push(`Baris ${idx + 1}: Username dan Password wajib diisi`);
      continue;
    }

    const email = getAuthEmail(username);

    // Create in Supabase Auth
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { role: level, username },
    });

    if (authError) {
      errors.push(`Baris ${idx + 1} (${username}): ${authError.message}`);
      continue;
    }

    // Insert into pengguna table
    const { error: dbError } = await supabase.from("pengguna").insert({
      username,
      password: "auth-managed",
      level,
      aktif,
      nama,
    });

    if (dbError) {
      if (authData.user) {
        await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      }
      errors.push(`Baris ${idx + 1} (${username}): DB error - ${dbError.message}`);
      continue;
    }

    count++;
  }

  await logActivity(supabase, {
    aksi: "CREATE",
    entitas: "pengguna",
    deskripsi: `Bulk import ${count} pengguna`,
    data_baru: { count },
  });

  revalidatePath("/dashboard/settings/users");

  if (count === 0 && errors.length > 0) {
    return { error: `Gagal mengimpor pengguna: ${errors.join("; ")}` };
  }

  return {
    success: true,
    count,
    message: `Berhasil mengimpor ${count} pengguna.${errors.length > 0 ? ` (${errors.length} gagal)` : ""}`,
  };
}
