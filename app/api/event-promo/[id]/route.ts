import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function PUT(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const supabase = await createClient();
  const body = await request.json();
  const { id_produk, ...promoData } = body;

  const { data, error } = await supabase
    .from("event_promo")
    .update(promoData)
    .eq("id", params.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (id_produk && Array.isArray(id_produk)) {
    await supabase.from("event_promo_produk").delete().eq("id_event_promo", params.id);
    
    if (id_produk.length > 0) {
      const produkData = id_produk.map((prodId) => ({
        id_event_promo: params.id,
        id_produk: prodId,
      }));
      const { error: produkError } = await supabase
        .from("event_promo_produk")
        .insert(produkData);
      if (produkError) return NextResponse.json({ error: produkError.message }, { status: 500 });
    }
  }

  return NextResponse.json(data);
}

export async function DELETE(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const supabase = await createClient();
  const { error } = await supabase.from("event_promo").delete().eq("id", params.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
