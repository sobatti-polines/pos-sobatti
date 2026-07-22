import { createClient } from "@/lib/supabase/server";
import { ProfileForm } from "./profile-form";
import { StoreForm, type StoreSettings } from "./store-form";
import { redirect } from "next/navigation";
import { User, Store, Shield, ArrowRight, Database } from "lucide-react";
import Link from "next/link";

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/");

  const username = user.email?.split("@")[0] || "";
  const role = user.user_metadata?.role;

  const { data: pengaturan } = await supabase
    .from("pengaturan")
    .select("*")
    .eq("id", 1)
    .single();

  return (
    <div className="flex-1 p-4 md:p-8 lg:p-12 w-full flex flex-col gap-4 md:gap-8 mx-auto">
      <header className="shrink-0">
        <h1 className="text-4xl font-light tracking-tighter text-foreground">
          Pengaturan
        </h1>
        <p className="text-muted-foreground mt-2">
          Kelola profil pengguna dan konfigurasi operasional toko Anda
        </p>
      </header>

      <div className="w-full max-w-5xl mx-auto">
        <div className="flex flex-col">
        {/* Account Section */}
        <section className="flex flex-col lg:flex-row gap-8 lg:gap-16">
          <div className="w-full lg:w-1/3 shrink-0">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center mb-6">
              <User className="w-5 h-5 text-primary" />
            </div>
            <h2 className="text-[26px] font-light tracking-[-0.26px] text-foreground">Akun Pengguna</h2>
            <p className="text-[15px] font-light text-muted-foreground mt-2 leading-relaxed">
              Kredensial login dan profil pribadi yang digunakan untuk mengakses sistem.
            </p>
          </div>
          <div className="w-full lg:w-2/3 pt-2 lg:pt-16">
            <ProfileForm initialUsername={username} />
          </div>
        </section>

        <div className="w-full h-px bg-border my-16" />

        {/* User Management Section (Owner only) */}
        {role === "OWNER" && (
          <>
            <section className="flex flex-col lg:flex-row gap-8 lg:gap-16">
              <div className="w-full lg:w-1/3 shrink-0">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center mb-6">
                  <Shield className="w-5 h-5 text-primary" />
                </div>
                <h2 className="text-[26px] font-light tracking-[-0.26px] text-foreground">Manajemen Pengguna</h2>
                <p className="text-[15px] font-light text-muted-foreground mt-2 leading-relaxed">
                  Kelola akun kasir, admin, dan hak akses sistem secara menyeluruh.
                </p>
              </div>
              <div className="w-full lg:w-2/3 pt-2 lg:pt-16">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 bg-muted/30 p-6 rounded-[12px] border border-border/50">
                  <div>
                    <h3 className="text-[16px] font-medium text-foreground">Pengaturan Hak Akses</h3>
                    <p className="text-[14px] font-light text-muted-foreground mt-1 max-w-md">
                      Tambah, edit, atau hapus pengguna aplikasi. Atur peran sebagai KASIR, ADMIN, atau OWNER.
                    </p>
                  </div>
                  <Link 
                    href="/dashboard/settings/users" 
                    className="shrink-0 flex items-center justify-center h-10 px-5 rounded-full bg-primary text-primary-foreground font-medium text-[15px] transition-colors hover:bg-primary/90 shadow-sm"
                  >
                    Kelola Pengguna
                  </Link>
                </div>
              </div>
            </section>
            
            <div className="w-full h-px bg-border my-16" />
          </>
        )}

        {/* Reference Data Section (Owner / Admin) */}
        {(role === "OWNER" || role === "ADMIN") && (
          <>
            <section className="flex flex-col lg:flex-row gap-8 lg:gap-16">
              <div className="w-full lg:w-1/3 shrink-0">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center mb-6">
                  <Database className="w-5 h-5 text-primary" />
                </div>
                <h2 className="text-[26px] font-light tracking-[-0.26px] text-foreground">Data Referensi</h2>
                <p className="text-[15px] font-light text-muted-foreground mt-2 leading-relaxed">
                  Kelola kategori produk, satuan barang, dan metode pembayaran.
                </p>
              </div>
              <div className="w-full lg:w-2/3 pt-2 lg:pt-16">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 bg-muted/30 p-6 rounded-[12px] border border-border/50">
                  <div>
                    <h3 className="text-[16px] font-medium text-foreground">Pengaturan Data Master</h3>
                    <p className="text-[14px] font-light text-muted-foreground mt-1 max-w-md">
                      Tambah, edit, atau hapus data kategori, satuan, dan metode pembayaran.
                    </p>
                  </div>
                  <Link 
                    href="/dashboard/settings/reference-data" 
                    className="shrink-0 flex items-center justify-center h-10 px-5 rounded-full bg-primary text-primary-foreground font-medium text-[15px] transition-colors hover:bg-primary/90 shadow-sm"
                  >
                    Kelola Referensi
                  </Link>
                </div>
              </div>
            </section>
            
            <div className="w-full h-px bg-border my-16" />
          </>
        )}

        {/* Store Section */}
        <section className="flex flex-col lg:flex-row gap-8 lg:gap-16">
          <div className="w-full lg:w-1/3 shrink-0">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center mb-6">
              <Store className="w-5 h-5 text-primary" />
            </div>
            <h2 className="text-[26px] font-light tracking-[-0.26px] text-foreground">Informasi Toko</h2>
            <p className="text-[15px] font-light text-muted-foreground mt-2 leading-relaxed">
              Konfigurasi identitas toko, transaksi, cetak struk, dan perbankan.
            </p>
          </div>
          <div className="w-full lg:w-2/3 pt-2 lg:pt-16">
            <StoreForm initialData={(pengaturan as StoreSettings) ?? null} />
          </div>
        </section>

        <div className="w-full h-px bg-border my-16" />

        {/* Info Card - Cream Band Pattern */}
        <section className="mb-12">
          <div className="p-10 bg-[#f5e9d4] text-[#0d253d] dark:bg-[#f5e9d4]/10 dark:text-[#f5e9d4] border-none rounded-[16px] flex flex-col md:flex-row md:items-center justify-between gap-8 shadow-sm">
            <div className="max-w-xl">
              <h3 className="text-[26px] font-light tracking-[-0.26px]">Butuh Bantuan?</h3>
              <p className="text-[16px] font-light opacity-80 mt-3 leading-relaxed">
                Jika Anda mengalami kesulitan dalam mengonfigurasi sistem, silakan hubungi tim dukungan kami.
              </p>
            </div>
            <button className="h-10 px-6 rounded-full bg-transparent border-2 border-[#0d253d] text-[#0d253d] dark:border-[#f5e9d4] dark:text-[#f5e9d4] text-[15px] font-medium hover:bg-[#0d253d]/5 dark:hover:bg-[#f5e9d4]/10 transition-colors shrink-0 flex items-center gap-2">
              Pusat Bantuan <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </section>
        </div>
      </div>
    </div>
  );
}
