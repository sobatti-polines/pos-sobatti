import { createClient } from "@/lib/supabase/server";
import { generateLabaRugi } from "@/lib/laporan-keuangan";
import { startOfMonth, format } from "date-fns";
import LabaRugiClient from "./laba-rugi-client";

export default async function LabaRugiPage() {
  const supabase = await createClient();
  const start = format(startOfMonth(new Date()), "yyyy-MM-dd");
  const end = format(new Date(), "yyyy-MM-dd");

  let initialData = null;
  try {
    initialData = await generateLabaRugi(supabase, start, end);
  } catch (e) {
    console.error(e);
  }

  return (
    <div className="flex-1 p-4 md:p-8 lg:p-12 w-full flex flex-col gap-4 md:gap-8 mx-auto h-full md:max-h-screen md:overflow-hidden">
      <header className="shrink-0 print:hidden">
        <h1 className="text-4xl font-light tracking-tighter text-foreground">
          Laporan Laba Rugi
        </h1>
        <p className="text-muted-foreground mt-2">
          Analisis pendapatan dan beban usaha.
        </p>
      </header>

      <LabaRugiClient initialData={initialData} />
    </div>
  );
}
