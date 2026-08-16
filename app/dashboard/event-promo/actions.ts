"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { logActivity, buildDeskripsi } from "@/lib/activity-log";

export async function saveEventPromo(data: any, isNew: boolean, selectedProducts: number[]) {
  const supabase = await createClient();

  const promoData = {
    nama: data.nama,
    tanggal_mulai: data.tanggal_mulai,
    tanggal_selesai: data.tanggal_selesai,
    tipe_diskon: data.tipe_diskon,
    nilai_diskon: data.nilai_diskon,
    aktif: data.aktif,
  };

  let eventId = data.id;
  let dataLama: Record<string, unknown> | null = null;

  if (isNew) {
    const { data: inserted, error } = await supabase
      .from("event_promo")
      .insert(promoData)
      .select()
      .single();

    if (error) return { error: error.message };
    eventId = inserted.id;
  } else {
    // Ambil data lama untuk diff log
    const { data: existing } = await supabase
      .from("event_promo")
      .select("nama, tanggal_mulai, tanggal_selesai, tipe_diskon, nilai_diskon, aktif")
      .eq("id", eventId)
      .single();

    if (existing) {
      dataLama = existing as unknown as Record<string, unknown>;
    }

    const { error } = await supabase
      .from("event_promo")
      .update(promoData)
      .eq("id", eventId);
    if (error) return { error: error.message };

    await supabase.from("event_promo_produk").delete().eq("id_event_promo", eventId);
  }

  if (selectedProducts.length > 0) {
    const rows = selectedProducts.map(pId => ({ id_event_promo: eventId, id_produk: pId }));
    const { error: relError } = await supabase.from("event_promo_produk").insert(rows);
    if (relError) return { error: relError.message };
  }

  await logActivity(supabase, {
    aksi: isNew ? "CREATE" : "UPDATE",
    entitas: "event_promo",
    deskripsi: buildDeskripsi({
      aksi: isNew ? "CREATE" : "UPDATE",
      entitas: "event_promo",
      data_lama: dataLama,
      data_baru: { ...promoData, jumlah_produk: selectedProducts.length } as unknown as Record<string, unknown>,
    }),
    data_lama: dataLama,
    data_baru: { ...promoData, jumlah_produk: selectedProducts.length } as unknown as Record<string, unknown>,
  });

  revalidatePath("/dashboard/event-promo");
  return { success: true };
}

export async function deleteEventPromo(id: string) {
  const supabase = await createClient();

  // Ambil data lama untuk log
  const { data: existing } = await supabase
    .from("event_promo")
    .select("nama, tanggal_mulai, tanggal_selesai, tipe_diskon, nilai_diskon, aktif")
    .eq("id", id)
    .single();

  const { error } = await supabase.from("event_promo").delete().eq("id", id);
  if (error) return { error: error.message };

  await logActivity(supabase, {
    aksi: "DELETE",
    entitas: "event_promo",
    deskripsi: buildDeskripsi({
      aksi: "DELETE",
      entitas: "event_promo",
      data_lama: existing ? (existing as unknown as Record<string, unknown>) : { id },
    }),
    data_lama: existing ? (existing as unknown as Record<string, unknown>) : { id },
  });

  revalidatePath("/dashboard/event-promo");
  return { success: true };
}
