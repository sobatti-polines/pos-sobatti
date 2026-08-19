import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { fetchAllRows } from "@/lib/supabase/fetch-all";

// JANGAN cache: produk yang baru ditambahkan tidak muncul di banner/dashboard
// stok menipis selama cache publik masih berlaku (s-maxage + stale-while-revalidate).
export const dynamic = "force-dynamic";

// Peringatan display: stok display 0 dianggap "Habis" (badge terpisah),
// bukan "Menipis" — konsisten dengan perilaku lama.
function isDisplayLow(stok: number, stok_minimum: number | null): boolean {
  return stok > 0 && stok_minimum != null && stok <= stok_minimum;
}

// Peringatan gudang: aktif jika ambang diisi dan stok_gudang <= ambang
// (termasuk 0 — gudang kosong perlu segera diisi).
function isGudangLow(stokGudang: number, stokMinimumGudang: number | null): boolean {
  return stokMinimumGudang != null && stokGudang <= stokMinimumGudang;
}

export async function GET() {
  let supabase;
  try {
    supabase = await createClient();
  } catch {
    return NextResponse.json([]);
  }

  const data = await fetchAllRows(supabase, (db, from, to) =>
    db
      .from("produk")
      .select(
        "id, nama_produk, hitung_stok, stok, stok_gudang, stok_minimum, stok_minimum_gudang, satuan(nama)"
      )
      .eq("hitung_stok", true)
      .range(from, to)
  ).catch((e) => {
    console.error("Failed to fetch products for low stock API:", e);
    return null;
  });

  if (!data) return NextResponse.json([]);

  const lowStock = data
    .map((p) => {
      const stok = p.stok ?? 0;
      const stokGudang = p.stok_gudang ?? 0;
      return {
        ...p,
        stok,
        stok_gudang: stokGudang,
        stok_minimum: p.stok_minimum ?? null,
        stok_minimum_gudang: p.stok_minimum_gudang ?? null,
        displayLow: isDisplayLow(stok, p.stok_minimum),
        gudangLow: isGudangLow(stokGudang, p.stok_minimum_gudang),
      };
    })
    .filter((p) => p.displayLow || p.gudangLow);

  lowStock.sort((a, b) => {
    const aCritical = a.displayLow ? a.stok : a.gudangLow ? a.stok_gudang : Infinity;
    const bCritical = b.displayLow ? b.stok : b.gudangLow ? b.stok_gudang : Infinity;
    return aCritical - bCritical;
  });

  const res = NextResponse.json(lowStock);
  res.headers.set("Cache-Control", "no-store");
  return res;
}
