import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { logActivity, buildDeskripsi } from "@/lib/activity-log";

export async function GET(request: Request) {
  const supabase = await createClient();
  const { searchParams } = new URL(request.url);
  const aktif = searchParams.get("aktif");

  let query = supabase.from("event_promo").select("*").order("created_at", { ascending: false });
  if (aktif !== null) {
    query = query.eq("aktif", aktif === "true");
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const body = await request.json();
  
  const { id_produk, ...promoData } = body;

  const { data: eventPromo, error: eventError } = await supabase
    .from("event_promo")
    .insert(promoData)
    .select()
    .single();

  if (eventError) return NextResponse.json({ error: eventError.message }, { status: 500 });

  if (id_produk && Array.isArray(id_produk) && id_produk.length > 0) {
    const produkData = id_produk.map((id) => ({
      id_event_promo: eventPromo.id,
      id_produk: id,
    }));
    
    const { error: produkError } = await supabase
      .from("event_promo_produk")
      .insert(produkData);
      
    if (produkError) {
      return NextResponse.json({ error: produkError.message }, { status: 500 });
    }
  }

  await logActivity(supabase, {
    aksi: "CREATE",
    entitas: "event_promo",
    deskripsi: buildDeskripsi({
      aksi: "CREATE",
      entitas: "event_promo",
      data_baru: { ...(promoData as Record<string, unknown>), jumlah_produk: Array.isArray(id_produk) ? id_produk.length : 0 },
    }),
    data_baru: { ...(promoData as Record<string, unknown>), jumlah_produk: Array.isArray(id_produk) ? id_produk.length : 0 },
  });

  return NextResponse.json(eventPromo);
}
