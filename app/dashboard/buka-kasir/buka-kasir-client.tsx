"use client";

import { useState, useEffect } from "react";
import {
  Calculator,
  AlertCircle,
  Check,
  Loader2,
  Printer,
  Save,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  fetchCashSummary,
  submitTutupKasir,
  bukaSesiKasir,
} from "../tutup-kasir/actions";

function formatIDR(n: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
}

export default function BukaKasirClient({
  initialSummary,
}: {
  initialSummary: any;
}) {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [summary, setSummary] = useState(initialSummary);
  const [uangAwal, setUangAwal] = useState<string>("");
  const [uangAktual, setUangAktual] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const refreshSummary = async (newDate: string) => {
    setLoading(true);
    const res = await fetchCashSummary(newDate);
    if (res.data) {
      setSummary(res.data);
      setError("");
    } else {
      setError(res.error || "Gagal memuat data");
    }
    setLoading(false);
  };

  useEffect(() => {
    if (date !== initialSummary?.tanggal) {
      refreshSummary(date);
    }
  }, [date]);

  const handleBukaSesi = async () => {
    const num = Number(uangAwal);
    if (uangAwal === "" || isNaN(num) || num <= 0) {
      setError("Masukkan uang awal sesi (float) lebih dari 0");
      return;
    }
    setSubmitting(true);
    setError("");
    setSuccess("");
    const res = await bukaSesiKasir(summary.tanggal, num);
    if (res?.error) {
      setError(res.error);
    } else {
      setSuccess("Sesi kasir berhasil dibuka");
      await refreshSummary(summary.tanggal);
    }
    setSubmitting(false);
  };

  const handleSubmit = async () => {
    const num = Number(uangAktual);
    if (uangAktual === "" || isNaN(num) || num < 0) {
      setError("Masukkan uang aktual di laci");
      return;
    }
    setSubmitting(true);
    setError("");
    setSuccess("");
    const res = await submitTutupKasir({
      tanggal: summary.tanggal,
      uang_aktual: num,
    });
    if (res?.error) {
      setError(res.error);
    } else {
      setSuccess("Tutup kasir berhasil dikonfirmasi");
      await refreshSummary(summary.tanggal);
    }
    setSubmitting(false);
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!summary) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground p-8 text-center bg-background border border-border rounded-xl">
        <p>Data tidak ditemukan</p>
      </div>
    );
  }

  const sudahDibuka = summary.sesi?.sudah_dibuka;
  const sudahDitutup = summary.sesi?.sudah_ditutup;
  const saldoAwal = Number(summary.saldo_awal || 0);
  const totalMasuk = Number(summary.total_masuk || 0);
  const totalKeluar = Number(summary.total_keluar || 0);
  const expectedSaldoAkhir = saldoAwal + totalMasuk - totalKeluar;
  const penambahan = Number(summary.penambahan ?? totalMasuk);
  const selisih =
    uangAktual !== "" ? Number(uangAktual) - expectedSaldoAkhir : 0;

  return (
    <>
      <header className="shrink-0 print:hidden">
        <h1 className="text-4xl font-light tracking-tighter text-foreground">
          Kas Kasir
        </h1>
        <p className="text-muted-foreground mt-2">
          Buka sesi dengan uang awal, lalu tutup di akhir hari.
        </p>
      </header>

      <div className="flex-1 flex flex-col min-h-0 bg-background border border-border rounded-[12px] shadow-[0_1px_3px_rgba(0,55,112,0.08)] overflow-hidden relative">
        <div className="flex-1 overflow-y-auto p-6 lg:p-10">
          <div className="max-w-3xl mx-auto space-y-10">
            <div className="flex items-center gap-3">
              <label
                htmlFor="date"
                className="text-sm font-medium text-muted-foreground"
              >
                Shift:
              </label>
              <Input
                id="date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-[160px] h-9 text-sm shadow-sm"
              />
              {sudahDitutup && (
                <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-3 py-1">
                  <Check className="w-3.5 h-3.5" /> Sesi sudah ditutup
                </span>
              )}
            </div>

            {/* LANGKAH 1 — BUKA SESI */}
            {!sudahDibuka && (
              <div className="space-y-6">
                <div className="flex items-start gap-3 bg-primary/5 border border-primary/20 rounded-xl p-5">
                  <Wallet className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                  <div>
                    <h3 className="font-medium text-foreground">
                      Buka Sesi Kasir
                    </h3>
                    <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                      Masukkan <strong>uang awal (float)</strong> yang ditaruh
                      di laci sebelum sesi dimulai. Uang ini digunakan untuk
                      memberi kembalian tunai kepada pelanggan.
                    </p>
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label
                      htmlFor="awal"
                      className="font-medium text-foreground"
                    >
                      Uang Awal Sesi (Rp)
                    </label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">
                        Rp
                      </span>
                      <Input
                        id="awal"
                        type="number"
                        placeholder="Contoh: 200000"
                        value={uangAwal}
                        onChange={(e) =>
                          setUangAwal(
                            e.target.value === "" ? "" : e.target.value,
                          )
                        }
                        className="pl-12 h-14 text-2xl font-semibold tabular-nums shadow-sm"
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Contoh: uang awal 200.000 → di akhir hari laci berisi
                      1.200.000 → penambahan hari ini = 1.000.000.
                    </p>
                  </div>

                  {error && (
                    <div className="flex items-center gap-2 p-3 bg-destructive/10 text-destructive text-sm rounded-md border border-destructive/20">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      {error}
                    </div>
                  )}
                  {success && (
                    <div className="flex items-center gap-2 p-3 bg-emerald-50 text-emerald-700 text-sm rounded-md border border-emerald-100">
                      <Check className="w-4 h-4 shrink-0" />
                      {success}
                    </div>
                  )}

                  <div className="pt-2 flex flex-col sm:flex-row justify-end gap-3 border-t border-border/50">
                    <Button
                      onClick={handleBukaSesi}
                      disabled={submitting || uangAwal === ""}
                      className="h-11 px-8 rounded-full bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm font-medium"
                    >
                      {submitting ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <Wallet className="w-4 h-4 mr-2" />
                      )}
                      Buka Sesi Kasir
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {sudahDibuka && (
              <div className="flex flex-col items-center justify-center p-12 text-center bg-muted/20 border border-border/50 rounded-2xl">
                <Check className="w-12 h-12 text-emerald-500 mb-4" />
                <h3 className="text-xl font-medium text-foreground">
                  Kasir Sudah Dibuka
                </h3>
                <p className="text-muted-foreground mt-2 max-w-md">
                  Sesi kasir untuk hari ini telah berhasil dibuka. Silakan
                  menuju halaman <strong>Tutup Kasir</strong> di penghujung hari
                  untuk mengakhiri sesi.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
