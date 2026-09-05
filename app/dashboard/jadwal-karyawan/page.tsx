import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import JadwalKaryawanClient, {
  type EmployeeOption,
  type LeaveRequestRecord,
  type ScheduleDetailRecord,
  type ShiftOption,
  type WeeklyScheduleRecord,
} from "./jadwal-karyawan-client";
import { isOwnerLike } from "@/lib/roles";

function toDateString(date: Date) {
  return date.toISOString().slice(0, 10);
}

function startOfWeekMonday(input?: string) {
  // Jika input tanggal diberikan, gunakan langsung sebagai minggu mulai.
  // Ini sesuai harapan user: ?week=2026-09-07 berarti minggu 7 Sep — 13 Sep 2026.
  if (input && /^\d{4}-\d{2}-\d{2}$/.test(input)) {
    return input;
  }

  // Fallback: hitung minggu ini (Senin) berdasarkan waktu lokal server (WIB).
  const now = new Date();
  const day = now.getDay(); // 0=Sun..6=Sat (lokal WIB)
  const diff = day === 0 ? -6 : 1 - day;
  const base = new Date(now);
  base.setDate(base.getDate() + diff);
  return base.toISOString().slice(0, 10);
}

function addDays(date: string, days: number) {
  const d = new Date(`${date}T00:00:00+07:00`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
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

  const [activeEmployees, shifts, weeklySchedule, historyRows] = await Promise.all([
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

  const scheduledEmployees = Array.from(
    new Map([
      ...activeEmployees,
      ...(weeklySchedule?.jadwal_karyawan ?? [])
        .map((row) => row.pengguna)
        .filter((employee): employee is EmployeeOption => Boolean(employee)),
    ].map((employee) => [employee.id, employee])).values()
  ).sort((a, b) => (a.nama || a.username).localeCompare(b.nama || b.username, "id"));

  let leaveRequests: LeaveRequestRecord[] = [];
  if (weeklySchedule) {
    const { data, error } = await supabase
      .from("permintaan_libur")
      .select(
        "id, id_jadwal_mingguan, id_pengguna, tanggal, status, created_at, ditinjau_pada, pengguna:pengguna!permintaan_libur_id_pengguna_fkey(id, username, nama, level)"
      )
      .eq("id_jadwal_mingguan", weeklySchedule.id)
      .in("status", ["MENUNGGU", "DISETUJUI"])
      .order("created_at", { ascending: true });
    if (error) {
      console.error("Failed to fetch leave requests:", error);
    } else {
      leaveRequests = (data ?? []) as unknown as LeaveRequestRecord[];
    }
  }

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
        employees={scheduledEmployees}
        shifts={shifts}
        weeklySchedule={weeklySchedule}
        historyRows={historyRows}
        leaveRequests={leaveRequests}
      />
    </div>
  );
}
