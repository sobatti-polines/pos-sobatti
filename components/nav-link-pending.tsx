"use client";

import { useLinkStatus } from "next/link";
import { Loader2 } from "lucide-react";

/**
 * Indikator pending navigasi (useLinkStatus).
 *
 * Saat navigasi link masih berlangsung, tampilkan OVERLAY layar penuh:
 * spinner di tengah layar dengan latar belakang hitam transparan tipis —
 * bukan indikator kecil di dalam sidebar/link.
 *
 * Dipasang sebagai anak dari `<Link>` (next/link); hanya link yang sedang
 * pending yang akan merender overlay (hanya satu pada satu waktu).
 */
export function NavLinkPending() {
  const { pending } = useLinkStatus();

  if (!pending) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-3 bg-black/40 animate-in fade-in duration-200"
      role="status"
      aria-label="Memuat halaman"
    >
      <Loader2 className="w-10 h-10 text-white animate-spin" />
      <span className="text-sm font-medium text-white/90">Memuat...</span>
    </div>
  );
}
