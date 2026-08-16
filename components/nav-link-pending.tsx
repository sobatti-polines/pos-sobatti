"use client";

import { useLinkStatus } from "next/link";
import { Loader2 } from "lucide-react";

/**
 * Indikator pending per-link (useLinkStatus).
 *
 * Ditempatkan sebagai anak dari `<Link>` dari next/link. Muncul saat navigasi
 * link tersebut masih berlangsung (prefetch belum selesai / belum commit),
 * sehingga user langsung tahu bahwa klik sudah terdaftar.
 *
 * Catatan: di production, link yang sudah selesai di-prefetch akan melewati
 * fase pending (navigasi instan) — indikator ini menjadi fallback yang
 * informatif justru saat navigasi benar-benar terhambat.
 */
export function NavLinkPending() {
  const { pending } = useLinkStatus();

  if (!pending) return null;

  return (
    <Loader2
      className="w-3.5 h-3.5 text-primary animate-spin shrink-0 ml-auto"
      aria-hidden
    />
  );
}
