import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { fetchAllRows } from "@/lib/supabase/fetch-all";
import { POS_PRODUCT_COLUMNS } from "@/lib/pos-data";
import { ilikeContainsPattern, ilikeContainsValue } from "@/lib/postgrest-filter";

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

  // Filter pencarian dihitung SEKALI lalu dipakai semua chunk.
  //
  // Dua hal yang wajib dijaga di sini:
  // 1. Pencarian WAJIB memakai wildcard %...% (ilikeContainsPattern). Tanpa itu
  //    `ilike` berarti pencocokan PERSIS sehingga mengetik sebagian nama
  //    selalu kosong.
  // 2. Nilai di dalam or=() WAJIB dikutip (ditangani ilikeContainsPattern),
  //    kalau tidak nama produk yang memuat koma/kurung/kutip — mis.
  //    `AUGERBITS 1/4" (6MM) HIOSHI` — membuat parser PostgREST gagal dan
  //    hasilnya kosong.
  //
  // Kolom yang dicari sengaja disamakan dengan filter lokal di pos-client
  // (nama, barcode, SKU, merk, kategori) supaya hasil dari server tidak
  // "menghapus" produk yang sempat tampil dari filter lokal saat kasir
  // mengetik — inilah gejala "muncul lalu tiba-tiba tidak ditemukan".
  let searchFilter: string | null = null;
  if (search) {
    const pattern = ilikeContainsPattern(search);
    const parts = [
      `nama_produk.ilike.${pattern}`,
      `barcode.ilike.${pattern}`,
      `sku.ilike.${pattern}`,
    ];

    // PostgREST tidak bisa memfilter relasi (merk.nama / kategori.nama) di
    // dalam or=() — mencobanya menghasilkan error PGRST100. Jadi id yang
    // namanya cocok dicari lebih dulu lewat query terpisah, lalu dimasukkan
    // sebagai id.in.(...). Bila query bantu ini gagal, pencarian nama tetap
    // jalan (hanya nama merk/kategori yang tidak ikut dicocokkan).
    type IdRow = { id: number };
    const [kategoriRes, merkRes] = await Promise.all([
      supabase
        .from("kategori")
        .select("id")
        .ilike("nama", ilikeContainsValue(search)),
      supabase.from("merk").select("id").ilike("nama", ilikeContainsValue(search)),
    ]);
    if (kategoriRes.error) console.error("Gagal mencari kategori:", kategoriRes.error);
    if (merkRes.error) console.error("Gagal mencari merk:", merkRes.error);

    const kategoriIds = ((kategoriRes.data ?? []) as IdRow[]).map((r) => r.id);
    const merkIds = ((merkRes.data ?? []) as IdRow[]).map((r) => r.id);
    if (kategoriIds.length > 0) parts.push(`id_kategori.in.(${kategoriIds.join(",")})`);
    if (merkIds.length > 0) parts.push(`id_merk.in.(${merkIds.join(",")})`);

    searchFilter = parts.join(",");
  }

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

    if (searchFilter) query = query.or(searchFilter);

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
