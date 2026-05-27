"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Camera, Clock, CheckCircle2, XCircle } from "lucide-react";
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

export function AttendanceWidget() {
  const [data, setData] = useState<AttendanceData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/attendance/today")
      .then((res) => res.json())
      .then((d) => {
        setData(d);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return (
    <Card className="bg-muted/30 border-none animate-pulse h-32"></Card>
  );

  if (!data || data.user.level === "OWNER") return null;

  const { attendance } = data;

  const formatTime = (isoString: string | null) => {
    if (!isoString) return "--:--";
    return new Date(isoString).toLocaleTimeString("id-ID", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <Card className="bg-muted/30 border-none overflow-hidden">
      <CardContent className="p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
              attendance ? "bg-emerald-100 text-emerald-600" : "bg-primary/10 text-primary"
            }`}>
              {attendance ? <CheckCircle2 className="w-6 h-6" /> : <Clock className="w-6 h-6" />}
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Absensi Hari Ini</p>
              <div className="flex items-center gap-2 mt-1">
                <h4 className="text-xl font-semibold">
                  {attendance ? attendance.status : "Belum Absen"}
                </h4>
                {attendance?.status === "TELAT" && (
                  <Badge variant="destructive" className="font-normal">
                    {attendance.telat_menit} menit
                  </Badge>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-8">
            <div className="flex flex-col">
              <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-tighter">Jam Masuk</span>
              <span className="text-sm font-medium tabular-nums">{formatTime(attendance?.jam_masuk || null)}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-tighter">Jam Pulang</span>
              <span className="text-sm font-medium tabular-nums">{formatTime(attendance?.jam_pulang || null)}</span>
            </div>
            
            {!attendance?.jam_pulang && (
              <Button asChild className="gap-2 shadow-lg shadow-primary/20">
                <Link href="/dashboard/attendance/scan">
                  <Camera className="w-4 h-4" />
                  Quick Scan
                </Link>
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
