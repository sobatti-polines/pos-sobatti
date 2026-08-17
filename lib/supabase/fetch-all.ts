import type { SupabaseClient } from "@supabase/supabase-js";

// PostgREST/Supabase membatasi response maksimal `max_rows` (default 1000 baris)
// PER REQUEST — apapun nilai `.limit()` atau `.range()` yang diminta, response
// tetap dipotong di 1000 baris. Akibatnya query tanpa pagination diam-diam
// kehilangan baris ke-1001+ (mis. daftar produk 1199 hanya tampil 1000).
//
// Solusi: ambil data per-chunk 1000 baris dengan `.range(from, to)` sampai
// semua baris terkumpul. Chunk terakhir < 1000 baris (atau 0) menandakan selesai.

const CHUNK_SIZE = 1000;

/**
 * Ambil SEMUA baris hasil query dengan pagination chunk 1000 baris,
 * menghindari potongan `max_rows` PostgREST.
 *
 * Fungsi `query` menerima SupabaseClient + rentang (from, to) dan harus
 * mengembalikan query builder yang sudah diakhiri `.range(from, to)`.
 *
 * Contoh:
 * ```ts
 * const produk = await fetchAllRows(supabase, (db, from, to) =>
 *   db.from("produk").select("*").order("nama_produk").range(from, to)
 * );
 * ```
 *
 * Catatan: parameter `query` sengaja bertipe longgar (`unknown`) karena tipe
 * builder PostgREST (`PostgrestFilterBuilder`) bukan `Promise` murni menurut
 * TypeScript meskipun bisa di-await.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function fetchAllRows<T = any>(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient,
  query: (db: SupabaseClient, from: number, to: number) => unknown
): Promise<T[]> {
  const all: T[] = [];
  let from = 0;

  for (;;) {
    const to = from + CHUNK_SIZE - 1;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = (await query(supabase, from, to)) as any;
    if (error) {
      console.error("fetchAllRows error:", error);
      throw error;
    }
    if (!data || data.length === 0) break;
    all.push(...(data as T[]));
    if (data.length < CHUNK_SIZE) break;
    from += CHUNK_SIZE;
  }

  return all;
}
