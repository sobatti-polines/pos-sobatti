import { getServerSupabase } from "@/lib/auth";
import { fetchAllRows } from "@/lib/supabase/fetch-all";
import {
  applyPromoToProducts,
  buildEffectivePriceMap,
  getActivePromos,
} from "@/lib/promo";
import type { Customer, PaymentMethod, Product } from "@/stores/pos-store";

/**
 * Bootstrap data untuk halaman POS.
 *
 * Sebelumnya seluruh data ini diambil dari browser setelah halaman tampil:
 * `auth.getUser()` → query `pengguna` → 4 permintaan paralel (produk, pelanggan,
 * metode bayar, pengaturan) → lalu 1 permintaan harga promo yang harus menunggu
 * daftar produk selesai lebih dulu.
 *
 * Setiap langkah itu adalah round-trip browser → server → PostgREST. Di jaringan
 * berlatensi tinggi, biaya per round-trip mendominasi; urutan serial di atas
 * membuat kasir menunggu berkali-kali sebelum katalog bisa dipakai.
 *
 * Sekarang semuanya dikerjakan di server dan dikirim sekali sebagai satu
 * payload Server Component. Isi datanya sama, jadi ukuran byte yang dikirim ke
 * browser tidak bertambah — yang hilang adalah round-trip-nya.
 *
 * Catatan: `/api/pos/products`, `/api/pos/barcode`, dan endpoint POS lain
 * TETAP dipakai untuk pencarian, scan barcode, dan penyegaran data.
 */

/**
 * Daftar kolom produk yang dipakai jalur POS.
 *
 * Dipegang di satu tempat supaya bentuk objek produk selalu sama di semua
 * jalur (bootstrap server, `/api/pos/products`, `/api/pos/barcode`) — bentuk
 * yang berbeda antar jalur adalah sumber bug harga/stok yang sulit dilacak.
 *
 * `harga_modal` masih disertakan karena dideklarasikan wajib oleh tipe
 * `Product` di `stores/pos-store.ts` (kontrak store sengaja tidak diubah).
 * `default_purchase_unit` dihapus: tidak dipakai maupun dideklarasikan di mana
 * pun pada POS.
 */
export const POS_PRODUCT_COLUMNS = [
  "id, nama_produk, id_kategori, hitung_stok, barcode, stok, stok_gudang, sku",
  "harga_modal, harga_jual_satuan, harga_jual_grosir, harga_jual_promo, diskon",
  "conversion_ratio, jual_satuan",
  "harga_jual_besar_satuan, harga_jual_besar_grosir, harga_jual_besar_promo",
  "id_produk_master, qty_per_unit",
  "kategori(nama), satuan(nama), merk(nama)",
].join(", ");

export interface PosSettings {
  taxRate: number;
  jenisNota: string;
  metodeCetak: string;
}

export interface PosBootstrapData {
  products: Product[];
  customers: Customer[];
  paymentMethods: PaymentMethod[];
  settings: PosSettings;
  cashierName: string;
  cashierUsername: string;
}

/**
 * Ambil seluruh data awal POS dalam satu gelombang query paralel.
 * `cashierUsername` dipakai untuk mencari nama tampilan di tabel `pengguna`.
 */
export async function getPosBootstrapData(cashierUsername: string): Promise<PosBootstrapData> {
  const supabase = await getServerSupabase();

  const [productRows, customerRes, paymentRes, settingsRes, cashierRes, activePromos] =
    await Promise.all([
      fetchAllRows<Product>(supabase, (db, from, to) =>
        db
          .from("produk")
          .select(POS_PRODUCT_COLUMNS)
          .order("nama_produk")
          .range(from, to)
      ),
      supabase
        .from("pelanggan")
        .select("id, nama_pelanggan, alamat, no_hp, email, point")
        .order("nama_pelanggan"),
      supabase.from("metode_bayar").select("id, nama").neq("nama", "Transfer").order("id"),
      supabase
        .from("pengaturan")
        .select("pajak_persen, jenis_nota, metode_cetak")
        .eq("id", 1)
        .maybeSingle(),
      supabase.from("pengguna").select("nama").eq("username", cashierUsername).maybeSingle(),
      // Dijalankan paralel dengan query produk (bukan setelahnya) supaya tidak
      // ada tahap serial tambahan.
      getActivePromos(supabase),
    ]);

  if (customerRes.error) {
    console.error("Gagal mengambil data pelanggan POS:", customerRes.error);
  }
  if (paymentRes.error) {
    console.error("Gagal mengambil metode bayar POS:", paymentRes.error);
  }

  // Harga efektif promo diterapkan di server memakai sumber logika yang sama
  // dengan /api/event-promo/efektif.
  const promoMap = buildEffectivePriceMap(activePromos, productRows);
  const products = promoMap.size > 0 ? applyPromoToProducts(productRows, promoMap) : productRows;

  return {
    products,
    customers: (customerRes.data ?? []) as Customer[],
    paymentMethods: (paymentRes.data ?? []) as PaymentMethod[],
    settings: {
      taxRate: Number(settingsRes.data?.pajak_persen ?? 0),
      jenisNota: settingsRes.data?.jenis_nota ?? "Invoice",
      metodeCetak: settingsRes.data?.metode_cetak ?? "Preview",
    },
    cashierName: cashierRes.data?.nama || cashierUsername,
    cashierUsername,
  };
}
