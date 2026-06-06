import { createClient } from "@/lib/supabase/server";
import OpnameHistoryClient from "./history-client";

export default async function StockOpnameHistoryPage() {
  const supabase = await createClient();

  const { data: rawHistory } = await supabase
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const history = (rawHistory ?? []) as any[];

  return (
    <div className="flex-1 p-4 md:p-8 lg:p-12 w-full flex flex-col gap-4 md:gap-8 mx-auto h-full md:max-h-screen md:overflow-hidden">
      <header className="shrink-0">
        <h1 className="text-4xl font-light tracking-tighter text-foreground">
          Riwayat Stok Opname
        </h1>
        <p className="text-muted-foreground mt-2">
          Daftar riwayat pengecekan fisik stok yang pernah dilakukan
        </p>
      </header>

      <OpnameHistoryClient initialHistory={history} />
    </div>
  );
}
