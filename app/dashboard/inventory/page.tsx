import { createClient } from "@/lib/supabase/server";
import { attachMasterInfo, type MasterInfo } from "@/lib/produk-paket";
import InventoryClient from "./inventory-client";

export default async function InventoryPage() {
  const supabase = await createClient();

  const [productsRes, categoriesRes, unitsRes, lokasiRes, merksRes] = await Promise.all([
    supabase.from("produk").select(`
      *,
      kategori(nama),
      satuan(nama),
      lokasi_area(nama)
    `).order("id", { ascending: false }),
    supabase.from("kategori").select("*").order("nama"),
    supabase.from("satuan").select("*").order("nama"),
    supabase.from("lokasi_area").select("*").order("nama"),
    supabase.from("merk").select("*").order("nama"),
  ]);

  interface RawProduct {
    id: number;
    sku: string | null;
    nama_produk: string;
    id_kategori: number;
    id_satuan: number;
    id_merk: number | null;
    hitung_stok: boolean;
    barcode: string | null;
    harga_modal: number;
    harga_jual_satuan: number;
    harga_jual_grosir: number;
    harga_jual_promo: number | null;
    diskon: number;
    stok: number | null;
    stok_gudang: number | null;
    stok_minimum: number | null;
    harga_pokok_avco: number | null;
    nilai_persediaan: number | null;
    default_purchase_unit: string | null;
    conversion_ratio: number | null;
    jual_satuan: string | null;
    harga_jual_besar_satuan: number | null;
    harga_jual_besar_grosir: number | null;
    harga_jual_besar_promo: number | null;
    id_produk_master: number | null;
    qty_per_unit: number | null;
    isi_satuan: string | null;
    jenis_isi_paket: string | null;
    id_lokasi_area: number | null;
    kategori: { nama: string } | null;
    satuan: { nama: string } | null;
    lokasi_area: { nama: string } | null;
  }

  const withMaster = await attachMasterInfo(supabase, (productsRes.data ?? []) as RawProduct[]);

  const productsWithStock = withMaster.map((p) => ({
    ...p,
    stock: p.hitung_stok ? (p.stok ?? 0) : null,
    stok_gudang: p.stok_gudang ?? 0,
    stok_minimum: p.stok_minimum ?? 5,
    harga_pokok_avco: p.harga_pokok_avco ?? 0,
    nilai_persediaan: p.nilai_persediaan ?? 0,
    id_merk: p.id_merk ?? null,
    default_purchase_unit: p.default_purchase_unit ?? null,
    conversion_ratio: p.conversion_ratio ?? 1,
    jual_satuan: p.jual_satuan ?? null,
    harga_jual_besar_satuan: p.harga_jual_besar_satuan ?? null,
    harga_jual_besar_grosir: p.harga_jual_besar_grosir ?? null,
    harga_jual_besar_promo: p.harga_jual_besar_promo ?? null,
    id_produk_master: p.id_produk_master ?? null,
    qty_per_unit: p.qty_per_unit ?? null,
    isi_satuan: p.isi_satuan ?? null,
    jenis_isi_paket: p.jenis_isi_paket ?? null,
    id_lokasi_area: p.id_lokasi_area ?? null,
    lokasi_area: p.lokasi_area ?? null,
    master: p.master as MasterInfo | null,
  }));

  return (
    <div className="flex-1 p-4 md:p-8 lg:p-12 w-full flex flex-col gap-4 md:gap-8 mx-auto h-full md:max-h-screen md:overflow-hidden">
      <header className="shrink-0">
        <h1 className="text-4xl font-light tracking-tighter text-foreground">
          Inventaris
        </h1>
        <p className="text-muted-foreground mt-2">
          Kelola stok, harga, dan rincian produk
        </p>
      </header>

      <InventoryClient 
        initialProducts={productsWithStock} 
        categories={categoriesRes.data ?? []} 
        units={unitsRes.data ?? []}
        lokasiAreas={lokasiRes.data ?? []}
        merks={merksRes.data ?? []}
      />
    </div>
  );
}
