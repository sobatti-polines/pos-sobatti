import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { fetchAllRows } from "@/lib/supabase/fetch-all";
import { getStoreSettings } from "@/lib/store-settings";
import LaporanKasirClient from "./laporan-kasir-client";
import { isAdminOrOwnerLike } from "@/lib/roles";

export const dynamic = "force-dynamic";

export default async function LaporanKasirPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/");

  const role = user.user_metadata?.role;
  // Laporan kas (kasir harian) untuk admin & owner.
  if (!isAdminOrOwnerLike(role)) redirect("/dashboard");

  const reports = await fetchAllRows(supabase, (db, from, to) =>
    db
      .from("saldo_kas_harian")
      .select(`
        *,
        pengguna:id_pengguna ( id, nama, username )
      `)
      .order("tanggal", { ascending: false })
      .range(from, to)
  );

  const store = await getStoreSettings(supabase);

  return (
    <div className="flex-1 p-4 md:p-8 lg:p-12 w-full flex flex-col gap-4 md:gap-8 mx-auto h-full md:max-h-screen md:overflow-hidden">
      <header className="shrink-0 print:hidden">
        <h1 className="text-4xl font-light tracking-tighter text-foreground">
          Laporan Kasir Harian
        </h1>
        <p className="text-muted-foreground mt-2">
          Riwayat penutupan kas dan rekonsiliasi harian sesi kasir.
        </p>
      </header>

      <LaporanKasirClient data={reports || []} store={store} role={role} />
    </div>
  );
}
