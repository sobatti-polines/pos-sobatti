import { createClient } from "@/lib/supabase/server";
import StockOpnameClient from "./stock-opname-client";

export default async function StockOpnamePage() {
  const supabase = await createClient();

  const { data: products } = await supabase
    .from("produk")
    .select("id, nama_produk, stok, stok_gudang, barcode, hitung_stok")
    .eq("hitung_stok", true)
    .is("id_produk_master", null)
    .order("nama_produk");

  return (
    <StockOpnameClient products={products ?? []} />
  );
}
