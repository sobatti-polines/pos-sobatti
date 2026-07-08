"use client";

import { useState, useEffect } from "react";
import { Calculator, AlertCircle, Check, Loader2, Printer, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { fetchCashSummary, submitTutupKasir } from "./actions";

function formatIDR(n: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
}

export default function TutupKasirClient({ initialSummary }: { initialSummary: any }) {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [summary, setSummary] = useState(initialSummary);
  const [uangAktual, setUangAktual] = useState<number | "">("");
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

  const handleSubmit = async () => {
    if (uangAktual === "") {
      setError("Masukkan uang aktual di laci");
      return;
    }

    setSubmitting(true);
    setError("");

    const res = await submitTutupKasir({
      tanggal: summary.tanggal,
      saldo_awal: summary.saldo_awal,
      total_masuk: summary.total_masuk,
      total_keluar: summary.total_keluar,
      uang_aktual: Number(uangAktual),
    });

    if (res?.error) {
      setError(res.error);
    } else {
      setSuccess("Tutup kasir berhasil dikonfirmasi");
    }
    setSubmitting(false);
  };

  const expectedSaldoAkhir = summary ? Number(summary.saldo_awal) + Number(summary.total_masuk) - Number(summary.total_keluar) : 0;
  const selisih = uangAktual !== "" ? Number(uangAktual) - expectedSaldoAkhir : 0;

  return (
    <>
      <header className="shrink-0 print:hidden">
        <h1 className="text-3xl font-light tracking-tight text-foreground">
          Tutup Kasir
        </h1>
      </header>

      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : !summary ? (
        <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground p-8 text-center bg-background border border-border rounded-xl">
          <p>Data tidak ditemukan</p>
        </div>
      ) : (
        <div className="flex-1 flex flex-col min-h-0 bg-background border border-border rounded-xl shadow-[0_1px_3px_rgba(0,55,112,0.08)] overflow-hidden relative max-w-4xl">
          <div className="flex-1 overflow-y-auto p-8 lg:p-10">
            <div className="space-y-10">
              
              <div className="flex items-center gap-3">
                <label htmlFor="date" className="text-sm font-medium text-muted-foreground">Shift:</label>
                <Input 
                  id="date" 
                  type="date" 
                  value={date} 
                  onChange={(e) => setDate(e.target.value)} 
                  className="w-[160px] h-9 text-sm shadow-sm" 
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-12 lg:gap-24">
                
                {/* Kiri: Ringkasan Sistem */}
                <div className="space-y-6">
                  <h3 className="font-medium text-foreground flex items-center gap-2">
                    <Calculator className="w-4 h-4 text-muted-foreground" />
                    Sistem
                  </h3>

                  <div className="grid grid-cols-2 gap-y-4 py-4 border-y border-border/60 text-sm">
                    <span className="text-muted-foreground">Saldo Awal</span>
                    <span className="text-right tabular-nums">{formatIDR(summary.saldo_awal)}</span>
                    
                    <span className="text-muted-foreground">Pemasukan</span>
                    <span className="text-right text-emerald-600 tabular-nums">+{formatIDR(summary.total_masuk)}</span>
                    
                    <span className="text-muted-foreground">Pengeluaran</span>
                    <span className="text-right text-rose-600 tabular-nums">-{formatIDR(summary.total_keluar)}</span>
                  </div>

                  <div className="flex justify-between items-center py-1">
                    <span className="font-medium text-foreground">Saldo Akhir</span>
                    <span className="text-2xl font-semibold tabular-nums text-foreground">{formatIDR(expectedSaldoAkhir)}</span>
                  </div>

                  <div className="pt-6">
                    <h4 className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground mb-4">Rincian Tunai</h4>
                    <div className="grid grid-cols-2 gap-y-3 text-sm text-muted-foreground">
                      <span>Penjualan</span>
                      <span className="text-right tabular-nums">{formatIDR(summary.detail.sales_tunai)}</span>
                      <span>Piutang</span>
                      <span className="text-right tabular-nums">{formatIDR(summary.detail.piutang_tunai)}</span>
                      <span>Pembelian</span>
                      <span className="text-right tabular-nums">{formatIDR(summary.detail.pembelian_tunai)}</span>
                      <span>Hutang</span>
                      <span className="text-right tabular-nums">{formatIDR(summary.detail.hutang_tunai)}</span>
                    </div>
                  </div>
                </div>

                {/* Kanan: Input & Aksi */}
                <div className="flex flex-col space-y-8">
                  <div className="space-y-4">
                    <label htmlFor="aktual" className="font-medium text-foreground">
                      Fisik Laci
                    </label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">Rp</span>
                      <Input 
                        id="aktual" 
                        type="number" 
                        placeholder="0"
                        value={uangAktual}
                        onChange={(e) => setUangAktual(e.target.value === "" ? "" : Number(e.target.value))}
                        className="pl-12 h-14 text-2xl font-semibold tabular-nums shadow-sm"
                      />
                    </div>
                  </div>

                  <div className="pt-4">
                    <span className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground block mb-1">Selisih</span>
                    <div className={`text-4xl font-semibold tabular-nums flex items-center gap-3 ${
                      uangAktual === "" ? "text-muted-foreground/30" :
                      selisih === 0 ? 'text-emerald-600' : 
                      Math.abs(selisih) < 1000 ? 'text-yellow-600' : 'text-rose-600'
                    }`}>
                      {uangAktual === "" ? "-" : `${selisih > 0 ? "+" : ""}${formatIDR(selisih)}`}
                      {uangAktual !== "" && selisih === 0 && <Check className="w-8 h-8 opacity-80" />}
                      {uangAktual !== "" && selisih !== 0 && <AlertCircle className="w-8 h-8 opacity-80" />}
                    </div>
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

                  <div className="mt-auto pt-8 flex flex-col sm:flex-row justify-end gap-3 border-t border-border/50">
                    <Button variant="ghost" type="button" className="h-11 px-6 font-medium" onClick={() => window.print()}>
                      <Printer className="w-4 h-4 mr-2" />
                      Cetak
                    </Button>
                    <Button 
                      onClick={handleSubmit} 
                      disabled={submitting || uangAktual === ""} 
                      className="h-11 px-8 rounded-full bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm font-medium"
                    >
                      {submitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                      Simpan
                    </Button>
                  </div>
                </div>

              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
