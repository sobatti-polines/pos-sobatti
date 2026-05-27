"use client";

import { useState, useMemo } from "react";
import { 
  Search, 
  Calendar, 
  Filter, 
  ChevronLeft, 
  ChevronRight, 
  Clock,
  UserCheck,
  AlertCircle,
  CheckCircle2,
  CalendarDays
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

function formatTime(isoString: string | null) {
  if (!isoString) return "--:--";
  return new Date(isoString).toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDate(dateStr: string) {
  const date = new Date(dateStr);
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(date);
}

export function HistoryClient({ initialData }: { initialData: any[] }) {
  const [dateFilter, setDateFilter] = useState({ start: "", end: "" });

  const filteredData = useMemo(() => {
    let result = [...initialData];

    if (dateFilter.start) {
      result = result.filter((d) => d.tanggal >= dateFilter.start);
    }
    if (dateFilter.end) {
      result = result.filter((d) => d.tanggal <= dateFilter.end);
    }

    return result;
  }, [initialData, dateFilter]);

  const stats = useMemo(() => {
    const total = filteredData.length;
    const telat = filteredData.filter(d => d.status === "TELAT").length;
    const totalTelatMenit = filteredData.reduce((sum, d) => sum + (d.telat_menit || 0), 0);
    
    return { total, telat, totalTelatMenit };
  }, [filteredData]);

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-background border border-border rounded-[12px] shadow-[0_1px_3px_rgba(0,55,112,0.08)] overflow-hidden">
      <div className="shrink-0 flex flex-col p-4 lg:p-6 border-b border-border bg-transparent gap-6">
        {/* Stats Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-muted/30 rounded-xl p-4 border border-border/50 flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <UserCheck className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-widest">Total Hadir</p>
              <p className="text-2xl font-light tracking-tight text-foreground tabular-nums">{stats.total} Hari</p>
            </div>
          </div>
          <div className="bg-muted/30 rounded-xl p-4 border border-border/50 flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-warning/20 flex items-center justify-center">
              <AlertCircle className="w-5 h-5 text-warning" />
            </div>
            <div>
              <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-widest">Total Terlambat</p>
              <p className="text-2xl font-light tracking-tight text-foreground tabular-nums">{stats.telat} Kali</p>
            </div>
          </div>
          <div className="bg-muted/30 rounded-xl p-4 border border-border/50 flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-destructive/20 flex items-center justify-center">
              <Clock className="w-5 h-5 text-destructive" />
            </div>
            <div>
              <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-widest">Total Menit Telat</p>
              <p className="text-2xl font-light tracking-tight text-foreground tabular-nums">{stats.totalTelatMenit} Menit</p>
            </div>
          </div>
        </div>

        {/* Filters Row */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Input 
                type="date" 
                className="rounded-md border px-3 py-2 text-sm w-40 h-10"
                value={dateFilter.start}
                onChange={(e) => setDateFilter(prev => ({ ...prev, start: e.target.value }))}
              />
              <span className="text-muted-foreground text-sm">s/d</span>
              <Input 
                type="date" 
                className="rounded-md border px-3 py-2 text-sm w-40 h-10"
                value={dateFilter.end}
                onChange={(e) => setDateFilter(prev => ({ ...prev, end: e.target.value }))}
              />
            </div>
            <Button 
              variant="outline" 
              className="h-10 rounded-full px-6" 
              onClick={() => setDateFilter({ start: "", end: "" })}
            >
              Reset
            </Button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto min-h-0 relative">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[200px] pl-6">Tanggal</TableHead>
              <TableHead className="w-[150px]">Status</TableHead>
              <TableHead className="w-[150px]">Jam Masuk</TableHead>
              <TableHead className="w-[150px]">Jam Pulang</TableHead>
              <TableHead className="w-[150px]">Keterangan</TableHead>
              <TableHead className="pr-6">Informasi Perangkat</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredData.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-32">
                  <div className="flex flex-col items-center justify-center text-muted-foreground">
                    <CalendarDays className="w-12 h-12 mb-4 opacity-20" />
                    <p className="text-base font-medium text-foreground">Tidak ada riwayat ditemukan</p>
                    <p className="text-sm mt-1">Coba sesuaikan filter tanggal Anda.</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filteredData.map((d) => (
                <TableRow key={d.id}>
                  <TableCell className="pl-6 font-medium">
                    {formatDate(d.tanggal)}
                  </TableCell>
                  <TableCell>
                    <Badge 
                      variant="secondary" 
                      className={`font-normal border-none rounded-full px-3 py-1 text-[11px] uppercase tracking-wider ${
                        d.status === "HADIR" 
                          ? "bg-success/20 text-success" 
                          : "bg-warning/20 text-warning"
                      }`}
                    >
                      {d.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="tabular-nums font-medium text-foreground">
                    {formatTime(d.jam_masuk)}
                  </TableCell>
                  <TableCell className="tabular-nums text-muted-foreground">
                    {formatTime(d.jam_pulang)}
                  </TableCell>
                  <TableCell>
                    {d.telat_menit > 0 ? (
                      <span className="text-xs text-warning font-medium">Telat {d.telat_menit} menit</span>
                    ) : (
                      <span className="text-xs text-success font-medium">Tepat Waktu</span>
                    )}
                  </TableCell>
                  <TableCell className="pr-6 text-xs text-muted-foreground truncate max-w-[200px]" title={d.device_info}>
                    {d.device_info || "-"}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
