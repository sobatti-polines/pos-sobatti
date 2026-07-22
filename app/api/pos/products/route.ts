import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("produk")
    .select(`
      id, nama_produk, id_kategori, hitung_stok, barcode, stok, stok_gudang,
      harga_modal, harga_jual_satuan, harga_jual_grosir, harga_jual_promo, diskon,
      base_unit, default_purchase_unit, conversion_ratio,
      kategori(nama)
    `)
    .order("nama_produk");

  if (error) {
    console.error("Failed to fetch products:", error);
    return NextResponse.json({ error: "Gagal mengambil data produk" }, { status: 500 });
  }

  return NextResponse.json(data ?? []);
}
