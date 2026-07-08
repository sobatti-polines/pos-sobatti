import { createClient } from "@/lib/supabase/server";
import PiutangClient from "./piutang-client";

export default async function PiutangPage() {
  const supabase = await createClient();

  const { data: piutangList } = await supabase
    .from("piutang_dagang")
    .select(`
      id,
      id_pelanggan,
      tanggal_piutang,
      tanggal_jatuh_tempo,
      jumlah_awal,
      jumlah_terbayar,
      sisa_piutang,
      status,
      catatan,
      pelanggan:id_pelanggan(nama_pelanggan)
    `)
    .order("tanggal_piutang", { ascending: false });

  const { data: metodeBayar } = await supabase
    .from("metode_bayar")
    .select("nama")
    .order("nama");

  return (
    <div className="flex-1 p-4 md:p-8 lg:p-12 w-full flex flex-col gap-4 md:gap-8 mx-auto h-full md:max-h-screen md:overflow-hidden">
      <header className="shrink-0">
        <h1 className="text-4xl font-light tracking-tighter text-foreground">
          Piutang Dagang
        </h1>
        <p className="text-muted-foreground mt-2">
          Kelola piutang dari pelanggan.
        </p>
      </header>
      <PiutangClient 
        data={piutangList || []} 
        metodeBayar={(metodeBayar || []).map(m => m.nama)} 
      />
    </div>
  );
}
