import { createClient } from "@/lib/supabase/server";
import ReturHistoryClient from "./history-client";

export default async function ReturHistoryPage() {
  const supabase = await createClient();

  const [returRes, supplierRes] = await Promise.all([
    supabase
      .from("retur_pembelian")
      .select(`
        id,
        no_retur,
        tgl_retur,
        total_nilai,
        keterangan,
        created_at,
        supplier(id, nama_supplier),
        pengguna(id, nama, username),
        barang_masuk(id, no_surat, produk(nama_produk)),
        detail_retur_pembelian(id, qty_retur, harga_pokok)
      `)
      .order("tgl_retur", { ascending: false })
      .order("created_at", { ascending: false }),
    supabase.from("supplier").select("id, nama_supplier").order("nama_supplier"),
  ]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const history = (returRes.data ?? []).map((r: any) => {
    const details = Array.isArray(r.detail_retur_pembelian) ? r.detail_retur_pembelian : [];
    return {
      id: r.id,
      no_retur: r.no_retur,
      tgl_retur: r.tgl_retur,
      total_nilai: Number(r.total_nilai ?? 0),
      keterangan: r.keterangan,
      created_at: r.created_at,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      supplier: Array.isArray(r.supplier) ? r.supplier[0] ?? null : (r.supplier as any) ?? null,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      pengguna: Array.isArray(r.pengguna) ? r.pengguna[0] ?? null : (r.pengguna as any) ?? null,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      barang_masuk: Array.isArray(r.barang_masuk) ? r.barang_masuk[0] ?? null : (r.barang_masuk as any) ?? null,
      jumlah_item: details.length,
    };
  });

  return (
    <div className="flex-1 p-4 md:p-8 lg:p-12 w-full flex flex-col gap-4 md:gap-8 mx-auto h-full md:max-h-screen md:overflow-hidden">
      <header className="shrink-0">
        <h1 className="text-4xl font-light tracking-tighter text-foreground">
          Riwayat Retur Pembelian
        </h1>
        <p className="text-muted-foreground mt-2">
          Daftar semua retur barang ke supplier
        </p>
      </header>

      <ReturHistoryClient history={history} suppliers={supplierRes.data ?? []} />
    </div>
  );
}
