import { SupabaseClient } from "@supabase/supabase-js";

export interface StoreSettings {
  nama_toko: string | null;
  alamat: string | null;
  telepon: string | null;
  email: string | null;
}

/**
 * Ambil info toko dari tabel `pengaturan` (id = 1) untuk header laporan.
 * Mengembalikan null bila tidak ada data (aman untuk row kosong / tabel belum diisi).
 */
export async function getStoreSettings(
  supabase: SupabaseClient
): Promise<StoreSettings | null> {
  try {
    const { data, error } = await supabase
      .from("pengaturan")
      .select("nama_toko, alamat, telepon, email")
      .eq("id", 1)
      .maybeSingle();

    if (error || !data) return null;

    return {
      nama_toko: data.nama_toko ?? null,
      alamat: data.alamat ?? null,
      telepon: data.telepon ?? null,
      email: data.email ?? null,
    };
  } catch {
    return null;
  }
}