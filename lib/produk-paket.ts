import type { SupabaseClient } from "@supabase/supabase-js";

// Produk paket/turunan: stok paket DIISI MANUAL dari stok master
// (RPC process_isi_stok_paket). Helper ini hanya melengkapi info master
// untuk keperluan tampilan (nama master, stok yang tersedia utk konversi).

export interface MasterInfo {
  stok: number | null;
  stok_gudang: number | null;
  hitung_stok: boolean;
  nama_produk: string | null;
}

export interface PaketProductLike {
  id: number;
  id_produk_master: number | null;
}

// Tambahkan info master ke daftar produk paket (query kedua, tanpa embed FK).
export async function attachMasterInfo<T extends PaketProductLike>(
  supabase: SupabaseClient,
  products: T[]
): Promise<(T & { master: MasterInfo | null })[]> {
  if (products.length === 0) return [];

  const masterIds = Array.from(
    new Set(
      products
        .map((p) => p.id_produk_master)
        .filter((id): id is number => id != null)
    )
  );

  let masterMap: Map<number, MasterInfo> = new Map();
  if (masterIds.length > 0) {
    const { data: masters } = await supabase
      .from("produk")
      .select("id, stok, stok_gudang, hitung_stok, nama_produk")
      .in("id", masterIds);

    masterMap = new Map(
      (masters ?? []).map((m) => [
        m.id as number,
        {
          stok: m.stok as number | null,
          stok_gudang: m.stok_gudang as number | null,
          hitung_stok: m.hitung_stok as boolean,
          nama_produk: m.nama_produk as string | null,
        },
      ])
    );
  }

  return products.map((p) => ({
    ...p,
    master: p.id_produk_master != null
      ? masterMap.get(p.id_produk_master) ?? {
          stok: null,
          stok_gudang: null,
          hitung_stok: false,
          nama_produk: null,
        }
      : null,
  }));
}

// Total stok master yang tersedia untuk konversi/isi stok paket.
export function masterTotalStock(master: MasterInfo | null): number {
  if (!master) return 0;
  return (master.stok ?? 0) + (master.stok_gudang ?? 0);
}

// Berapa paket maksimal yang bisa dibuat dari stok master saat ini.
export function maxPaketFromMaster(master: MasterInfo | null, qtyPerUnit: number): number {
  if (!master || !qtyPerUnit || qtyPerUnit <= 0) return 0;
  return Math.floor(masterTotalStock(master) / qtyPerUnit);
}