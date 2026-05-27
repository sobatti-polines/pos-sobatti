"use client";

import { useEffect, useState, useCallback } from "react";
import QRCode from "qrcode";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RefreshCw, Timer, Loader2 } from "lucide-react";

export default function GenerateQRPage() {
  const [qrData, setQrData] = useState<{ token: string; expired_at: string } | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);

  const fetchQR = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/attendance/generate-qr", { method: "POST" });
      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`Failed to fetch QR: ${res.status} ${errorText}`);
      }
      const data = await res.json();
      if (data.token) {
        setQrData(data);
        const url = await QRCode.toDataURL(data.token, {
          width: 300,
          margin: 2,
          color: {
            dark: "#000000",
            light: "#ffffff",
          },
        });
        setQrDataUrl(url);
        
        const expiry = new Date(data.expired_at).getTime();
        const now = new Date().getTime();
        setTimeLeft(Math.max(0, Math.floor((expiry - now) / 1000)));
      }
    } catch (error) {
      console.error("Failed to fetch QR:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!qrData) return;

    const timer = setInterval(() => {
      const expiry = new Date(qrData.expired_at).getTime();
      const now = new Date().getTime();
      const diff = Math.max(0, Math.floor((expiry - now) / 1000));
      
      setTimeLeft(diff);

      if (diff <= 0) {
        setQrData(null);
        setQrDataUrl("");
        clearInterval(timer);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [qrData]);

  const isExpired = !qrData || timeLeft <= 0;

  return (
    <div className="flex-1 p-8 lg:p-12 w-full max-w-4xl mx-auto flex flex-col gap-8">
      <header>
        <h1 className="text-4xl font-light tracking-tight text-foreground">
          Generate QR Attendance
        </h1>
        <p className="text-muted-foreground mt-2">
          Minta karyawan untuk melakukan scan pada kode QR di bawah ini untuk absensi.
        </p>
      </header>

      <div className="flex justify-center mt-8">
        <Card className="w-full max-w-md bg-card border border-border/50 rounded-xl shadow-[0_8px_24px_rgba(0,55,112,0.08),_0_2px_6px_rgba(0,55,112,0.04)] overflow-hidden">
          <CardHeader className="text-center pb-2 bg-muted/30 border-b border-border/50">
            <CardTitle className="text-2xl font-light">QR Absensi</CardTitle>
            <CardDescription>Berlaku selama 30 detik</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-8 py-10">
            <div className="bg-white p-4 rounded-2xl shadow-inner border border-border/50 relative">
              {loading && !qrDataUrl ? (
                <div className="w-[250px] h-[250px] flex items-center justify-center">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
              ) : qrDataUrl && !isExpired ? (
                <img 
                  src={qrDataUrl} 
                  alt="QR Attendance" 
                  className={`w-[250px] h-[250px] transition-opacity duration-300 ${loading ? "opacity-50" : "opacity-100"}`}
                />
              ) : (
                <div className="w-[250px] h-[250px] flex flex-col items-center justify-center text-center p-6 bg-muted/20 rounded-xl border-2 border-dashed border-border/50">
                  <p className="text-sm text-muted-foreground mb-4">
                    {isExpired && qrData ? "QR Code telah kedaluwarsa." : "Klik tombol di bawah untuk membuat QR code baru."}
                  </p>
                  <Button 
                    onClick={fetchQR} 
                    className="gap-2"
                    disabled={loading}
                  >
                    <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
                    Buat QR Baru
                  </Button>
                </div>
              )}
              {loading && qrDataUrl && !isExpired && (
                <div className="absolute inset-0 flex items-center justify-center bg-white/50 backdrop-blur-[1px]">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
              )}
            </div>

            <div className="flex flex-col items-center gap-4 w-full">
              <div className="flex items-center gap-2 text-2xl font-mono tabular-nums bg-muted px-6 py-2 rounded-full border border-border">
                <Timer className={`w-6 h-6 ${timeLeft < 10 ? "text-destructive" : "text-primary"}`} />
                <span className={timeLeft < 10 ? "text-destructive font-medium" : "text-foreground"}>
                  00:{timeLeft.toString().padStart(2, "0")}
                </span>
              </div>
              
              {!isExpired && (
                <Button 
                  onClick={fetchQR} 
                  variant="outline" 
                  className="w-full h-12 gap-2 mt-2"
                  disabled={loading}
                >
                  <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
                  Refresh Manual
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
        <div className="p-4 rounded-lg bg-muted/50 border border-border flex gap-4">
          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <RefreshCw className="w-4 h-4 text-primary" />
          </div>
          <div>
            <h4 className="font-medium mb-1">Informasi</h4>
            <p className="text-muted-foreground leading-relaxed">QR code harus diperbarui secara manual untuk memastikan keamanan data absensi.</p>
          </div>
        </div>
        <div className="p-4 rounded-lg bg-muted/50 border border-border flex gap-4">
          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <Timer className="w-4 h-4 text-primary" />
          </div>
          <div>
            <h4 className="font-medium mb-1">Cara Penggunaan</h4>
            <p className="text-muted-foreground leading-relaxed">Klik &quot;Buat QR Baru&quot;, lalu minta karyawan melakukan scan menggunakan menu &quot;Scan QR&quot;.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
