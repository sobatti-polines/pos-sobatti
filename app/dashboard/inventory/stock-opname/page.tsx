import { createClient } from "@/lib/supabase/server";
import StockOpnameClient from "./stock-opname-client";

export default async function StockOpnamePage() {
  const supabase = await createClient();

  const { data: rawProducts } = await supabase
    .from("produk")
    .select("id, nama_produk, stok, stok_gudang, barcode, hitung_stok, lokasi_area(nama)")
    .eq("hitung_stok", true)
    .is("id_produk_master", null)
    .order("nama_produk");

  const products = (rawProducts ?? []).map((p) => ({
    ...p,
    lokasi_area: Array.isArray(p.lokasi_area) ? (p.lokasi_area[0] ?? null) : p.lokasi_area,
  }));

  return (
    <StockOpnameClient products={products} />
  );
}
