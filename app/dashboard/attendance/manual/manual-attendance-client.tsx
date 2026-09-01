"use client";

import { useMemo, useState, useTransition } from "react";
import { CalendarCheck2, Loader2, Save } from "lucide-react";
import DataTable, { type Column } from "@/components/data-table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { useTable } from "@/hooks/use-table";
import {
  attendanceStatusBadgeClass,
  attendanceStatusLabel,
  type AttendanceStatus,
} from "@/lib/attendance-display";
import { saveManualAttendance, type ManualAttendanceInput } from "./actions";

export interface ManualAttendanceRow {
  id_pengguna: number;
  pengguna: { id: number; username: string; nama: string | null; level: string };
  shift: { id: number; kode: string; nama: string; jam_mulai: string; jam_selesai: string };
  tipe_jadwal: "PAGI" | "SORE";
  attendance_id: number | null;
  sumber: "QR" | "MANUAL" | null;
  status: AttendanceStatus | "";
  jam_masuk: string;
  jam_pulang: string;
  telat_menit: string;
  catatan_manual: string;
}

function formatDate(date: string) {
  return new Intl.DateTimeFormat("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${date}T00:00:00.000Z`));
}

function sameAttendance(a: ManualAttendanceRow, b: ManualAttendanceRow) {
  return a.status === b.status
    && a.jam_masuk === b.jam_masuk
    && a.jam_pulang === b.jam_pulang
    && a.telat_menit === b.telat_menit
    && a.catatan_manual === b.catatan_manual;
}

export default function ManualAttendanceClient({
  date,
  initialRows,
  loadError,
}: {
  date: string;
  initialRows: ManualAttendanceRow[];
  loadError: string | null;
}) {
  const [rows, setRows] = useState(initialRows);
  const [savedRows, setSavedRows] = useState(initialRows);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isPending, startTransition] = useTransition();

  const savedByEmployee = useMemo(
    () => new Map(savedRows.map((row) => [row.id_pengguna, row])),
    [savedRows]
  );
  const dirtyRows = useMemo(
    () => rows.filter((row) => {
      const saved = savedByEmployee.get(row.id_pengguna);
      return row.sumber !== "QR" && row.status !== "" && saved && !sameAttendance(row, saved);
    }),
    [rows, savedByEmployee]
  );

  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return rows;
    return rows.filter((row) =>
      (row.pengguna.nama || row.pengguna.username).toLowerCase().includes(query)
      || row.pengguna.username.toLowerCase().includes(query)
      || row.shift.nama.toLowerCase().includes(query)
    );
  }, [rows, search]);

  const table = useTable({ data: filteredRows, defaultItemsPerPage: 25 });

  const updateRow = (id: number, changes: Partial<ManualAttendanceRow>) => {
    setSuccess("");
    setRows((current) => current.map((row) =>
      row.id_pengguna === id ? { ...row, ...changes } : row
    ));
  };

  const handleStatusChange = (row: ManualAttendanceRow, value: string) => {
    const status = value as AttendanceStatus | "";
    if (status === "TIDAK_HADIR") {
      updateRow(row.id_pengguna, { status, jam_masuk: "", jam_pulang: "", telat_menit: "0" });
      return;
    }
    updateRow(row.id_pengguna, {
      status,
      telat_menit: status === "TELAT" ? row.telat_menit : "0",
    });
  };

  const handleSave = () => {
    setError("");
    setSuccess("");

    const payload: ManualAttendanceInput[] = [];
    for (const row of dirtyRows) {
      if (!row.status) continue;
      const name = row.pengguna.nama || row.pengguna.username;
      if (row.status !== "TIDAK_HADIR" && !row.jam_masuk) {
        setError(`Jam masuk ${name} wajib diisi.`);
        return;
      }
      const lateMinutes = Number(row.telat_menit);
      if (row.status === "TELAT" && (!Number.isInteger(lateMinutes) || lateMinutes < 1)) {
        setError(`Menit terlambat ${name} minimal 1 menit.`);
        return;
      }
      if (row.jam_pulang && row.jam_masuk && row.jam_pulang < row.jam_masuk) {
        setError(`Jam pulang ${name} tidak boleh lebih awal dari jam masuk.`);
        return;
      }
      payload.push({
        id_pengguna: row.id_pengguna,
        status: row.status,
        jam_masuk: row.status === "TIDAK_HADIR" ? null : row.jam_masuk,
        jam_pulang: row.status === "TIDAK_HADIR" ? null : row.jam_pulang || null,
        telat_menit: row.status === "TELAT" ? lateMinutes : 0,
        catatan_manual: row.catatan_manual.trim() || null,
      });
    }

    if (payload.length === 0) return;
    startTransition(async () => {
      const result = await saveManualAttendance(payload);
      if (result.error) {
        setError(result.error);
        return;
      }
      const changedIds = new Set(payload.map((row) => row.id_pengguna));
      const nextRows = rows.map((row) => changedIds.has(row.id_pengguna)
        ? { ...row, sumber: "MANUAL" as const, attendance_id: row.attendance_id ?? -row.id_pengguna }
        : row
      );
      setRows(nextRows);
      setSavedRows(nextRows);
      setSuccess(result.message || "Absensi manual berhasil disimpan.");
    });
  };

  const columns: Column<ManualAttendanceRow>[] = [
    {
      key: "pegawai",
      header: "Pegawai",
      sortable: true,
      sortKey: "pengguna.nama",
      headerClassName: "min-w-[190px]",
      render: (row) => (
        <div className="min-w-0">
          <p className="truncate font-medium text-foreground">
            {row.pengguna.nama || row.pengguna.username}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {row.pengguna.username} · {row.pengguna.level}
          </p>
        </div>
      ),
    },
    {
      key: "shift",
      header: "Shift",
      sortable: true,
      sortKey: "shift.nama",
      headerClassName: "min-w-[145px]",
      render: (row) => (
        <div>
          <p className="text-sm font-medium text-foreground">{row.shift.nama}</p>
          <p className="text-xs tabular-nums text-muted-foreground">
            {row.shift.jam_mulai.slice(0, 5)}–{row.shift.jam_selesai.slice(0, 5)}
          </p>
        </div>
      ),
    },
    {
      key: "sumber",
      header: "Sumber",
      headerClassName: "w-[120px]",
      render: (row) => (
        <Badge
          variant="secondary"
          className={`border-none ${
            row.sumber === "QR"
              ? "bg-sky-100 text-sky-700"
              : row.sumber === "MANUAL"
                ? "bg-violet-100 text-violet-700"
                : "bg-muted text-muted-foreground"
          }`}
        >
          {row.sumber === "QR" ? "QR · Terkunci" : row.sumber === "MANUAL" ? "Manual" : "Belum dicatat"}
        </Badge>
      ),
    },
    {
      key: "status",
      header: "Status",
      headerClassName: "min-w-[165px]",
      render: (row) => row.sumber === "QR" && row.status ? (
        <Badge className={`border-none ${attendanceStatusBadgeClass(row.status)}`}>
          {attendanceStatusLabel(row.status)}
        </Badge>
      ) : (
        <Select
          aria-label={`Status ${row.pengguna.nama || row.pengguna.username}`}
          value={row.status}
          onChange={(event) => handleStatusChange(row, event.target.value)}
          disabled={isPending}
          className="h-9 min-w-[150px]"
        >
          <option value="" disabled={Boolean(row.attendance_id)}>Belum Dicatat</option>
          <option value="HADIR">Hadir</option>
          <option value="TELAT">Terlambat</option>
          <option value="TIDAK_HADIR">Tidak Hadir</option>
        </Select>
      ),
    },
    {
      key: "jam_masuk",
      header: "Jam Masuk",
      headerClassName: "min-w-[130px]",
      render: (row) => row.sumber === "QR" ? (
        <span className="text-sm tabular-nums text-foreground">{row.jam_masuk || "--:--"}</span>
      ) : (
        <Input
          aria-label={`Jam masuk ${row.pengguna.nama || row.pengguna.username}`}
          type="time"
          value={row.jam_masuk}
          onChange={(event) => updateRow(row.id_pengguna, { jam_masuk: event.target.value })}
          disabled={isPending || !row.status || row.status === "TIDAK_HADIR"}
          className="h-9 min-w-[118px] tabular-nums"
        />
      ),
    },
    {
      key: "jam_pulang",
      header: "Jam Pulang",
      headerClassName: "min-w-[130px]",
      render: (row) => row.sumber === "QR" ? (
        <span className="text-sm tabular-nums text-muted-foreground">{row.jam_pulang || "--:--"}</span>
      ) : (
        <Input
          aria-label={`Jam pulang ${row.pengguna.nama || row.pengguna.username}`}
          type="time"
          value={row.jam_pulang}
          onChange={(event) => updateRow(row.id_pengguna, { jam_pulang: event.target.value })}
          disabled={isPending || !row.status || row.status === "TIDAK_HADIR"}
          className="h-9 min-w-[118px] tabular-nums"
        />
      ),
    },
    {
      key: "telat_menit",
      header: "Terlambat",
      headerClassName: "min-w-[125px]",
      render: (row) => row.sumber === "QR" ? (
        <span className="text-sm tabular-nums text-muted-foreground">
          {row.status === "TELAT" ? `${row.telat_menit} menit` : "-"}
        </span>
      ) : (
        <div className="flex min-w-[112px] items-center gap-2">
          <Input
            aria-label={`Menit terlambat ${row.pengguna.nama || row.pengguna.username}`}
            type="number"
            min={1}
            step={1}
            value={row.telat_menit}
            onChange={(event) => updateRow(row.id_pengguna, { telat_menit: event.target.value })}
            disabled={isPending || row.status !== "TELAT"}
            className="h-9 w-20 tabular-nums"
          />
          <span className="text-xs text-muted-foreground">menit</span>
        </div>
      ),
    },
    {
      key: "catatan_manual",
      header: "Catatan",
      headerClassName: "min-w-[200px]",
      render: (row) => row.sumber === "QR" ? (
        <span className="text-sm text-muted-foreground">-</span>
      ) : (
        <Input
          aria-label={`Catatan ${row.pengguna.nama || row.pengguna.username}`}
          value={row.catatan_manual}
          maxLength={500}
          placeholder="Opsional"
          onChange={(event) => updateRow(row.id_pengguna, { catatan_manual: event.target.value })}
          disabled={isPending || !row.status}
          className="h-9 min-w-[180px]"
        />
      ),
    },
  ];

  const recorded = rows.filter((row) => row.status).length;
  const absent = rows.filter((row) => row.status === "TIDAK_HADIR").length;

  return (
    <DataTable
      data={table.paginatedData}
      total={table.total}
      columns={columns}
      rowKey={(row) => row.id_pengguna}
      search={search}
      onSearchChange={setSearch}
      searchPlaceholder="Cari nama atau shift..."
      sortConfig={table.sortConfig}
      onSort={table.handleSort}
      currentPage={table.currentPage}
      onPageChange={table.setCurrentPage}
      itemsPerPage={table.itemsPerPage}
      onItemsPerPageChange={table.setItemsPerPage}
      actions={[
        {
          label: isPending ? "Menyimpan..." : `Simpan Semua${dirtyRows.length ? ` (${dirtyRows.length})` : ""}`,
          icon: isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />,
          kind: "primary",
          onClick: handleSave,
          disabled: isPending || dirtyRows.length === 0 || Boolean(loadError),
        },
      ]}
      topContent={
        <div className="space-y-4">
          <div className="flex flex-wrap items-end gap-x-10 gap-y-4">
            <div>
              <p className="text-sm text-muted-foreground">Tanggal Absensi</p>
              <p className="mt-1 font-medium capitalize text-foreground">{formatDate(date)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Dijadwalkan</p>
              <p className="mt-1 text-xl font-light tabular-nums text-foreground">{rows.length} pegawai</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Sudah Dicatat</p>
              <p className="mt-1 text-xl font-light tabular-nums text-foreground">{recorded}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Tidak Hadir</p>
              <p className="mt-1 text-xl font-light tabular-nums text-foreground">{absent}</p>
            </div>
          </div>
          {success && (
            <div className="rounded-[10px] bg-emerald-50 px-4 py-3 text-sm text-emerald-700" role="status">
              {success}
            </div>
          )}
        </div>
      }
      errorBanner={loadError || error || null}
      emptyState={{
        icon: CalendarCheck2,
        title: "Tidak ada pegawai yang perlu dicatat",
        description: "Pastikan jadwal hari ini sudah diterbitkan. Pegawai yang libur tidak ditampilkan.",
      }}
      mobileCards
      mobileBreakpoint="xl"
      showRowNumber={false}
      className="min-h-0"
    />
  );
}
