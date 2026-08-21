import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code")?.trim();

  if (!code) {
    return NextResponse.json({ error: "code required" }, { status: 400 });
  }

  const supabase = await createClient();

  const fields = `id, nama_produk, id_kategori, hitung_stok, stok, stok_gudang,
    harga_modal, harga_jual_satuan, harga_jual_grosir, harga_jual_promo, diskon,
    default_purchase_unit, conversion_ratio,
    jual_satuan,
    harga_jual_besar_satuan, harga_jual_besar_grosir, harga_jual_besar_promo,
    id_produk_master, qty_per_unit,
    kategori(nama), satuan(nama)`;

  const findProduct = async () => {
    // Try barcode match first (scanner input)
    const { data: barcodeMatch } = await supabase
      .from("produk")
      .select(fields)
      .ilike("barcode", code)
      .maybeSingle();

    if (barcodeMatch) return barcodeMatch;

    // Try numeric ID match as fallback
    const numericId = /^\d+$/.test(code) ? Number(code) : null;
    if (numericId !== null) {
      const { data } = await supabase
        .from("produk")
        .select(fields)
        .eq("id", numericId)
        .maybeSingle();

      if (data) return data;
    }

    // Try name search as another fallback
    const { data } = await supabase
      .from("produk")
      .select(fields)
      .ilike("nama_produk", `%${code}%`)
      .limit(1)
      .maybeSingle();

    if (data) return data;

    return null;
  };

  const product = await findProduct();
  if (!product) return NextResponse.json({ product: null }, { status: 404 });

  return NextResponse.json({ product });
}
