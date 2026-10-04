import type { Metadata } from "next";
import Link from "next/link";
import { WifiOff, RotateCcw } from "lucide-react";

export const metadata: Metadata = {
  title: "Tidak Ada Koneksi — POS",
  description: "Halaman yang ditampilkan saat koneksi jaringan terputus",
};

/**
 * Halaman fallback offline (diprecache oleh service worker).
 *
 * Halaman ini sengaja dibuat statis murni dan tanpa JavaScript yang wajib
 * jalan: saat jaringan benar-benar putus, hanya berkas yang sudah tersimpan
 * di perangkat yang bisa ditampilkan. Tidak ada data user yang dirender di
 * sini.
 */
export default function OfflinePage() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-background px-6 py-16 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
        <WifiOff className="h-7 w-7 text-muted-foreground" />
      </div>

      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-light tracking-tight text-foreground">
          Tidak Ada Koneksi
        </h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          Perangkat ini sedang tidak terhubung ke jaringan, jadi data terbaru
          belum bisa dimuat.
        </p>
        <p className="max-w-sm text-sm text-muted-foreground">
          Periksa Wi-Fi atau data seluler, lalu muat ulang halaman. Semua
          transaksi hanya tercatat setelah server mengonfirmasi, sehingga tidak
          ada transaksi yang tersimpan dari perangkat ini.
        </p>
      </div>

      {/* Link merender <a href> biasa, jadi tetap berfungsi walau JavaScript
          belum termuat saat perangkat offline. */}
      <Link
        href="/"
        className="inline-flex h-11 items-center gap-2 rounded-full bg-primary px-6 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
      >
        <RotateCcw className="h-4 w-4" />
        Coba Lagi
      </Link>
    </div>
  );
}
