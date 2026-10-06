import type { SupabaseClient } from "@supabase/supabase-js";

// PostgREST/Supabase membatasi response maksimal `max_rows` (default 1000 baris)
// PER REQUEST — apapun nilai `.limit()` atau `.range()` yang diminta, response
// tetap dipotong di 1000 baris. Akibatnya query tanpa pagination diam-diam
// kehilangan baris ke-1001+ (mis. daftar produk 1199 hanya tampil 1000).
//
// Solusi: ambil data per-chunk 1000 baris dengan `.range(from, to)` sampai
// semua baris terkumpul. Chunk terakhir < 1000 baris (atau 0) menandakan selesai.

const CHUNK_SIZE = 1000;

// Setelah chunk pertama penuh, chunk berikutnya diambil paralel sebanyak ini
// sekaligus. Pembatasan PostgREST adalah per-REQUEST (1000 baris), bukan total,
// jadi paralel aman dan tetap menghasilkan urutan yang sama. Di koneksi lambat
// (VPS Bogor -> Supabase Tokyo ~190ms RTT) ini memangkas N roundtrip jadi ~1.
const PARALLEL_WINDOW = 4;

/**
 * Ambil SEMUA baris hasil query dengan pagination chunk 1000 baris,
 * menghindari potongan `max_rows` PostgREST.
 *
 * Chunk pertama diambil sendiri dulu supaya daftar kecil (<1000 baris) tetap
 * hanya 1 request. Baru setelahnya chunk berikutnya dipanggil paralel per
 * window, berhenti pada chunk pertama yang tidak penuh (atau 0 baris).
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
  supabase: SupabaseClient,
  query: (db: SupabaseClient, from: number, to: number) => unknown
): Promise<T[]> {
  const jalankan = async (from: number): Promise<T[]> => {
    const to = from + CHUNK_SIZE - 1;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = (await query(supabase, from, to)) as any;
    if (error) {
      console.error("fetchAllRows error:", error);
      throw error;
    }
    return (data ?? []) as T[];
  };

  const all: T[] = [];

  const pertama = await jalankan(0);
  all.push(...pertama);
  if (pertama.length < CHUNK_SIZE) return all;

  let from = CHUNK_SIZE;
  for (;;) {
    const offsets = Array.from({ length: PARALLEL_WINDOW }, (_, i) => from + i * CHUNK_SIZE);
    const hasil = await Promise.all(offsets.map(jalankan));
    for (const rows of hasil) {
      all.push(...rows);
      // Chunk terakhir < CHUNK_SIZE (atau 0) menandakan selesai.
      if (rows.length < CHUNK_SIZE) return all;
    }
    from += PARALLEL_WINDOW * CHUNK_SIZE;
  }
}
