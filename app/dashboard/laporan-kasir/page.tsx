import { createClient } from "@/lib/supabase/server";
import LaporanKasirClient from "./laporan-kasir-client";

export default async function LaporanKasirPage() {
  const supabase = await createClient();

  const { data: reports } = await supabase
    .from("saldo_kas_harian")
    .select(`
      *,
      pengguna:id_pengguna ( id, nama, username )
    `)
    .order("tanggal", { ascending: false });

  return (
    <LaporanKasirClient data={reports || []} />
  );
}
