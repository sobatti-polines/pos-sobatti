import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("pelanggan")
    .select("id, nama_pelanggan, alamat, no_hp, email")
    .order("nama_pelanggan");

  if (error) {
    console.error("Failed to fetch customers:", error);
    return NextResponse.json({ error: "Gagal mengambil data pelanggan" }, { status: 500 });
  }

  return NextResponse.json(data ?? []);
}
