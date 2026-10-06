"use client";

import { useLinkStatus } from "next/link";

/**
 * Indikator pending navigasi (useLinkStatus).
 *
 * Sebelumnya komponen ini menampilkan overlay LAYAR PENUH (latar gelap +
 * spinner besar) selama navigasi berlangsung. Pada koneksi lambat itu menutup
 * seluruh UI, menyembunyikan konten yang sudah dimuat, dan membuat halaman
 * terasa macet. Sekarang hanya bar tipis di tepi atas viewport ditambah label
 * kecil: tetap memberi umpan balik yang jelas bahwa klik sudah diterima dan
 * halaman sedang dimuat, tanpa menghalangi konten maupun klik.
 *
 * Bar sebelumnya hanya 2px dengan warna 25% opasitas sehingga praktis tidak
 * terlihat di layar toko yang terang — pengguna merasa kliknya tidak masuk lalu
 * mengklik berulang. Sekarang bar 4px warna penuh + label "Memuat halaman".
 *
 * Dipasang sebagai anak dari `<Link>` (next/link); hanya link yang sedang
 * pending yang merender indikator ini (satu pada satu waktu).
 */
export function NavLinkPending() {
  const { pending } = useLinkStatus();

  if (!pending) return null;

  return (
    <>
      <span
        className="fixed inset-x-0 top-0 z-[100] block h-1 overflow-hidden bg-primary/20"
        role="status"
        aria-label="Memuat halaman"
      >
        <span className="block h-full w-full animate-pulse bg-primary" />
      </span>
      <span className="pointer-events-none fixed right-4 top-3 z-[100] hidden items-center gap-2 rounded-full border border-border bg-background/95 px-3 py-1 text-xs font-medium text-foreground shadow-sm md:inline-flex">
        <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-primary/25 border-t-primary" />
        Memuat halaman
      </span>
    </>
  );
}
