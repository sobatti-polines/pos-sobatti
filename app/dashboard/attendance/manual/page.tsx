import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getTodayWIB } from "@/lib/utils";
import { isOwnerLike } from "@/lib/roles";
import { formatAttendanceTime, normalizeAttendanceStatus } from "@/lib/attendance-display";
import ManualAttendanceClient, { type ManualAttendanceRow } from "./manual-attendance-client";

interface RawScheduleRow {
  id_pengguna: number;
  tipe_jadwal: "PAGI" | "SORE";
  pengguna: ManualAttendanceRow["pengguna"] | ManualAttendanceRow["pengguna"][] | null;
  shift_kerja: ManualAttendanceRow["shift"] | ManualAttendanceRow["shift"][] | null;
}

interface AttendanceRecord {
  id: number;
  id_pengguna: number;
  status: string;
  jam_masuk: string | null;
  jam_pulang: string | null;
  telat_menit: number | null;
  sumber: "QR" | "MANUAL";
  catatan_manual: string | null;
}

function one<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? value[0] ?? null : value;
}

export default async function ManualAttendancePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/");

  const { data: currentUser } = await supabase
    .from("pengguna")
    .select("id, level, aktif")
    .eq("username", user.email?.split("@")[0])
    .maybeSingle();

  if (!currentUser?.aktif || !isOwnerLike(currentUser.level)) redirect("/dashboard");

  const today = getTodayWIB();
  const { data: scheduleData, error: scheduleError } = await supabase
    .from("jadwal_karyawan")
    .select(`
      id_pengguna,
      tipe_jadwal,
      pengguna(id, username, nama, level),
      shift_kerja(id, kode, nama, jam_mulai, jam_selesai),
      jadwal_mingguan!inner(status)
    `)
    .eq("tanggal", today)
    .eq("jadwal_mingguan.status", "TERBIT")
    .in("tipe_jadwal", ["PAGI", "SORE"]);

  const schedules = (scheduleData ?? []) as unknown as RawScheduleRow[];
  const employeeIds = schedules.map((row) => Number(row.id_pengguna));
  const [employeeResult, attendanceResult] = employeeIds.length
    ? await Promise.all([
        supabase
          .from("pengguna")
          .select("id, username, nama, level")
          .in("id", employeeIds),
        supabase
          .from("absensi")
          .select("id, id_pengguna, status, jam_masuk, jam_pulang, telat_menit, sumber, catatan_manual")
          .eq("tanggal", today)
          .in("id_pengguna", employeeIds),
      ])
    : [
        { data: [], error: null },
        { data: [], error: null },
      ];

  const employeeById = new Map(
    (employeeResult.data ?? []).map((employee) => [Number(employee.id), employee as ManualAttendanceRow["pengguna"]])
  );

  const attendanceByEmployee = new Map(
    ((attendanceResult.data ?? []) as AttendanceRecord[]).map((record) => [record.id_pengguna, record])
  );

  const rows: ManualAttendanceRow[] = schedules
    .map((schedule) => {
      const pengguna = employeeById.get(Number(schedule.id_pengguna)) ?? one(schedule.pengguna);
      const shift = one(schedule.shift_kerja);
      if (!pengguna || !shift) return null;
      const attendance = attendanceByEmployee.get(schedule.id_pengguna);
      return {
        id_pengguna: schedule.id_pengguna,
        pengguna,
        shift,
        tipe_jadwal: schedule.tipe_jadwal,
        attendance_id: attendance?.id ?? null,
        sumber: attendance?.sumber ?? null,
        status: normalizeAttendanceStatus(attendance?.status),
        jam_masuk: formatAttendanceTime(attendance?.jam_masuk).replace("--:--", ""),
        jam_pulang: formatAttendanceTime(attendance?.jam_pulang).replace("--:--", ""),
        telat_menit: String(attendance?.telat_menit ?? 0),
        catatan_manual: attendance?.catatan_manual ?? "",
      } satisfies ManualAttendanceRow;
    })
    .filter((row): row is ManualAttendanceRow => row !== null)
    .sort((a, b) => (a.pengguna.nama || a.pengguna.username).localeCompare(b.pengguna.nama || b.pengguna.username, "id"));

  const loadError = scheduleError || employeeResult.error || attendanceResult.error
    ? "Sebagian data absensi gagal dimuat. Muat ulang halaman sebelum mencatat absensi."
    : null;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 p-4 md:max-h-screen md:gap-8 md:overflow-hidden md:p-8 lg:p-12">
      <header className="shrink-0">
        <h1 className="text-3xl font-light tracking-tighter text-foreground md:text-4xl">
          Absen Manual
        </h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          Catat kehadiran pegawai yang dijadwalkan bekerja hari ini saat pemindaian QR terkendala.
        </p>
      </header>

      <ManualAttendanceClient date={today} initialRows={rows} loadError={loadError} />
    </div>
  );
}
