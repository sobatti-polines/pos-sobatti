import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { fetchAllRows } from "@/lib/supabase/fetch-all";
import { POS_PRODUCT_COLUMNS } from "@/lib/pos-data";
import { ilikePattern } from "@/lib/postgrest-filter";

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
    // Daftar kolom dipegang bersama dengan bootstrap POS (lib/pos-data.ts)
    // supaya bentuk objek produk tidak pernah berbeda antar jalur.
    let query = supabase
      .from("produk")
      .select(POS_PRODUCT_COLUMNS)
      .order("nama_produk");

    if (search) {
      // Nilai pencarian WAJIB di-escape + dikutip: nama produk mengandung
      // koma/kurung/tanda kutip (contoh: AUGERBITS 1/2" (13 MM) HIOSHI) dan
      // pattern mentah membuat parser or= PostgREST gagal → hasil kosong.
      // Wildcard ILIKE (% _) juga di-escape agar dicari sebagai karakter literal.
      const pattern = ilikePattern(search);
      query = query.or(
        `nama_produk.ilike.${pattern},barcode.ilike.${pattern},sku.ilike.${pattern}`
      );
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
