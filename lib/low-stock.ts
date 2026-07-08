import { createClient } from "@/lib/supabase/server";

export interface LowStockItem {
  id: number;
  nama_produk: string;
  stok: number;
  stok_minimum: number;
  satuan: { nama: string } | null;
}

export async function getLowStockItems(): Promise<LowStockItem[]> {
  const supabase = await createClient();

  const { data } = await supabase
    .from("produk")
    .select("id, nama_produk, stok, stok_minimum, satuan(nama)")
    .eq("hitung_stok", true);

  if (!data) return [];

  const items: LowStockItem[] = [];
  for (const p of data) {
    const stok = p.stok ?? 0;
    const min = p.stok_minimum ?? 5;
    if (stok <= min) {
      items.push({
        id: p.id,
        nama_produk: p.nama_produk,
        stok,
        stok_minimum: min,
        satuan: p.satuan as unknown as { nama: string } | null,
      });
    }
  }

  items.sort((a, b) => a.stok - b.stok);
  return items;
}
