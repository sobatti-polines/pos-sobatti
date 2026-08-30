"use client";

import { useState, useTransition } from "react";
import { CalendarCheck, Loader2, MoveRight, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  cancelLeaveRequest,
  saveLeaveRequest,
  type LeaveRequestStatus,
} from "@/app/dashboard/jadwal-karyawan/actions";

export interface LeaveBookingRequest {
  id: number;
  id_pengguna: number;
  tanggal: string;
  status: LeaveRequestStatus;
  pengguna: {
    id: number;
    username: string;
    nama: string | null;
  } | null;
}

const DAY_LABELS = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"];

function addDays(date: string, days: number) {
  const value = new Date(`${date}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function formatDate(date: string) {
  return new Date(`${date}T00:00:00.000Z`).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
  });
}

export default function BookingLiburClient({
  scheduleId,
  weekStart,
  weekEnd,
  employeeId,
  eligible,
  capacity,
  requests,
  ownLatestRequest,
  bookingOpen,
}: {
  scheduleId: number | null;
  weekStart: string;
  weekEnd: string;
  employeeId: number;
  eligible: boolean;
  capacity: number;
  requests: LeaveBookingRequest[];
  ownLatestRequest: LeaveBookingRequest | null;
  bookingOpen: boolean;
}) {
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();
  const dates = Array.from({ length: 7 }, (_, index) => addDays(weekStart, index));
  const ownActiveRequest = requests.find((request) => request.id_pengguna === employeeId) ?? null;

  const mutate = (action: () => Promise<{ error?: string; success?: boolean }>) => {
    setError("");
    startTransition(async () => {
      const result = await action();
      if (result.error) {
        setError(result.error);
        return;
      }
      window.location.reload();
    });
  };

  return (
    <section className="mb-6 border-b border-border pb-6">
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-medium text-foreground">Booking Libur Minggu Depan</h2>
            <Badge variant={bookingOpen ? "outline" : "secondary"}>
              {bookingOpen ? "Terbuka" : "Belum tersedia"}
            </Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {formatDate(weekStart)} - {formatDate(weekEnd)}
          </p>
        </div>
        {ownActiveRequest?.status === "MENUNGGU" && (
          <Button
            type="button"
            size="sm"
            variant="destructive"
            disabled={isPending || !bookingOpen}
            onClick={() => mutate(() => cancelLeaveRequest(ownActiveRequest.id))}
          >
            {isPending ? <Loader2 className="animate-spin" /> : <X />}
            Batalkan Booking
          </Button>
        )}
      </div>

      {error && (
        <div className="mb-4 rounded-[6px] border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive" role="alert">
          {error}
        </div>
      )}

      {!scheduleId ? (
        <p className="text-sm text-muted-foreground">Owner belum membuka draft jadwal minggu depan.</p>
      ) : !eligible ? (
        <p className="text-sm text-muted-foreground">Anda tidak termasuk dalam draft jadwal minggu depan.</p>
      ) : (
        <div className="divide-y divide-border rounded-[8px] border border-border">
          {dates.map((date, index) => {
            const dayRequests = requests.filter((request) => request.tanggal === date);
            const ownOnDate = ownActiveRequest?.tanggal === date;
            const isApproved = ownOnDate && ownActiveRequest?.status === "DISETUJUI";
            const isFull = dayRequests.length >= capacity && !ownOnDate;
            return (
              <div
                key={date}
                className="grid gap-3 px-4 py-3 sm:grid-cols-[150px_minmax(0,1fr)_auto] sm:items-center"
              >
                <div>
                  <p className="text-sm font-medium text-foreground">{DAY_LABELS[index]}</p>
                  <p className="text-xs text-muted-foreground">{formatDate(date)}</p>
                </div>
                <div className="flex min-w-0 flex-wrap gap-2">
                  {dayRequests.length > 0 ? (
                    dayRequests.map((request) => (
                      <Badge
                        key={request.id}
                        className={
                          request.status === "DISETUJUI"
                            ? "border-none bg-emerald-100 text-emerald-800"
                            : "border-none bg-amber-100 text-amber-800"
                        }
                      >
                        {request.pengguna?.nama || request.pengguna?.username || `Pegawai #${request.id_pengguna}`}
                      </Badge>
                    ))
                  ) : (
                    <span className="text-sm text-muted-foreground">Belum dibooking</span>
                  )}
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant={ownOnDate ? "secondary" : "outline"}
                  disabled={isPending || !bookingOpen || isApproved || isFull}
                  onClick={() => {
                    if (!scheduleId || ownOnDate) return;
                    mutate(() => saveLeaveRequest(scheduleId, date));
                  }}
                >
                  {isPending ? (
                    <Loader2 className="animate-spin" />
                  ) : ownOnDate ? (
                    <CalendarCheck />
                  ) : (
                    <MoveRight />
                  )}
                  {isApproved
                    ? "Disetujui"
                    : ownOnDate
                      ? "Dipilih"
                      : isFull
                        ? "Penuh"
                        : ownActiveRequest
                          ? "Pindahkan"
                          : "Pilih"}
                </Button>
              </div>
            );
          })}
        </div>
      )}

      {!ownActiveRequest && ownLatestRequest?.status === "DITOLAK" && (
        <p className="mt-3 text-sm text-destructive">
          Permintaan {formatDate(ownLatestRequest.tanggal)} ditolak. Pilih hari lain yang masih tersedia.
        </p>
      )}
    </section>
  );
}
