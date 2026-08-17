import { createClient } from "@/lib/supabase/server";
import { fetchAllRows } from "@/lib/supabase/fetch-all";
import StockOpnameClient from "./stock-opname-client";

export default async function StockOpnamePage() {
  const supabase = await createClient();

  // fetchAllRows: PostgREST memotong di 1000 baris per request — tanpa ini
  // produk ke-1001+ tidak ikut dihitung stok opname.
  const rawProducts = await fetchAllRows(supabase, (db, from, to) =>
    db.from("produk")
      .select("id, nama_produk, stok, stok_gudang, barcode, hitung_stok, lokasi_area(nama)")
      .eq("hitung_stok", true)
      .is("id_produk_master", null)
      .order("nama_produk")
      .range(from, to)
  ).catch((e) => {
    console.error("Failed to fetch products:", e);
    return [];
  });

  const products = (rawProducts ?? []).map((p) => ({
    ...p,
    lokasi_area: Array.isArray(p.lokasi_area) ? (p.lokasi_area[0] ?? null) : p.lokasi_area,
  }));

  return (
    <StockOpnameClient products={products} />
  );
}
