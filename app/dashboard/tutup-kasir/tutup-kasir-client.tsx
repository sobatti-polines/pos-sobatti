"use client";

import { useState, useEffect } from "react";
import { Calculator, AlertCircle, Check, Loader2, Printer, Save, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { fetchCashSummary, submitTutupKasir, bukaSesiKasir } from "./actions";

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
    const res = await submitTutupKasir({ tanggal: summary.tanggal, uang_aktual: num });
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
  const selisih = uangAktual !== "" ? Number(uangAktual) - expectedSaldoAkhir : 0;

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
              <label htmlFor="date" className="text-sm font-medium text-muted-foreground">Shift:</label>
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
                    <h3 className="font-medium text-foreground">Buka Sesi Kasir</h3>
                    <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                      Masukkan <strong>uang awal (float)</strong> yang ditaruh di laci sebelum sesi dimulai.
                      Uang ini digunakan untuk memberi kembalian tunai kepada pelanggan.
                    </p>
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label htmlFor="awal" className="font-medium text-foreground">
                      Uang Awal Sesi (Rp)
                    </label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">Rp</span>
                      <Input
                        id="awal"
                        type="number"
                        placeholder="Contoh: 200000"
                        value={uangAwal}
                        onChange={(e) => setUangAwal(e.target.value === "" ? "" : e.target.value)}
                        className="pl-12 h-14 text-2xl font-semibold tabular-nums shadow-sm"
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Contoh: uang awal 200.000 → di akhir hari laci berisi 1.200.000 → penambahan hari ini = 1.000.000.
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
                      {submitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Wallet className="w-4 h-4 mr-2" />}
                      Buka Sesi Kasir
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* LANGKAH 2 — TUTUP KASIR */}
            {sudahDibuka && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-12 lg:gap-24">
                <div className="space-y-6">
                  <h3 className="font-medium text-foreground flex items-center gap-2">
                    <Calculator className="w-4 h-4 text-muted-foreground" />
                    Sistem
                  </h3>

                  <div className="grid grid-cols-2 gap-y-4 py-4 border-y border-border/60 text-sm">
                    <span className="text-muted-foreground">Uang Awal Sesi</span>
                    <span className="text-right tabular-nums">{formatIDR(Number(summary.uang_awal ?? saldoAwal))}</span>

                    <span className="text-muted-foreground">Pemasukan (Penjualan)</span>
                    <span className="text-right text-emerald-600 tabular-nums">+{formatIDR(totalMasuk)}</span>

                    <span className="text-muted-foreground">Pengeluaran</span>
                    <span className="text-right text-rose-600 tabular-nums">-{formatIDR(totalKeluar)}</span>
                  </div>

                  <div className="flex justify-between items-center py-1">
                    <span className="font-medium text-foreground">Saldo Akhir</span>
                    <span className="text-2xl font-semibold tabular-nums text-foreground">{formatIDR(expectedSaldoAkhir)}</span>
                  </div>

                  <div className="flex justify-between items-center pt-4 border-t border-border">
                    <span className="text-sm font-medium text-foreground">Penambahan Hari Ini</span>
                    <span className="text-xl font-semibold tabular-nums text-emerald-600">+{formatIDR(penambahan)}</span>
                  </div>
                  <p className="text-xs text-muted-foreground -mt-2">
                    = Saldo Akhir − Uang Awal (hasil penjualan tunai hari ini)
                  </p>

                  <div className="pt-4">
                    <h4 className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground mb-4">Rincian</h4>
                    <div className="grid grid-cols-2 gap-y-3 text-sm text-muted-foreground">
                      <span>Penjualan Tunai</span>
                      <span className="text-right tabular-nums">{formatIDR(totalMasuk)}</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground/70 mt-3 leading-relaxed">
                      Pembelian barang & pengeluaran operasional tidak tercatat di laci kasir — keduanya dikelola lewat Kas Admin.
                    </p>
                  </div>
                </div>

                <div className="flex flex-col space-y-8">
                  {sudahDitutup ? (
                    <div className="flex items-start gap-3 p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
                      <Check className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                      <div className="text-sm">
                        <p className="font-medium text-emerald-800">Sesi kasir sudah ditutup</p>
                        <p className="text-emerald-700 mt-1">
                          Uang aktual {formatIDR(Number(summary.uang_aktual ?? 0))}, selisih{" "}
                          {formatIDR(Number(summary.selisih ?? 0))}. Lihat riwayat di menu Laporan Kasir Harian.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="space-y-4">
                        <label htmlFor="aktual" className="font-medium text-foreground">
                          Fisik Laci (Uang Aktual)
                        </label>
                        <div className="relative">
                          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">Rp</span>
                          <Input
                            id="aktual"
                            type="number"
                            placeholder="0"
                            value={uangAktual}
                            onChange={(e) => setUangAktual(e.target.value === "" ? "" : e.target.value)}
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
                          Simpan Tutup Kasir
                        </Button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
