import { createClient } from "@/lib/supabase/server";
import StockInClient from "./stock-in-client";

export default async function StockInPage() {
  const supabase = await createClient();

  const [productsRes, suppliersRes] = await Promise.all([
    supabase
      .from("produk")
      .select("id, nama_produk, barcode, satuan(id, nama)")
      .eq("hitung_stok", true)
      .order("nama_produk"),
    supabase.from("supplier").select("id, nama_supplier").order("nama_supplier"),
  ]);

  const products = (productsRes.data ?? []).map((p: any) => ({
    id: p.id,
    nama_produk: p.nama_produk,
    barcode: p.barcode,
    satuan: Array.isArray(p.satuan) ? p.satuan[0] ?? null : p.satuan ?? null,
  }));

  return (
    <StockInClient
      products={products}
      suppliers={suppliersRes.data ?? []}
    />
  );
}
