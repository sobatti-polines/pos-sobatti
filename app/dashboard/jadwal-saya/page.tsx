import { redirect } from "next/navigation";
import { CalendarDays, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/server";
import { isOwnerLike } from "@/lib/roles";
import { getTodayWIB } from "@/lib/utils";
import BookingLiburClient, {
  type LeaveBookingRequest,
} from "./booking-libur-client";

type ScheduleType = "PAGI" | "SORE" | "LIBUR";

interface MyScheduleRow {
  id: number;
  tanggal: string;
  tipe_jadwal: ScheduleType;
  shift_kerja: {
    kode: string;
    nama: string;
    jam_mulai: string;
    jam_selesai: string;
  } | null;
  jadwal_mingguan: {
    status: string;
    catatan_seragam?: Record<string, string> | null;
  } | null;
}

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

const DAY_LABELS = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"];

function toDateString(date: Date) {
  return date.toISOString().slice(0, 10);
}

function addDays(date: string, days: number) {
  const d = new Date(`${date}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return toDateString(d);
}

function startOfWeekMonday(input = new Date()) {
  const base = new Date(Date.UTC(input.getFullYear(), input.getMonth(), input.getDate()));
  const day = base.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  base.setUTCDate(base.getUTCDate() + diff);
  return toDateString(base);
}

function formatDate(date: string) {
  return new Date(`${date}T00:00:00.000Z`).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function formatTime(value: string | null | undefined) {
  return value ? value.slice(0, 5) : "--:--";
}

function shiftBadge(type: ScheduleType) {
  const cls: Record<ScheduleType, string> = {
    PAGI: "bg-sky-100 text-sky-700",
    SORE: "bg-indigo-100 text-indigo-700",
    LIBUR: "bg-rose-100 text-rose-700",
  };
  return <Badge className={`rounded-full border-none ${cls[type]}`}>{type}</Badge>;
}

export default async function JadwalSayaPage() {
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
  const weekStart = startOfWeekMonday(new Date(`${today}T00:00:00.000Z`));
  const weekDates = Array.from({ length: 7 }, (_, index) => addDays(weekStart, index));
  const weekEnd = addDays(weekStart, 6);
  const nextWeekStart = addDays(weekStart, 7);
  const nextWeekEnd = addDays(nextWeekStart, 6);

  const [{ data, error }, { data: draftSchedule, error: draftError }] = await Promise.all([
    supabase
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
      .order("tanggal", { ascending: true }),
    supabase
      .from("jadwal_mingguan")
      .select("id, minggu_mulai, status, jadwal_karyawan(id_pengguna)")
      .eq("minggu_mulai", nextWeekStart)
      .eq("status", "DRAFT")
      .maybeSingle(),
  ]);

  if (error) {
    console.error("Failed to fetch my schedule:", error);
  }
  if (draftError) {
    console.error("Failed to fetch next schedule draft:", draftError);
  }

  let leaveRequests: LeaveBookingRequest[] = [];
  let ownLatestRequest: LeaveBookingRequest | null = null;
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

  const scheduleRows = ((data ?? []) as unknown as RawMyScheduleRow[]).map((row) => ({
    ...row,
    shift_kerja: Array.isArray(row.shift_kerja) ? row.shift_kerja[0] ?? null : row.shift_kerja,
    jadwal_mingguan: Array.isArray(row.jadwal_mingguan)
      ? row.jadwal_mingguan[0] ?? null
      : row.jadwal_mingguan,
  })) satisfies MyScheduleRow[];

  const scheduleByDate = new Map(scheduleRows.map((row) => [row.tanggal, row]));
  const todaySchedule = scheduleByDate.get(today);
  const catatanSeragam = scheduleRows[0]?.jadwal_mingguan?.catatan_seragam ?? null;
  const participantIds = new Set(
    (draftSchedule?.jadwal_karyawan ?? []).map((row) => Number(row.id_pengguna))
  );
  const leaveCapacity = Math.max(1, Math.ceil(participantIds.size / 7));

  return (
    <div className="flex-1 p-4 md:p-8 lg:p-12 w-full flex flex-col gap-4 md:gap-8 mx-auto h-full md:max-h-screen md:overflow-hidden">
      <header className="shrink-0">
        <h1 className="text-3xl md:text-4xl font-light tracking-tighter text-foreground">
          Jadwal Saya
        </h1>
        <p className="text-muted-foreground mt-2">
          Lihat jadwal shift minggu ini yang sudah diterbitkan owner.
        </p>
      </header>

      <main className="min-h-0 flex-1 overflow-y-auto rounded-[16px] border border-border bg-card p-4 md:p-6">
        <BookingLiburClient
          scheduleId={draftSchedule?.id ?? null}
          weekStart={nextWeekStart}
          weekEnd={nextWeekEnd}
          employeeId={Number(pengguna.id)}
          eligible={participantIds.has(Number(pengguna.id))}
          capacity={leaveCapacity}
          requests={leaveRequests}
          ownLatestRequest={ownLatestRequest}
          bookingOpen={Boolean(draftSchedule) && today < nextWeekStart}
        />

        <div className="mb-5 grid gap-4 md:grid-cols-[1fr_320px]">
          <div className="rounded-[14px] border border-border p-4">
            <p className="text-sm text-muted-foreground">Periode Minggu Ini</p>
            <p className="mt-1 text-xl font-light tracking-tight text-foreground">
              {formatDate(weekStart)} - {formatDate(weekEnd)}
            </p>
          </div>
          <div className="rounded-[14px] border border-border p-4">
            <div className="mb-2 flex items-center gap-2 text-sm font-medium text-foreground">
              <Clock className="h-4 w-4 text-primary" />
              Shift Hari Ini
            </div>
            {todaySchedule ? (
              <div className="flex items-center justify-between gap-3">
                {shiftBadge(todaySchedule.tipe_jadwal)}
                <span className="text-sm tabular-nums text-muted-foreground">
                  {todaySchedule.tipe_jadwal === "LIBUR"
                    ? "Hari libur"
                    : `${formatTime(todaySchedule.shift_kerja?.jam_mulai)} - ${formatTime(todaySchedule.shift_kerja?.jam_selesai)}`}
                </span>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Belum ada jadwal hari ini.</p>
            )}
          </div>
        </div>

        <div className="grid gap-3">
          {weekDates.map((date, index) => {
            const row = scheduleByDate.get(date);
            return (
              <div
                key={date}
                className={`grid gap-3 rounded-[14px] border px-4 py-3 sm:grid-cols-2 lg:grid-cols-[160px_minmax(0,1fr)_minmax(0,1fr)_auto] lg:items-center ${
                  date === today ? "border-primary/30 bg-primary/5" : "border-border"
                }`}
              >
                <div>
                  <p className="font-medium text-foreground">{DAY_LABELS[index]}</p>
                  <p className="text-sm text-muted-foreground">{formatDate(date)}</p>
                </div>
                <div className="flex items-center gap-2">
                  {row ? shiftBadge(row.tipe_jadwal) : (
                    <Badge className="rounded-full border-none bg-muted text-muted-foreground">
                      Belum Ada
                    </Badge>
                  )}
                  {date === today && (
                    <Badge variant="outline" className="rounded-full">
                      Hari Ini
                    </Badge>
                  )}
                </div>
                <div className="min-w-0 text-sm text-muted-foreground">
                  {catatanSeragam?.[date] ? (
                    <span className="inline-flex max-w-full items-start gap-1.5 whitespace-normal break-words rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                      <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-primary/60" />
                      {catatanSeragam[date]}
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground/60">-</span>
                  )}
                </div>
                <div className="flex min-w-0 items-center gap-2 text-sm tabular-nums text-muted-foreground lg:whitespace-nowrap">
                  <CalendarDays className="h-4 w-4" />
                  {row?.tipe_jadwal === "LIBUR"
                    ? "Libur"
                    : row
                      ? `${formatTime(row.shift_kerja?.jam_mulai)} - ${formatTime(row.shift_kerja?.jam_selesai)}`
                      : "-"}
                </div>
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}
