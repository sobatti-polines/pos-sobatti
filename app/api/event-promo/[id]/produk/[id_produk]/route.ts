import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function DELETE(
  request: Request,
  props: { params: Promise<{ id: string; id_produk: string }> }
) {
  const params = await props.params;
  const supabase = await createClient();
  
  const { error } = await supabase
    .from("event_promo_produk")
    .delete()
    .eq("id_event_promo", params.id)
    .eq("id_produk", parseInt(params.id_produk, 10));

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
