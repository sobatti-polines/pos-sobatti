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
  Download,
  Users,
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

export function ReportClient({ initialData }: { initialData: any[] }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [dateFilter, setDateFilter] = useState({ start: "", end: "" });

  const filteredData = useMemo(() => {
    let result = [...initialData];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(d => 
        d.pengguna?.username?.toLowerCase().includes(q)
      );
    }

    if (dateFilter.start) {
      result = result.filter((d) => d.tanggal >= dateFilter.start);
    }
    if (dateFilter.end) {
      result = result.filter((d) => d.tanggal <= dateFilter.end);
    }

    return result;
  }, [initialData, searchQuery, dateFilter]);

  const stats = useMemo(() => {
    const total = filteredData.length;
    const telat = filteredData.filter(d => d.status === "TELAT").length;
    const uniqueEmployees = new Set(filteredData.map(d => d.id_pengguna)).size;
    
    return { total, telat, uniqueEmployees };
  }, [filteredData]);

  const downloadCSV = () => {
    const headers = ["Tanggal", "Username", "Level", "Jam Masuk", "Jam Pulang", "Status", "Telat (Menit)", "Device"];
    const rows = filteredData.map(d => [
      d.tanggal,
      d.pengguna?.username || "-",
      d.pengguna?.level || "-",
      formatTime(d.jam_masuk),
      formatTime(d.jam_pulang),
      d.status,
      d.telat_menit || 0,
      (d.device_info || "").replace(/,/g, ";")
    ]);

    const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `laporan_absensi_${new Date().toISOString().split("T")[0]}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-background border border-border rounded-[12px] shadow-[0_1px_3px_rgba(0,55,112,0.08)] overflow-hidden">
      <div className="shrink-0 flex flex-col p-4 lg:p-6 border-b border-border bg-transparent gap-6">
        {/* Stats Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-muted/30 rounded-xl p-4 border border-border/50 flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Users className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-widest">Pegawai Aktif</p>
              <p className="text-2xl font-light tracking-tight text-foreground tabular-nums">{stats.uniqueEmployees} Orang</p>
            </div>
          </div>
          <div className="bg-muted/30 rounded-xl p-4 border border-border/50 flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-success/20 flex items-center justify-center">
              <UserCheck className="w-5 h-5 text-success" />
            </div>
            <div>
              <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-widest">Total Kehadiran</p>
              <p className="text-2xl font-light tracking-tight text-foreground tabular-nums">{stats.total} Record</p>
            </div>
          </div>
          <div className="bg-muted/30 rounded-xl p-4 border border-border/50 flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-warning/20 flex items-center justify-center">
              <AlertCircle className="w-5 h-5 text-warning" />
            </div>
            <div>
              <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-widest">Total Keterlambatan</p>
              <p className="text-2xl font-light tracking-tight text-foreground tabular-nums">{stats.telat} Record</p>
            </div>
          </div>
        </div>

        {/* Filters Row */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input 
                placeholder="Cari username..." 
                className="pl-9 w-full h-10"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
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
              onClick={() => {
                setSearchQuery("");
                setDateFilter({ start: "", end: "" });
              }}
            >
              Reset
            </Button>
          </div>

          <Button onClick={downloadCSV} className="h-10 rounded-full gap-2 px-6 shadow-lg shadow-primary/20">
            <Download className="w-4 h-4" />
            Export CSV
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto min-h-0 relative">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[180px] pl-6">Tanggal</TableHead>
              <TableHead className="w-[180px]">Pegawai</TableHead>
              <TableHead className="w-[120px]">Status</TableHead>
              <TableHead className="w-[120px]">Jam Masuk</TableHead>
              <TableHead className="w-[120px]">Jam Pulang</TableHead>
              <TableHead className="w-[120px]">Terlambat</TableHead>
              <TableHead className="pr-6">Device</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredData.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-32">
                  <div className="flex flex-col items-center justify-center text-muted-foreground">
                    <CalendarDays className="w-12 h-12 mb-4 opacity-20" />
                    <p className="text-base font-medium text-foreground">Tidak ada data absensi</p>
                    <p className="text-sm mt-1">Sesuaikan filter atau pastikan pegawai sudah melakukan absen.</p>
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
                    <div className="flex flex-col">
                      <span className="font-medium text-foreground">{d.pengguna?.username}</span>
                      <span className="text-[10px] text-muted-foreground uppercase">{d.pengguna?.level}</span>
                    </div>
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
                      <span className="text-xs text-warning font-medium">{d.telat_menit} menit</span>
                    ) : (
                      <span className="text-xs text-success font-medium">-</span>
                    )}
                  </TableCell>
                  <TableCell className="pr-6 text-[10px] text-muted-foreground truncate max-w-[150px]" title={d.device_info}>
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
