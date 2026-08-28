import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { fetchAllRows } from "@/lib/supabase/fetch-all";
import PergerakanHargaClient from "./pergerakan-harga-client";
import { type ProductOption } from "./actions";
import { isOwnerLike } from "@/lib/roles";

export default async function PergerakanHargaPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/");

  const username = user.email?.split("@")[0];
  const { data: pengguna } = await supabase
    .from("pengguna")
    .select("level")
    .eq("username", username)
    .maybeSingle();

  if (!isOwnerLike(pengguna?.level)) redirect("/dashboard");

  const products = await fetchAllRows<ProductOption>(supabase, (db, from, to) =>
    db
      .from("produk")
      .select("id, nama_produk, sku, barcode")
      .order("nama_produk")
      .range(from, to)
  ).catch((err) => {
    console.error("Failed to fetch products for price movement report:", err);
    return [];
  });

  return (
    <div className="flex-1 p-4 md:p-8 lg:p-12 w-full flex flex-col gap-4 md:gap-8 mx-auto h-full md:max-h-screen md:overflow-hidden">
      <header className="shrink-0 print:hidden">
        <h1 className="text-4xl font-light tracking-tighter text-foreground">
          Pergerakan Harga Barang
        </h1>
        <p className="text-muted-foreground mt-2">
          Pilih produk untuk melihat kapan harga berubah, naik atau turun, dan berapa qty yang terjual pada harga tersebut.
        </p>
      </header>

      <PergerakanHargaClient products={products} initialReport={null} />
    </div>
  );
}
