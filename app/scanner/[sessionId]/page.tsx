"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { BrowserMultiFormatReader } from "@zxing/browser";
import { NotFoundException, DecodeHintType, BarcodeFormat } from "@zxing/library";

type ScanState = "idle" | "starting" | "scanning" | "found" | "error";

export default function ScannerPage() {
  const { sessionId } = useParams<{ sessionId: string }>();

  const videoRef = useRef<HTMLVideoElement>(null);
  const readerRef = useRef<BrowserMultiFormatReader | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const cooldownRef = useRef<string | null>(null);
  const cooldownTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [state, setState] = useState<ScanState>("idle");
  const [lastBarcode, setLastBarcode] = useState<string | null>(null);
  const [scanCount, setScanCount] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const sendBarcode = useCallback(
    async (barcode: string) => {
      try {
        await fetch(`/api/scanner/${sessionId}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ barcode }),
        });
      } catch {
        /* ignore */
      }
    },
    [sessionId]
  );

  const onDecode = useCallback(
    async (barcode: string) => {
      if (barcode === cooldownRef.current) return;
      cooldownRef.current = barcode;
      if ("vibrate" in navigator) navigator.vibrate(80);

      setState("found");
      setLastBarcode(barcode);
      setScanCount((n) => n + 1);

      // Send to POS — the desktop handles the product lookup + cart update
      await sendBarcode(barcode);

      // Resume scanning after 1.5 s
      if (cooldownTimer.current) clearTimeout(cooldownTimer.current);
      cooldownTimer.current = setTimeout(() => {
        cooldownRef.current = null;
        setState("scanning");
      }, 1500);
    },
    [sendBarcode]
  );

  const startScanning = useCallback(async () => {
    setState("starting");
    setErrorMsg(null);

    try {
      // 1. Get camera stream manually — gives us control over resolution
      //    Use `ideal` so it gracefully falls back if environment cam isn't available
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "environment" },
          width:  { ideal: 1920 },
          height: { ideal: 1080 },
        },
      });
      streamRef.current = stream;

      // 2. Attach stream to video and wait for it to actually be playing
      const video = videoRef.current!;
      video.srcObject = stream;
      await video.play();

      // 3. Configure ZXing with TRY_HARDER and common barcode formats
      const hints = new Map();
      hints.set(DecodeHintType.TRY_HARDER, true);
      hints.set(DecodeHintType.POSSIBLE_FORMATS, [
        BarcodeFormat.CODE_128,
        BarcodeFormat.CODE_39,
        BarcodeFormat.CODE_93,
        BarcodeFormat.EAN_13,
        BarcodeFormat.EAN_8,
        BarcodeFormat.UPC_A,
        BarcodeFormat.UPC_E,
        BarcodeFormat.DATA_MATRIX,
        BarcodeFormat.QR_CODE,
        BarcodeFormat.ITF,
      ]);

      const reader = new BrowserMultiFormatReader(hints);
      readerRef.current = reader;

      // 4. decodeFromStream decodes continuously from the already-playing stream
      reader.decodeFromStream(stream, video, (result, err) => {
        if (result) {
          onDecode(result.getText());
        } else if (err && !(err instanceof NotFoundException)) {
          // NotFoundException fires every frame when no barcode visible — ignore
          console.warn("[scanner]", err);
        }
      });

      setState("scanning");
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Kamera tidak bisa diakses";
      setErrorMsg(msg);
      setState("error");
    }
  }, [onDecode]);

  // Cleanup reader on unmount
  useEffect(() => {
    return () => {
      BrowserMultiFormatReader.releaseAllStreams();
      streamRef.current?.getTracks().forEach((t) => t.stop());
      if (cooldownTimer.current) clearTimeout(cooldownTimer.current);
    };
  }, []);

  return (
    <div className="scanner-root">
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #0a0a0a; }
        .scanner-root {
          min-height: 100dvh;
          background: #0a0a0a;
          color: #f5f5f5;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          display: flex;
          flex-direction: column;
        }

        .header {
          padding: 20px 20px 0;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .header-title { font-size: 18px; font-weight: 600; }
        .scan-badge {
          background: #1a1a1a;
          border: 1px solid #2a2a2a;
          border-radius: 20px;
          padding: 4px 12px;
          font-size: 13px;
          color: #888;
        }
        .scan-badge span { color: #f5f5f5; font-weight: 600; }

        .viewfinder-wrap {
          flex: 1;
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 24px 20px;
          min-height: 300px;
        }
        .video-bg {
          position: absolute;
          inset: 0;
          overflow: hidden;
        }
        /* Always rendered — hidden via visibility, not conditional render */
        video {
          width: 100%;
          height: 100%;
          object-fit: cover;
          opacity: 0.9;
          display: block;
        }
        .video-bg.hidden {
          visibility: hidden;
        }
        .overlay {
          position: absolute;
          inset: 0;
          background: linear-gradient(
            to bottom,
            rgba(10,10,10,.7) 0%,
            transparent 28%,
            transparent 72%,
            rgba(10,10,10,.7) 100%
          );
        }

        .frame {
          position: relative;
          z-index: 2;
          width: min(280px, 76vw);
          aspect-ratio: 1;
        }
        .frame::before, .frame::after,
        .frame-inner::before, .frame-inner::after {
          content: '';
          position: absolute;
          width: 28px; height: 28px;
          border-color: #fff; border-style: solid; border-radius: 3px;
        }
        .frame::before { top:0; left:0; border-width: 3px 0 0 3px; }
        .frame::after  { top:0; right:0; border-width: 3px 3px 0 0; }
        .frame-inner::before { bottom:0; left:0; border-width: 0 0 3px 3px; }
        .frame-inner::after  { bottom:0; right:0; border-width: 0 3px 3px 0; }

        .scan-line {
          position: absolute;
          left: 10%; right: 10%;
          height: 2px;
          background: linear-gradient(90deg, transparent, #6ee7b7, transparent);
          border-radius: 1px;
          top: 50%;
          animation: scanLine 2s ease-in-out infinite;
        }
        @keyframes scanLine {
          0%,100% { transform: translateY(-56px); opacity: 0; }
          10%      { opacity: 1; }
          50%      { transform: translateY(56px); }
          90%      { opacity: 1; }
        }

        .state-overlay {
          position: absolute; inset: 0; z-index: 3;
          display: flex; align-items: center; justify-content: center;
          flex-direction: column; gap: 12px;
          background: rgba(10,10,10,.65);
          backdrop-filter: blur(6px);
          border-radius: 16px; padding: 20px; text-align: center;
        }
        .state-icon { font-size: 38px; line-height: 1; }
        .state-label { font-size: 14px; font-weight: 500; color: #bbb; }
        .state-code { font-size: 12px; font-family: monospace; color: #666; word-break: break-all; margin-top: 4px; }

        .bottom-panel {
          padding: 16px 20px 36px;
          display: flex; flex-direction: column; gap: 12px;
        }

        .feedback-card {
          background: #141414; border: 1px solid #222; border-radius: 16px;
          padding: 16px; min-height: 72px;
          display: flex; align-items: center; gap: 14px;
          transition: border-color .2s;
        }
        .feedback-card.ok   { border-color: #16a34a44; }
        .feedback-card.fail { border-color: #dc262644; }

        .feedback-icon {
          width: 40px; height: 40px; border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          font-size: 18px; flex-shrink: 0; background: #1e1e1e;
        }
        .feedback-icon.ok   { background: #14532d33; }
        .feedback-icon.fail { background: #7f1d1d33; }

        .feedback-text { flex: 1; min-width: 0; }
        .feedback-name {
          font-size: 15px; font-weight: 500; color: #f5f5f5;
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        .feedback-sub { font-size: 12px; color: #555; margin-top: 2px; font-family: monospace; }
        .feedback-placeholder { font-size: 14px; color: #555; }

        .btn {
          width: 100%; height: 56px; border: none; border-radius: 14px;
          font-size: 16px; font-weight: 600; cursor: pointer;
          transition: opacity .15s, transform .1s;
          -webkit-tap-highlight-color: transparent;
          display: flex; align-items: center; justify-content: center; gap: 8px;
        }
        .btn:active { transform: scale(.97); opacity: .9; }
        .btn-primary { background: #f5f5f5; color: #0a0a0a; }
        .btn-secondary { background: #1e1e1e; color: #f5f5f5; }

        .hint {
          text-align: center; font-size: 12px; color: #444; line-height: 1.6;
        }

        .spinner {
          width: 18px; height: 18px;
          border: 2px solid #0a0a0a40;
          border-top-color: #0a0a0a;
          border-radius: 50%;
          animation: spin .7s linear infinite;
        }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>

      <div className="header">
        <span className="header-title">Barcode Scanner</span>
        <div className="scan-badge">
          Scan: <span>{scanCount}</span>
        </div>
      </div>

      <div className="viewfinder-wrap">
        {/* Video is ALWAYS in the DOM — ZXing needs a mounted element */}
        <div className={`video-bg${state === "idle" || state === "error" ? " hidden" : ""}`}>
          <video ref={videoRef} muted playsInline autoPlay />
          <div className="overlay" />
        </div>

        <div className="frame">
          <div className="frame-inner" />

          {state === "scanning" && <div className="scan-line" />}

          {state === "starting" && (
            <div className="state-overlay">
              <div className="spinner" style={{ borderColor: "#fff3", borderTopColor: "#fff" }} />
              <div className="state-label">Memulai kamera...</div>
            </div>
          )}
          {state === "found" && (
            <div className="state-overlay">
              <div className="state-icon">✓</div>
              <div className="state-label">Terkirim ke kasir!</div>
              <div className="state-code">{lastBarcode}</div>
            </div>
          )}
          {state === "error" && (
            <div className="state-overlay">
              <div className="state-icon">✕</div>
              <div className="state-label" style={{ color: "#f87171" }}>
                {errorMsg ?? "Kamera tidak bisa diakses"}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="bottom-panel">
        <div className={`feedback-card ${state === "found" ? "ok" : ""}`}>
          <div className={`feedback-icon ${state === "found" ? "ok" : ""}`}>
            {state === "found" ? "✓" : "▦"}
          </div>
          <div className="feedback-text">
            {lastBarcode ? (
              <>
                <div className="feedback-name">Terkirim ke kasir</div>
                <div className="feedback-sub">{lastBarcode}</div>
              </>
            ) : (
              <div className="feedback-placeholder">
                Arahkan kamera ke barcode produk
              </div>
            )}
          </div>
        </div>

        {state === "idle" && (
          <button className="btn btn-primary" onClick={startScanning}>
            Mulai Scan
          </button>
        )}

        {state === "starting" && (
          <button className="btn btn-primary" disabled style={{ opacity: 0.6 }}>
            <span className="spinner" />
            Memulai...
          </button>
        )}

        {state === "error" && (
          <button className="btn btn-secondary" onClick={startScanning}>
            Coba Lagi
          </button>
        )}

        <p className="hint">
          {state === "scanning"
            ? "Scan otomatis aktif · Arahkan kamera ke barcode"
            : state === "idle" || state === "starting"
            ? `Sesi: ${sessionId?.slice(0, 8)}...`
            : state === "error"
            ? "Pastikan izin kamera sudah diberikan"
            : ""}
        </p>
      </div>
    </div>
  );
}
