/**
 * Helper filter teks PostgREST yang aman terhadap karakter tercadang dan
 * wildcard ILIKE.
 *
 * LATAR BELAKANG bug POS (penting, jangan diulang):
 * `ilike` di PostgREST memakai pola LIKE mentah — tidak ada wildcard otomatis.
 * Jadi `nama_produk.ilike.semen` berarti "sama persis dengan 'semen'", BUKAN
 * "mengandung 'semen'". Pencarian sebagian WAJIB memakai `%...%`.
 *
 * Ada DUA bentuk nilai yang aturannya BERBEDA, dan mencampurnya menghasilkan
 * query yang selalu kosong tanpa error:
 *
 * 1. Filter kolom langsung (`.ilike("kolom", nilai)`):
 *    nilai TIDAK boleh dibungkus tanda kutip. `barcode=ilike."ROL3M"` mencari
 *    teks yang benar-benar memuat karakter kutip, bukan barcode ROL3M.
 *    → pakai `ilikeValue` / `ilikeContainsValue`.
 *
 * 2. Filter di dalam `or=()` (`.or('nama.ilike.<nilai>')`):
 *    nilai yang memuat karakter tercadang koma/kurung/kutip (contoh nama
 *    produk: `AUGERBITS 1/4" (6MM) HIOSHI`) WAJIB dibungkus tanda kutip ganda,
 *    dan `"`/`\` di dalamnya di-escape. Tanpa kutip, parser PostgREST gagal
 *    membaca filter → hasil kosong.
 *    → pakai `ilikeContainsPattern` (pencarian sebagian).
 *
 * Aturan resmi: https://docs.postgrest.org/en/v12/references/api/url_grammar.html
 */

/**
 * Bungkus nilai filter `or=()` dengan kutip ganda + escape `"` dan `\` sesuai
 * grammar PostgREST. Hanya untuk dipakai di dalam `or=()` / `and=()`.
 */
export function quoteFilterValue(value: string): string {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

/**
 * Escape wildcard ILIKE (`%`, `_`) dan karakter escape `\` pada pola LIKE
 * PostgreSQL. Tanpa ini, `%`/`_` yang diketik kasir dianggap wildcard, bukan
 * karakter literal — `_` khususnya cocok dengan SEMUA karakter sehingga hasil
 * pencarian jadi terlalu luas.
 */
export function escapeLikeWildcards(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/[%_]/g, (m) => `\\${m}`);
}

/**
 * Pola ILIKE PERSIS untuk filter kolom langsung (`.ilike("barcode", ...)`).
 * Tanpa kutip ganda, wildcard yang diketik di-escape jadi literal.
 */
export function ilikeValue(value: string): string {
  return escapeLikeWildcards(value);
}

/**
 * Pola ILIKE SEBAGIAN (`contains`) untuk filter kolom langsung:
 * `%` ditambahkan di kiri-kanan, wildcard yang diketik pengguna tetap literal.
 * Contoh: `.ilike("nama_produk", ilikeContainsValue("semen"))`.
 */
export function ilikeContainsValue(value: string): string {
  return `%${escapeLikeWildcards(value)}%`;
}

/**
 * Pola ILIKE SEBAGIAN (`contains`) untuk dipakai di dalam `or=()`:
 * dikutip ganda supaya karakter tercadang (koma/kurung/kutip) tidak merusak
 * parser, dan wildcard `%...%` ditambahkan supaya cocok sebagian.
 *
 * Contoh: `.or(`nama_produk.ilike.${ilikeContainsPattern("semen")}`)`
 *   → `nama_produk.ilike."%semen%"`
 */
export function ilikeContainsPattern(value: string): string {
  return quoteFilterValue(ilikeContainsValue(value));
}
