import { Loader2 } from "lucide-react";

/**
 * Loading UI untuk seluruh halaman di bawah /dashboard.
 * Ditampilkan secara instan saat navigasi dimulai (klik link sidebar/menu),
 * sehingga user langsung mendapat umpan balik bahwa halaman sedang dimuat.
 */
export default function DashboardLoading() {
  return (
    <div
      className="flex-1 p-4 md:p-8 lg:p-12 w-full flex flex-col gap-4 md:gap-8 mx-auto"
      role="status"
      aria-label="Memuat halaman"
    >
      {/* Header skeleton */}
      <header className="shrink-0">
        <div className="h-9 w-2/3 max-w-xs rounded-lg bg-muted animate-pulse" />
        <div className="h-4 w-full max-w-sm mt-3 rounded bg-muted/70 animate-pulse" />
      </header>

      {/* Stat cards skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="rounded-xl border border-border/50 p-4 space-y-3"
          >
            <div className="h-3 w-24 rounded bg-muted animate-pulse" />
            <div className="h-7 w-32 rounded bg-muted/70 animate-pulse" />
          </div>
        ))}
      </div>

      {/* Content/table skeleton */}
      <div className="rounded-xl border border-border/50 p-4 md:p-6 space-y-4 flex-1">
        <div className="flex items-center justify-between gap-4">
          <div className="h-5 w-40 rounded bg-muted animate-pulse" />
          <div className="h-9 w-36 rounded-full bg-muted/70 animate-pulse" />
        </div>
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-4 w-full rounded bg-muted/50 animate-pulse" />
        ))}
      </div>

      {/* Spinner + label */}
      <div className="flex items-center justify-center gap-2 pb-4 text-muted-foreground">
        <Loader2 className="w-4 h-4 animate-spin" />
        <span className="text-sm">Memuat...</span>
      </div>
    </div>
  );
}
