import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { logActivity } from "@/lib/activity-log";

export async function POST(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const supabase = await createClient();
  const body = await request.json();
  
  const { error } = await supabase
    .from("event_promo_produk")
    .insert({
      id_event_promo: params.id,
      id_produk: body.id_produk
    });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Ambil nama event & produk untuk deskripsi log yang informatif
  const { data: event } = await supabase
    .from("event_promo")
    .select("nama")
    .eq("id", params.id)
    .single();
  const { data: produk } = await supabase
    .from("produk")
    .select("nama_produk")
    .eq("id", body.id_produk)
    .single();

  await logActivity(supabase, {
    aksi: "CREATE",
    entitas: "event_promo_produk",
    deskripsi: `Menambahkan produk '${produk?.nama_produk ?? body.id_produk}' ke Event Promo '${event?.nama ?? params.id}'`,
    data_baru: { id_event_promo: params.id, id_produk: body.id_produk, nama_event: event?.nama ?? null, nama_produk: produk?.nama_produk ?? null },
  });

  return NextResponse.json({ success: true });
}
