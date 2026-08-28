import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { format, startOfMonth } from "date-fns";
import { getStoreSettings } from "@/lib/store-settings";
import { getLaporanKas } from "./actions";
import LaporanKasClient from "./laporan-kas-client";
import { isAdminOrOwnerLike } from "@/lib/roles";

export const dynamic = "force-dynamic";

export default async function LaporanKasPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/");

  // Laporan kas (kedua kas) untuk admin & owner
  const role = user.user_metadata?.role;
  if (!isAdminOrOwnerLike(role)) redirect("/dashboard");

  const start = format(startOfMonth(new Date()), "yyyy-MM-dd");
  const end = format(new Date(), "yyyy-MM-dd");

  let initialData = null;
  try {
    const res = await getLaporanKas({ tanggal_awal: start, tanggal_akhir: end });
    if (res.data) initialData = res.data;
  } catch (e) {
    console.error(e);
  }

  const store = await getStoreSettings(supabase);

  return (
    <div className="flex-1 p-4 md:p-8 lg:p-12 w-full flex flex-col gap-4 md:gap-8 mx-auto h-full md:max-h-screen md:overflow-hidden">
      <header className="shrink-0 print:hidden">
        <h1 className="text-4xl font-light tracking-tighter text-foreground">
          Laporan Kas
        </h1>
        <p className="text-muted-foreground mt-2">
          Pantau pergerakan uang Kas Kasir (laci) dan Kas Admin (operasional) secara detail.
        </p>
      </header>

      <LaporanKasClient initialData={initialData} store={store} />
    </div>
  );
}
