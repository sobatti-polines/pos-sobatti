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

interface AttendanceRecord {
  id: string;
  tanggal: string;
  jam_masuk: string | null;
  jam_pulang: string | null;
  status: string;
  telat_menit: number;
  device_info: string | null;
  sumber?: "QR" | "MANUAL";
  catatan_manual?: string | null;
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
    const total = filteredData.filter((d) => d.status === "HADIR" || d.status === "ON TIME" || d.status === "TELAT").length;
    const telat = filteredData.filter(d => d.status === "TELAT").length;
    const tidakHadir = filteredData.filter(d => d.status === "TIDAK_HADIR" || d.status === "ALPHA").length;
    const totalTelatMenit = filteredData.reduce((sum, d) => sum + (d.telat_menit || 0), 0);
    return { total, telat, tidakHadir, totalTelatMenit };
  }, [filteredData]);

  const table = useTable({ data: filteredData, defaultItemsPerPage: 15 });

  const handleExportCSV = () => {
    const headers = ["Tanggal", "Status", "Jam Masuk", "Jam Pulang", "Keterangan", "Sumber", "Informasi Perangkat"];
    const rows = filteredData.map(d => [
      formatDate(d.tanggal),
      attendanceStatusLabel(d.status),
      formatAttendanceTime(d.jam_masuk),
      formatAttendanceTime(d.jam_pulang),
      attendanceDescription(d),
      d.sumber === "MANUAL" ? "Manual" : "QR",
      d.device_info || "-"
    ]);
    exportToCSV(`Riwayat_Absensi_${getTodayWIB()}`, headers, rows);
  };

  const handleExportPDF = () => {
    const headers = ["Tanggal", "Status", "Jam Masuk", "Jam Pulang", "Keterangan", "Sumber", "Informasi Perangkat"];
    const rows = filteredData.map(d => [
      formatDate(d.tanggal),
      attendanceStatusLabel(d.status),
      formatAttendanceTime(d.jam_masuk),
      formatAttendanceTime(d.jam_pulang),
      attendanceDescription(d),
      d.sumber === "MANUAL" ? "Manual" : "QR",
      d.device_info || "-"
    ]);
    exportToPDF(`Riwayat_Absensi_${getTodayWIB()}`, "Riwayat Absensi", headers, rows);
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
    { key: "tanggal", header: "Tanggal", sortable: true, className: "pl-6", headerClassName: "pl-6 w-[200px]", render: (d) => <span className="font-medium">{formatDate(d.tanggal)}</span> },
    {
      key: "status", header: "Status", sortable: true, headerClassName: "w-[150px]",
      render: (d) => (
        <Badge variant="secondary" className={`border-none rounded-full px-3 py-1 text-[11px] ${attendanceStatusBadgeClass(d.status)}`}>
          {attendanceStatusLabel(d.status)}
        </Badge>
      ),
    },
    { key: "jam_masuk", header: "Jam Masuk", sortable: true, headerClassName: "w-[150px]", render: (d) => <span className="tabular-nums font-medium text-foreground">{formatAttendanceTime(d.jam_masuk)}</span> },
    { key: "jam_pulang", header: "Jam Pulang", sortable: true, headerClassName: "w-[150px]", render: (d) => <span className="tabular-nums text-muted-foreground">{formatAttendanceTime(d.jam_pulang)}</span> },
    {
      key: "keterangan", header: "Keterangan", sortable: true, sortKey: "telat_menit", headerClassName: "w-[150px]",
      render: (d) => <span className="text-xs text-muted-foreground">{attendanceDescription(d)}</span>,
    },
    {
      key: "sumber", header: "Sumber", sortable: true, headerClassName: "w-[100px]",
      render: (d) => <span className="text-xs text-muted-foreground">{d.sumber === "MANUAL" ? "Manual" : "QR"}</span>,
    },
    {
      key: "device_info", header: "Informasi Perangkat", sortable: true, className: "pr-6",
      render: (d) => <span className="text-xs text-muted-foreground truncate max-w-[200px] block" title={d.device_info ?? undefined}>{d.device_info || "-"}</span>,
    },
  ];

  return (
    <DataTable
      data={table.paginatedData}
      total={table.total}
      columns={columns}
      rowKey={(d) => d.id}
      sortConfig={table.sortConfig}
      onSort={table.handleSort}
      currentPage={table.currentPage}
      onPageChange={table.setCurrentPage}
      itemsPerPage={table.itemsPerPage}
      onItemsPerPageChange={table.setItemsPerPage}
      filters={filters}
      actions={[
        { label: "Reset", variant: "outline", onClick: () => setDateFilter({ start: "", end: "" }) },
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
          <div>
            <p className="text-sm font-medium text-muted-foreground mb-1">Tidak Hadir</p>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-light tracking-tight text-foreground tabular-nums">{stats.tidakHadir}</span>
              <span className="text-sm text-muted-foreground">hari</span>
            </div>
          </div>
        </div>
      }
      emptyState={{
        icon: CalendarDays,
        title: "Tidak ada riwayat ditemukan",
        description: "Coba sesuaikan filter tanggal Anda.",
      }}
      mobileCards
      mobileBreakpoint="lg"
    />
  );
}
