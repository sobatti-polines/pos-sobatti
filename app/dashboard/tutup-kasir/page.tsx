import { createClient } from "@/lib/supabase/server";
import { getDailyCashSummary } from "@/lib/laporan-kasir";
import TutupKasirClient from "./tutup-kasir-client";

export default async function TutupKasirPage() {
  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);
  
  let initialSummary = null;
  try {
    initialSummary = await getDailyCashSummary(supabase, today);
  } catch (e) {
    console.error(e);
  }

  return (
    <div className="flex-1 p-4 md:p-8 lg:p-12 w-full flex flex-col gap-4 md:gap-8 mx-auto h-full md:max-h-screen md:overflow-hidden print-area">
      <TutupKasirClient initialSummary={initialSummary} />
    </div>
  );
}
