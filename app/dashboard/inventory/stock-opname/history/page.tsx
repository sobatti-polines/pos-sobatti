import { createClient } from "@/lib/supabase/server";
import { fetchAllRows } from "@/lib/supabase/fetch-all";
import OpnameHistoryClient from "./history-client";

export default async function StockOpnameHistoryPage() {
  const supabase = await createClient();

  const rawSesi = await fetchAllRows(supabase, (db, from, to) =>
    db
      .from("sesi_stok_opname")
      .select(`
        id,
        no_sesi,
        tgl_sesi,
        status,
        keterangan,
        total_item,
        total_selisih,
        total_nilai,
        created_at,
        applied_at,
        pengguna(nama, username),
        stok_opname(
          id,
          id_produk,
          stok_sistem,
          stok_fisik,
          selisih,
          klasifikasi,
          harga_pokok_snap,
          keterangan,
          produk(nama_produk, sku)
        )
      `)
      .order("tgl_sesi", { ascending: false })
      .order("created_at", { ascending: false })
      .range(from, to)
  );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sesiList = (rawSesi ?? []) as any[];

  return (
    <div className="flex-1 p-4 md:p-8 lg:p-12 w-full flex flex-col gap-4 md:gap-8 mx-auto h-full md:max-h-screen md:overflow-hidden">
      <header className="shrink-0">
        <h1 className="text-4xl font-light tracking-tighter text-foreground">
          Riwayat Stok Opname
        </h1>
        <p className="text-muted-foreground mt-2">
          Daftar sesi pengecekan fisik stok yang pernah dilakukan
        </p>
      </header>

      <OpnameHistoryClient initialSesi={sesiList} />
    </div>
  );
}
