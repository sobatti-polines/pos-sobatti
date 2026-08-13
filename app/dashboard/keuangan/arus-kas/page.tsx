import { createClient } from "@/lib/supabase/server";
import { generateArusKas } from "@/lib/laporan-keuangan";
import { getStoreSettings } from "@/lib/store-settings";
import { startOfMonth, format } from "date-fns";
import ArusKasClient from "./arus-kas-client";

export default async function ArusKasPage() {
  const supabase = await createClient();
  const start = format(startOfMonth(new Date()), "yyyy-MM-dd");
  const end = format(new Date(), "yyyy-MM-dd");

  let initialData = null;
  try {
    initialData = await generateArusKas(supabase, start, end);
  } catch (e) {
    console.error(e);
  }

  const store = await getStoreSettings(supabase);

  return (
    <div className="flex-1 p-4 md:p-8 lg:p-12 w-full flex flex-col gap-4 md:gap-8 mx-auto h-full md:max-h-screen md:overflow-hidden">
      <header className="shrink-0 print:hidden">
        <h1 className="text-4xl font-light tracking-tighter text-foreground">
          Laporan Arus Kas
        </h1>
        <p className="text-muted-foreground mt-2">
          Ringkasan penerimaan dan pembayaran kas selama periode.
        </p>
      </header>

      <ArusKasClient initialData={initialData} store={store} />
    </div>
  );
}