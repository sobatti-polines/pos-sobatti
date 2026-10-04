/**
 * Loading UI untuk /pos.
 *
 * Sebelumnya berupa spinner layar penuh. Sekarang skeleton yang mengikuti
 * bentuk layout POS (header kasir, kolom pencarian, tabel keranjang, dan panel
 * pembayaran) supaya perpindahan ke UI asli tidak menggeser tata letak dan
 * kasir langsung mengenali halaman yang sedang dimuat.
 */
export default function PosLoading() {
  return (
    <div
      className="flex-1 flex flex-col h-full bg-background print:hidden"
      role="status"
      aria-label="Menyiapkan POS"
    >
      {/* Header */}
      <header className="shrink-0 flex items-center justify-between gap-4 px-4 lg:px-10 py-3 md:py-5 border-b border-border">
        <div className="flex items-center gap-3 md:gap-4">
          <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-muted animate-pulse" />
          <div className="space-y-1.5">
            <div className="h-4 w-28 md:w-32 rounded bg-muted animate-pulse" />
            <div className="h-3 w-16 md:w-20 rounded bg-muted/70 animate-pulse" />
          </div>
        </div>
        <div className="hidden md:block h-14 flex-1 max-w-2xl rounded-full bg-muted/50 animate-pulse" />
        <div className="shrink-0 flex items-center gap-2">
          <div className="h-10 w-10 rounded-full bg-muted/60 animate-pulse" />
          <div className="h-10 w-10 rounded-full bg-muted/60 animate-pulse" />
        </div>
      </header>

      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* Keranjang */}
        <div className="flex-1 min-w-0 px-4 lg:px-10 py-6 space-y-5">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between gap-4">
              <div className="h-4 flex-1 max-w-md rounded bg-muted animate-pulse" />
              <div className="h-4 w-20 md:w-28 rounded bg-muted/70 animate-pulse" />
            </div>
          ))}
        </div>

        {/* Panel pembayaran */}
        <div className="w-full lg:w-[400px] xl:w-[480px] shrink-0 border-t lg:border-t-0 lg:border-l border-border p-4 lg:p-6 space-y-4">
          <div className="h-3 w-24 rounded bg-muted animate-pulse" />
          <div className="h-10 w-full rounded-md bg-muted/60 animate-pulse" />
          <div className="grid grid-cols-3 gap-2">
            {Array.from({ length: 9 }).map((_, i) => (
              <div key={i} className="h-12 rounded-md bg-muted/50 animate-pulse" />
            ))}
          </div>
          <div className="h-12 w-full rounded-full bg-muted/70 animate-pulse" />
        </div>
      </div>

      <span className="sr-only">Menyiapkan POS...</span>
    </div>
  );
}
