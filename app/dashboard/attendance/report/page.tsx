import { createClient } from "@/lib/supabase/server";
import { fetchAllRows } from "@/lib/supabase/fetch-all";
import { ReportClient } from "./report-client";
import { isOwnerLike } from "@/lib/roles";
import { getTodayWIB } from "@/lib/utils";

export default async function AdminAttendanceReportPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return <div>Tidak terautentikasi.</div>;
  }

  const { data: pengguna } = await supabase
    .from("pengguna")
    .select("level, aktif")
    .eq("username", user.email?.split("@")[0])
    .single();

  if (!pengguna?.aktif || !isOwnerLike(pengguna.level)) {
    return <div>Akses ditolak. Hanya Owner yang dapat melihat laporan ini.</div>;
  }

  const today = getTodayWIB();
  const firstDay = `${today.slice(0, 7)}-01`;
  
  const report = await fetchAllRows(supabase, (db, from, to) =>
    db
      .from("absensi")
      .select(`
        *,
        pengguna (
          username,
          level
        )
      `)
      .order("tanggal", { ascending: false })
      .range(from, to)
  ).catch((error) => {
    console.error("Error fetching report:", error);
    return [];
  });

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

      <ReportClient initialData={report ?? []} initialStart={firstDay} initialEnd={today} />
    </div>
  );
}
