import { createClient } from "@/lib/supabase/server";
import StockInClient, { type ReorderPrefill } from "./stock-in-client";

interface ReorderRawItem {
  id_produk: number;
  supplied_qty: number;
  supplied_unit: string | null;
  total_cost: number;
}

export default async function StockInPage({
  searchParams,
}: {
  searchParams: Promise<{ reorder?: string }>;
}) {
  const supabase = await createClient();
  const params = await searchParams;

  const [productsRes, suppliersRes, satuanRes] = await Promise.all([
    supabase
      .from("produk")
      .select(
        "id, nama_produk, barcode, default_purchase_unit, conversion_ratio, satuan(id, nama)"
      )
      .eq("hitung_stok", true)
      .is("id_produk_master", null)
      .order("nama_produk"),
    supabase.from("supplier").select("id, nama_supplier").order("nama_supplier"),
    supabase.from("satuan").select("id, nama").order("nama"),
  ]);

  interface RawStockInProduct {
    id: number;
    nama_produk: string;
    barcode: string | null;
    default_purchase_unit: string | null;
    conversion_ratio: number;
    satuan: { id: number; nama: string } | { id: number; nama: string }[] | null;
  }

  const products = (productsRes.data ?? []).map((p: RawStockInProduct) => {
    const satuanNama = (Array.isArray(p.satuan) ? p.satuan[0] ?? null : p.satuan ?? null)?.nama ?? "pcs";
    return {
      id: p.id,
      nama_produk: p.nama_produk,
      barcode: p.barcode,
      inventory_unit: satuanNama,
      default_purchase_unit: p.default_purchase_unit || null,
      conversion_ratio: p.conversion_ratio || 1,
      satuan: Array.isArray(p.satuan) ? p.satuan[0] ?? null : p.satuan ?? null,
    };
  });

  const satuanOptions: { id: number; nama: string }[] = satuanRes.data ?? [];

  let initialReorder: ReorderPrefill | null = null;
  const reorderId = params.reorder ? Number(params.reorder) : null;
  if (reorderId && Number.isInteger(reorderId) && reorderId > 0) {
    initialReorder = await buildReorderPrefill(supabase, reorderId, products);
  }

  return (
    <StockInClient
      products={products}
      suppliers={suppliersRes.data ?? []}
      satuanOptions={satuanOptions}
      initialReorder={initialReorder}
    />
  );
}

async function buildReorderPrefill(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  reorderId: number,
  products: { id: number; default_purchase_unit?: string | null }[]
): Promise<ReorderPrefill | null> {
  const { data: row } = await supabase
    .from("barang_masuk")
    .select("tgl_masuk, no_surat, id_supplier, supplier(id, nama_supplier)")
    .eq("id", reorderId)
    .single();

  if (!row?.id_supplier) return null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supplier = Array.isArray(row.supplier) ? row.supplier[0] ?? null : (row.supplier as any) ?? null;

  let itemsQuery = supabase
    .from("barang_masuk")
    .select("id_produk, supplied_qty, supplied_unit, total_cost")
    .eq("id_supplier", row.id_supplier)
    .eq("tgl_masuk", row.tgl_masuk)
    .eq("status", "AKTIF")
    .order("id", { ascending: true });

  itemsQuery = row.no_surat ? itemsQuery.eq("no_surat", row.no_surat) : itemsQuery.is("no_surat", null);

  const { data: items } = await itemsQuery;
  if (!items?.length) return null;

  const productIds = new Set(products.map((p) => p.id));
  const productByUnit = new Map(products.map((p) => [p.id, p.default_purchase_unit ?? ""]));
  const prefilledItems: ReorderPrefill["items"] = [];
  for (const item of items as ReorderRawItem[]) {
    if (!productIds.has(item.id_produk)) continue;
    prefilledItems.push({
      id_produk: item.id_produk,
      supplied_qty: Number(item.supplied_qty) || 1,
      supplied_unit: item.supplied_unit ?? productByUnit.get(item.id_produk) ?? "",
      total_cost: Number(item.total_cost) || 0,
    });
  }
  if (!prefilledItems.length) return null;

  return {
    supplierId: row.id_supplier,
    supplierName: supplier?.nama_supplier ?? "",
    noSurat: row.no_surat,
    items: prefilledItems,
  };
}
