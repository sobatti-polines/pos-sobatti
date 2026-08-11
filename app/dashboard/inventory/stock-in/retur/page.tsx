import { createClient } from "@/lib/supabase/server";
import ReturClient from "./retur-client";

export default async function ReturPage() {
  const supabase = await createClient();

  const [bmRes, supplierRes] = await Promise.all([
    supabase
      .from("barang_masuk")
      .select(`
        id,
        tgl_masuk,
        no_surat,
        supplied_unit,
        supplied_qty,
        applied_conversion_ratio,
        base_qty_added,
        supplier(id, nama_supplier),
        produk(
          id,
          nama_produk,
          sku,
          conversion_ratio,
          default_purchase_unit,
          stok_gudang,
          satuan(nama)
        )
      `)
      .eq("status", "AKTIF")
      .order("tgl_masuk", { ascending: false })
      .order("created_at", { ascending: false }),
    supabase.from("supplier").select("id, nama_supplier").order("nama_supplier"),
  ]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const records = (bmRes.data ?? []).map((r: any) => {
    const produk = Array.isArray(r.produk) ? r.produk[0] ?? null : r.produk ?? null;
    return {
      id: r.id,
      tgl_masuk: r.tgl_masuk,
      no_surat: r.no_surat,
      supplied_unit: r.supplied_unit,
      supplied_qty: r.supplied_qty,
      applied_conversion_ratio: r.applied_conversion_ratio,
      base_qty_added: Number(r.base_qty_added ?? r.jumlah ?? 0),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      supplier: Array.isArray(r.supplier) ? r.supplier[0] ?? null : (r.supplier as any) ?? null,
      produk: produk
        ? {
            ...produk,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            satuan: Array.isArray(produk.satuan) ? produk.satuan[0] ?? null : (produk.satuan as any) ?? null,
            conversion_ratio: Number(produk.conversion_ratio ?? 1),
            stok_gudang: Number(produk.stok_gudang ?? 0),
          }
        : null,
    };
  });

  return (
    <div className="flex-1 p-4 md:p-8 lg:p-12 w-full flex flex-col gap-4 md:gap-8 mx-auto h-full md:max-h-screen md:overflow-hidden">
      <header className="shrink-0">
        <h1 className="text-4xl font-light tracking-tighter text-foreground">
          Retur Pembelian
        </h1>
        <p className="text-muted-foreground mt-2">
          Catat pengembalian barang ke supplier
        </p>
      </header>

      <ReturClient records={records} suppliers={supplierRes.data ?? []} />
    </div>
  );
}
