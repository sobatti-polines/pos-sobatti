"use server";

import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";

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

  // 2. Update pengguna table
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

  revalidatePath("/dashboard/settings/users");
  return { success: true, message: "Pengguna berhasil dihapus" };
}
