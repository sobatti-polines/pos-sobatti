import { createClient } from "@/lib/supabase/server";
import { HistoryClient } from "./history-client";

export default async function AttendanceHistoryPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  // Get current user details
  const { data: pengguna } = await supabase
    .from("pengguna")
    .select("id")
    .eq("username", user.email?.split("@")[0])
    .single();

  if (!pengguna) return <div>User profile not found.</div>;

  const { data: history, error } = await supabase
    .from("absensi")
    .select("*")
    .eq("id_pengguna", pengguna.id)
    .order("tanggal", { ascending: false })
    .limit(100);

  if (error) {
    console.error("Error fetching history:", error);
  }

  return (
    <div className="flex-1 p-4 md:p-8 lg:p-12 w-full flex flex-col gap-4 md:gap-8 mx-auto h-full md:max-h-screen md:overflow-hidden">
      <header className="shrink-0">
        <h1 className="text-4xl font-light tracking-tighter text-foreground">
          Riwayat Absen Saya
        </h1>
        <p className="text-muted-foreground mt-2">
          Pantau riwayat kehadiran, ketepatan waktu, dan jam kerja Anda
        </p>
      </header>

      <HistoryClient initialData={history ?? []} />
    </div>
  );
}
