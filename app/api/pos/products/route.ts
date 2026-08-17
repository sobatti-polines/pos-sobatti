import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { fetchAllRows } from "@/lib/supabase/fetch-all";

// JANGAN cache route ini (baik server-side maupun CDN):
// 1. Data produk harus SELALU fresh — cache publik membuat produk yang baru
//    ditambahkan tidak muncul di POS hingga 7 menit (s-maxage + stale-while-revalidate),
//    yang membuat kasir mengira gagal lalu menambah produk berulang → duplikat.
// 2. Cache "public" juga membocorkan response antar-user (RLS tidak dijalankan
//    lagi karena response diambil dari CDN, bukan dari query per-user).
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const supabase = await createClient();

  const search = req.nextUrl.searchParams.get("search") || "";

  // fetchAllRows: PostgREST memotong response maksimal max_rows (1000 baris)
  // per request — `limit` besar sekalipun tetap dipotong di 1000. Loop chunk
  // 1000 baris supaya seluruh katalog (bisa 1199+ produk) ikut termuat.
  const buildQuery = (from: number, to: number) => {
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
      `)
      .order("nama_produk");

    if (search) {
      query = query.or(`nama_produk.ilike.%${search}%,barcode.ilike.%${search}%,sku.ilike.%${search}%`);
    }

    return query.range(from, to);
  };

  let data: unknown[] = [];
  try {
    data = await fetchAllRows(supabase, (db, from, to) => buildQuery(from, to));
  } catch (error) {
    console.error("Failed to fetch products:", error);
    return NextResponse.json({ error: "Gagal mengambil data produk" }, { status: 500 });
  }

  const res = NextResponse.json({ data, total: data.length, page: 1, limit: data.length });
  res.headers.set("Cache-Control", "no-store");
  return res;
}
