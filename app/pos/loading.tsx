import { Loader2 } from "lucide-react";

/**
 * Loading UI untuk seluruh halaman di bawah /pos (kasir & invoice).
 * Ditampilkan secara instan saat navigasi dimulai.
 */
export default function PosLoading() {
  return (
    <div
      className="relative flex flex-1 h-full gap-4 p-4 md:p-6"
      role="status"
      aria-label="Memuat halaman"
    >
      {/* Product panel skeleton */}
      <div className="flex-1 flex flex-col gap-4 min-w-0">
        <div className="h-10 w-full max-w-md rounded-md bg-muted animate-pulse" />
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 flex-1 content-start">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="rounded-xl border border-border/50 p-3 space-y-3"
            >
              <div className="aspect-square w-full rounded-lg bg-muted/60 animate-pulse" />
              <div className="h-3 w-3/4 rounded bg-muted animate-pulse" />
              <div className="h-3 w-1/2 rounded bg-muted/70 animate-pulse" />
            </div>
          ))}
        </div>
      </div>

      {/* Cart / payment panel skeleton */}
      <div className="w-72 lg:w-80 shrink-0 hidden md:flex flex-col gap-4">
        <div className="rounded-xl border border-border/50 p-4 space-y-3 flex-1">
          <div className="h-5 w-28 rounded bg-muted animate-pulse" />
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-4 w-full rounded bg-muted/50 animate-pulse" />
          ))}
        </div>
        <div className="h-12 w-full rounded-md bg-muted/70 animate-pulse" />
        <div className="h-12 w-full rounded-full bg-muted animate-pulse" />
      </div>

      {/* Mobile spinner */}
      <div className="md:hidden absolute inset-0 flex items-center justify-center gap-2 text-muted-foreground">
        <Loader2 className="w-5 h-5 animate-spin" />
        <span className="text-sm">Memuat...</span>
      </div>
    </div>
  );
}
