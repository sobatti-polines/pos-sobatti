import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();

  // Metode 'Transfer' generik digantikan oleh bank dinamis dari pengaturan toko
  // (Bank 1 & Bank 2). Baris lama tetap tersimpan untuk riwayat transaksi.
  const { data, error } = await supabase
    .from("metode_bayar")
    .select("id, nama")
    .neq("nama", "Transfer")
    .order("id");

  if (error) {
    console.error("Failed to fetch payment methods:", error);
    return NextResponse.json({ error: "Gagal mengambil metode bayar" }, { status: 500 });
  }

  return NextResponse.json(data ?? []);
}
