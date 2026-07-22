import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const revalidate = 60;

export async function GET(req: NextRequest) {
  const supabase = await createClient();

  const search = req.nextUrl.searchParams.get("search") || "";
  const limit = Math.min(500, Math.max(1, Number(req.nextUrl.searchParams.get("limit")) || 500));
  const page = Math.max(1, Number(req.nextUrl.searchParams.get("page")) || 1);
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  let query = supabase
    .from("produk")
    .select(`
      id, nama_produk, id_kategori, hitung_stok, barcode, stok, stok_gudang,
      harga_modal, harga_jual_satuan, harga_jual_grosir, harga_jual_promo, diskon,
      base_unit, default_purchase_unit, conversion_ratio,
      kategori(nama)
    `, { count: "exact" })
    .order("nama_produk");

  if (search) {
    query = query.or(`nama_produk.ilike.%${search}%,barcode.ilike.%${search}%`);
  }

  const { data, error, count } = await query.range(from, to);

  if (error) {
    console.error("Failed to fetch products:", error);
    return NextResponse.json({ error: "Gagal mengambil data produk" }, { status: 500 });
  }

  const res = NextResponse.json({ data: data ?? [], total: count ?? 0, page, limit });
  res.headers.set("Cache-Control", "public, max-age=60, s-maxage=120, stale-while-revalidate=300");
  return res;
}
