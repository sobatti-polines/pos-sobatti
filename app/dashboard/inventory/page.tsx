import { createClient } from "@/lib/supabase/server";
import { fetchAllRows } from "@/lib/supabase/fetch-all";
import { attachMasterInfo, type MasterInfo } from "@/lib/produk-paket";
import InventoryClient from "./inventory-client";
import { isOwnerLike } from "@/lib/roles";

export default async function InventoryPage() {
  const supabase = await createClient();

  // fetchAllRows: PostgREST memotong response maksimal 1000 baris per request
  // (max_rows). Tanpa pagination, produk ke-1001+ (total bisa 1199+) tidak pernah
  // muncul di tabel inventaris. Loop chunk 1000 baris sampai semua terkumpul.
  const productsData = await fetchAllRows(supabase, (db, from, to) =>
    db.from("produk").select(`
      *,
      kategori(nama),
      satuan(nama),
      lokasi_area(nama)
    `).order("nama_produk", { ascending: true }).range(from, to)
  ).catch((e) => {
    console.error("Failed to fetch products:", e);
    return [];
  });

  const [categoriesRes, unitsRes, lokasiRes, merksRes] = await Promise.all([
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
    stok_minimum_gudang: number | null;
    harga_pokok_avco: number | null;
    nilai_persediaan: number | null;
    default_purchase_unit: string | null;
    conversion_ratio: number | null;
    jual_satuan: string | null;
    harga_jual_besar_satuan: number | null;
    harga_jual_besar_grosir: number | null;
    harga_jual_besar_promo: number | null;
    harga_jual_besar_manual?: boolean;
    id_produk_master: number | null;
    qty_per_unit: number | null;
    isi_satuan: string | null;
    jenis_isi_paket: string | null;
    id_lokasi_area: number | null;
    kategori: { nama: string } | null;
    satuan: { nama: string } | null;
    lokasi_area: { nama: string } | null;
    created_at: string;
    updated_at: string;
  }

  const withMaster = await attachMasterInfo(supabase, (productsData ?? []) as RawProduct[]);

  const today = new Date().toLocaleDateString('en-CA');
  const { data: activePromos } = await supabase
    .from('event_promo')
    .select('id, nama, tipe_diskon, nilai_diskon, event_promo_produk!inner(id_produk)')
    .eq('aktif', true)
    .lte('tanggal_mulai', today)
    .gte('tanggal_selesai', today);

  const promoMap = new Map();
  if (activePromos && activePromos.length > 0) {
    for (const promo of activePromos) {
      for (const ep of promo.event_promo_produk) {
        if (!promoMap.has(ep.id_produk)) {
          promoMap.set(ep.id_produk, promo);
        }
      }
    }
  }

  const productsWithStock = withMaster.map((p) => {
    const harga_asli_satuan = p.harga_jual_satuan;
    const harga_asli_grosir = p.harga_jual_grosir;
    const harga_asli_promo = p.harga_jual_promo;
    const harga_asli_besar_satuan = p.harga_jual_besar_satuan;
    const harga_asli_besar_grosir = p.harga_jual_besar_grosir;
    const harga_asli_besar_promo = p.harga_jual_besar_promo;
    let harga_jual_satuan = p.harga_jual_satuan;
    let harga_jual_grosir = p.harga_jual_grosir;
    let harga_jual_promo = p.harga_jual_promo;
    let harga_jual_besar_satuan = p.harga_jual_besar_satuan;
    let harga_jual_besar_grosir = p.harga_jual_besar_grosir;
    let harga_jual_besar_promo = p.harga_jual_besar_promo;
    let nama_event_promo = undefined;

    const promo = promoMap.get(p.id);
    if (promo) {
      const calc = (harga: number | null) => {
        if (!harga) return harga;
        if (promo.tipe_diskon === 'persen') {
          return Math.max(0, harga - (harga * promo.nilai_diskon / 100));
        }
        return Math.max(0, harga - promo.nilai_diskon);
      };
      
      harga_jual_satuan = calc(p.harga_jual_satuan)!;
      harga_jual_grosir = calc(p.harga_jual_grosir)!;
      harga_jual_promo = calc(p.harga_jual_promo);
      harga_jual_besar_satuan = calc(p.harga_jual_besar_satuan);
      harga_jual_besar_grosir = calc(p.harga_jual_besar_grosir);
      harga_jual_besar_promo = calc(p.harga_jual_besar_promo);
      nama_event_promo = promo.nama;
    }

    return {
      ...p,
      stock: p.hitung_stok ? (p.stok ?? 0) : null,
      stok_gudang: p.stok_gudang ?? 0,
      stok_minimum: p.stok_minimum ?? 5,
      stok_minimum_gudang: p.stok_minimum_gudang ?? null,
      harga_pokok_avco: p.harga_pokok_avco ?? 0,
      nilai_persediaan: p.nilai_persediaan ?? 0,
      id_merk: p.id_merk ?? null,
      default_purchase_unit: p.default_purchase_unit ?? null,
      conversion_ratio: p.conversion_ratio ?? 1,
      jual_satuan: p.jual_satuan ?? null,
      harga_jual_besar_manual: p.harga_jual_besar_manual ?? false,
      harga_jual_besar_satuan,
      harga_jual_besar_grosir,
      harga_jual_besar_promo,
      id_produk_master: p.id_produk_master ?? null,
      qty_per_unit: p.qty_per_unit ?? null,
      isi_satuan: p.isi_satuan ?? null,
      jenis_isi_paket: p.jenis_isi_paket ?? null,
      id_lokasi_area: p.id_lokasi_area ?? null,
      lokasi_area: p.lokasi_area ?? null,
      master: p.master as MasterInfo | null,
      harga_asli_satuan,
      harga_asli_grosir,
      harga_asli_promo,
      harga_asli_besar_satuan,
      harga_asli_besar_grosir,
      harga_asli_besar_promo,
      harga_jual_satuan,
      harga_jual_grosir,
      harga_jual_promo,
      nama_event_promo,
      created_at: p.created_at,
      updated_at: p.updated_at,
    };
  });

  const { data: { user } } = await supabase.auth.getUser();
  const isOwner = isOwnerLike(user?.user_metadata?.role);

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
        isOwner={isOwner}
      />
    </div>
  );
}
