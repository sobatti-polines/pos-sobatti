import { createClient } from "@/lib/supabase/server";
import { ReportClient } from "./report-client";

export default async function AdminAttendanceReportPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || user.user_metadata?.role !== "OWNER") {
    return <div>Access Denied. Owner only.</div>;
  }

  // Get current month's initial data
  const now = new Date();
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
  
  const { data: report, error } = await supabase
    .from("absensi")
    .select(`
      *,
      pengguna (
        username,
        level
      )
    `)
    .gte("tanggal", firstDay)
    .order("tanggal", { ascending: false });

  if (error) {
    console.error("Error fetching report:", error);
  }

  return (
    <div className="flex-1 p-4 md:p-8 lg:p-12 w-full flex flex-col gap-4 md:gap-8 mx-auto h-full md:max-h-screen md:overflow-hidden">
      <header className="shrink-0 flex justify-between items-end">
        <div>
          <h1 className="text-4xl font-light tracking-tighter text-foreground">
            Laporan Absensi Pegawai
          </h1>
          <p className="text-muted-foreground mt-2">
            Pantau kehadiran, ketepatan waktu, dan produktivitas seluruh tim
          </p>
        </div>
      </header>

      <ReportClient initialData={report ?? []} />
    </div>
  );
}
