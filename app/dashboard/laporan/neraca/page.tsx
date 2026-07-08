import { createClient } from "@/lib/supabase/server";
import { generateNeraca } from "@/lib/laporan-keuangan";
import { format } from "date-fns";
import NeracaClient from "./neraca-client";

export default async function NeracaPage() {
  const supabase = await createClient();
  const today = format(new Date(), "yyyy-MM-dd");

  let initialData = null;
  try {
    initialData = await generateNeraca(supabase, today);
  } catch (e) {
    console.error(e);
  }

  return (
    <div className="flex-1 p-8 lg:p-12 w-full flex flex-col gap-8 mx-auto h-full overflow-y-auto print:p-0 print:overflow-visible">
      <header className="shrink-0 print:hidden">
        <h1 className="text-4xl font-light tracking-tighter text-foreground">
          Neraca Keuangan
        </h1>
        <p className="text-muted-foreground mt-2">
          Posisi aset, kewajiban, dan ekuitas.
        </p>
      </header>

      <NeracaClient initialData={initialData} />
    </div>
  );
}
