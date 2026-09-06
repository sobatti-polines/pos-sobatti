import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isOwnerLike } from "@/lib/roles";
import { getTodayWIB } from "@/lib/utils";
import JadwalSayaClient, {
  type MyScheduleRow,
  type ScheduleType,
} from "./jadwal-saya-client";
import { type LeaveBookingRequest } from "./booking-libur-client";

// Paksa render dinamis — jadwal karyawan bergantung pada data database yang sering berubah
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

interface RawMyScheduleRow {
  id: number;
  tanggal: string;
  tipe_jadwal: ScheduleType;
  shift_kerja:
    | MyScheduleRow["shift_kerja"]
    | MyScheduleRow["shift_kerja"][];
  jadwal_mingguan:
    | MyScheduleRow["jadwal_mingguan"]
    | MyScheduleRow["jadwal_mingguan"][];
}

function addDays(date: string, days: number) {
  const d = new Date(`${date}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function startOfWeekMonday(input?: string) {
  let baseDateStr = input;
  if (!baseDateStr || !/^\d{4}-\d{2}-\d{2}$/.test(baseDateStr)) {
    baseDateStr = getTodayWIB();
  }

  const d = new Date(`${baseDateStr}T00:00:00.000Z`);
  if (isNaN(d.getTime())) {
    baseDateStr = getTodayWIB();
    const fallback = new Date(`${baseDateStr}T00:00:00.000Z`);
    const day = fallback.getUTCDay();
    const diff = day === 0 ? -6 : 1 - day;
    fallback.setUTCDate(fallback.getUTCDate() + diff);
    return fallback.toISOString().slice(0, 10);
  }

  const day = d.getUTCDay(); // 0=Sun..6=Sat
  const diff = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diff);
  return d.toISOString().slice(0, 10);
}

export default async function JadwalSayaPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/");

  const { data: pengguna } = await supabase
    .from("pengguna")
    .select("id, username, nama, level")
    .eq("username", user.email?.split("@")[0])
    .maybeSingle();

  if (!pengguna) redirect("/");
  if (isOwnerLike(pengguna.level)) redirect("/dashboard/jadwal-karyawan");

  const today = getTodayWIB();
  const weekStart = startOfWeekMonday(params.week);
  const weekEnd = addDays(weekStart, 6);
  const isCurrentWeek = weekStart === startOfWeekMonday(today);
  const nextWeekStart = addDays(weekStart, 7);
  const nextWeekEnd = addDays(nextWeekStart, 6);

  // Fetch jadwal karyawan untuk minggu yang diminta (termasuk catatan_seragam via join)
  const { data, error } = await supabase
    .from("jadwal_karyawan")
    .select(
      `
      id,
      tanggal,
      tipe_jadwal,
      shift_kerja(kode, nama, jam_mulai, jam_selesai),
      jadwal_mingguan!inner(status, catatan_seragam)
    `
    )
    .eq("id_pengguna", pengguna.id)
    .gte("tanggal", weekStart)
    .lte("tanggal", weekEnd)
    .eq("jadwal_mingguan.status", "TERBIT")
    .order("tanggal", { ascending: true });

  if (error) {
    console.error("Failed to fetch my schedule:", error);
  }

  // Fetch data booking libur hanya jika sedang melihat minggu ini
  let draftSchedule: { id: number; jadwal_karyawan: { id_pengguna: number }[] } | null = null;
  let leaveRequests: LeaveBookingRequest[] = [];
  let ownLatestRequest: LeaveBookingRequest | null = null;

  if (isCurrentWeek) {
    const { data: draft, error: draftError } = await supabase
      .from("jadwal_mingguan")
      .select("id, minggu_mulai, status, jadwal_karyawan(id_pengguna)")
      .eq("minggu_mulai", nextWeekStart)
      .eq("status", "DRAFT")
      .maybeSingle();

    if (draftError) {
      console.error("Failed to fetch next schedule draft:", draftError);
    }
    draftSchedule = draft;

    if (draftSchedule) {
      const [{ data: activeRequests }, { data: latestRequest }] = await Promise.all([
        supabase
          .from("permintaan_libur")
          .select(
            "id, id_pengguna, tanggal, status, pengguna:pengguna!permintaan_libur_id_pengguna_fkey(id, username, nama)"
          )
          .eq("id_jadwal_mingguan", draftSchedule.id)
          .in("status", ["MENUNGGU", "DISETUJUI"])
          .order("created_at", { ascending: true }),
        supabase
          .from("permintaan_libur")
          .select(
            "id, id_pengguna, tanggal, status, pengguna:pengguna!permintaan_libur_id_pengguna_fkey(id, username, nama)"
          )
          .eq("id_jadwal_mingguan", draftSchedule.id)
          .eq("id_pengguna", pengguna.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);
      leaveRequests = (activeRequests ?? []) as unknown as LeaveBookingRequest[];
      ownLatestRequest = latestRequest as unknown as LeaveBookingRequest | null;
    }
  }

  const scheduleRows = ((data ?? []) as unknown as RawMyScheduleRow[]).map((row) => ({
    ...row,
    shift_kerja: Array.isArray(row.shift_kerja) ? row.shift_kerja[0] ?? null : row.shift_kerja,
    jadwal_mingguan: Array.isArray(row.jadwal_mingguan)
      ? row.jadwal_mingguan[0] ?? null
      : row.jadwal_mingguan,
  })) satisfies MyScheduleRow[];

  const scheduleByDate = new Map(scheduleRows.map((row) => [row.tanggal, row]));
  const scheduleStatus = scheduleRows[0]?.jadwal_mingguan?.status ?? "BELUM_ADA";
  const catatanSeragam = scheduleRows[0]?.jadwal_mingguan?.catatan_seragam ?? null;
  const participantIds = new Set(
    (draftSchedule?.jadwal_karyawan ?? []).map((row) => Number(row.id_pengguna))
  );
  const leaveCapacity = Math.max(1, Math.ceil(participantIds.size / 7));

  return (
    <div className="flex-1 p-4 md:p-8 lg:p-12 w-full flex flex-col gap-4 md:gap-8 mx-auto h-full md:max-h-screen md:overflow-hidden">
      <JadwalSayaClient
        weekStart={weekStart}
        weekEnd={weekEnd}
        scheduleByDate={scheduleByDate}
        catatanSeragam={catatanSeragam}
        today={today}
        isCurrentWeek={isCurrentWeek}
        scheduleStatus={scheduleStatus}
        nextWeekStart={nextWeekStart}
        nextWeekEnd={nextWeekEnd}
        scheduleId={draftSchedule?.id ?? null}
        employeeId={Number(pengguna.id)}
        eligible={participantIds.has(Number(pengguna.id))}
        leaveCapacity={leaveCapacity}
        leaveRequests={leaveRequests}
        ownLatestRequest={ownLatestRequest}
        bookingOpen={Boolean(draftSchedule) && today < nextWeekStart}
      />
    </div>
  );
}
