"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import {
  AlertTriangle,
  Check,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock,
  Download,
  FileDown,
  FileSpreadsheet,
  Loader2,
  RotateCcw,
  Save,
  Send,
  Sparkles,
  UserCheck,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  reviewLeaveRequest,
  saveUniformNotes,
  saveWeeklySchedule,
  type LeaveRequestStatus,
  type ScheduleType,
} from "./actions";

export interface EmployeeOption {
  id: number;
  username: string;
  nama: string | null;
  level: string;
}

export interface ShiftOption {
  id: number;
  kode: "PAGI" | "SORE";
  nama: string;
  jam_mulai: string;
  jam_selesai: string;
  aktif: boolean;
  urutan: number;
}

export interface ScheduleDetailRecord {
  id?: number;
  tanggal: string;
  id_pengguna: number;
  tipe_jadwal: ScheduleType;
  catatan?: string | null;
  pengguna?: EmployeeOption | null;
  shift_kerja?: ShiftOption | null;
}

export interface WeeklyScheduleRecord {
  id: number;
  minggu_mulai: string;
  kebutuhan_pagi: number;
  kebutuhan_sore: number;
  status: "DRAFT" | "TERBIT";
  catatan_seragam?: Record<string, string> | null;
  jadwal_karyawan?: ScheduleDetailRecord[];
}

export interface LeaveRequestRecord {
  id: number;
  id_jadwal_mingguan: number;
  id_pengguna: number;
  tanggal: string;
  status: LeaveRequestStatus;
  created_at: string;
  ditinjau_pada?: string | null;
  pengguna: EmployeeOption | null;
}

type CellValue = ScheduleType | "";
type ScheduleMap = Record<string, CellValue>;

const DAY_LABELS = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"];

function addDays(date: string, days: number) {
  const d = new Date(`${date}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function formatDate(date: string) {
  return new Date(`${date}T00:00:00.000Z`).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
  });
}

function formatLongDate(date: string) {
  return new Date(`${date}T00:00:00.000Z`).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function cellKey(employeeId: number, date: string) {
  return `${employeeId}-${date}`;
}

function normalizeTime(value: string | undefined, fallback: string) {
  return (value || fallback).slice(0, 5);
}

function getInitialSchedule(
  employees: EmployeeOption[],
  weekDates: string[],
  weeklySchedule: WeeklyScheduleRecord | null
) {
  const result: ScheduleMap = {};
  for (const employee of employees) {
    for (const date of weekDates) result[cellKey(employee.id, date)] = "";
  }

  for (const row of weeklySchedule?.jadwal_karyawan ?? []) {
    result[cellKey(Number(row.id_pengguna), row.tanggal)] = row.tipe_jadwal;
  }

  return result;
}

function statusBadge(status: "DRAFT" | "TERBIT" | "BELUM_ADA") {
  if (status === "TERBIT") {
    return <Badge className="rounded-full border-none bg-emerald-100 text-emerald-700">Terbit</Badge>;
  }
  if (status === "DRAFT") {
    return <Badge className="rounded-full border-none bg-amber-100 text-amber-700">Draft</Badge>;
  }
  return <Badge className="rounded-full border-none bg-muted text-muted-foreground">Belum Ada</Badge>;
}

function roleBadge(level: string) {
  const cls =
    level === "ADMIN"
      ? "bg-blue-100 text-blue-700"
      : level === "KASIR"
        ? "bg-emerald-100 text-emerald-700"
        : "bg-slate-100 text-slate-700";
  return <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${cls}`}>{level}</span>;
}

function shiftClass(value: CellValue) {
  if (value === "PAGI") return "bg-sky-50 text-sky-700 ring-sky-200";
  if (value === "SORE") return "bg-indigo-50 text-indigo-700 ring-indigo-200";
  if (value === "LIBUR") return "bg-rose-50 text-rose-700 ring-rose-200";
  return "bg-background text-muted-foreground ring-border";
}

function nextValue(current: CellValue): CellValue {
  if (!current) return "PAGI";
  if (current === "PAGI") return "SORE";
  if (current === "SORE") return "LIBUR";
  return "";
}

/* ------------------------------------------------------------------ */
/*  Export helpers — PDF & Excel untuk jadwal mingguan                  */
/* ------------------------------------------------------------------ */

function shiftLabel(value: CellValue): string {
  if (value === "PAGI") return "Pagi";
  if (value === "SORE") return "Sore";
  if (value === "LIBUR") return "Libur";
  return "-";
}

function exportSchedulePDF(
  weekStart: string,
  weekEnd: string,
  employees: EmployeeOption[],
  weekDates: string[],
  schedule: ScheduleMap,
  shifts: ShiftOption[],
  kebutuhanPagi: string,
  kebutuhanSore: string,
  catatanSeragam?: Record<string, string> | null,
) {
  const pagiShift = shifts.find((s) => s.kode === "PAGI");
  const soreShift = shifts.find((s) => s.kode === "SORE");

  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();
  const mx = 14;

  // --- Header ---
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 30, 30);
  doc.text("Jadwal Karyawan Mingguan", mx, 16);

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 100, 100);
  const dateRangeText = `${formatLongDate(weekStart)} — ${formatLongDate(weekEnd)}`;
  doc.text(dateRangeText, mx, 23);

  // Info bar
  const infoY = 29;
  doc.setFontSize(9);
  doc.setTextColor(80, 80, 80);
  const shiftInfo = `Pagi: ${pagiShift?.jam_mulai ?? "08:00"}-${pagiShift?.jam_selesai ?? "15:00"} (min ${kebutuhanPagi}) · Sore: ${soreShift?.jam_mulai ?? "15:00"}-${soreShift?.jam_selesai ?? "22:00"} (min ${kebutuhanSore})`;
  doc.text(shiftInfo, mx, infoY);
  doc.text(`Dicetak: ${new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })} ${new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}`, pw - mx, infoY, { align: "right" });

  // --- Table ---
  // Header: No, Nama, Level, 7 hari
  // Lebar: A4 landscape = 297mm - 28mm margin = 269mm usable
  // No(10) + Nama(42) + Level(24) + 7 hari(27ea = 189) = 265mm
  const headerRow = [
    "#",
    "Nama",
    "Level",
    ...DAY_LABELS.map((d, i) => `${d}\n${formatDate(weekDates[i])}`),
  ];

  const bodyRows = employees.map((employee, idx) => {
    const cells = weekDates.map((date) => {
      const v = schedule[cellKey(employee.id, date)] as CellValue;
      return shiftLabel(v);
    });
    return [
      String(idx + 1),
      employee.nama || employee.username,
      employee.level,
      ...cells,
    ];
  });

  // Baris total
  const summaryRow = ["", "TOTAL", "", ...weekDates.map((date) => {
    let p = 0, s = 0, l = 0;
    for (const emp of employees) {
      const v = schedule[cellKey(emp.id, date)] as CellValue;
      if (v === "PAGI") p++;
      else if (v === "SORE") s++;
      else if (v === "LIBUR") l++;
    }
    return `P:${p} S:${s} L:${l}`;
  })];

  // Baris seragam
  const hasSeragam = catatanSeragam && Object.keys(catatanSeragam).length > 0;
  const seragamRow = hasSeragam
    ? ["", "SERAGAM", "", ...weekDates.map((date) => catatanSeragam?.[date] || "-")]
    : null;

  autoTable(doc, {
    head: [headerRow],
    body: [...bodyRows, summaryRow, ...(seragamRow ? [seragamRow] : [])],
    startY: infoY + 6,
    styles: {
      fontSize: 8,
      cellPadding: 3,
      valign: "middle",
      halign: "center",
      lineColor: [200, 200, 200],
      lineWidth: 0.3,
      overflow: "linebreak",
    },
    headStyles: {
      fillColor: [55, 65, 81],
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 7.5,
      halign: "center",
      cellPadding: 4,
      lineColor: [75, 85, 99],
      lineWidth: 0.4,
    },
    columnStyles: {
      0: { halign: "center", cellWidth: 10 },
      1: { halign: "left", fontStyle: "normal", cellWidth: 42 },
      2: { halign: "center", cellWidth: 26 },
    },
    didParseCell: (data) => {
      // Baris ringkasan
      if (data.row.index === bodyRows.length) {
        data.cell.styles.fontStyle = "bold";
        data.cell.styles.fillColor = [243, 244, 246];
        data.cell.styles.fontSize = 7.5;
      }
      // Baris seragam
      if (seragamRow && data.row.index === bodyRows.length + 1) {
        data.cell.styles.fontStyle = "italic";
        data.cell.styles.fillColor = [245, 243, 255]; // violet-50
        data.cell.styles.fontSize = 7.5;
        if (data.column.index >= 3 && String(data.cell.raw) !== "-") {
          data.cell.styles.textColor = [91, 33, 182]; // violet-700
        }
      }
      // Warna cell shift
      if (data.section === "body" && data.column.index >= 3) {
        const val = String(data.cell.raw);
        if (val === "Pagi") {
          data.cell.styles.textColor = [3, 105, 161];
        } else if (val === "Sore") {
          data.cell.styles.textColor = [55, 48, 163];
        } else if (val === "Libur") {
          data.cell.styles.textColor = [190, 18, 60];
          data.cell.styles.fontStyle = "bold";
        }
      }
    },
    margin: { left: mx, right: mx },
    tableWidth: "auto",
  });

  // --- Footer ---
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text(
      `Halaman ${i} dari ${pageCount} — Jadwal Karyawan ${dateRangeText}`,
      pw / 2,
      ph - 6,
      { align: "center" }
    );
  }

  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  doc.save(`jadwal-karyawan-${pad(now.getDate())}-${pad(now.getMonth() + 1)}-${String(now.getFullYear()).slice(-2)}.pdf`);
}

function exportScheduleExcel(
  weekStart: string,
  weekEnd: string,
  employees: EmployeeOption[],
  weekDates: string[],
  schedule: ScheduleMap,
  shifts: ShiftOption[],
  kebutuhanPagi: string,
  kebutuhanSore: string,
  catatanSeragam?: Record<string, string> | null,
) {
  const pagiShift = shifts.find((s) => s.kode === "PAGI");
  const soreShift = shifts.find((s) => s.kode === "SORE");

  const wb = XLSX.utils.book_new();

  // --- Sheet Jadwal ---
  const headers = ["#", "Nama", "Level", ...DAY_LABELS.map((d, i) => `${d} (${formatDate(weekDates[i])})`)];

  const dataRows = employees.map((employee, idx) => {
    const cells = weekDates.map((date) => shiftLabel(schedule[cellKey(employee.id, date)] as CellValue));
    return [String(idx + 1), employee.nama || employee.username, employee.level, ...cells];
  });

  // Baris total
  const totalRow = ["", "TOTAL", "", ...weekDates.map((date) => {
    let p = 0, s = 0, l = 0;
    for (const emp of employees) {
      const v = schedule[cellKey(emp.id, date)] as CellValue;
      if (v === "PAGI") p++;
      else if (v === "SORE") s++;
      else if (v === "LIBUR") l++;
    }
    return `P:${p} S:${s} L:${l}`;
  })];

  // Baris seragam
  const hasSeragam = catatanSeragam && Object.keys(catatanSeragam).length > 0;
  const seragamRow = hasSeragam
    ? ["", "SERAGAM", "", ...weekDates.map((date) => catatanSeragam?.[date] || "-")]
    : null;

  const sheetData = [headers, ...dataRows, totalRow, ...(seragamRow ? [seragamRow] : [])];
  const ws = XLSX.utils.aoa_to_sheet(sheetData);

  ws["!cols"] = [
    { wch: 5 },   // #
    { wch: 22 },  // Nama
    { wch: 14 },  // Level
    { wch: 16 },  // Senin
    { wch: 16 },  // Selasa
    { wch: 16 },  // Rabu
    { wch: 16 },  // Kamis
    { wch: 16 },  // Jumat
    { wch: 16 },  // Sabtu
    { wch: 16 },  // Minggu
  ];

  XLSX.utils.book_append_sheet(wb, ws, "Jadwal");

  // --- Sheet Info ---
  const dateRange = `${formatLongDate(weekStart)} — ${formatLongDate(weekEnd)}`;
  const infoData = [
    ["JADWAL KARYAWAN MINGGUAN"],
    [""],
    ["Periode", dateRange],
    ["Pagi", `${pagiShift?.jam_mulai ?? "08:00"}-${pagiShift?.jam_selesai ?? "15:00"} (min ${kebutuhanPagi} orang)`],
    ["Sore", `${soreShift?.jam_mulai ?? "15:00"}-${soreShift?.jam_selesai ?? "22:00"} (min ${kebutuhanSore} orang)`],
    ["Jumlah Pegawai", String(employees.length)],
    ["Dicetak", new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })],
  ];
  const wsInfo = XLSX.utils.aoa_to_sheet(infoData);
  wsInfo["!cols"] = [{ wch: 18 }, { wch: 50 }];
  XLSX.utils.book_append_sheet(wb, wsInfo, "Info");

  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  XLSX.writeFile(wb, `jadwal-karyawan-${pad(now.getDate())}-${pad(now.getMonth() + 1)}-${String(now.getFullYear()).slice(-2)}.xlsx`);
}

export default function JadwalKaryawanClient({
  weekStart,
  weekEnd,
  employees,
  shifts,
  weeklySchedule,
  historyRows,
  leaveRequests,
}: {
  weekStart: string;
  weekEnd: string;
  employees: EmployeeOption[];
  shifts: ShiftOption[];
  weeklySchedule: WeeklyScheduleRecord | null;
  historyRows: ScheduleDetailRecord[];
  leaveRequests: LeaveRequestRecord[];
}) {
  const weekDates = useMemo(
    () => Array.from({ length: 7 }, (_, index) => addDays(weekStart, index)),
    [weekStart]
  );
  const pagiShift = shifts.find((shift) => shift.kode === "PAGI");
  const soreShift = shifts.find((shift) => shift.kode === "SORE");
  const isPublished = weeklySchedule?.status === "TERBIT";

  const [schedule, setSchedule] = useState<ScheduleMap>(() =>
    getInitialSchedule(employees, weekDates, weeklySchedule)
  );
  const [kebutuhanPagi, setKebutuhanPagi] = useState(
    String(weeklySchedule?.kebutuhan_pagi ?? 1)
  );
  const [kebutuhanSore, setKebutuhanSore] = useState(
    String(weeklySchedule?.kebutuhan_sore ?? 1)
  );
  const [jamPagiMulai, setJamPagiMulai] = useState(
    normalizeTime(pagiShift?.jam_mulai, "08:00")
  );
  const [jamPagiSelesai, setJamPagiSelesai] = useState(
    normalizeTime(pagiShift?.jam_selesai, "15:00")
  );
  const [jamSoreMulai, setJamSoreMulai] = useState(
    normalizeTime(soreShift?.jam_mulai, "15:00")
  );
  const [jamSoreSelesai, setJamSoreSelesai] = useState(
    normalizeTime(soreShift?.jam_selesai, "22:00")
  );
  const [errorMsg, setErrorMsg] = useState("");
  const [catatanSeragam, setCatatanSeragam] = useState<Record<string, string>>(
    () => weeklySchedule?.catatan_seragam ?? {}
  );
  const [isPending, startTransition] = useTransition();
  const [isNavigating, setIsNavigating] = useState(false);
  const router = useRouter();

  const handleNavigateWeek = (targetWeek: string) => {
    setIsNavigating(true);
    router.push(`/dashboard/jadwal-karyawan?week=${targetWeek}`);
  };

  const previousWeek = addDays(weekStart, -7);
  const nextWeek = addDays(weekStart, 7);
  const status = weeklySchedule?.status ?? "BELUM_ADA";
  const leaveCapacity = Math.max(1, Math.ceil(employees.length / 7));
  const waitingRequests = leaveRequests.filter((request) => request.status === "MENUNGGU");
  const approvedCellKeys = useMemo(
    () =>
      new Set(
        leaveRequests
          .filter((request) => request.status === "DISETUJUI")
          .map((request) => cellKey(Number(request.id_pengguna), request.tanggal))
      ),
    [leaveRequests]
  );

  const historyCounts = useMemo(() => {
    const counts: Record<number, { PAGI: number; SORE: number }> = {};
    for (const employee of employees) counts[employee.id] = { PAGI: 0, SORE: 0 };
    for (const row of historyRows) {
      if (row.tipe_jadwal === "PAGI" || row.tipe_jadwal === "SORE") {
        const id = Number(row.id_pengguna);
        if (!counts[id]) counts[id] = { PAGI: 0, SORE: 0 };
        counts[id][row.tipe_jadwal] += 1;
      }
    }
    return counts;
  }, [employees, historyRows]);

  const stats = useMemo(() => {
    const employeeStats = employees.map((employee) => {
      const values = weekDates.map((date) => schedule[cellKey(employee.id, date)]);
      return {
        employee,
        pagi: values.filter((value) => value === "PAGI").length,
        sore: values.filter((value) => value === "SORE").length,
        libur: values.filter((value) => value === "LIBUR").length,
        kosong: values.filter((value) => !value).length,
      };
    });

    const dailyStats = weekDates.map((date) => ({
      date,
      pagi: employees.filter((employee) => schedule[cellKey(employee.id, date)] === "PAGI").length,
      sore: employees.filter((employee) => schedule[cellKey(employee.id, date)] === "SORE").length,
      libur: employees.filter((employee) => schedule[cellKey(employee.id, date)] === "LIBUR").length,
    }));

    const warnings: string[] = [];
    const missingCells = employeeStats.reduce((sum, item) => sum + item.kosong, 0);
    if (missingCells > 0) warnings.push(`${missingCells} cell jadwal masih kosong.`);
    for (const day of dailyStats) {
      if (day.pagi < Number(kebutuhanPagi)) warnings.push(`${formatDate(day.date)} shift pagi kurang.`);
      if (day.sore < Number(kebutuhanSore)) warnings.push(`${formatDate(day.date)} shift sore kurang.`);
      if (day.libur > leaveCapacity) {
        warnings.push(`${formatDate(day.date)} melebihi batas ${leaveCapacity} pegawai libur.`);
      }
    }

    return { employeeStats, dailyStats, warnings };
  }, [employees, weekDates, schedule, kebutuhanPagi, kebutuhanSore, leaveCapacity]);

  const setCell = (employeeId: number, date: string, value: CellValue) => {
    if (approvedCellKeys.has(cellKey(employeeId, date))) return;
    setSchedule((prev) => ({ ...prev, [cellKey(employeeId, date)]: value }));
  };

  const handleReview = (
    requestId: number,
    decision: "SETUJUI" | "TOLAK" | "BATALKAN_PERSETUJUAN"
  ) => {
    setErrorMsg("");
    startTransition(async () => {
      const result = await reviewLeaveRequest(requestId, decision);
      if (result.error) {
        setErrorMsg(result.error);
        return;
      }
      window.location.reload();
    });
  };

  const handleSuggest = () => {
    setSchedule((prev) => {
      const next = { ...prev };
      const runningCounts: Record<number, { PAGI: number; SORE: number }> = {};
      const targetPagi = Math.max(0, Number(kebutuhanPagi) || 0);
      const targetSore = Math.max(0, Number(kebutuhanSore) || 0);

      for (const employee of employees) {
        runningCounts[employee.id] = { PAGI: 0, SORE: 0 };
        for (const date of weekDates) {
          const value = next[cellKey(employee.id, date)];
          if (value !== "LIBUR") next[cellKey(employee.id, date)] = "";
        }
      }

      const assignShift = (employeeId: number, date: string, shift: "PAGI" | "SORE") => {
        next[cellKey(employeeId, date)] = shift;
        runningCounts[employeeId][shift] += 1;
      };

      const shiftScore = (employeeId: number, shift: "PAGI" | "SORE") => {
        const history = historyCounts[employeeId] ?? { PAGI: 0, SORE: 0 };
        return runningCounts[employeeId][shift] + history[shift] * 0.25;
      };

      for (const date of weekDates) {
        let available = employees.filter((employee) => next[cellKey(employee.id, date)] !== "LIBUR");

        const pick = (shift: "PAGI" | "SORE", count: number) => {
          const selected = [...available]
            .sort(
              (a, b) =>
                shiftScore(a.id, shift) - shiftScore(b.id, shift) ||
                shiftScore(a.id, shift === "PAGI" ? "SORE" : "PAGI") -
                  shiftScore(b.id, shift === "PAGI" ? "SORE" : "PAGI")
            )
            .slice(0, count);

          for (const employee of selected) assignShift(employee.id, date, shift);
          const selectedIds = new Set(selected.map((employee) => employee.id));
          available = available.filter((employee) => !selectedIds.has(employee.id));
        };

        pick("PAGI", targetPagi);
        pick("SORE", targetSore);

        for (const employee of available) {
          const key = cellKey(employee.id, date);
          const dailyPagi = employees.filter((item) => next[cellKey(item.id, date)] === "PAGI").length;
          const dailySore = employees.filter((item) => next[cellKey(item.id, date)] === "SORE").length;
          let chosen: ScheduleType;

          if (dailyPagi < dailySore) {
            chosen = "PAGI";
          } else if (dailySore < dailyPagi) {
            chosen = "SORE";
          } else {
            chosen = shiftScore(employee.id, "PAGI") <= shiftScore(employee.id, "SORE") ? "PAGI" : "SORE";
          }

          next[key] = chosen;
          runningCounts[employee.id][chosen] += 1;
        }
      }

      return next;
    });
  };

  const getRows = () =>
    employees.flatMap((employee) =>
      weekDates
        .map((date) => ({
          tanggal: date,
          id_pengguna: employee.id,
          tipe_jadwal: schedule[cellKey(employee.id, date)],
        }))
        .filter((row): row is { tanggal: string; id_pengguna: number; tipe_jadwal: ScheduleType } =>
          row.tipe_jadwal === "PAGI" || row.tipe_jadwal === "SORE" || row.tipe_jadwal === "LIBUR"
        )
    );

  const handleSave = (publish: boolean) => {
    setErrorMsg("");
    startTransition(async () => {
      const result = await saveWeeklySchedule({
        minggu_mulai: weekStart,
        kebutuhan_pagi: Number(kebutuhanPagi),
        kebutuhan_sore: Number(kebutuhanSore),
        jam_pagi_mulai: jamPagiMulai,
        jam_pagi_selesai: jamPagiSelesai,
        jam_sore_mulai: jamSoreMulai,
        jam_sore_selesai: jamSoreSelesai,
        rows: getRows(),
        publish,
        catatan_seragam: catatanSeragam,
      });

      if (result.error) {
        setErrorMsg(result.error);
        return;
      }

      window.location.reload();
    });
  };

  const handleSaveUniform = () => {
    setErrorMsg("");
    startTransition(async () => {
      const result = await saveUniformNotes(weekStart, catatanSeragam);
      if (result.error) {
        setErrorMsg(result.error);
        return;
      }

      window.location.reload();
    });
  };

  return (
    <div className="min-h-0 flex-1 overflow-y-auto rounded-[16px] border border-border bg-card">
      <div className="sticky top-0 z-20 border-b border-border bg-card/95 px-4 py-5 backdrop-blur md:px-6 md:py-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              {statusBadge(status)}
              <span className="text-sm text-muted-foreground">
                {formatLongDate(weekStart)} - {formatLongDate(weekEnd)}
              </span>
              {(isPending || isNavigating) && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
            </div>
            <h2 className="text-2xl font-light leading-tight tracking-tight text-foreground">
              Jadwal Mingguan
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="rounded-full">
                  <Download className="mr-2 h-4 w-4" />
                  <span className="hidden sm:inline">Export</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuItem
                  onClick={() => exportSchedulePDF(
                    weekStart, weekEnd, employees, weekDates,
                    schedule, shifts, kebutuhanPagi, kebutuhanSore,
                    catatanSeragam
                  )}
                >
                  <FileDown className="mr-2 h-4 w-4" />
                  PDF
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => exportScheduleExcel(
                    weekStart, weekEnd, employees, weekDates,
                    schedule, shifts, kebutuhanPagi, kebutuhanSore,
                    catatanSeragam
                  )}
                >
                  <FileSpreadsheet className="mr-2 h-4 w-4" />
                  Excel
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <div className="hidden sm:block w-px h-5 bg-border" />
            <Button
              variant="outline"
              size="sm"
              disabled={isPending || isNavigating}
              onClick={() => handleNavigateWeek(previousWeek)}
            >
              <ChevronLeft className="h-4 w-4" />
              <span className="hidden md:inline">Minggu Sebelumnya</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={isPending || isNavigating}
              onClick={() => handleNavigateWeek(nextWeek)}
            >
              <span className="hidden md:inline">Minggu Berikutnya</span>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      <div className="grid gap-5 p-4 md:p-6">
        {errorMsg && (
          <div className="rounded-[10px] border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            {errorMsg}
          </div>
        )}

        <div className="grid gap-3 lg:grid-cols-[1fr_auto]">
          <div className="grid gap-3 rounded-[14px] border border-border p-4 md:grid-cols-2 2xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(16rem,1.35fr)_minmax(16rem,1.35fr)]">
            <label className="grid min-w-0 gap-1.5">
              <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                Kebutuhan Pagi
              </span>
              <Input
                type="number"
                min="0"
                value={kebutuhanPagi}
                disabled={isPublished}
                onChange={(event) => setKebutuhanPagi(event.target.value)}
              />
            </label>
            <label className="grid min-w-0 gap-1.5">
              <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                Kebutuhan Sore
              </span>
              <Input
                type="number"
                min="0"
                value={kebutuhanSore}
                disabled={isPublished}
                onChange={(event) => setKebutuhanSore(event.target.value)}
              />
            </label>
            <label className="grid min-w-0 gap-1.5">
              <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                Jam Pagi
              </span>
              <div className="grid grid-cols-[minmax(7.5rem,1fr)_minmax(7.5rem,1fr)] gap-2">
                <Input type="time" value={jamPagiMulai} disabled={isPublished} onChange={(event) => setJamPagiMulai(event.target.value)} />
                <Input type="time" value={jamPagiSelesai} disabled={isPublished} onChange={(event) => setJamPagiSelesai(event.target.value)} />
              </div>
            </label>
            <label className="grid min-w-0 gap-1.5">
              <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                Jam Sore
              </span>
              <div className="grid grid-cols-[minmax(7.5rem,1fr)_minmax(7.5rem,1fr)] gap-2">
                <Input type="time" value={jamSoreMulai} disabled={isPublished} onChange={(event) => setJamSoreMulai(event.target.value)} />
                <Input type="time" value={jamSoreSelesai} disabled={isPublished} onChange={(event) => setJamSoreSelesai(event.target.value)} />
              </div>
            </label>
          </div>

          <div className="flex flex-wrap items-center gap-2 lg:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={handleSuggest}
              disabled={isPending || isNavigating || isPublished || employees.length === 0}
            >
              <Sparkles className="mr-2 h-4 w-4" />
              Sarankan Shift
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleSave(false)}
              disabled={isPending || isNavigating || isPublished}
            >
              {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Simpan Draft
            </Button>
            <Button
              type="button"
              onClick={() => handleSave(true)}
              disabled={isPending || isNavigating || isPublished || waitingRequests.length > 0}
            >
              {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
              Terbitkan
            </Button>
          </div>
        </div>

        <div className="rounded-[14px] border border-border p-4">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-medium text-foreground">Catatan Seragam</h3>
                <span className="text-[11px] text-muted-foreground">Opsional</span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Dapat diperbarui kapan saja, termasuk setelah jadwal diterbitkan.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={handleSaveUniform}
              disabled={isPending || isNavigating || !weeklySchedule}
              className="h-10 shrink-0 rounded-full"
            >
              {isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              Simpan Seragam
            </Button>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
            {weekDates.map((date, index) => (
              <div key={date} className="min-w-0">
                <label
                  htmlFor={`seragam-${date}`}
                  className="block text-[11px] font-medium uppercase tracking-wider text-muted-foreground"
                >
                  {DAY_LABELS[index]}
                </label>
                <span className="mb-1.5 block truncate text-[11px] text-muted-foreground">
                  {formatDate(date)}
                </span>
                <Input
                  id={`seragam-${date}`}
                  type="text"
                  placeholder="Contoh: Batik"
                  value={catatanSeragam[date] ?? ""}
                  onChange={(e) => setCatatanSeragam((prev) => ({ ...prev, [date]: e.target.value }))}
                  className="h-10 min-w-0 text-base sm:text-sm"
                />
              </div>
            ))}
          </div>
        </div>

        <section className="border-y border-border py-5">
          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-base font-medium text-foreground">Permintaan Libur</h3>
                {waitingRequests.length > 0 && (
                  <Badge className="border-none bg-amber-100 text-amber-800">
                    {waitingRequests.length} menunggu
                  </Badge>
                )}
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                Maksimal {leaveCapacity} pegawai libur pada hari yang sama.
              </p>
            </div>
          </div>

          {!weeklySchedule ? (
            <p className="text-sm text-muted-foreground">
              Simpan draft jadwal lengkap agar pegawai dapat mulai booking libur.
            </p>
          ) : leaveRequests.length === 0 ? (
            <p className="text-sm text-muted-foreground">Belum ada permintaan libur aktif.</p>
          ) : (
            <div className="divide-y divide-border rounded-[8px] border border-border">
              {leaveRequests.map((request) => {
                const employeeName = request.pengguna?.nama || request.pengguna?.username || `Pegawai #${request.id_pengguna}`;
                const isWaiting = request.status === "MENUNGGU";
                return (
                  <div
                    key={request.id}
                    className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-sm font-medium text-foreground">{employeeName}</p>
                        <Badge
                          className={
                            isWaiting
                              ? "border-none bg-amber-100 text-amber-800"
                              : "border-none bg-emerald-100 text-emerald-800"
                          }
                        >
                          {isWaiting ? "Menunggu" : "Disetujui"}
                        </Badge>
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {formatLongDate(request.tanggal)}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {isWaiting ? (
                        <>
                          <Button
                            type="button"
                            size="sm"
                            onClick={() => handleReview(request.id, "SETUJUI")}
                            disabled={isPending || isPublished}
                          >
                            <Check />
                            ACC
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="destructive"
                            onClick={() => handleReview(request.id, "TOLAK")}
                            disabled={isPending || isPublished}
                          >
                            <X />
                            Tolak
                          </Button>
                        </>
                      ) : (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => handleReview(request.id, "BATALKAN_PERSETUJUAN")}
                          disabled={isPending || isPublished}
                        >
                          <RotateCcw />
                          Batalkan ACC
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <div className="grid gap-4 xl:grid-cols-[1fr_280px]">
          <div className="overflow-hidden rounded-[14px] border border-border">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] border-collapse text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="w-[220px] border-b border-border px-4 py-3 text-left font-medium text-muted-foreground">
                      Pegawai
                    </th>
                    {weekDates.map((date, index) => (
                      <th key={date} className="border-b border-border px-3 py-3 text-center font-medium text-muted-foreground">
                        <span className="block text-foreground">{DAY_LABELS[index]}</span>
                        <span className="text-xs font-normal">{formatDate(date)}</span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {employees.map((employee) => (
                    <tr key={employee.id} className="border-b border-border/70 last:border-0">
                      <td className="px-4 py-3 align-middle">
                        <div className="flex flex-col gap-1">
                          <span className="font-medium text-foreground">
                            {employee.nama || employee.username}
                          </span>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">{employee.username}</span>
                            {roleBadge(employee.level)}
                          </div>
                        </div>
                      </td>
                      {weekDates.map((date) => {
                        const value = schedule[cellKey(employee.id, date)];
                        const isApprovedLeave = approvedCellKeys.has(cellKey(employee.id, date));
                        return (
                          <td key={date} className="px-2 py-3 text-center align-middle">
                            <button
                              type="button"
                              disabled={isPublished || isApprovedLeave}
                              onClick={() => setCell(employee.id, date, nextValue(value))}
                              title={isApprovedLeave ? "Libur sudah disetujui. Batalkan ACC untuk mengubahnya." : undefined}
                              className={`mx-auto flex h-10 min-w-24 items-center justify-center rounded-full px-3 text-xs font-medium ring-1 transition-colors disabled:cursor-not-allowed disabled:opacity-80 ${shiftClass(value)}`}
                            >
                              {value || "Kosong"}
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {employees.length === 0 && (
              <div className="flex flex-col items-center justify-center gap-2 px-4 py-12 text-center text-muted-foreground">
                <UserCheck className="h-8 w-8" />
                <p className="font-medium text-foreground">Belum ada pegawai aktif</p>
                <p className="text-sm">Tambahkan pengguna aktif dengan role ADMIN, KASIR, atau KARYAWAN.</p>
              </div>
            )}
          </div>

          <aside className="grid content-start gap-4">
            <div className="rounded-[14px] border border-border p-4">
              <div className="mb-3 flex items-center gap-2">
                <Clock className="h-4 w-4 text-primary" />
                <p className="text-sm font-medium text-foreground">Ringkasan Shift</p>
              </div>
              <div className="grid gap-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Pagi</span>
                  <span className="tabular-nums">{jamPagiMulai} - {jamPagiSelesai}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Sore</span>
                  <span className="tabular-nums">{jamSoreMulai} - {jamSoreSelesai}</span>
                </div>
              </div>
            </div>

            <div className="rounded-[14px] border border-border p-4">
              <div className="mb-3 flex items-center gap-2">
                <CalendarDays className="h-4 w-4 text-primary" />
                <p className="text-sm font-medium text-foreground">Coverage Harian</p>
              </div>
              <div className="grid gap-2">
                {stats.dailyStats.map((day, index) => (
                  <div key={day.date} className="grid grid-cols-[1fr_auto] gap-2 text-sm">
                    <span className="text-muted-foreground">{DAY_LABELS[index]}</span>
                    <span className="tabular-nums">
                      P {day.pagi}/{kebutuhanPagi} · S {day.sore}/{kebutuhanSore}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[14px] border border-border p-4">
              <div className="mb-3 flex items-center gap-2">
                <UserCheck className="h-4 w-4 text-primary" />
                <p className="text-sm font-medium text-foreground">Fairness Pegawai</p>
              </div>
              <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
                {stats.employeeStats.map((item) => (
                  <div key={item.employee.id} className="rounded-[10px] bg-muted/50 px-3 py-2 text-xs">
                    <div className="mb-1 flex justify-between gap-2">
                      <span className="truncate font-medium text-foreground">
                        {item.employee.nama || item.employee.username}
                      </span>
                      <span className={item.kosong === 0 ? "text-emerald-700" : "text-amber-700"}>
                        L {item.libur}
                      </span>
                    </div>
                    <div className="flex justify-between text-muted-foreground">
                      <span>Pagi {item.pagi}</span>
                      <span>Sore {item.sore}</span>
                      <span>Kosong {item.kosong}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {stats.warnings.length > 0 && (
              <div className="rounded-[14px] border border-amber-200 bg-amber-50 p-4 text-amber-800">
                <div className="mb-2 flex items-center gap-2 text-sm font-medium">
                  <AlertTriangle className="h-4 w-4" />
                  Perlu Dicek
                </div>
                <ul className="grid gap-1 text-xs">
                  {stats.warnings.slice(0, 6).map((warning) => (
                    <li key={warning}>• {warning}</li>
                  ))}
                  {stats.warnings.length > 6 && <li>• {stats.warnings.length - 6} warning lainnya.</li>}
                </ul>
              </div>
            )}
          </aside>
        </div>

        <div className="rounded-[12px] border border-border bg-muted/30 px-4 py-3 text-xs text-muted-foreground">
          Klik cell untuk mengganti urutan: Kosong → Pagi → Sore → Libur. Pilih libur dulu, lalu gunakan
          “Sarankan Shift” agar sistem membagi Pagi/Sore tanpa mengubah libur.
        </div>
      </div>
    </div>
  );
}
