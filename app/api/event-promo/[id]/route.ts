import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { logActivity, buildDeskripsi } from "@/lib/activity-log";

export async function PUT(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const supabase = await createClient();
  const body = await request.json();
  const { id_produk, ...promoData } = body;

  // Ambil data lama untuk diff log
  const { data: existing } = await supabase
    .from("event_promo")
    .select("nama, tanggal_mulai, tanggal_selesai, tipe_diskon, nilai_diskon, aktif")
    .eq("id", params.id)
    .single();

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

  await logActivity(supabase, {
    aksi: "UPDATE",
    entitas: "event_promo",
    deskripsi: buildDeskripsi({
      aksi: "UPDATE",
      entitas: "event_promo",
      data_lama: existing ? (existing as unknown as Record<string, unknown>) : null,
      data_baru: { ...(promoData as Record<string, unknown>), jumlah_produk: Array.isArray(id_produk) ? id_produk.length : 0 },
    }),
    data_lama: existing ? (existing as unknown as Record<string, unknown>) : null,
    data_baru: { ...(promoData as Record<string, unknown>), jumlah_produk: Array.isArray(id_produk) ? id_produk.length : 0 },
  });

  return NextResponse.json(data);
}

export async function DELETE(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const supabase = await createClient();

  // Ambil data lama untuk log
  const { data: existing } = await supabase
    .from("event_promo")
    .select("nama, tanggal_mulai, tanggal_selesai, tipe_diskon, nilai_diskon, aktif")
    .eq("id", params.id)
    .single();

  const { error } = await supabase.from("event_promo").delete().eq("id", params.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logActivity(supabase, {
    aksi: "DELETE",
    entitas: "event_promo",
    deskripsi: buildDeskripsi({
      aksi: "DELETE",
      entitas: "event_promo",
      data_lama: existing ? (existing as unknown as Record<string, unknown>) : { id: params.id },
    }),
    data_lama: existing ? (existing as unknown as Record<string, unknown>) : { id: params.id },
  });

  return NextResponse.json({ success: true });
}
