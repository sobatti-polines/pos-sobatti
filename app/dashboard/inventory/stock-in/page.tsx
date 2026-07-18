import { createClient } from "@/lib/supabase/server";
import StockInClient from "./stock-in-client";

export default async function StockInPage() {
  const supabase = await createClient();

  const [productsRes, suppliersRes, satuanRes] = await Promise.all([
    supabase
      .from("produk")
      .select(
        "id, nama_produk, barcode, base_unit, default_purchase_unit, conversion_ratio, satuan(id, nama)"
      )
      .eq("hitung_stok", true)
      .order("nama_produk"),
    supabase.from("supplier").select("id, nama_supplier").order("nama_supplier"),
    supabase.from("satuan").select("id, nama").order("nama"),
  ]);

  interface RawStockInProduct {
    id: number;
    nama_produk: string;
    barcode: string | null;
    base_unit: string;
    default_purchase_unit: string | null;
    conversion_ratio: number;
    satuan: { id: number; nama: string } | { id: number; nama: string }[] | null;
  }

  const products = (productsRes.data ?? []).map((p: RawStockInProduct) => ({
    id: p.id,
    nama_produk: p.nama_produk,
    barcode: p.barcode,
    base_unit: p.base_unit || "pcs",
    default_purchase_unit: p.default_purchase_unit || null,
    conversion_ratio: p.conversion_ratio || 1,
    satuan: Array.isArray(p.satuan) ? p.satuan[0] ?? null : p.satuan ?? null,
  }));

  const satuanOptions: { id: number; nama: string }[] = satuanRes.data ?? [];

  return (
    <StockInClient
      products={products}
      suppliers={suppliersRes.data ?? []}
      satuanOptions={satuanOptions}
    />
  );
}
