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

  interface RawProduct {
    id: number;
    nama_produk: string;
    id_kategori: number;
    id_satuan: number;
    hitung_stok: boolean;
    barcode: string | null;
    harga_modal: number;
    harga_jual_satuan: number;
    harga_jual_grosir: number;
    harga_jual_promo: number | null;
    diskon: number;
    stok: number | null;
    kategori: { nama: string } | null;
    satuan: { nama: string } | null;
  }

  const productsWithStock = (productsRes.data ?? []).map((p: RawProduct) => {
    const stock = p.hitung_stok ? (p.stok ?? 0) : null;
    return { ...p, stock };
  });

  return (
    <div className="flex-1 p-4 md:p-8 lg:p-12 w-full flex flex-col gap-4 md:gap-8 mx-auto h-full md:max-h-screen md:overflow-hidden">
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
