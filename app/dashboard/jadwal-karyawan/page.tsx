import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import JadwalKaryawanClient, {
  type EmployeeOption,
  type ScheduleDetailRecord,
  type ShiftOption,
  type WeeklyScheduleRecord,
} from "./jadwal-karyawan-client";
import { isOwnerLike } from "@/lib/roles";

function toDateString(date: Date) {
  return date.toISOString().slice(0, 10);
}

function startOfWeekMonday(input?: string) {
  const base = input && /^\d{4}-\d{2}-\d{2}$/.test(input)
    ? new Date(`${input}T00:00:00.000Z`)
    : new Date();
  const day = base.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  base.setUTCDate(base.getUTCDate() + diff);
  return toDateString(base);
}

function addDays(date: string, days: number) {
  const d = new Date(`${date}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return toDateString(d);
}

export default async function JadwalKaryawanPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>;
}) {
  const params = await searchParams;
  const weekStart = startOfWeekMonday(params.week);
  const weekEnd = addDays(weekStart, 6);
  const historyStart = addDays(weekStart, -28);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/");

  const { data: currentUser } = await supabase
    .from("pengguna")
    .select("id, level")
    .eq("username", user.email?.split("@")[0])
    .maybeSingle();

  if (!isOwnerLike(currentUser?.level)) redirect("/dashboard");

  const [employees, shifts, weeklySchedule, historyRows] = await Promise.all([
    supabase
      .from("pengguna")
      .select("id, username, nama, level")
      .eq("aktif", true)
      .in("level", ["ADMIN", "KASIR", "KARYAWAN"])
      .order("nama", { ascending: true })
      .then(({ data, error }) => {
        if (error) {
          console.error("Failed to fetch schedule employees:", error);
          return [] as EmployeeOption[];
        }
        return (data ?? []) as EmployeeOption[];
      }),
    supabase
      .from("shift_kerja")
      .select("id, kode, nama, jam_mulai, jam_selesai, aktif, urutan")
      .order("urutan", { ascending: true })
      .then(({ data, error }) => {
        if (error) {
          console.error("Failed to fetch shifts:", error);
          return [] as ShiftOption[];
        }
        return (data ?? []) as ShiftOption[];
      }),
    supabase
      .from("jadwal_mingguan")
      .select(
        `
        *,
        jadwal_karyawan(
          id,
          tanggal,
          id_pengguna,
          tipe_jadwal,
          catatan,
          pengguna(id, username, nama, level),
          shift_kerja(id, kode, nama, jam_mulai, jam_selesai)
        )
      `
      )
      .eq("minggu_mulai", weekStart)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error) {
          console.error("Failed to fetch weekly schedule:", error);
          return null;
        }
        return data as WeeklyScheduleRecord | null;
      }),
    supabase
      .from("jadwal_karyawan")
      .select("id_pengguna, tipe_jadwal, tanggal, jadwal_mingguan!inner(status)")
      .gte("tanggal", historyStart)
      .lt("tanggal", weekStart)
      .eq("jadwal_mingguan.status", "TERBIT")
      .then(({ data, error }) => {
        if (error) {
          console.error("Failed to fetch schedule history:", error);
          return [] as ScheduleDetailRecord[];
        }
        return (data ?? []) as ScheduleDetailRecord[];
      }),
  ]);

  return (
    <div className="flex-1 p-4 md:p-8 lg:p-12 w-full flex flex-col gap-6 md:gap-9 mx-auto h-full md:max-h-screen md:overflow-hidden">
      <header className="shrink-0 space-y-3 pt-1 md:pt-2">
        <h1 className="text-3xl leading-tight md:text-4xl font-light tracking-tighter text-foreground">
          Jadwal Karyawan
        </h1>
        <p className="max-w-2xl text-base leading-7 text-muted-foreground">
          Susun jadwal mingguan shift pagi dan sore dengan pembagian yang seimbang.
        </p>
      </header>

      <JadwalKaryawanClient
        weekStart={weekStart}
        weekEnd={weekEnd}
        employees={employees}
        shifts={shifts}
        weeklySchedule={weeklySchedule}
        historyRows={historyRows}
      />
    </div>
  );
}
