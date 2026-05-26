import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code")?.trim();

  if (!code) {
    return NextResponse.json({ error: "code required" }, { status: 400 });
  }

  const supabase = await createClient();

  const fields = `id, nama_produk, id_kategori, hitung_stok, stok,
    harga_modal, harga_jual_satuan, harga_jual_grosir, diskon,
    kategori(nama)`;

  // Try barcode match first (scanner input)
  const { data: barcodeMatch } = await supabase
    .from("produk")
    .select(fields)
    .eq("barcode", code)
    .maybeSingle();

  if (barcodeMatch) return NextResponse.json({ product: barcodeMatch });

  // Try numeric ID match as fallback
  const numericId = /^\d+$/.test(code) ? Number(code) : null;
  if (numericId !== null) {
    const { data } = await supabase
      .from("produk")
      .select(fields)
      .eq("id", numericId)
      .maybeSingle();

    if (data) return NextResponse.json({ product: data });
  }

  // Try name search as another fallback
  const { data } = await supabase
    .from("produk")
    .select(fields)
    .ilike("nama_produk", `%${code}%`)
    .limit(1)
    .maybeSingle();

  if (data) return NextResponse.json({ product: data });

  return NextResponse.json({ product: null }, { status: 404 });
}
