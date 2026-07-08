"use client";

import { useState, useEffect } from "react";
import { AlertTriangle, X, Package } from "lucide-react";
import Link from "next/link";
import { useLowStockRealtime } from "@/hooks/use-low-stock-realtime";

const DISMISS_KEY = "low-stock-banner-dismissed";

export function LowStockBanner() {
  const items = useLowStockRealtime();
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const stored = sessionStorage.getItem(DISMISS_KEY);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (stored === "true") setDismissed(true);
  }, []);

  if (items.length === 0 || dismissed) return null;

  const handleDismiss = () => {
    setDismissed(true);
    sessionStorage.setItem(DISMISS_KEY, "true");
  };

  return (
    <div className="shrink-0 bg-warning/10 border-b border-warning/20 px-4 md:px-8 lg:px-12 py-3 flex items-center justify-between gap-4 animate-in slide-in-from-top duration-300">
      <div className="flex items-center gap-3 min-w-0">
        <AlertTriangle className="w-5 h-5 text-warning shrink-0" />
        <p className="text-sm text-foreground truncate">
          <span className="font-medium">{items.length}</span> produk dengan stok display menipis:
          <span className="ml-1.5 text-muted-foreground">
            {items.slice(0, 3).map((i) => i.nama_produk).join(", ")}
            {items.length > 3 && <span> +{items.length - 3} lainnya</span>}
          </span>
        </p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <Link
          href="/dashboard/inventory"
          className="text-xs font-medium text-primary hover:underline flex items-center gap-1"
        >
          <Package className="w-3.5 h-3.5" />
          Lihat Inventaris
        </Link>
        <button
          type="button"
          onClick={handleDismiss}
          className="text-muted-foreground hover:text-foreground transition-colors p-1"
          aria-label="Tutup notifikasi"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
