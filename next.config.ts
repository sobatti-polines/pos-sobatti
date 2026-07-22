import type { NextConfig } from "next";
import * as os from "os";
import withPWAInit from "@ducanh2912/next-pwa";

const withPWA = withPWAInit({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
});

// Find local network IP dynamically
const getLocalIp = () => {
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
  return 'localhost';
};

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      allowedOrigins: [getLocalIp(), 'localhost:3000'],
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
  allowedDevOrigins: [getLocalIp()],
  compress: true,
  images: {
    formats: ["image/avif", "image/webp"],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    minimumCacheTTL: 86400,
  },
} as NextConfig;

export default withPWA(nextConfig);
