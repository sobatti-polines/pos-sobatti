import { createClient } from "@/lib/supabase/server";

export interface LowStockItem {
  id: number;
  nama_produk: string;
  stok: number; // stok display
  stok_gudang: number;
  stok_minimum: number; // ambang display (default 5)
  stok_minimum_gudang: number | null; // ambang gudang (NULL = nonaktif)
  displayLow: boolean;
  gudangLow: boolean;
  satuan: { nama: string } | null;
}

// Peringatan display: konsisten dengan perilaku lama — stok display 0
// dianggap "Habis" (badge terpisah), bukan "Menipis".
function isDisplayLow(stok: number, stok_minimum: number | null): boolean {
  return stok > 0 && stok <= (stok_minimum ?? 5);
}

// Peringatan gudang: aktif jika ambang diisi dan stok_gudang <= ambang
// (termasuk 0 — gudang kosong perlu segera diisi). Keputusan user.
function isGudangLow(stokGudang: number, stokMinimumGudang: number | null): boolean {
  return stokMinimumGudang != null && stokGudang <= stokMinimumGudang;
}

export async function getLowStockItems(): Promise<LowStockItem[]> {
  const supabase = await createClient();

  const { data } = await supabase
    .from("produk")
    .select(
      "id, nama_produk, hitung_stok, stok, stok_gudang, stok_minimum, stok_minimum_gudang, satuan(nama)"
    )
    .eq("hitung_stok", true);

  if (!data) return [];

  const items: LowStockItem[] = [];
  for (const p of data) {
    const stok = p.stok ?? 0;
    const stokGudang = p.stok_gudang ?? 0;
    const displayLow = isDisplayLow(stok, p.stok_minimum);
    const gudangLow = isGudangLow(stokGudang, p.stok_minimum_gudang);
    if (!displayLow && !gudangLow) continue;

    items.push({
      id: p.id,
      nama_produk: p.nama_produk,
      stok,
      stok_gudang: stokGudang,
      stok_minimum: p.stok_minimum ?? 5,
      stok_minimum_gudang: p.stok_minimum_gudang ?? null,
      displayLow,
      gudangLow,
      satuan: p.satuan as unknown as { nama: string } | null,
    });
  }

  // Urutkan berdasarkan nilai stok terendah yang sedang menipis.
  items.sort((a, b) => {
    const aCritical = a.displayLow
      ? a.stok
      : a.gudangLow
        ? a.stok_gudang
        : Infinity;
    const bCritical = b.displayLow
      ? b.stok
      : b.gudangLow
        ? b.stok_gudang
        : Infinity;
    return aCritical - bCritical;
  });

  return items;
}
