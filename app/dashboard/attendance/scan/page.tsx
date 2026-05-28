"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { BrowserMultiFormatReader } from "@zxing/browser";
import { NotFoundException, DecodeHintType, BarcodeFormat } from "@zxing/library";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Camera, RefreshCw, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";

type ScanStatus = "idle" | "requesting_permission" | "scanning" | "processing" | "success" | "error";

export default function AttendanceScanPage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const readerRef = useRef<BrowserMultiFormatReader | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [status, setStatus] = useState<ScanStatus>("idle");
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [successMsg, setSuccessMsg] = useState<string>("");
  const router = useRouter();

  const stopCamera = useCallback(() => {
    if (readerRef.current) {
      BrowserMultiFormatReader.releaseAllStreams();
      readerRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }, []);

  const handleScan = useCallback(async (token: string) => {
    try {
      setStatus("processing");
      
      // Try Check-in first, if already checked in, try checkout
      const checkinRes = await fetch("/api/attendance/checkin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          device_info: navigator.userAgent
        })
      });

      let checkinData;
      try {
        checkinData = await checkinRes.json();
      } catch (_e) {
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
        } catch (_e) {
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
    } catch (_err) {
      setStatus("error");
      setErrorMsg("Terjadi kesalahan koneksi.");
    }
  }, []);

  const startScanning = useCallback(async () => {
    try {
      setStatus("requesting_permission");
      setErrorMsg("");
      setSuccessMsg("");

      // Stop any previous camera session
      stopCamera();

      // 1. Acquire camera stream manually
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      });
      streamRef.current = stream;

      // 2. Attach stream to video element and wait for it to play
      const video = videoRef.current!;
      video.srcObject = stream;
      await video.play();

      // 3. Configure ZXing reader with QR_CODE format
      const hints = new Map();
      hints.set(DecodeHintType.TRY_HARDER, true);
      hints.set(DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.QR_CODE]);

      const reader = new BrowserMultiFormatReader(hints);
      readerRef.current = reader;

      // 4. Start continuous decoding from the already-playing stream
      reader.decodeFromStream(stream, video, (result, err) => {
        if (result) {
          // Stop scanning immediately on successful decode
          stopCamera();
          handleScan(result.getText());
        } else if (err && !(err instanceof NotFoundException)) {
          // NotFoundException fires every frame when no QR visible — ignore
          console.warn("[qr-scanner]", err);
        }
      });

      setStatus("scanning");
    } catch (err: unknown) {
      console.error("Scan initialization error:", err);
      setStatus("error");
      
      const errorName = err instanceof Error ? (err as Error & { name?: string }).name : undefined;
      const errorMessage = err instanceof Error ? err.message : undefined;
      
      if (errorName === "NotAllowedError") {
        setErrorMsg("Izin kamera ditolak. Silakan berikan izin di pengaturan browser Anda.");
      } else if (errorName === "NotFoundError" || errorName === "DevicesNotFoundError") {
        setErrorMsg("Kamera tidak ditemukan.");
      } else if (errorName === "NotReadableError" || errorName === "AbortError") {
        setErrorMsg("Kamera sedang digunakan aplikasi lain. Tutup aplikasi lain dan coba lagi.");
      } else {
        setErrorMsg(errorMessage || "Gagal memulai scanner.");
      }
    }
  }, [stopCamera, handleScan]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      BrowserMultiFormatReader.releaseAllStreams();
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const isVideoVisible = status === "scanning" || status === "processing";

  return (
    <div className="flex-1 p-8 lg:p-12 w-full max-w-8xl mx-auto flex flex-col gap-8">
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
              Pastikan izin kamera diberikan
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0 relative bg-card aspect-square flex items-center justify-center">
            {/* Video is ALWAYS in the DOM — ZXing needs a mounted element */}
            <video 
              ref={videoRef} 
              className="absolute inset-0 w-full h-full object-cover"
              style={{ visibility: isVideoVisible ? "visible" : "hidden" }}
              muted
              playsInline
              autoPlay
            />

            {status === "idle" && (
              <div className="flex flex-col items-center gap-6 p-8 text-foreground relative z-10">
                <div className="w-20 h-20 rounded-full bg-primary/20 flex items-center justify-center">
                  <Camera className="w-10 h-10 text-primary" />
                </div>
                <Button onClick={startScanning} size="lg" className="px-8 h-12 gap-2">
                  Buka Kamera
                </Button>
              </div>
            )}

            {status === "requesting_permission" && (
              <div className="flex flex-col items-center gap-4 text-foreground relative z-10">
                <Loader2 className="w-10 h-10 animate-spin text-primary" />
                <p>Meminta izin kamera...</p>
              </div>
            )}

            {(status === "scanning" || status === "processing") && (
              <div className="absolute inset-0 z-10 pointer-events-none">
                <div className="absolute inset-0 border-[40px] border-background/80">
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
                  <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex flex-col items-center justify-center text-foreground gap-4 pointer-events-auto">
                    <Loader2 className="w-10 h-10 animate-spin text-primary" />
                    <p className="font-medium">Memproses absensi...</p>
                  </div>
                )}
              </div>
            )}

            {status === "success" && (
              <div className="flex flex-col items-center gap-6 p-8 text-center relative z-10">
                <div className="w-20 h-20 rounded-full bg-success/20 flex items-center justify-center">
                  <CheckCircle2 className="w-10 h-10 text-success" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-foreground mb-2">{successMsg}</h3>
                  <p className="text-muted-foreground">Data absensi telah tersimpan di sistem.</p>
                </div>
                <Button onClick={() => router.push("/dashboard")} variant="outline" className="bg-transparent border-border hover:bg-muted">
                  Kembali ke Dashboard
                </Button>
              </div>
            )}

            {status === "error" && (
              <div className="flex flex-col items-center gap-6 p-8 text-center relative z-10">
                <div className="w-20 h-20 rounded-full bg-destructive/20 flex items-center justify-center">
                  <AlertCircle className="w-10 h-10 text-destructive" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-foreground mb-2">Absensi Gagal</h3>
                  <p className="text-muted-foreground">{errorMsg}</p>
                </div>
                <Button onClick={startScanning} variant="outline" className="bg-transparent border-border hover:bg-muted gap-2">
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
          <CardContent className="py-4 px-6">
            <div className="flex items-start gap-4">
              <Camera className="w-5 h-5 text-primary shrink-0 mt-1" />
              <div>
                <p className="font-medium">Izin Kamera</p>
                <p className="text-sm text-muted-foreground leading-relaxed">Pastikan Anda memberikan izin akses kamera untuk melakukan pemindaian kode QR.</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-muted/30 border-none">
          <CardContent className="py-4 px-6">
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
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(300px); }
        }
      `}</style>
    </div>
  );
}
