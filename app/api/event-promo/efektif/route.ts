import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { getEffectivePrices } from "@/lib/promo";

// Logika harga efektif promo sengaja TIDAK ditulis di sini lagi — dipakai
// bersama dengan bootstrap POS lewat `lib/promo.ts` supaya aturan harga hanya
// punya satu sumber. Endpoint ini tetap ada karena masih dipakai klien POS
// untuk menimpa harga hasil pencarian server.
export async function POST(request: Request) {
  const supabase = await createClient();

  try {
    const body = await request.json();
    const { id_produk } = body; // Bisa single number atau array of numbers

    if (!id_produk) {
      return NextResponse.json({ error: "id_produk diperlukan" }, { status: 400 });
    }

    const ids = Array.isArray(id_produk) ? id_produk : [id_produk];
    const results = await getEffectivePrices(supabase, ids);

    return NextResponse.json(results);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Gagal menghitung harga promo";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
