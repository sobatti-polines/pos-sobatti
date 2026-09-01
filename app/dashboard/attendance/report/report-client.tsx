"use client";

import { useState, useMemo } from "react";
import { CalendarDays } from "lucide-react";
import { useTable } from "@/hooks/use-table";
import DataTable, { type Column, type FilterDef } from "@/components/data-table";
import { Badge } from "@/components/ui/badge";
import { exportToCSV, exportToPDF } from "@/lib/export-utils";
import { ExportDropdown } from "@/components/export-dropdown";
import {
  attendanceDescription,
  attendanceStatusBadgeClass,
  attendanceStatusLabel,
  formatAttendanceTime,
} from "@/lib/attendance-display";
import { getTodayWIB } from "@/lib/utils";

function formatDate(dateStr: string) {
  const date = new Date(dateStr);
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
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
  sumber?: "QR" | "MANUAL";
  catatan_manual?: string | null;
  id_pengguna: string;
  pengguna?: { username: string; level: string };
}

export function ReportClient({
  initialData,
  initialStart,
  initialEnd,
}: {
  initialData: AttendanceReportRecord[];
  initialStart: string;
  initialEnd: string;
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [dateFilter, setDateFilter] = useState({ start: initialStart, end: initialEnd });

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
    const total = filteredData.filter((d) => d.status === "HADIR" || d.status === "ON TIME" || d.status === "TELAT").length;
    const telat = filteredData.filter(d => d.status === "TELAT").length;
    const tidakHadir = filteredData.filter(d => d.status === "TIDAK_HADIR" || d.status === "ALPHA").length;
    const uniqueEmployees = new Set(filteredData.map(d => d.id_pengguna)).size;
    return { total, telat, tidakHadir, uniqueEmployees };
  }, [filteredData]);

  const table = useTable({ data: filteredData, defaultItemsPerPage: 15 });

  const handleExportCSV = () => {
    const headers = ["Tanggal", "Username", "Level", "Jam Masuk", "Jam Pulang", "Status", "Telat (Menit)", "Sumber", "Catatan", "Perangkat"];
    const rows = filteredData.map(d => [
      d.tanggal,
      d.pengguna?.username || "-",
      d.pengguna?.level || "-",
      formatAttendanceTime(d.jam_masuk),
      formatAttendanceTime(d.jam_pulang),
      attendanceStatusLabel(d.status),
      d.telat_menit || 0,
      d.sumber || "QR",
      d.catatan_manual || "-",
      d.device_info || "-"
    ]);
    exportToCSV(`Laporan_Absensi_${getTodayWIB()}`, headers, rows);
  };

  const handleExportPDF = () => {
    const headers = ["Tanggal", "Username", "Level", "Jam Masuk", "Jam Pulang", "Status", "Telat (Menit)", "Sumber", "Catatan", "Perangkat"];
    const rows = filteredData.map(d => [
      d.tanggal,
      d.pengguna?.username || "-",
      d.pengguna?.level || "-",
      formatAttendanceTime(d.jam_masuk),
      formatAttendanceTime(d.jam_pulang),
      attendanceStatusLabel(d.status),
      d.telat_menit || 0,
      d.sumber || "QR",
      d.catatan_manual || "-",
      d.device_info || "-"
    ]);
    exportToPDF(`Laporan_Absensi_${getTodayWIB()}`, "Laporan Absensi", headers, rows);
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
    { key: "tanggal", header: "Tanggal", sortable: true, className: "pl-6", headerClassName: "pl-6 w-[180px]", render: (d) => <span className="font-medium">{formatDate(d.tanggal)}</span> },
    {
      key: "pegawai", header: "Pegawai", sortable: true, sortKey: "pengguna.username", headerClassName: "w-[180px]",
      render: (d) => (
        <div className="flex flex-col">
          <span className="font-medium text-foreground">{d.pengguna?.username}</span>
          <span className="text-[10px] text-muted-foreground uppercase">{d.pengguna?.level}</span>
        </div>
      ),
    },
    {
      key: "status", header: "Status", sortable: true, headerClassName: "w-[120px]",
      render: (d) => (
        <Badge variant="secondary" className={`border-none rounded-full px-3 py-1 text-[11px] ${attendanceStatusBadgeClass(d.status)}`}>
          {attendanceStatusLabel(d.status)}
        </Badge>
      ),
    },
    { key: "jam_masuk", header: "Jam Masuk", sortable: true, headerClassName: "w-[120px]", render: (d) => <span className="tabular-nums font-medium text-foreground">{formatAttendanceTime(d.jam_masuk)}</span> },
    { key: "jam_pulang", header: "Jam Pulang", sortable: true, headerClassName: "w-[120px]", render: (d) => <span className="tabular-nums text-muted-foreground">{formatAttendanceTime(d.jam_pulang)}</span> },
    {
      key: "telat", header: "Terlambat", sortable: true, sortKey: "telat_menit", headerClassName: "w-[120px]",
      render: (d) => d.telat_menit > 0 ? (
        <span className="text-xs text-warning font-medium">{d.telat_menit} menit</span>
      ) : (
        <span className="text-xs text-success font-medium">-</span>
      ),
    },
    {
      key: "sumber", header: "Sumber", sortable: true, headerClassName: "w-[100px]",
      render: (d) => <span className="text-xs text-muted-foreground">{d.sumber === "MANUAL" ? "Manual" : "QR"}</span>,
    },
    {
      key: "catatan_manual", header: "Keterangan", headerClassName: "min-w-[160px]",
      render: (d) => <span className="text-xs text-muted-foreground">{attendanceDescription(d)}</span>,
    },
    {
      key: "device_info", header: "Perangkat", sortable: true, className: "pr-6",
      render: (d) => <span className="text-[10px] text-muted-foreground truncate max-w-[150px] block" title={d.device_info ?? undefined}>{d.device_info || "-"}</span>,
    },
  ];

  return (
    <DataTable
      data={table.paginatedData}
      total={table.total}
      columns={columns}
      rowKey={(d) => d.id}
      search={searchQuery}
      onSearchChange={setSearchQuery}
      searchPlaceholder="Cari username..."
      sortConfig={table.sortConfig}
      onSort={table.handleSort}
      currentPage={table.currentPage}
      onPageChange={table.setCurrentPage}
      itemsPerPage={table.itemsPerPage}
      onItemsPerPageChange={table.setItemsPerPage}
      filters={filters}
      actions={[
        { label: "Reset", variant: "outline", onClick: () => { setSearchQuery(""); setDateFilter({ start: initialStart, end: initialEnd }); } },
        {
          label: "Export",
          customRender: () => (
            <ExportDropdown
              onExportCSV={handleExportCSV}
              onExportPDF={handleExportPDF}
              className="flex-1 md:flex-none"
            />
          ),
        },
      ]}
      topContent={
        <div className="flex flex-wrap gap-x-10 gap-y-6 pb-2 md:gap-x-16">
          <div>
            <p className="text-sm font-medium text-muted-foreground mb-1">Pegawai Tercatat</p>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-light tracking-tight text-foreground tabular-nums">{stats.uniqueEmployees}</span>
              <span className="text-sm text-muted-foreground">orang</span>
            </div>
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground mb-1">Total Kehadiran</p>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-light tracking-tight text-foreground tabular-nums">{stats.total}</span>
              <span className="text-sm text-muted-foreground">catatan</span>
            </div>
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground mb-1">Total Keterlambatan</p>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-light tracking-tight text-foreground tabular-nums">{stats.telat}</span>
              <span className="text-sm text-muted-foreground">catatan</span>
            </div>
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground mb-1">Tidak Hadir</p>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-light tracking-tight text-foreground tabular-nums">{stats.tidakHadir}</span>
              <span className="text-sm text-muted-foreground">catatan</span>
            </div>
          </div>
        </div>
      }
      emptyState={{
        icon: CalendarDays,
        title: "Tidak ada data absensi",
        description: "Sesuaikan filter atau pastikan pegawai sudah melakukan absen.",
      }}
      mobileCards
      mobileBreakpoint="lg"
    />
  );
}
