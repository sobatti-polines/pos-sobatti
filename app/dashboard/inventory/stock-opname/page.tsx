import { createClient } from "@/lib/supabase/server";
import StockOpnameClient from "./stock-opname-client";

export default async function StockOpnamePage() {
  const supabase = await createClient();

  const { data: products } = await supabase
    .from("produk")
    .select("id, nama_produk, stok, hitung_stok")
    .eq("hitung_stok", true)
    .order("nama_produk");

  return (
    <div className="flex-1 p-4 md:p-8 lg:p-12 w-full flex flex-col gap-4 md:gap-8 mx-auto h-full md:max-h-screen md:overflow-hidden">
      <header className="shrink-0">
        <h1 className="text-4xl font-light tracking-tighter text-foreground">
          Stok Opname
        </h1>
        <p className="text-muted-foreground mt-2">
          Catat pengecekan fisik stok dan hitung selisih dengan sistem
        </p>
      </header>

      <StockOpnameClient products={products ?? []} />
    </div>
  );
}
