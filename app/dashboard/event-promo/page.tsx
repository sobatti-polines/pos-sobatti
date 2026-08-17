import { createClient } from "@/lib/supabase/server";
import { fetchAllRows } from "@/lib/supabase/fetch-all";
import { redirect } from "next/navigation";
import EventPromoClient from "./client";

export default async function EventPromoPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) redirect("/");

  const { data: promos } = await supabase
    .from("event_promo")
    .select("*, event_promo_produk(id_produk)")
    .order("created_at", { ascending: false });

  // fetchAllRows: PostgREST memotong di 1000 baris per request — tanpa ini
  // produk ke-1001+ tidak bisa dipilih untuk event promo.
  const produk = await fetchAllRows(supabase, (db, from, to) =>
    db.from("produk").select("id, nama_produk, stok, harga_jual_satuan").order("nama_produk", { ascending: true }).range(from, to)
  ).catch((e) => {
    console.error("Failed to fetch products:", e);
    return [];
  });

  return (
    <div className="flex-1 p-4 md:p-8 lg:p-12 w-full flex flex-col gap-4 md:gap-8 mx-auto h-full md:max-h-screen md:overflow-hidden">
      <header className="shrink-0 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-light tracking-tighter text-foreground">
            Event Promo
          </h1>
          <p className="text-muted-foreground mt-2">
            Kelola diskon event otomatis berbasis tanggal
          </p>
        </div>
      </header>
      <EventPromoClient initialPromos={promos || []} products={produk} />
    </div>
  );
}
