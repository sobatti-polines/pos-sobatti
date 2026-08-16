import { createClient } from "@/lib/supabase/server";
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

  const { data: produk } = await supabase
    .from("produk")
    .select("id, nama_produk, stok, harga_jual_satuan")
    .order("nama_produk", { ascending: true });

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
      <EventPromoClient initialPromos={promos || []} products={produk || []} />
    </div>
  );
}
