import { createClient } from "@/lib/supabase/server";
import OpnameHistoryClient from "./history-client";

export default async function StockOpnameHistoryPage() {
  const supabase = await createClient();

  const { data: history } = await supabase
    .from("stok_opname")
    .select(`
      id,
      tgl_opname,
      stok_sistem,
      stok_fisik,
      selisih,
      keterangan,
      produk(nama_produk)
    `)
    .order("tgl_opname", { ascending: false })
    .order("created_at", { ascending: false });

  return (
    <div className="flex-1 p-8 lg:p-12 w-full flex flex-col gap-8 mx-auto h-full max-h-screen overflow-hidden">
      <header className="shrink-0">
        <h1 className="text-4xl font-light tracking-tighter text-foreground">
          Riwayat Stok Opname
        </h1>
        <p className="text-muted-foreground mt-2">
          Daftar riwayat pengecekan fisik stok yang pernah dilakukan
        </p>
      </header>

      <OpnameHistoryClient initialHistory={history ?? []} />
    </div>
  );
}
