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
  /* config options here */
  experimental: {
    serverActions: {
      allowedOrigins: [getLocalIp(), 'localhost:3000'],
    },
  },
  turbopack: {},
  // If allowedDevOrigins is a custom thing you are using:
  allowedDevOrigins: [getLocalIp()],
} as NextConfig;

export default withPWA(nextConfig);
