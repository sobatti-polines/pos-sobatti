import { Loader2 } from "lucide-react";

/**
 * Loading UI untuk halaman-halaman absensi (/attendance).
 * Ditampilkan secara instan saat navigasi dimulai.
 */
export default function AttendanceLoading() {
  return (
    <div
      className="flex-1 min-h-[100dvh] flex flex-col items-center justify-center gap-4 bg-background"
      role="status"
      aria-label="Memuat halaman"
    >
      <Loader2 className="w-8 h-8 animate-spin text-primary" />
      <span className="text-sm text-muted-foreground">Memuat...</span>
    </div>
  );
}
