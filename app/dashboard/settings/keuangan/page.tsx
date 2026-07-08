import { createClient } from "@/lib/supabase/server";
import FinanceSettingsForm from "./finance-settings-form";

export default async function FinanceSettingsPage() {
  const supabase = await createClient();

  const { data: settings } = await supabase
    .from("pengaturan_keuangan")
    .select("*")
    .maybeSingle();

  return (
    <div className="p-4 md:p-8 max-w-2xl mx-auto space-y-6">
      <div className="space-y-1">
        <h1 className="text-3xl font-light tracking-tighter">Pengaturan Keuangan</h1>
        <p className="text-muted-foreground text-sm">
          Konfigurasi saldo awal dan informasi identitas usaha untuk laporan keuangan.
        </p>
      </div>

      <div className="bg-background border border-border rounded-xl shadow-sm p-6">
        <FinanceSettingsForm initialData={settings} />
      </div>
    </div>
  );
}
