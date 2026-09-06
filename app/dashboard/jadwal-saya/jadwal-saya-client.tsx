"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, ChevronLeft, ChevronRight, Clock, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import BookingLiburClient, {
  type LeaveBookingRequest,
} from "./booking-libur-client";

export type ScheduleType = "PAGI" | "SORE" | "LIBUR";

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

function formatLongDate(date: string) {
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

export default function JadwalSayaClient({
  weekStart,
  weekEnd,
  scheduleByDate,
  catatanSeragam,
  today,
  isCurrentWeek,
  scheduleStatus,
  nextWeekStart,
  nextWeekEnd,
  scheduleId,
  employeeId,
  eligible,
  leaveCapacity,
  leaveRequests,
  ownLatestRequest,
  bookingOpen,
}: {
  weekStart: string;
  weekEnd: string;
  scheduleByDate: Map<string, MyScheduleRow>;
  catatanSeragam: Record<string, string> | null;
  today: string;
  isCurrentWeek: boolean;
  scheduleStatus: string;
  nextWeekStart: string;
  nextWeekEnd: string;
  scheduleId: number | null;
  employeeId: number;
  eligible: boolean;
  leaveCapacity: number;
  leaveRequests: LeaveBookingRequest[];
  ownLatestRequest: LeaveBookingRequest | null;
  bookingOpen: boolean;
}) {
  const router = useRouter();
  const [isNavigating, setIsNavigating] = useState(false);

  const weekDates = Array.from({ length: 7 }, (_, index) => addDays(weekStart, index));
  const todaySchedule = scheduleByDate.get(today);
  const previousWeek = addDays(weekStart, -7);
  const nextWeek = addDays(weekStart, 7);

  const handleNavigateWeek = (targetWeek: string) => {
    setIsNavigating(true);
    router.push(`/dashboard/jadwal-saya?week=${targetWeek}`);
  };

  return (
    <div className="flex-1 p-4 md:p-8 lg:p-12 w-full flex flex-col gap-4 md:gap-8 mx-auto h-full md:max-h-screen md:overflow-hidden">
      <header className="shrink-0 space-y-3 pt-1 md:pt-2">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-2">
            <h1 className="text-3xl md:text-4xl font-light tracking-tighter text-foreground">
              Jadwal Saya
            </h1>
            <div className="flex flex-wrap items-center gap-2">
              {statusBadge(scheduleStatus)}
              <span className="text-sm text-muted-foreground">
                {formatLongDate(weekStart)} - {formatLongDate(weekEnd)}
              </span>
              {isCurrentWeek && (
                <Badge variant="outline" className="rounded-full">
                  Minggu Ini
                </Badge>
              )}
              {isNavigating && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={isNavigating}
              onClick={() => handleNavigateWeek(previousWeek)}
            >
              <ChevronLeft className="h-4 w-4" />
              <span className="hidden md:inline">Minggu Sebelumnya</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={isNavigating}
              onClick={() => handleNavigateWeek(nextWeek)}
            >
              <span className="hidden md:inline">Minggu Berikutnya</span>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="min-h-0 flex-1 overflow-y-auto rounded-[16px] border border-border bg-card p-4 md:p-6">
        {isCurrentWeek && (
          <BookingLiburClient
            key={`${nextWeekStart}-${scheduleId ?? "none"}`}
            scheduleId={scheduleId}
            weekStart={nextWeekStart}
            weekEnd={nextWeekEnd}
            employeeId={employeeId}
            eligible={eligible}
            capacity={leaveCapacity}
            requests={leaveRequests}
            ownLatestRequest={ownLatestRequest}
            bookingOpen={bookingOpen}
          />
        )}

        <div className="mb-5 grid gap-4 md:grid-cols-[1fr_320px]">
          <div className="rounded-[14px] border border-border p-4">
            <p className="text-sm text-muted-foreground">Periode Minggu</p>
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
              <p className="text-sm text-muted-foreground">
                {isCurrentWeek ? "Belum ada jadwal hari ini." : "Hari ini bukan bagian dari minggu yang dilihat."}
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
