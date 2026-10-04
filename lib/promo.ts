import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Satu sumber logika harga efektif event promo.
 *
 * Sebelumnya perhitungan yang sama ditulis ulang di tiga tempat:
 *   1. route `POST /api/event-promo/efektif`
 *   2. blok `load()` di `app/pos/pos-client.tsx`
 *   3. blok pencarian server di `app/pos/pos-client.tsx`
 *
 * Tiga salinan berarti satu aturan harga bisa diam-diam berbeda antar jalur.
 * File ini menyatukannya.
 *
 * PENTING: file ini sengaja TIDAK mengimpor apa pun dari `lib/supabase/server`
 * atau `next/headers`, supaya aman dipakai Client Component juga. Satu-satunya
 * import adalah tipe `SupabaseClient`, yang dihapus saat kompilasi.
 */

export interface ActivePromo {
  id: number;
  nama: string;
  tipe_diskon: string;
  nilai_diskon: number;
  event_promo_produk: { id_produk: number }[];
}

/** Kolom harga produk yang dibutuhkan untuk menghitung harga efektif promo. */
export interface PromoPricedProduct {
  id: number;
  harga_jual_satuan: number | null;
  harga_jual_grosir: number | null;
  harga_jual_promo: number | null;
  jual_satuan: string | null;
  conversion_ratio: number | null;
  harga_jual_besar_satuan: number | null;
  harga_jual_besar_grosir: number | null;
  harga_jual_besar_promo: number | null;
}

/** Hasil perhitungan harga efektif untuk satu produk. */
export interface EffectivePrice {
  id_produk: number;
  harga_jual_satuan: number | null;
  harga_jual_grosir: number | null;
  harga_jual_promo: number | null;
  harga_jual_besar_satuan: number | null;
  harga_jual_besar_grosir: number | null;
  harga_jual_besar_promo: number | null;
  id_event_promo: number;
  nama_event: string;
}

/** Field tambahan yang ditempel ke produk setelah harga promo diterapkan. */
export interface PromoOverride {
  id_produk: number;
  nama_event_promo: string;
  harga_asli_satuan: number | null;
  harga_asli_besar_satuan: number | null;
  harga_jual_satuan: number | null;
  harga_jual_grosir: number | null;
  harga_jual_promo: number | null;
  harga_jual_besar_satuan: number | null;
  harga_jual_besar_grosir: number | null;
  harga_jual_besar_promo: number | null;
}

/**
 * Event promo yang sedang aktif hari ini, beserta daftar produknya.
 * Mengembalikan array kosong bila tidak ada (atau bila query gagal) supaya
 * pemanggil tidak perlu menangani error sendiri.
 */
export async function getActivePromos(supabase: SupabaseClient): Promise<ActivePromo[]> {
  // Tanggal lokal format en-CA (YYYY-MM-DD) — sama seperti implementasi lama,
  // jangan diubah ke UTC tanpa menyesuaikan kolom tanggal di database.
  const today = new Date().toLocaleDateString("en-CA");

  const { data, error } = await supabase
    .from("event_promo")
    .select("id, nama, tipe_diskon, nilai_diskon, event_promo_produk!inner(id_produk)")
    .eq("aktif", true)
    .lte("tanggal_mulai", today)
    .gte("tanggal_selesai", today);

  if (error) {
    console.error("Gagal mengambil event promo aktif:", error);
    return [];
  }

  return (data ?? []) as unknown as ActivePromo[];
}

/**
 * Hitung harga efektif untuk produk yang terdaftar di salah satu promo aktif.
 * Produk tanpa promo aktif tidak masuk ke map.
 */
export function buildEffectivePriceMap(
  activePromos: ActivePromo[],
  products: PromoPricedProduct[]
): Map<number, EffectivePrice> {
  const map = new Map<number, EffectivePrice>();
  if (activePromos.length === 0) return map;

  for (const prod of products) {
    // Ambil promo pertama bila ada beberapa yang tumpang tindih (perilaku lama).
    const promo = activePromos.find((p) =>
      p.event_promo_produk.some((ep) => ep.id_produk === prod.id)
    );
    if (!promo) continue;

    // Harga besar OTOMATIS = harga kecil × conversion_ratio (aturan 20260816).
    // Fallback bila kolom DB NULL/0 untuk data lama — jangan pernah tampilkan 0.
    const ratio = Number(prod.conversion_ratio) || 1;
    const hasBig = !!prod.jual_satuan && ratio > 0;
    const big = (kolom: number | null, kecil: number | null) =>
      hasBig
        ? kolom != null && kolom > 0
          ? kolom
          : Math.round(Number(kecil || 0) * ratio)
        : null;

    const calc = (harga: number | null) => {
      if (!harga) return harga;
      if (promo.tipe_diskon === "persen") {
        return Math.max(0, harga - (harga * promo.nilai_diskon) / 100);
      }
      return Math.max(0, harga - promo.nilai_diskon);
    };

    map.set(prod.id, {
      id_produk: prod.id,
      harga_jual_satuan: calc(prod.harga_jual_satuan),
      harga_jual_grosir: calc(prod.harga_jual_grosir),
      harga_jual_promo: calc(prod.harga_jual_promo),
      harga_jual_besar_satuan: calc(big(prod.harga_jual_besar_satuan, prod.harga_jual_satuan)),
      harga_jual_besar_grosir: calc(big(prod.harga_jual_besar_grosir, prod.harga_jual_grosir)),
      harga_jual_besar_promo: calc(big(prod.harga_jual_besar_promo, prod.harga_jual_promo)),
      id_event_promo: promo.id,
      nama_event: promo.nama,
    });
  }

  return map;
}

/** Ubah array hasil `getEffectivePrices()` menjadi map keyed by id_produk. */
export function toEffectivePriceMap(list: EffectivePrice[]): Map<number, EffectivePrice> {
  return new Map(list.map((p) => [p.id_produk, p]));
}

/**
 * Tempelkan harga efektif promo ke daftar produk. Produk tanpa promo
 * dikembalikan apa adanya, sehingga aman dipanggil untuk sembarang daftar.
 */
export function applyPromoToProducts<T extends PromoPricedProduct>(
  products: T[],
  promos: Map<number, EffectivePrice>
): (T & PromoOverride)[] {
  if (promos.size === 0) return products as (T & PromoOverride)[];

  return products.map((p) => {
    const pr = promos.get(p.id);
    if (!pr) return p as T & PromoOverride;

    return {
      ...p,
      id_produk: pr.id_produk,
      nama_event_promo: pr.nama_event,
      harga_asli_satuan: p.harga_jual_satuan,
      harga_asli_besar_satuan: p.harga_jual_besar_satuan,
      harga_jual_satuan: pr.harga_jual_satuan,
      harga_jual_grosir: pr.harga_jual_grosir,
      harga_jual_promo: pr.harga_jual_promo,
      harga_jual_besar_satuan: pr.harga_jual_besar_satuan,
      harga_jual_besar_grosir: pr.harga_jual_besar_grosir,
      harga_jual_besar_promo: pr.harga_jual_besar_promo,
    } as T & PromoOverride;
  });
}

/**
 * Harga efektif untuk sekumpulan id produk (kontrak sama dengan
 * `POST /api/event-promo/efektif`). Hanya produk yang benar-benar terdaftar di
 * promo aktif yang dikembalikan.
 */
export async function getEffectivePrices(
  supabase: SupabaseClient,
  productIds: number[]
): Promise<EffectivePrice[]> {
  const ids = Array.isArray(productIds) ? productIds : [productIds];
  if (ids.length === 0) return [];

  const activePromos = await getActivePromos(supabase);
  if (activePromos.length === 0) return [];

  const promoIds = activePromos.flatMap((p) => p.event_promo_produk.map((ep) => ep.id_produk));
  const validIds = ids.filter((id) => promoIds.includes(id));
  if (validIds.length === 0) return [];

  const { data: products } = await supabase
    .from("produk")
    .select(
      "id, harga_jual_satuan, harga_jual_grosir, harga_jual_promo, harga_jual_besar_satuan, harga_jual_besar_grosir, harga_jual_besar_promo, jual_satuan, conversion_ratio"
    )
    .in("id", validIds);

  if (!products) return [];

  return Array.from(
    buildEffectivePriceMap(activePromos, products as unknown as PromoPricedProduct[]).values()
  );
}
