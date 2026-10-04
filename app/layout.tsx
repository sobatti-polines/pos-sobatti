import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";

const interSans = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
});

export const metadata: Metadata = {
  title: "Masuk — POS",
  description: "Sistem Kasir",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "POS System",
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport = {
  themeColor: "#000000",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="id"
      className={cn("h-full", "antialiased", interSans.variable)}
    >
      <head>
        {/* Preconnect ke Supabase: origin data utama aplikasi dan sudah
            dipakai sejak render pertama, jadi koneksinya layak dipanaskan. */}
        <link rel="preconnect" href={process.env.NEXT_PUBLIC_SUPABASE_URL!} />
        {/*
          Sengaja TIDAK ada preload ikon aplikasi dan TIDAK ada prerender
          spekulatif ke /pos di sini. Ikon aplikasi bukan resource kritis, dan
          prerender /pos selalu memakan bandwidth halaman yang sedang dibuka
          (termasuk halaman login) untuk rute yang belum tentu dikunjungi —
          justru merugikan pada koneksi lambat/terbatas.
        */}
      </head>
      <body className="min-h-full flex flex-col md:overflow-hidden">{children}</body>
    </html>
  );
}
