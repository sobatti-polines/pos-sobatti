/**
 * Helper filter teks PostgREST yang aman terhadap karakter tercadang.
 *
 * Latar belakang bug POS: nilai pencarian yang mengandung koma, kurung, atau
 * tanda kutip (contoh nama produk asli: `AUGERBITS 1/2" (13 MM) HIOSHI`)
 * membuat parser `or=` PostgREST gagal membaca filter → query error 400 →
 * hasil pencarian kosong tanpa penjelasan. Produk dengan karakter itu lalu
 * terkesan "kadang muncul kadang tidak" di pencarian POS.
 *
 * Aturan resmi (docs PostgREST, URL Grammar):
 * - Nilai filter yang memuat karakter tercadang harus dibungkus TANDA KUTIP
 *   GANDA: `nama.ilike."(13 MM)"`.
 * - Di dalam kutip ganda, `"` ditulis `\"` dan `\` ditulis `\\`.
 *
 * Referensi: https://docs.postgrest.org/en/v12/references/api/url_grammar.html
 */

/**
 * Bungkus nilai filter dengan kutip ganda + escape `"` dan `\` sesuai grammar
 * PostgREST. Selalu mengutip (bukan hanya bila ada karakter khusus) supaya
 * perilakunya tidak bergantung isi input — lebih murah dan lebih aman.
 */
export function quoteFilterValue(value: string): string {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

/**
 * Escape wildcard ILIKE (`%`, `_`) dan karakter escape `\` pada pola LIKE
 * PostgreSQL. Tanpa ini, `%`/`_` yang diketik kasir bertindak sebagai
 * wildcard, bukan karakter literal — `_` khususnya cocok dengan SEMUA
 * karakter sehingga hasil pencarian jadi terlalu luas.
 */
export function escapeLikeWildcards(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/[%_]/g, (m) => `\\${m}`);
}

/**
 * Escape wildcard + bungkus kutip ganda dalam satu langkah. Untuk pola
 * `ilike` polos (keseluruhan nilai dicari apa adanya).
 */
export function ilikePattern(value: string): string {
  return quoteFilterValue(escapeLikeWildcards(value));
}
