import { createClient } from "@/lib/supabase/server";
import { getDailyCashSummary } from "@/lib/laporan-kasir";
import { redirect } from "next/navigation";
import BukaKasirClient from "./buka-kasir-client";

export default async function BukaKasirPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/");

  const role = user.user_metadata?.role;
  // Halaman Kas Kasir (buka/tutup sesi) HANYA untuk kasir.
  if (role !== "KASIR") redirect("/dashboard");

  const today = new Date().toISOString().slice(0, 10);
  
  let initialSummary = null;
  try {
    initialSummary = await getDailyCashSummary(supabase, today);
  } catch (e) {
    console.error(e);
  }

  return (
    <div className="flex-1 p-4 md:p-8 lg:p-12 w-full flex flex-col gap-4 md:gap-8 mx-auto h-full md:max-h-screen md:overflow-hidden print-area">
      <BukaKasirClient initialSummary={initialSummary} />
    </div>
  );
}
