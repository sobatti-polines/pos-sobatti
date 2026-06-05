"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Camera, CheckCircle2, Clock, LogIn, LogOut } from "lucide-react";
import Link from "next/link";

interface AttendanceData {
  attendance: {
    jam_masuk: string | null;
    jam_pulang: string | null;
    status: string;
    telat_menit: number;
  } | null;
  user: {
    level: string;
  };
}

export function AttendanceWidget({ initialData }: { initialData?: AttendanceData | null }) {
  const [data, setData] = useState<AttendanceData | null>(initialData || null);
  const [loading, setLoading] = useState(!initialData);

  useEffect(() => {
    // Only fetch if initialData wasn't provided or we want to refresh
    if (!initialData) {
      fetch("/api/attendance/today")
        .then((res) => res.json())
        .then((d) => {
          setData(d);
          setLoading(false);
        })
        .catch(() => setLoading(false));
    }
  }, [initialData]);

  if (loading && !data) return null;

  if (!data || data.user.level === "OWNER") return null;

  const { attendance } = data;

  const formatTime = (isoString: string | null) => {
    if (!isoString) return "--:--";
    return new Date(isoString).toLocaleTimeString("id-ID", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Asia/Jakarta"
    });
  };

  const todayStr = new Date().toLocaleDateString("id-ID", {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  const getStatusDisplay = () => {
    if (!attendance) return { label: "BELUM ABSEN", color: "text-zinc-600", bg: "bg-zinc-100", border: "border-zinc-300", icon: <Clock className="w-6 h-6" /> };
    if (attendance.status === "HADIR" || attendance.status === "ON TIME") return { label: "HADIR", color: "text-emerald-700", bg: "bg-emerald-100/80", border: "border-emerald-400", icon: <CheckCircle2 className="w-6 h-6" /> };
    if (attendance.status === "TELAT") return { label: "TERLAMBAT", color: "text-amber-700", bg: "bg-amber-100/80", border: "border-amber-400", icon: <Clock className="w-6 h-6" /> };
    return { label: attendance.status, color: "text-blue-700", bg: "bg-blue-100/80", border: "border-blue-400", icon: <CheckCircle2 className="w-6 h-6" /> };
  };

  const statusInfo = getStatusDisplay();

  return (
    <Card className="relative overflow-hidden border-none shadow-sm bg-[#FAF8F5] w-full">
      {/* Soft Gradient Mesh Background - Stretched Horizontally */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.65] overflow-hidden mix-blend-multiply">
        <div className="absolute -top-[50%] -left-[5%] w-[40%] h-[200%] rounded-full bg-blue-200/50 filter blur-[40px]" />
        <div className="absolute top-[0%] left-[30%] w-[50%] h-[150%] rounded-full bg-orange-200/40 filter blur-[50px]" />
        <div className="absolute -bottom-[20%] right-[0%] w-[30%] h-[150%] rounded-full bg-emerald-200/40 filter blur-[40px]" />
      </div>

      <CardContent className="relative z-10 p-4 md:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 md:gap-6">
        
        {/* Left Side: Status & Date */}
        <div className="flex items-center gap-4">
          <div className="relative group shrink-0">
            <div className={`absolute inset-0 rounded-full blur-md opacity-40 ${statusInfo.bg}`} />
            <div className={`relative flex items-center justify-center w-14 h-14 rounded-full border-2 ${statusInfo.border} ${statusInfo.bg} ${statusInfo.color} shadow-sm backdrop-blur-sm transition-transform group-hover:scale-105 duration-300`}>
              {statusInfo.icon}
            </div>
          </div>
          <div>
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-0.5">{todayStr}</p>
            <div className="flex items-center gap-2">
              <h4 className={`text-base md:text-lg font-bold tracking-tight ${statusInfo.color}`}>
                {statusInfo.label}
              </h4>
              {attendance?.status === "TELAT" && (
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-200 text-amber-800">
                  {attendance.telat_menit} m
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Right Side: Time Cards & Action */}
        <div className="flex flex-wrap md:flex-nowrap items-center gap-3 w-full md:w-auto">
          
          <div className="bg-white/70 backdrop-blur-md rounded-xl px-4 py-2 shadow-sm border border-white/40 flex-1 md:flex-none flex flex-col justify-center min-w-[100px]">
            <div className="flex items-center gap-1.5 mb-0.5">
              <LogIn className="w-3 h-3 text-zinc-400" />
              <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Masuk</span>
            </div>
            <span className="text-sm md:text-base font-bold text-zinc-800 tabular-nums">
              {formatTime(attendance?.jam_masuk || null)}
            </span>
          </div>

          <div className="bg-white/70 backdrop-blur-md rounded-xl px-4 py-2 shadow-sm border border-white/40 flex-1 md:flex-none flex flex-col justify-center min-w-[100px]">
            <div className="flex items-center gap-1.5 mb-0.5">
              <LogOut className="w-3 h-3 text-zinc-400" />
              <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Pulang</span>
            </div>
            <span className="text-sm md:text-base font-bold text-zinc-800 tabular-nums">
              {formatTime(attendance?.jam_pulang || null)}
            </span>
          </div>

          {/* Action Button */}
          {!attendance?.jam_pulang && (
            <Button asChild size="sm" className="w-full md:w-auto rounded-full h-[52px] md:h-11 px-6 text-sm font-semibold shadow-md shadow-primary/10 bg-primary hover:bg-primary/90 transition-all hover:scale-[1.02] shrink-0 mt-1 md:mt-0">
              <Link href="/attendance/scan">
                <Camera className="w-4 h-4 mr-2" />
                Scan
              </Link>
            </Button>
          )}
        </div>

      </CardContent>
    </Card>
  );
}
