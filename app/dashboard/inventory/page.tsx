import { createClient } from "@/lib/supabase/server";
import InventoryClient from "./inventory-client";

export default async function InventoryPage() {
  const supabase = await createClient();

  const [productsRes, categoriesRes, unitsRes] = await Promise.all([
    supabase.from("produk").select(`
      *,
      kategori(nama),
      satuan(nama)
    `).order("id", { ascending: false }),
    supabase.from("kategori").select("*").order("nama"),
    supabase.from("satuan").select("*").order("nama")
  ]);

  const productsWithStock = (productsRes.data ?? []).map((p: any) => {
    // Use the physical 'stok' column if it exists, otherwise fall back to null
    const stock = p.hitung_stok ? (p.stok ?? 0) : null;
    return { ...p, stock };
  });

  return (
    <div className="flex-1 p-8 lg:p-12 w-full flex flex-col gap-8 mx-auto h-full max-h-screen overflow-hidden">
      <header className="shrink-0">
        <h1 className="text-4xl font-light tracking-tighter text-foreground">
          Inventaris
        </h1>
        <p className="text-muted-foreground mt-2">
          Kelola stok, harga, dan rincian produk
        </p>
      </header>

      <InventoryClient 
        initialProducts={productsWithStock} 
        categories={categoriesRes.data ?? []} 
        units={unitsRes.data ?? []} 
      />
    </div>
  );
}
