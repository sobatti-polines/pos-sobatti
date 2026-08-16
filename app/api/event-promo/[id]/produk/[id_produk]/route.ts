import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { logActivity } from "@/lib/activity-log";

export async function DELETE(
  request: Request,
  props: { params: Promise<{ id: string; id_produk: string }> }
) {
  const params = await props.params;
  const supabase = await createClient();

  // Ambil nama event & produk untuk deskripsi log yang informatif
  const { data: event } = await supabase
    .from("event_promo")
    .select("nama")
    .eq("id", params.id)
    .single();
  const { data: produk } = await supabase
    .from("produk")
    .select("nama_produk")
    .eq("id", parseInt(params.id_produk, 10))
    .single();
  
  const { error } = await supabase
    .from("event_promo_produk")
    .delete()
    .eq("id_event_promo", params.id)
    .eq("id_produk", parseInt(params.id_produk, 10));

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logActivity(supabase, {
    aksi: "DELETE",
    entitas: "event_promo_produk",
    deskripsi: `Menghapus produk '${produk?.nama_produk ?? params.id_produk}' dari Event Promo '${event?.nama ?? params.id}'`,
    data_lama: { id_event_promo: params.id, id_produk: params.id_produk, nama_event: event?.nama ?? null, nama_produk: produk?.nama_produk ?? null },
  });

  return NextResponse.json({ success: true });
}
