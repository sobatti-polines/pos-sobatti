import { createClient } from "@/lib/supabase/server";
import { ProfileForm } from "./profile-form";
import { StoreForm, type StoreSettings } from "./store-form";
import { redirect } from "next/navigation";
import { User, Store } from "lucide-react";

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/");

  const username = user.email?.split("@")[0] || "";

  const { data: pengaturan } = await supabase
    .from("pengaturan")
    .select("*")
    .eq("id", 1)
    .single();

  return (
    <div className="flex-1 p-8 lg:p-12 w-full flex flex-col gap-8 mx-auto h-full overflow-y-auto">
      <header className="shrink-0 mb-4">
        <h1 className="text-[48px] font-light tracking-[-0.96px] text-foreground leading-tight">
          Pengaturan
        </h1>
        <p className="text-[16px] font-light text-muted-foreground mt-2">
          Kelola profil pengguna dan konfigurasi operasional toko Anda
        </p>
      </header>

      <div className="w-full max-w-5xl space-y-12">
        {/* Account Section */}
        <section className="space-y-6">
          <div className="flex items-center gap-4 border-b border-border pb-6">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <User className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h2 className="text-[26px] font-light tracking-[-0.26px] text-foreground">Akun Pengguna</h2>
              <p className="text-[15px] font-light text-muted-foreground mt-1">Kredensial login dan profil pribadi</p>
            </div>
          </div>
          <div className="bg-background border border-border shadow-level-1 rounded-[12px] p-6 md:p-10">
            <ProfileForm initialUsername={username} />
          </div>
        </section>

        {/* Store Section */}
        <section className="space-y-6">
          <div className="flex items-center gap-4 border-b border-border pb-6">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <Store className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h2 className="text-[26px] font-light tracking-[-0.26px] text-foreground">Informasi & Sistem Toko</h2>
              <p className="text-[15px] font-light text-muted-foreground mt-1">Konfigurasi identitas toko, transaksi, dan perbankan</p>
            </div>
          </div>
          <div className="bg-background border border-border shadow-level-1 rounded-[12px] p-6 md:p-10">
            <StoreForm initialData={(pengaturan as StoreSettings) ?? null} />
          </div>
        </section>

        {/* Info Card */}
        {/* Info Card - Cream Band Pattern */}
        <div className="p-10 bg-[#f5e9d4] text-[#0d253d] dark:bg-[#f5e9d4]/10 dark:text-[#f5e9d4] border-none rounded-[12px] flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <h3 className="text-[22px] font-light tracking-[-0.22px]">Butuh Bantuan?</h3>
            <p className="text-[15px] font-light opacity-80 mt-2 max-w-2xl">
              Jika Anda mengalami kesulitan dalam mengonfigurasi sistem, silakan hubungi tim dukungan kami.
            </p>
          </div>
          <button className="text-sm font-medium text-primary dark:text-primary-foreground hover:underline shrink-0">
            Buka Pusat Bantuan →
          </button>
        </div>
      </div>
    </div>
  );
}
