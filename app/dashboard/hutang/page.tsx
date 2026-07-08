import { createClient } from "@/lib/supabase/server";
import HutangClient from "./hutang-client";

export default async function HutangPage() {
  const supabase = await createClient();

  const { data: hutangList } = await supabase
    .from("hutang_dagang")
    .select(`
      id,
      id_supplier,
      tanggal_hutang,
      tanggal_jatuh_tempo,
      jumlah_awal,
      jumlah_terbayar,
      sisa_hutang,
      status,
      catatan,
      supplier:id_supplier(nama_supplier)
    `)
    .order("tanggal_hutang", { ascending: false });

  const { data: metodeBayar } = await supabase
    .from("metode_bayar")
    .select("nama")
    .order("nama");

  return (
    <div className="flex-1 p-4 md:p-8 lg:p-12 w-full flex flex-col gap-4 md:gap-8 mx-auto h-full md:max-h-screen md:overflow-hidden">
      <header className="shrink-0">
        <h1 className="text-4xl font-light tracking-tighter text-foreground">
          Hutang Dagang
        </h1>
        <p className="text-muted-foreground mt-2">
          Kelola hutang kepada supplier.
        </p>
      </header>
      <HutangClient 
        data={hutangList || []} 
        metodeBayar={(metodeBayar || []).map(m => m.nama)} 
      />
    </div>
  );
}
