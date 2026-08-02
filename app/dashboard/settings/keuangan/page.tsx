import { createClient } from "@/lib/supabase/server";
import FinanceSettingsForm from "./finance-settings-form";

export default async function FinanceSettingsPage() {
  const supabase = await createClient();

  const { data: settings } = await supabase
    .from("pengaturan_keuangan")
    .select("*")
    .maybeSingle();

  return (
    <div className="flex-1 p-4 md:p-8 lg:p-12 w-full flex flex-col gap-4 md:gap-8 mx-auto h-full md:max-h-screen md:overflow-hidden">
      <header className="shrink-0">
        <h1 className="text-3xl font-light tracking-tight text-foreground">
          Pengaturan Keuangan
        </h1>
        <p className="text-muted-foreground mt-2">
          Konfigurasi saldo awal dan informasi identitas usaha untuk laporan keuangan.
        </p>
      </header>

      <div className="flex-1 flex flex-col min-h-0 bg-background border border-border rounded-xl shadow-[0_1px_3px_rgba(0,55,112,0.08)] overflow-hidden max-w-2xl">
        <div className="flex-1 overflow-y-auto p-6">
          <FinanceSettingsForm initialData={settings} />
        </div>
      </div>
    </div>
  );
}
