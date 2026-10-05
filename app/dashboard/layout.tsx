import { DashboardSidebar } from "@/components/dashboard-sidebar";
import { DashboardMobileNav } from "@/components/dashboard-mobile-nav";
import { getSessionUser } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { unstable_cache } from "next/cache";
import { redirect } from "next/navigation";

/**
 * Nama tampil sidebar per username, di-cache 5 menit.
 *
 * Data global per username (bukan rahasia finansial) dan nama jarang berubah,
 * sehingga tidak perlu 1 query Tokyo tiap full load. Memakai supabaseAdmin
 * (tanpa cookies) supaya boleh masuk unstable_cache; key = username.
 */
const getPenggunaNamaCached = unstable_cache(
  async (username: string): Promise<string | null> => {
    const { data, error } = await supabaseAdmin
      .from("pengguna")
      .select("nama")
      .eq("username", username)
      .maybeSingle();
    // Error dilempar (tidak di-cache): fallback username dipakai dan
    // navigasi berikutnya mencoba lagi. Hanya null legitim yang di-cache.
    if (error) throw error;
    return (data?.nama as string | undefined) ?? null;
  },
  ["pengguna-nama-v1"],
  { revalidate: 300 }
);

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Auth di-dedupe per request: layout, page, dan lib/ tidak lagi memanggil
  // supabase.auth.getUser() masing-masing.
  const user = await getSessionUser();

  if (!user) {
    redirect("/");
  }

  const role = user.user_metadata?.role;
  const username = user.user_metadata?.username || user.email?.split("@")[0];

  // Ambil nama lengkap dari tabel pengguna untuk ditampilkan di sidebar
  let userName: string | null = null;
  if (username) {
    try {
      userName = (await getPenggunaNamaCached(username)) || username;
    } catch (e) {
      console.error("Gagal memuat nama pengguna sidebar, pakai username:", e);
      userName = username;
    }
  }

  return (
    <div className="flex flex-col md:h-[100dvh] md:overflow-hidden bg-background md:flex-row">
      <DashboardSidebar role={role} userName={userName} />
      <div className="flex-1 flex flex-col w-full min-h-[100dvh] md:min-h-0 md:overflow-hidden">
        <DashboardMobileNav role={role} userName={userName} />
        <main className="flex-1 flex flex-col w-full md:overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
