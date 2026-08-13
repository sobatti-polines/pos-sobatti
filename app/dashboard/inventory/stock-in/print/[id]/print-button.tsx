"use client";

import { Printer } from "lucide-react";

export function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 h-9 rounded-full text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
    >
      <Printer className="w-4 h-4" />
      Cetak Dokumen
    </button>
  );
}
