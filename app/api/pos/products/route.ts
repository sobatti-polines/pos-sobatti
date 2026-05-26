import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("produk")
    .select(`
      id, nama_produk, id_kategori, hitung_stok, barcode, stok,
      harga_modal, harga_jual_satuan, harga_jual_grosir, diskon,
      kategori(nama)
    `)
    .order("nama_produk");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data ?? []);
}
