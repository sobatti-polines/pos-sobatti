/**
 * Script untuk membuat user DEV di Supabase (Auth + pengguna table)
 * 
 * Cara pakai:
 *   npx tsx scripts/create-dev-user.ts
 * 
 * Pastikan file .env di root project berisi:
 *   NEXT_PUBLIC_SUPABASE_URL=...
 *   SERVICE_ROLE=...
 */

import { readFileSync } from "fs";
import { resolve } from "path";
import { createClient } from "@supabase/supabase-js";

// Load .env secara manual (hanya .env, bukan .env.local atau lainnya)
const envPath = resolve(__dirname, "../.env");
try {
  const envContent = readFileSync(envPath, "utf-8");
  for (const line of envContent.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIndex = trimmed.indexOf("=");
    if (eqIndex === -1) continue;
    const key = trimmed.slice(0, eqIndex).trim();
    const value = trimmed.slice(eqIndex + 1).trim();
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
  console.log("📄 Loaded .env dari:", envPath);
} catch {
  console.error("❌ File .env tidak ditemukan di:", envPath);
  process.exit(1);
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE = process.env.SERVICE_ROLE || process.env.NECT_PUBLIC_SERVICE_ROLE;

if (!SUPABASE_URL || !SERVICE_ROLE) {
  console.error("❌ NEXT_PUBLIC_SUPABASE_URL dan SERVICE_ROLE (atau NECT_PUBLIC_SERVICE_ROLE) harus di-set di .env");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

const DEV_USER = {
  username: "haydar",
  password: "130305",
  nama: "Haydar",
  level: "DEV",
  aktif: true,
};

function getAuthEmail(username: string) {
  // Cek apakah user sudah ada di auth dengan email apapun
  return `${username.toLowerCase().replace(/[^a-z0-9]/g, "")}@sobats.com`;
}

const DEV_EMAIL = "haydar130305@gmail.com";

async function main() {
  console.log("🔧 Membuat user DEV:", DEV_USER.username);
  console.log("   URL:", SUPABASE_URL);

  // 1. Cek apakah sudah ada di auth
  const { data: existingUsers, error: listError } = await supabase.auth.admin.listUsers();
  
  if (listError) {
    console.error("❌ Gagal list auth users:", listError.message);
    process.exit(1);
  }

  const alreadyExists = existingUsers?.users?.some(
    (u) => u.email === DEV_EMAIL
  );

  if (alreadyExists) {
    console.log("⚠️  Auth user sudah ada, skip pembuatan auth.");
  } else {
    // 2. Buat auth user
    console.log("📝 Membuat Supabase Auth user...");
    const { data: authData, error: authError } =
      await supabase.auth.admin.createUser({
        email: DEV_EMAIL,
        password: DEV_USER.password,
        email_confirm: true,
        user_metadata: { role: DEV_USER.level, username: DEV_USER.username },
      });

    if (authError) {
      console.error("❌ Gagal membuat auth user:", authError.message);
      process.exit(1);
    }
    console.log("✅ Auth user berhasil dibuat:", authData.user.id);
  }

  // 3. Cek apakah sudah ada di pengguna
  const { data: existingPengguna } = await supabase
    .from("pengguna")
    .select("id")
    .eq("username", DEV_USER.username)
    .single();

  if (existingPengguna) {
    console.log("⚠️  Data pengguna sudah ada (id:" + existingPengguna.id + "), skip insert.");
  } else {
    // 4. Insert ke pengguna table
    console.log("📝 Insert ke tabel pengguna...");
    const { error: dbError } = await supabase.from("pengguna").insert({
      username: DEV_USER.username,
      password: "auth-managed",
      level: DEV_USER.level,
      aktif: DEV_USER.aktif,
      nama: DEV_USER.nama,
    });

    if (dbError) {
      console.error("❌ Gagal insert pengguna:", dbError.message);
      process.exit(1);
    }
    console.log("✅ Data pengguna berhasil di-insert.");
  }

  console.log("\n🎉 Selesai! User DEV sudah siap:");
  console.log("   Username:", DEV_USER.username);
  console.log("   Password:", DEV_USER.password);
  console.log("   Level   :", DEV_USER.level);
  console.log("   Login di: / (halaman login)");
}

main().catch((err) => {
  console.error("❌ Unexpected error:", err);
  process.exit(1);
});
