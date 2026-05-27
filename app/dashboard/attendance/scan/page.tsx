"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { BrowserQRCodeReader, IScannerControls } from "@zxing/browser";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Camera, RefreshCw, MapPin, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";

type ScanStatus = "idle" | "requesting_permission" | "scanning" | "processing" | "success" | "error";

export default function AttendanceScanPage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const [status, setStatus] = useState<ScanStatus>("idle");
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [successMsg, setSuccessMsg] = useState<string>("");
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const router = useRouter();

  const startScanning = useCallback(async () => {
    try {
      setStatus("requesting_permission");
      setErrorMsg("");
      setSuccessMsg("");

      // 1. Get GPS Location first
      const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 5000,
          maximumAge: 0
        });
      });

      setLocation({
        lat: pos.coords.latitude,
        lng: pos.coords.longitude
      });

      // 2. Start Camera
      const codeReader = new BrowserQRCodeReader();
      const controls = await codeReader.decodeFromVideoDevice(
        undefined, // default camera
        videoRef.current!,
        async (result, error) => {
          if (result) {
            controls.stop();
            handleScan(result.getText(), pos.coords.latitude, pos.coords.longitude);
          }
        }
      );

      controlsRef.current = controls;
      setStatus("scanning");
    } catch (err: any) {
      console.error("Scan error:", err);
      setStatus("error");
      if (err.code === 1) {
        setErrorMsg("Izin lokasi atau kamera ditolak.");
      } else {
        setErrorMsg(err.message || "Gagal memulai scanner.");
      }
    }
  }, []);

  const handleScan = async (token: string, lat: number, lng: number) => {
    try {
      setStatus("processing");
      
      // Try Check-in first, if already checked in, try checkout
      // In a real app, you might have a toggle for Masuk/Pulang
      // For simplicity, we'll hit checkin and if it says "already checked in", we try checkout
      
      const checkinRes = await fetch("/api/attendance/checkin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          latitude: lat,
          longitude: lng,
          device_info: navigator.userAgent
        })
      });

      let checkinData;
      try {
        checkinData = await checkinRes.json();
      } catch (e) {
        checkinData = { error: "Failed to parse response from server" };
      }

      if (checkinRes.ok) {
        setStatus("success");
        setSuccessMsg(`Check-in Berhasil! Status: ${checkinData.status}`);
        return;
      }

      // If already checked in, try checkout
      if (checkinData.error?.toLowerCase().includes("already checked in")) {
        const checkoutRes = await fetch("/api/attendance/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token })
        });

        let checkoutData;
        try {
          checkoutData = await checkoutRes.json();
        } catch (e) {
          checkoutData = { error: "Failed to parse response from server" };
        }

        if (checkoutRes.ok) {
          setStatus("success");
          setSuccessMsg("Check-out Berhasil! Sampai jumpa besok.");
        } else {
          setStatus("error");
          setErrorMsg(checkoutData.error || "Gagal melakukan absensi.");
        }
      } else {
        setStatus("error");
        setErrorMsg(checkinData.error || "Gagal melakukan absensi.");
      }
    } catch (err) {
      setStatus("error");
      setErrorMsg("Terjadi kesalahan koneksi.");
    }
  };

  useEffect(() => {
    return () => {
      if (controlsRef.current) {
        controlsRef.current.stop();
      }
    };
  }, []);

  return (
    <div className="flex-1 p-8 lg:p-12 w-full max-w-4xl mx-auto flex flex-col gap-8">
      <header>
        <h1 className="text-4xl font-light tracking-tight text-foreground">
          Scan QR Attendance
        </h1>
        <p className="text-muted-foreground mt-2">
          Arahkan kamera ke kode QR yang ada di layar admin.
        </p>
      </header>

      <div className="flex justify-center mt-4">
        <Card className="w-full max-w-md overflow-hidden border-none shadow-2xl">
          <CardHeader className="bg-muted/30 border-b border-border/50 text-center">
            <CardTitle className="flex items-center justify-center gap-2">
              <Camera className="w-5 h-5 text-primary" />
              QR Scanner
            </CardTitle>
            <CardDescription>
              Pastikan GPS aktif dan izin kamera diberikan
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0 relative bg-[#0d253d] aspect-square flex items-center justify-center">
            {status === "idle" && (
              <div className="flex flex-col items-center gap-6 p-8 text-white">
                <div className="w-20 h-20 rounded-full bg-primary/20 flex items-center justify-center">
                  <Camera className="w-10 h-10 text-primary" />
                </div>
                <Button onClick={startScanning} size="lg" className="px-8 h-12 gap-2">
                  Buka Kamera
                </Button>
              </div>
            )}

            {status === "requesting_permission" && (
              <div className="flex flex-col items-center gap-4 text-white">
                <Loader2 className="w-10 h-10 animate-spin" />
                <p>Meminta izin kamera & lokasi...</p>
              </div>
            )}

            {(status === "scanning" || status === "processing") && (
              <div className="relative w-full h-full">
                <video 
                  ref={videoRef} 
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 border-[40px] border-[#0d253d]/40 pointer-events-none">
                  <div className="w-full h-full border border-primary/30 relative">
                    <div className="absolute top-[-1px] left-[-1px] w-4 h-4 border-t-2 border-l-2 border-primary/70"></div>
                    <div className="absolute top-[-1px] right-[-1px] w-4 h-4 border-t-2 border-r-2 border-primary/70"></div>
                    <div className="absolute bottom-[-1px] left-[-1px] w-4 h-4 border-b-2 border-l-2 border-primary/70"></div>
                    <div className="absolute bottom-[-1px] right-[-1px] w-4 h-4 border-b-2 border-r-2 border-primary/70"></div>
                    
                    {status === "scanning" && (
                      <div className="absolute left-0 right-0 h-0.5 bg-primary/60 animate-[scan_2s_ease-in-out_infinite]"></div>
                    )}
                  </div>
                </div>
                
                {status === "processing" && (
                  <div className="absolute inset-0 bg-[#0d253d]/60 backdrop-blur-sm flex flex-col items-center justify-center text-white gap-4">
                    <Loader2 className="w-10 h-10 animate-spin text-primary" />
                    <p className="font-medium">Memproses absensi...</p>
                  </div>
                )}
              </div>
            )}

            {status === "success" && (
              <div className="flex flex-col items-center gap-6 p-8 text-center">
                <div className="w-20 h-20 rounded-full bg-success/20 flex items-center justify-center">
                  <CheckCircle2 className="w-10 h-10 text-success" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-white mb-2">{successMsg}</h3>
                  <p className="text-white/80">Data absensi telah tersimpan di sistem.</p>
                </div>
                <Button onClick={() => router.push("/dashboard")} variant="outline" className="bg-transparent text-white border-white/20 hover:bg-white/10">
                  Kembali ke Dashboard
                </Button>
              </div>
            )}

            {status === "error" && (
              <div className="flex flex-col items-center gap-6 p-8 text-center">
                <div className="w-20 h-20 rounded-full bg-destructive/20 flex items-center justify-center">
                  <AlertCircle className="w-10 h-10 text-destructive" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-white mb-2">Absensi Gagal</h3>
                  <p className="text-white/80">{errorMsg}</p>
                </div>
                <Button onClick={startScanning} variant="outline" className="bg-transparent text-white border-white/20 hover:bg-white/10 gap-2">
                  <RefreshCw className="w-4 h-4" />
                  Coba Lagi
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
        <Card className="bg-muted/30 border-none">
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <MapPin className="w-5 h-5 text-primary shrink-0 mt-1" />
              <div>
                <p className="font-medium">Lokasi Toko</p>
                <p className="text-sm text-muted-foreground leading-relaxed">Absensi hanya dapat dilakukan dalam radius 50 meter dari koordinat toko yang terdaftar.</p>
                {location && (
                  <p className="text-[10px] font-mono mt-2 text-primary/70">
                    Posisi Anda: {location.lat.toFixed(6)}, {location.lng.toFixed(6)}
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-muted/30 border-none">
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <RefreshCw className="w-5 h-5 text-primary shrink-0 mt-1" />
              <div>
                <p className="font-medium">QR Dinamis</p>
                <p className="text-sm text-muted-foreground leading-relaxed">Pastikan Anda melakukan scan sebelum kode QR kedaluwarsa (30 detik).</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <style jsx global>{`
        @keyframes scan {
          0%, 100% { top: 0%; }
          50% { top: 100%; }
        }
      `}</style>
    </div>
  );
}
