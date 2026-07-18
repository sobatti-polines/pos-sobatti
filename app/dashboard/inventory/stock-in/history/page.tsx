import { createClient } from "@/lib/supabase/server";
import StockInHistoryClient from "./history-client";

export default async function StockInHistoryPage() {
  const supabase = await createClient();

  const [historyRes, suppliersRes] = await Promise.all([
    supabase
      .from("barang_masuk")
      .select(`
        id,
        tgl_masuk,
        harga_beli,
        jumlah,
        total,
        keterangan,
        supplied_unit,
        supplied_qty,
        applied_conversion_ratio,
        base_qty_added,
        total_cost,
        base_cost_per_piece,
        produk(nama_produk),
        supplier(id, nama_supplier)
      `)
      .order("tgl_masuk", { ascending: false })
      .order("created_at", { ascending: false }),
    supabase.from("supplier").select("id, nama_supplier").order("nama_supplier")
  ]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const history = (historyRes.data ?? []) as any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const suppliers = (suppliersRes.data ?? []) as any[];

  return (
    <div className="flex-1 p-4 md:p-8 lg:p-12 w-full flex flex-col gap-4 md:gap-8 mx-auto h-full md:max-h-screen md:overflow-hidden">
      <header className="shrink-0">
        <h1 className="text-4xl font-light tracking-tighter text-foreground">
          Riwayat Barang Masuk
        </h1>
        <p className="text-muted-foreground mt-2">
          Daftar semua riwayat pembelian stok barang dari supplier
        </p>
      </header>

      <StockInHistoryClient initialHistory={history} suppliers={suppliers} />
    </div>
  );
}
