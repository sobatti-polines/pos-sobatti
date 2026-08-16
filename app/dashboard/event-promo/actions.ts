"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function saveEventPromo(data: any, isNew: boolean, selectedProducts: number[]) {
  const supabase = await createClient();

  let eventId = data.id;

  if (isNew) {
    const { data: inserted, error } = await supabase
      .from("event_promo")
      .insert({
        nama: data.nama,
        tanggal_mulai: data.tanggal_mulai,
        tanggal_selesai: data.tanggal_selesai,
        tipe_diskon: data.tipe_diskon,
        nilai_diskon: data.nilai_diskon,
        aktif: data.aktif,
      })
      .select()
      .single();

    if (error) return { error: error.message };
    eventId = inserted.id;
  } else {
    const { error } = await supabase
      .from("event_promo")
      .update({
        nama: data.nama,
        tanggal_mulai: data.tanggal_mulai,
        tanggal_selesai: data.tanggal_selesai,
        tipe_diskon: data.tipe_diskon,
        nilai_diskon: data.nilai_diskon,
        aktif: data.aktif,
      })
      .eq("id", eventId);
    if (error) return { error: error.message };
    
    await supabase.from("event_promo_produk").delete().eq("id_event_promo", eventId);
  }

  if (selectedProducts.length > 0) {
    const rows = selectedProducts.map(pId => ({ id_event_promo: eventId, id_produk: pId }));
    const { error: relError } = await supabase.from("event_promo_produk").insert(rows);
    if (relError) return { error: relError.message };
  }

  revalidatePath("/dashboard/event-promo");
  return { success: true };
}

export async function deleteEventPromo(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("event_promo").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/dashboard/event-promo");
  return { success: true };
}
