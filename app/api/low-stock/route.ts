import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export const revalidate = 30;

export async function GET() {
  let supabase;
  try {
    supabase = await createClient();
  } catch {
    return NextResponse.json([]);
  }

  const { data, error } = await supabase
    .from("produk")
    .select("id, nama_produk, stok, stok_minimum, satuan(nama)")
    .eq("hitung_stok", true)
    .gt("stok", 0);

  if (error || !data) return NextResponse.json([]);

  const lowStock = data.filter(
    (p) => (p.stok ?? 0) <= (p.stok_minimum ?? 5)
  );
  lowStock.sort((a, b) => (a.stok ?? 0) - (b.stok ?? 0));

  const res = NextResponse.json(lowStock);
  res.headers.set("Cache-Control", "public, max-age=30, s-maxage=60, stale-while-revalidate=120");
  return res;
}
