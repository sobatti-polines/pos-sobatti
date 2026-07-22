"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { ProfileFormState } from "./profile-form";

export async function updateProfile(prevState: ProfileFormState, formData: FormData): Promise<ProfileFormState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Unauthorized" };

  const oldUsername = user.email?.split("@")[0];
  const newUsername = formData.get("username") as string;
  const newPassword = formData.get("password") as string;
  const confirmPassword = formData.get("confirmPassword") as string;

  if (!newUsername || newUsername.trim() === "") {
    return { error: "Username tidak boleh kosong" };
  }

  if (newPassword && newPassword !== confirmPassword) {
    return { error: "Kata sandi tidak cocok" };
  }

  const updates: Record<string, string> = {};
  const authUpdates: Record<string, string> = {};

  if (newUsername !== oldUsername) {
    // Check if new username exists
    const { data: existing } = await supabase
      .from("pengguna")
      .select("id")
      .eq("username", newUsername)
      .maybeSingle();

    if (existing) {
      return { error: "Username sudah digunakan" };
    }

    updates.username = newUsername;
    authUpdates.email = `${newUsername}@sobats.com`;
  }

  if (newPassword) {
    // Password is managed by Supabase Auth; store a placeholder in the DB column
    updates.password = "auth-managed";
    authUpdates.password = newPassword;
  }

  if (Object.keys(updates).length > 0) {
    const { error: dbError } = await supabase
      .from("pengguna")
      .update(updates)
      .eq("username", oldUsername);

    if (dbError) {
      console.error("Failed to update profile DB:", dbError);
      return { error: "Gagal memperbarui data pengguna" };
    }
  }

  if (Object.keys(authUpdates).length > 0) {
    const { error: authError } = await supabase.auth.updateUser(authUpdates);

    if (authError) {
      console.error("Failed to update auth:", authError);
      return { error: "Gagal memperbarui kredensial" };
    }
  }

  revalidatePath("/dashboard/settings");
  return { success: true, message: "Profil berhasil diperbarui" };
}
