export type AttendanceStatus = "HADIR" | "TELAT" | "TIDAK_HADIR";

export function normalizeAttendanceStatus(status: string | null | undefined): AttendanceStatus | "" {
  if (status === "HADIR" || status === "ON TIME") return "HADIR";
  if (status === "TELAT") return "TELAT";
  if (status === "TIDAK_HADIR" || status === "ALPHA") return "TIDAK_HADIR";
  return "";
}

export function attendanceStatusLabel(status: string) {
  if (status === "HADIR" || status === "ON TIME") return "Hadir";
  if (status === "TELAT") return "Terlambat";
  if (status === "TIDAK_HADIR" || status === "ALPHA") return "Tidak Hadir";
  return status.replaceAll("_", " ");
}

export function attendanceStatusBadgeClass(status: string) {
  if (status === "HADIR" || status === "ON TIME") {
    return "bg-emerald-100 text-emerald-700";
  }
  if (status === "TELAT") return "bg-amber-100 text-amber-700";
  if (status === "TIDAK_HADIR" || status === "ALPHA") {
    return "bg-rose-100 text-rose-700";
  }
  return "bg-muted text-muted-foreground";
}

export function formatAttendanceTime(value: string | null | undefined) {
  if (!value) return "--:--";
  const timePart = value.includes("T")
    ? value.split("T")[1]
    : value.includes(" ")
      ? value.split(" ")[1]
      : value;
  const [hour, minute] = timePart.split(":");
  return hour != null && minute != null ? `${hour}:${minute}` : "--:--";
}

export function attendanceDescription(record: {
  status: string;
  telat_menit?: number | null;
  catatan_manual?: string | null;
}) {
  if (record.status === "TELAT") {
    return `Terlambat ${record.telat_menit || 0} menit`;
  }
  if (record.status === "TIDAK_HADIR" || record.status === "ALPHA") {
    return record.catatan_manual || "Tidak hadir";
  }
  return record.catatan_manual || "Tepat waktu";
}
