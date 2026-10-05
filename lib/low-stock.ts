import { unstable_cache } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { fetchAllRows } from "@/lib/supabase/fetch-all";

export interface LowStockItem {
  id: number;
  nama_produk: string;
  stok: number; // stok display
  stok_gudang: number;
  stok_minimum: number | null; // ambang display (NULL = nonaktif)
  stok_minimum_gudang: number | null; // ambang gudang (NULL = nonaktif)
  displayLow: boolean;
  gudangLow: boolean;
  satuan: { nama: string } | null;
}

// Peringatan display: konsisten dengan perilaku lama — stok display 0
// dianggap "Habis" (badge terpisah), bukan "Menipis".
function isDisplayLow(stok: number, stok_minimum: number | null): boolean {
  return stok > 0 && stok_minimum != null && stok <= stok_minimum;
}

// Peringatan gudang: aktif jika ambang diisi dan stok_gudang <= ambang
// (termasuk 0 — gudang kosong perlu segera diisi). Keputusan user.
function isGudangLow(stokGudang: number, stokMinimumGudang: number | null): boolean {
  return stokMinimumGudang != null && stokGudang <= stokMinimumGudang;
}

interface LowStockRpcRow {
  id: number;
  nama_produk: string;
  stok: number | string;
  stok_gudang: number | string;
  stok_minimum: number | null;
  stok_minimum_gudang: number | string | null;
  display_low: boolean;
  gudang_low: boolean;
  satuan_nama: string | null;
}

function mapRpcRow(p: LowStockRpcRow): LowStockItem {
  return {
    id: p.id,
    nama_produk: p.nama_produk,
    stok: Number(p.stok ?? 0),
    stok_gudang: Number(p.stok_gudang ?? 0),
    stok_minimum: p.stok_minimum ?? null,
    stok_minimum_gudang:
      p.stok_minimum_gudang == null ? null : Number(p.stok_minimum_gudang),
    displayLow: p.display_low,
    gudangLow: p.gudang_low,
    satuan: p.satuan_nama ? { nama: p.satuan_nama } : null,
  };
}

/**
 * Daftar produk menipis via 1 RPC agregasi, di-cache 45 detik.
 *
 * Sebelumnya tiap render dashboard memindai SELURUH tabel produk lewat
 * fetchAllRows (chunk 1000 baris per roundtrip Bogor->Tokyo) lalu memfilter
 * di JS. Sekarang filter + sort dikerjakan di SQL dan yang pulang hanya
 * yang menipis (maks 50 baris).
 *
 * Memakai supabaseAdmin (tanpa cookies) supaya boleh masuk unstable_cache;
 * datanya global, bukan per-user. Stale maksimal 45 detik sudah disetujui.
 */
const getLowStockPreviewCached = unstable_cache(
  async (): Promise<LowStockItem[]> => {
    const { data, error } = await supabaseAdmin.rpc("get_low_stock_preview", {
      p_limit: 50,
    });
    if (error) throw error;
    return ((data ?? []) as unknown as LowStockRpcRow[]).map(mapRpcRow);
  },
  ["low-stock-preview-v1"],
  { revalidate: 45 }
);

export async function getLowStockItems(): Promise<LowStockItem[]> {
  try {
    return await getLowStockPreviewCached();
  } catch (e) {
    // Rollback aman selama migration RPC belum ada di environment ini.
    console.error("get_low_stock_preview RPC gagal, fallback fetchAllRows:", e);
    return getLowStockItemsLegacy();
  }
}

/**
 * Implementasi lama (pindai semua produk). Dipertahankan sebagai fallback
 * selama masa rollout migration RPC.
 */
async function getLowStockItemsLegacy(): Promise<LowStockItem[]> {
  const supabase = await createClient();

  const data = await fetchAllRows(supabase, (db, from, to) =>
    db
      .from("produk")
      .select(
        "id, nama_produk, hitung_stok, stok, stok_gudang, stok_minimum, stok_minimum_gudang, satuan(nama)"
      )
      .eq("hitung_stok", true)
      .range(from, to)
  ).catch((e) => {
    console.error("Failed to fetch products for low stock:", e);
    return null;
  });

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
      stok_minimum: p.stok_minimum ?? null,
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
