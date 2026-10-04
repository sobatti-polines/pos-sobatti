"use client";

import { useLinkStatus } from "next/link";

/**
 * Indikator pending navigasi (useLinkStatus).
 *
 * Sebelumnya komponen ini menampilkan overlay LAYAR PENUH (latar gelap +
 * spinner besar) selama navigasi berlangsung. Pada koneksi lambat itu menutup
 * seluruh UI, menyembunyikan konten yang sudah dimuat, dan membuat halaman
 * terasa macet. Sekarang hanya bar tipis di tepi atas viewport: tetap memberi
 * umpan balik bahwa halaman sedang dimuat, tanpa menghalangi konten maupun
 * klik.
 *
 * Dipasang sebagai anak dari `<Link>` (next/link); hanya link yang sedang
 * pending yang merender indikator ini (satu pada satu waktu).
 */
export function NavLinkPending() {
  const { pending } = useLinkStatus();

  if (!pending) return null;

  return (
    <span
      className="fixed inset-x-0 top-0 z-[100] block h-0.5 bg-primary/25"
      role="status"
      aria-label="Memuat halaman"
    >
      <span className="block h-full w-full bg-primary animate-pulse" />
    </span>
  );
}
