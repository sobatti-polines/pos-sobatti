import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

/**
 * Klien Supabase server yang dibagi per-request.
 *
 * `createClient()` membuat instance baru setiap kali dipanggil, dan setiap
 * instance membaca cookies. Layout, page, dan helper di lib/ sering
 * memanggilnya masing-masing dalam satu render yang sama.
 *
 * React `cache()` memoisasi hasil hanya untuk satu request render, sehingga
 * panggilan berulang tidak menambah kerja/round-trip. Karena cakupannya satu
 * request, tidak ada risiko data tertukar antar-user.
 */
export const getServerSupabase = cache(createClient);

/**
 * User terautentikasi, diambil sekali per request.
 *
 * Sebelumnya `supabase.auth.getUser()` dipanggil terpisah di layout, page,
 * dan lib/dashboard — masing-masing satu round-trip ke Supabase Auth. Karena
 * klien server memaksa `cache: "no-store"`, semuanya benar-benar menempuh
 * jaringan, sehingga di koneksi lambat biaya ini terasa berurutan sebelum
 * halaman bisa dirender.
 */
export const getSessionUser = cache(async () => {
  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});
