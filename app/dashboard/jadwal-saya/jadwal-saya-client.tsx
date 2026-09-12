"use client";

import { useEffect, useRef, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import BookingLiburClient, {
  type LeaveBookingRequest,
} from "./booking-libur-client";

export type ScheduleType = "PAGI" | "SORE" | "FULL" | "LIBUR";

export interface MyScheduleRow {
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

interface ScheduleResponse {
  weekStart: string;
  weekEnd: string;
  scheduleRows: MyScheduleRow[];
  scheduleStatus: string;
  catatanSeragam: Record<string, string> | null;
  today: string;
  isCurrentWeek: boolean;
  nextWeekStart: string;
  nextWeekEnd: string;
  scheduleId: number | null;
  employeeId: number;
  eligible: boolean;
  leaveCapacity: number;
  leaveRequests: LeaveBookingRequest[];
  ownLatestRequest: LeaveBookingRequest | null;
  canBookLeave: boolean;
  bookingOpen: boolean;
}

type ViewState =
  | { status: "loading"; weekKey: string }
  | { status: "error"; weekKey: string; error: string }
  | { status: "ready"; weekKey: string; data: ScheduleResponse };

const DAY_LABELS = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"];

function addDays(date: string, days: number) {
  const d = new Date(`${date}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function formatDate(date: string) {
  return new Date(`${date}T00:00:00+07:00`).toLocaleDateString("id-ID", {
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
    FULL: "bg-amber-100 text-amber-800",
    LIBUR: "bg-rose-100 text-rose-700",
  };
  return <Badge className={`rounded-full border-none ${cls[type]}`}>{type}</Badge>;
}

function statusBadge(status: string) {
  if (status === "TERBIT") {
    return <Badge className="rounded-full border-none bg-emerald-100 text-emerald-700">Terbit</Badge>;
  }
  if (status === "DRAFT") {
    return <Badge className="rounded-full border-none bg-amber-100 text-amber-700">Draft</Badge>;
  }
  return <Badge className="rounded-full border-none bg-muted text-muted-foreground">Belum Ada</Badge>;
}

function SkeletonLoader() {
  return (
    <div className="flex-1 p-4 md:p-8 lg:p-12 w-full flex flex-col gap-4 md:gap-8 mx-auto h-full md:max-h-screen md:overflow-hidden">
      <header className="shrink-0 space-y-3 pt-1 md:pt-2">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-2">
            <div className="h-9 w-48 bg-muted animate-pulse rounded" />
            <div className="flex items-center gap-2">
              <div className="h-5 w-16 bg-muted animate-pulse rounded-full" />
              <div className="h-5 w-56 bg-muted animate-pulse rounded" />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-8 w-32 bg-muted animate-pulse rounded" />
            <div className="h-8 w-36 bg-muted animate-pulse rounded" />
          </div>
        </div>
      </header>
      <main className="min-h-0 flex-1 overflow-y-auto rounded-[16px] border border-border bg-card p-4 md:p-6">
        <div className="mb-5 grid gap-4 md:grid-cols-[1fr_320px]">
          <div className="rounded-[14px] border border-border p-4">
            <div className="h-4 w-32 bg-muted animate-pulse rounded mb-2" />
            <div className="h-7 w-64 bg-muted animate-pulse rounded" />
          </div>
          <div className="rounded-[14px] border border-border p-4">
            <div className="h-4 w-28 bg-muted animate-pulse rounded mb-2" />
            <div className="h-6 w-40 bg-muted animate-pulse rounded" />
          </div>
        </div>
        <div className="grid gap-3">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="grid gap-3 rounded-[14px] border border-border px-4 py-3 sm:grid-cols-2 lg:grid-cols-[160px_minmax(0,1fr)_minmax(0,1fr)_auto] lg:items-center">
              <div>
                <div className="h-5 w-20 bg-muted animate-pulse rounded mb-1" />
                <div className="h-4 w-32 bg-muted animate-pulse rounded" />
              </div>
              <div className="h-6 w-16 bg-muted animate-pulse rounded-full" />
              <div className="h-5 w-24 bg-muted animate-pulse rounded" />
              <div className="h-5 w-28 bg-muted animate-pulse rounded" />
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}

export default function JadwalSayaClient({
  initialWeekStart,
}: {
  initialWeekStart: string;
}) {
  const [view, setView] = useState<ViewState>({
    status: "loading",
    weekKey: initialWeekStart,
  });
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const weekKey = view.weekKey;
    const controller = new AbortController();
    abortRef.current?.abort();
    abortRef.current = controller;

    fetch(`/api/jadwal-saya?week=${weekKey}`, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then((res) => res.json())
      .then((json) => {
        if (controller.signal.aborted) return;
        if (json.error) {
          setView({ status: "error", weekKey, error: json.error });
        } else {
          setView({ status: "ready", weekKey, data: json });
        }
      })
      .catch(() => {
        if (controller.signal.aborted) return;
        setView({ status: "error", weekKey, error: "Gagal mengambil data jadwal" });
      });

    return () => controller.abort();
  }, [view.weekKey]);

  const navigateWeek = (targetWeek: string) => {
    setView({ status: "loading", weekKey: targetWeek });
    window.history.pushState(null, "", `/dashboard/jadwal-saya?week=${targetWeek}`);
  };

  const previousWeek = addDays(view.weekKey, -7);
  const nextWeek = addDays(view.weekKey, 7);

  if (view.status === "loading") {
    return <SkeletonLoader />;
  }

  if (view.status === "error") {
    return (
      <div className="flex-1 p-4 md:p-8 lg:p-12 w-full flex flex-col items-center justify-center gap-4">
        <p className="text-destructive">{view.error}</p>
        <Button variant="outline" onClick={() => setView({ status: "loading", weekKey: view.weekKey })}>
          Coba Lagi
        </Button>
      </div>
    );
  }

  const { data } = view;
  const weekDates = Array.from({ length: 7 }, (_, index) => addDays(data.weekStart, index));
  const scheduleByDate = new Map(data.scheduleRows.map((row) => [row.tanggal, row]));
  const todaySchedule = scheduleByDate.get(data.today);

  return (
    <div className="flex-1 p-4 md:p-8 lg:p-12 w-full flex flex-col gap-4 md:gap-8 mx-auto h-full md:max-h-screen md:overflow-hidden">
      <header className="shrink-0 space-y-3 pt-1 md:pt-2">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-2">
            <h1 className="text-3xl md:text-4xl font-light tracking-tighter text-foreground">
              Jadwal Saya
            </h1>
            <div className="flex flex-wrap items-center gap-2">
              {statusBadge(data.scheduleStatus)}
              <span className="text-sm text-muted-foreground">
                {formatDate(data.weekStart)} - {formatDate(data.weekEnd)}
              </span>
              {data.isCurrentWeek && (
                <Badge variant="outline" className="rounded-full">
                  Minggu Ini
                </Badge>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigateWeek(previousWeek)}
            >
              <ChevronLeft className="h-4 w-4" />
              <span className="hidden md:inline">Minggu Sebelumnya</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigateWeek(nextWeek)}
            >
              <span className="hidden md:inline">Minggu Berikutnya</span>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="min-h-0 flex-1 overflow-y-auto rounded-[16px] border border-border bg-card p-4 md:p-6">
        {data.isCurrentWeek && data.canBookLeave && (
          <BookingLiburClient
            key={`${data.nextWeekStart}-${data.scheduleId ?? "none"}`}
            scheduleId={data.scheduleId}
            weekStart={data.nextWeekStart}
            weekEnd={data.nextWeekEnd}
            employeeId={data.employeeId}
            eligible={data.eligible}
            capacity={data.leaveCapacity}
            requests={data.leaveRequests}
            ownLatestRequest={data.ownLatestRequest}
            bookingOpen={data.bookingOpen}
          />
        )}

        <div className="mb-5 grid gap-4 md:grid-cols-[1fr_320px]">
          <div className="rounded-[14px] border border-border p-4">
            <p className="text-sm text-muted-foreground">
              {data.isCurrentWeek ? "Periode Minggu Ini" : "Periode Minggu yang Dilihat"}
            </p>
            <p className="mt-1 text-xl font-light tracking-tight text-foreground">
              {formatDate(data.weekStart)} - {formatDate(data.weekEnd)}
            </p>
            {!data.isCurrentWeek && (
              <p className="mt-2 text-xs text-muted-foreground">
                Klik &quot;Minggu Berikutnya&quot; untuk kembali ke minggu ini.
              </p>
            )}
          </div>
          <div className="rounded-[14px] border border-border p-4">
            <div className="mb-2 flex items-center gap-2 text-sm font-medium text-foreground">
              <Clock className="h-4 w-4 text-primary" />
              {data.isCurrentWeek ? "Shift Hari Ini" : "Shift Hari Ini (Minggu Ini)"}
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
              <p className="text-sm text-muted-foreground">
                {data.isCurrentWeek ? "Belum ada jadwal hari ini." : "Data shift hanya tersedia untuk minggu ini."}
              </p>
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
                  date === data.today ? "border-primary/30 bg-primary/5" : "border-border"
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
                  {date === data.today && (
                    <Badge variant="outline" className="rounded-full">
                      Hari Ini
                    </Badge>
                  )}
                </div>
                <div className="min-w-0 text-sm text-muted-foreground">
                  {data.catatanSeragam?.[date] ? (
                    <span className="inline-flex max-w-full items-start gap-1.5 whitespace-normal break-words rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                      <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-primary/60" />
                      {data.catatanSeragam[date]}
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
