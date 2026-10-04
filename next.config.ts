import type { NextConfig } from "next";
import * as os from "os";
import withPWAInit from "@ducanh2912/next-pwa";

const withPWA = withPWAInit({
  dest: "public",
  disable: process.env.NODE_ENV === "development",

  // ── Kebijakan caching service worker ───────────────────────────────────────
  // Default next-pwa meng-cache SEMUA GET same-origin /api/** dengan
  // NetworkFirst + networkTimeoutSeconds: 10. Di koneksi lambat, request yang
  // melewati 10 detik akan dijawab dari cache — padahal endpoint aplikasi ini
  // membawa data privat per-user (/api/attendance/today, /api/jadwal-saya,
  // /api/laporan/penjualan, /api/low-stock, /api/pos/products). Pada perangkat
  // kasir yang dipakai bergantian user, itu berisiko menyajikan data sesi lain.
  //
  // Karena itu seluruh default runtime caching DIGANTI (bukan ditambah).
  // (extendDefaultRuntimeCaching default false.)
  //
  // Yang TIDAK di-cache sama sekali: HTML/RSC halaman dan semua endpoint API.
  // Aset versioned (/_next/static/** dan file publik) sudah di-precache
  // otomatis oleh Workbox memakai revision hash, jadi tidak perlu route runtime.
  workboxOptions: {
    runtimeCaching: [
      {
        // Navigasi halaman: selalu dari jaringan karena halaman berisi data
        // per-user dan wajib fresh. Bila jaringan benar-benar gagal, next-pwa
        // menyajikan halaman /offline yang di-precache (lihat `fallbacks`).
        urlPattern: ({ request, sameOrigin }) =>
          sameOrigin && request.mode === "navigate",
        handler: "NetworkOnly",
        options: { cacheName: "navigations" },
      },
    ],
  },
  // Halaman statis yang ditampilkan saat navigasi gagal total (offline).
  fallbacks: { document: "/offline" },
  // Jangan reload paksa saat koneksi kembali: di jaringan yang naik-turun,
  // reload otomatis bisa terjadi berulang dan menghapus keranjang POS yang
  // belum dibayar.
  reloadOnOnline: false,
});

// Find local network IP dynamically
const getLocalIp = () => {
  try {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
      const ifaces = interfaces[name];
      if (!ifaces) continue;
      for (const iface of ifaces) {
        if (iface.family === "IPv4" && !iface.internal) {
          return iface.address;
        }
      }
    }
  } catch {
    return "localhost";
  }
  return 'localhost';
};

const nextConfig: NextConfig = {
  output: "standalone",
  productionBrowserSourceMaps: false,
  experimental: {
    webpackMemoryOptimizations: true,
    serverSourceMaps: false,
    serverActions: {
      allowedOrigins: [
        getLocalIp(),
        "localhost:3000",
        "*.trycloudflare.com",
        "plksys.web.id",
        "*.plksys.web.id"
      ],
      bodySizeLimit: "50mb",
    },
    optimizePackageImports: [
      "lucide-react",
      "date-fns",
      "@tanstack/react-table",
      "radix-ui",
    ],
    useCache: true,
  },
  turbopack: {},
  allowedDevOrigins: [getLocalIp(), "*.trycloudflare.com"],
  compress: true,
  images: {
    formats: ["image/avif", "image/webp"],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    minimumCacheTTL: 86400,
  },
} as NextConfig;

export default withPWA(nextConfig);
