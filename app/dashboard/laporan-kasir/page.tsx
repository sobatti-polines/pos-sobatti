import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import LaporanKasirClient from "./laporan-kasir-client";

export default async function LaporanKasirPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/");

  const role = user.user_metadata?.role;
  if (role !== "OWNER" && role !== "ADMIN") redirect("/dashboard");

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
