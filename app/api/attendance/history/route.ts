import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Tidak terautentikasi" }, { status: 401 });
  }

  // Get current user details
  const { data: pengguna } = await supabase
    .from("pengguna")
    .select("id, aktif")
    .eq("username", user.email?.split("@")[0])
    .single();

  if (!pengguna?.aktif) {
    return NextResponse.json({ error: "Profil pengguna tidak ditemukan" }, { status: 404 });
  }

  const { data: history, error } = await supabase
    .from("absensi")
    .select("*")
    .eq("id_pengguna", pengguna.id)
    .order("tanggal", { ascending: false })
    .limit(31); // Default to last 31 days

  if (error) {
    console.error("Failed to fetch attendance history:", error);
    return NextResponse.json({ error: "Gagal mengambil riwayat absensi" }, { status: 500 });
  }

  return NextResponse.json(history);
}
