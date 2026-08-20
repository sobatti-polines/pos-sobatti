import { createClient } from "@/lib/supabase/server";
import { getDailyCashSummary } from "@/lib/laporan-kasir";
import { getStoreSettings } from "@/lib/store-settings";
import { redirect } from "next/navigation";
import TutupKasirClient from "./tutup-kasir-client";

export default async function TutupKasirPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/");

  const role = user.user_metadata?.role;
  // Halaman Kas Kasir (buka/tutup sesi) HANYA untuk kasir.
  if (role !== "KASIR") redirect("/dashboard");

  const today = new Date().toISOString().slice(0, 10);
  
  let initialSummary = null;
  let store = null;
  try {
    initialSummary = await getDailyCashSummary(supabase, today);
    store = await getStoreSettings(supabase);
  } catch (e) {
    console.error(e);
  }

  const username = user.user_metadata?.username || user.email?.split("@")[0] || "Kasir";

  return (
    <div className="flex-1 p-4 md:p-8 lg:p-12 w-full flex flex-col gap-4 md:gap-8 mx-auto h-full md:max-h-screen md:overflow-hidden print-area">
      <TutupKasirClient initialSummary={initialSummary} store={store} username={username} />
    </div>
  );
}
