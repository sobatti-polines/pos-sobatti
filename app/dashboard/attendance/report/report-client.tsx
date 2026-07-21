"use client";

import { useState, useMemo } from "react";
import { CalendarDays, Download } from "lucide-react";
import DataTable, { type Column, type FilterDef } from "@/components/data-table";
import { Badge } from "@/components/ui/badge";
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

interface AttendanceReportRecord {
  id: string;
  tanggal: string;
  jam_masuk: string | null;
  jam_pulang: string | null;
  status: string;
  telat_menit: number;
  device_info: string | null;
  id_pengguna: string;
  pengguna?: { username: string; level: string };
}

export function ReportClient({ initialData }: { initialData: AttendanceReportRecord[] }) {
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

  const handleExportCSV = () => {
    const headers = ["Tanggal", "Username", "Level", "Jam Masuk", "Jam Pulang", "Status", "Telat (Menit)", "Device"];
    const rows = filteredData.map(d => [
      d.tanggal,
      d.pengguna?.username || "-",
      d.pengguna?.level || "-",
      formatTime(d.jam_masuk),
      formatTime(d.jam_pulang),
      d.status,
      d.telat_menit || 0,
      d.device_info || "-"
    ]);
    exportToCSV(`Laporan_Absensi_${new Date().toISOString().split("T")[0]}`, headers, rows);
  };

  const handleExportPDF = () => {
    const headers = ["Tanggal", "Username", "Level", "Jam Masuk", "Jam Pulang", "Status", "Telat (Menit)", "Device"];
    const rows = filteredData.map(d => [
      d.tanggal,
      d.pengguna?.username || "-",
      d.pengguna?.level || "-",
      formatTime(d.jam_masuk),
      formatTime(d.jam_pulang),
      d.status,
      d.telat_menit || 0,
      d.device_info || "-"
    ]);
    exportToPDF(`Laporan_Absensi_${new Date().toISOString().split("T")[0]}`, "Laporan Absensi", headers, rows);
  };

  const filters: FilterDef[] = [
    {
      type: "date-range",
      start: dateFilter.start,
      end: dateFilter.end,
      onStartChange: (v) => setDateFilter(prev => ({ ...prev, start: v })),
      onEndChange: (v) => setDateFilter(prev => ({ ...prev, end: v })),
    },
  ];

  const columns: Column<AttendanceReportRecord>[] = [
    { key: "tanggal", header: "Tanggal", className: "pl-6", headerClassName: "pl-6 w-[180px]", render: (d) => <span className="font-medium">{formatDate(d.tanggal)}</span> },
    {
      key: "pegawai", header: "Pegawai", headerClassName: "w-[180px]",
      render: (d) => (
        <div className="flex flex-col">
          <span className="font-medium text-foreground">{d.pengguna?.username}</span>
          <span className="text-[10px] text-muted-foreground uppercase">{d.pengguna?.level}</span>
        </div>
      ),
    },
    {
      key: "status", header: "Status", headerClassName: "w-[120px]",
      render: (d) => (
        <Badge variant="secondary" className={`font-normal border-none rounded-full px-3 py-1 text-[11px] uppercase tracking-wider ${
          d.status === "HADIR" ? "bg-success/20 text-success" : "bg-warning/20 text-warning"
        }`}>
          {d.status}
        </Badge>
      ),
    },
    { key: "jam_masuk", header: "Jam Masuk", headerClassName: "w-[120px]", render: (d) => <span className="tabular-nums font-medium text-foreground">{formatTime(d.jam_masuk)}</span> },
    { key: "jam_pulang", header: "Jam Pulang", headerClassName: "w-[120px]", render: (d) => <span className="tabular-nums text-muted-foreground">{formatTime(d.jam_pulang)}</span> },
    {
      key: "telat", header: "Terlambat", headerClassName: "w-[120px]",
      render: (d) => d.telat_menit > 0 ? (
        <span className="text-xs text-warning font-medium">{d.telat_menit} menit</span>
      ) : (
        <span className="text-xs text-success font-medium">-</span>
      ),
    },
    {
      key: "device_info", header: "Device", className: "pr-6",
      render: (d) => <span className="text-[10px] text-muted-foreground truncate max-w-[150px] block" title={d.device_info ?? undefined}>{d.device_info || "-"}</span>,
    },
  ];

  return (
    <DataTable
      data={filteredData}
      total={filteredData.length}
      columns={columns}
      rowKey={(d) => d.id}
      search={searchQuery}
      onSearchChange={setSearchQuery}
      searchPlaceholder="Cari username..."
      filters={filters}
      actions={[
        { label: "Reset", variant: "outline", onClick: () => { setSearchQuery(""); setDateFilter({ start: "", end: "" }); } },
        { label: "CSV", icon: <Download className="w-4 h-4" />, variant: "outline", onClick: handleExportCSV },
        { label: "PDF", icon: <Download className="w-4 h-4" />, variant: "outline", onClick: handleExportPDF },
      ]}
      topContent={
        <div className="flex flex-col sm:flex-row gap-8 md:gap-16 pb-2">
          <div>
            <p className="text-sm font-medium text-muted-foreground mb-1">Pegawai Aktif</p>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-light tracking-tight text-foreground tabular-nums">{stats.uniqueEmployees}</span>
              <span className="text-sm text-muted-foreground">orang</span>
            </div>
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground mb-1">Total Kehadiran</p>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-light tracking-tight text-foreground tabular-nums">{stats.total}</span>
              <span className="text-sm text-muted-foreground">record</span>
            </div>
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground mb-1">Total Keterlambatan</p>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-light tracking-tight text-foreground tabular-nums">{stats.telat}</span>
              <span className="text-sm text-muted-foreground">record</span>
            </div>
          </div>
        </div>
      }
      emptyState={{
        icon: CalendarDays,
        title: "Tidak ada data absensi",
        description: "Sesuaikan filter atau pastikan pegawai sudah melakukan absen.",
      }}
    />
  );
}
