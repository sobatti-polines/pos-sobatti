import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

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
    .eq("hitung_stok", true);

  if (error || !data) return NextResponse.json([]);

  const lowStock = [];
  for (const p of data) {
    const stok = p.stok ?? 0;
    const min = p.stok_minimum ?? 5;
    if (stok > 0 && stok <= min) {
      lowStock.push({
        id: p.id,
        nama_produk: p.nama_produk,
        stok,
        stok_minimum: min,
        satuan: p.satuan,
      });
    }
  }

  lowStock.sort((a: { stok: number }, b: { stok: number }) => a.stok - b.stok);
  return NextResponse.json(lowStock);
}
