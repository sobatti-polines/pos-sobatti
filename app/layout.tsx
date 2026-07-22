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
        <link rel="preconnect" href={process.env.NEXT_PUBLIC_SUPABASE_URL!} />
        <link
          rel="preload"
          href="/icon-192x192.png"
          as="image"
          type="image/png"
        />
        <script
          type="speculationrules"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              prerender: [
                {
                  source: "document",
                  where: { href_matches: "/pos" },
                  eagerness: "moderate",
                },
              ],
            }),
          }}
        />
      </head>
      <body className="min-h-full flex flex-col md:overflow-hidden">{children}</body>
    </html>
  );
}
