import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const revalidate = 60;

export async function GET(req: NextRequest) {
  const supabase = await createClient();

  const search = req.nextUrl.searchParams.get("search") || "";
  const limit = Math.min(10000, Math.max(1, Number(req.nextUrl.searchParams.get("limit")) || 10000));
  const page = Math.max(1, Number(req.nextUrl.searchParams.get("page")) || 1);
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  let query = supabase
    .from("produk")
    .select(`
      id, nama_produk, id_kategori, hitung_stok, barcode, stok, stok_gudang, sku,
      harga_modal, harga_jual_satuan, harga_jual_grosir, harga_jual_promo, diskon,
      default_purchase_unit, conversion_ratio,
      jual_satuan,
      harga_jual_besar_satuan, harga_jual_besar_grosir, harga_jual_besar_promo,
      id_produk_master, qty_per_unit,
      kategori(nama), satuan(nama), merk(nama)
    `, { count: "exact" })
    .order("nama_produk");

  if (search) {
    query = query.or(`nama_produk.ilike.%${search}%,barcode.ilike.%${search}%,sku.ilike.%${search}%`);
  }

  const { data, error, count } = await query.range(from, to);

  if (error) {
    console.error("Failed to fetch products:", error);
    return NextResponse.json({ error: "Gagal mengambil data produk" }, { status: 500 });
  }

  const res = NextResponse.json({ data, total: count ?? 0, page, limit });
  res.headers.set("Cache-Control", "public, max-age=60, s-maxage=120, stale-while-revalidate=300");
  return res;
}
