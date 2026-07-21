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

  const filters: FilterDef[] = [
    {
      type: "date-range",
      start: dateFilter.start,
      end: dateFilter.end,
      onStartChange: (v) => setDateFilter(prev => ({ ...prev, start: v })),
      onEndChange: (v) => setDateFilter(prev => ({ ...prev, end: v })),
    },
  ];

  const columns: Column<AttendanceRecord>[] = [
    { key: "tanggal", header: "Tanggal", className: "pl-6", headerClassName: "pl-6 w-[200px]", render: (d) => <span className="font-medium">{formatDate(d.tanggal)}</span> },
    {
      key: "status", header: "Status", headerClassName: "w-[150px]",
      render: (d) => (
        <Badge variant="secondary" className={`font-normal border-none rounded-full px-3 py-1 text-[11px] uppercase tracking-wider ${
          d.status === "HADIR" ? "bg-success/20 text-success" : "bg-warning/20 text-warning"
        }`}>
          {d.status}
        </Badge>
      ),
    },
    { key: "jam_masuk", header: "Jam Masuk", headerClassName: "w-[150px]", render: (d) => <span className="tabular-nums font-medium text-foreground">{formatTime(d.jam_masuk)}</span> },
    { key: "jam_pulang", header: "Jam Pulang", headerClassName: "w-[150px]", render: (d) => <span className="tabular-nums text-muted-foreground">{formatTime(d.jam_pulang)}</span> },
    {
      key: "keterangan", header: "Keterangan", headerClassName: "w-[150px]",
      render: (d) => d.telat_menit > 0 ? (
        <span className="text-xs text-warning font-medium">Telat {d.telat_menit} menit</span>
      ) : (
        <span className="text-xs text-success font-medium">Tepat Waktu</span>
      ),
    },
    {
      key: "device_info", header: "Informasi Perangkat", className: "pr-6",
      render: (d) => <span className="text-xs text-muted-foreground truncate max-w-[200px] block" title={d.device_info ?? undefined}>{d.device_info || "-"}</span>,
    },
  ];

  return (
    <DataTable
      data={filteredData}
      total={filteredData.length}
      columns={columns}
      rowKey={(d) => d.id}
      filters={filters}
      actions={[
        { label: "Reset", variant: "outline", onClick: () => setDateFilter({ start: "", end: "" }) },
        { label: "CSV", icon: <Download className="w-4 h-4" />, variant: "outline", onClick: handleExportCSV },
        { label: "PDF", icon: <Download className="w-4 h-4" />, variant: "outline", onClick: handleExportPDF },
      ]}
      topContent={
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
      }
      emptyState={{
        icon: CalendarDays,
        title: "Tidak ada riwayat ditemukan",
        description: "Coba sesuaikan filter tanggal Anda.",
      }}
    />
  );
}
