"use client";

import { useState, useMemo } from "react";
import { 
  Clock,
  UserCheck,
  AlertCircle,
  CalendarDays,
  Download
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
import { exportToCSV, exportToPDF } from "@/lib/export-utils";

function formatTime(isoString: string | null) {
  if (!isoString) return "--:--";
  return new Date(isoString).toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Jakarta"
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

interface AttendanceRecord {
  id: string;
  tanggal: string;
  jam_masuk: string | null;
  jam_pulang: string | null;
  status: string;
  telat_menit: number;
  device_info: string | null;
}

export function HistoryClient({ initialData }: { initialData: AttendanceRecord[] }) {
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

  const handleExportCSV = () => {
    const headers = ["Tanggal", "Status", "Jam Masuk", "Jam Pulang", "Keterangan", "Informasi Perangkat"];
    const rows = filteredData.map(d => [
      formatDate(d.tanggal),
      d.status,
      formatTime(d.jam_masuk),
      formatTime(d.jam_pulang),
      d.telat_menit > 0 ? `Telat ${d.telat_menit} menit` : "Tepat Waktu",
      d.device_info || "-"
    ]);
    exportToCSV(`Riwayat_Absensi_${new Date().toISOString().split("T")[0]}`, headers, rows);
  };

  const handleExportPDF = () => {
    const headers = ["Tanggal", "Status", "Jam Masuk", "Jam Pulang", "Keterangan", "Informasi Perangkat"];
    const rows = filteredData.map(d => [
      formatDate(d.tanggal),
      d.status,
      formatTime(d.jam_masuk),
      formatTime(d.jam_pulang),
      d.telat_menit > 0 ? `Telat ${d.telat_menit} menit` : "Tepat Waktu",
      d.device_info || "-"
    ]);
    exportToPDF(`Riwayat_Absensi_${new Date().toISOString().split("T")[0]}`, "Riwayat Absensi", headers, rows);
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-background border border-border rounded-[12px] shadow-[0_1px_3px_rgba(0,55,112,0.08)] overflow-hidden">
      <div className="shrink-0 flex flex-col p-4 lg:p-6 border-b border-border bg-transparent gap-6">
        {/* Stats Row */}
        <div className="flex flex-col sm:flex-row gap-8 md:gap-16 pb-2">
          <div>
            <p className="text-sm font-medium text-muted-foreground mb-1">Total Hadir</p>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-light tracking-tight text-foreground tabular-nums">{stats.total}</span>
              <span className="text-sm text-muted-foreground">hari</span>
            </div>
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground mb-1">Total Terlambat</p>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-light tracking-tight text-foreground tabular-nums">{stats.telat}</span>
              <span className="text-sm text-muted-foreground">kali</span>
            </div>
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground mb-1">Total Menit Telat</p>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-light tracking-tight text-foreground tabular-nums">{stats.totalTelatMenit}</span>
              <span className="text-sm text-muted-foreground">menit</span>
            </div>
          </div>
        </div>

        {/* Filters Row */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex-1 flex flex-col md:flex-row items-stretch md:items-center gap-3 w-full">
            <div className="flex items-center gap-2 w-full md:w-auto">
              <Input 
                type="date" 
                aria-label="Tanggal Mulai"
                className="rounded-md border px-3 py-2 text-sm w-full md:w-40 h-10 flex-1"
                value={dateFilter.start}
                onChange={(e) => setDateFilter(prev => ({ ...prev, start: e.target.value }))}
              />
              <span className="text-muted-foreground text-sm">s/d</span>
              <Input 
                type="date" 
                aria-label="Tanggal Selesai"
                className="rounded-md border px-3 py-2 text-sm w-full md:w-40 h-10 flex-1"
                value={dateFilter.end}
                onChange={(e) => setDateFilter(prev => ({ ...prev, end: e.target.value }))}
              />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
            <Button 
              variant="outline" 
              className="h-10 rounded-full px-6 flex-1 md:flex-none" 
              onClick={() => setDateFilter({ start: "", end: "" })}
            >
              Reset
            </Button>
            <Button onClick={handleExportCSV} variant="outline" className="h-10 rounded-full gap-2 px-6 flex-1 md:flex-none">
              <Download className="w-4 h-4" />
              CSV
            </Button>
            <Button onClick={handleExportPDF} variant="outline" className="h-10 rounded-full gap-2 px-6 flex-1 md:flex-none">
              <Download className="w-4 h-4" />
              PDF
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
                  <TableCell className="pr-6 text-xs text-muted-foreground truncate max-w-[200px]" title={d.device_info ?? undefined}>
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
