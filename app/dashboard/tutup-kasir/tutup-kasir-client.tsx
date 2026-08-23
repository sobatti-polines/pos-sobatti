"use client";

import { useState, useEffect, Fragment } from "react";
import {
  Calculator,
  AlertCircle,
  Check,
  Loader2,
  Printer,
  Save,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getTodayWIB } from "@/lib/utils";
import { fetchCashSummary, submitTutupKasir, bukaSesiKasir } from "./actions";

function formatIDR(n: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
}

import { format } from "date-fns";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { id } from "date-fns/locale";

export default function TutupKasirClient({
  initialSummary,
  store,
  username,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  initialSummary: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  store: any;
  username: string;
}) {
  const [date, setDate] = useState(getTodayWIB());
  const [summary, setSummary] = useState(initialSummary);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
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
      // eslint-disable-next-line react-hooks/set-state-in-effect
      refreshSummary(date);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
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

      <div className="print:hidden flex-1 flex flex-col min-h-0 bg-background border border-border rounded-[12px] shadow-[0_1px_3px_rgba(0,55,112,0.08)] overflow-hidden relative">
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
              <div className="flex flex-col items-center justify-center p-12 text-center bg-muted/20 border border-border/50 rounded-2xl">
                <AlertCircle className="w-12 h-12 text-warning mb-4" />
                <h3 className="text-xl font-medium text-foreground">
                  Sesi Kasir Belum Dibuka
                </h3>
                <p className="text-muted-foreground mt-2 max-w-md">
                  Anda tidak bisa menutup kasir karena sesi hari ini belum
                  dibuka. Silakan menuju halaman <strong>Buka Kasir</strong>{" "}
                  terlebih dahulu.
                </p>
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
                    <span className="text-muted-foreground">
                      Uang Awal Sesi
                    </span>
                    <span className="text-right tabular-nums">
                      {formatIDR(Number(summary.uang_awal ?? saldoAwal))}
                    </span>

                    <span className="text-muted-foreground">
                      Pemasukan (Penjualan)
                    </span>
                    <span className="text-right text-emerald-600 tabular-nums">
                      +{formatIDR(totalMasuk)}
                    </span>

                    <span className="text-muted-foreground">Pengeluaran</span>
                    <span className="text-right text-rose-600 tabular-nums">
                      -{formatIDR(totalKeluar)}
                    </span>
                  </div>

                  <div className="flex justify-between items-center py-1">
                    <span className="font-medium text-foreground">
                      Saldo Akhir
                    </span>
                    <span className="text-2xl font-semibold tabular-nums text-foreground">
                      {formatIDR(expectedSaldoAkhir)}
                    </span>
                  </div>

                  <div className="flex justify-between items-center pt-4 border-t border-border">
                    <span className="text-sm font-medium text-foreground">
                      Penambahan Hari Ini
                    </span>
                    <span className="text-xl font-semibold tabular-nums text-emerald-600">
                      +{formatIDR(penambahan)}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground -mt-2">
                    = Saldo Akhir − Uang Awal (hasil penjualan tunai hari ini)
                  </p>

                  <div className="pt-4">
                    <h4 className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground mb-4">
                      Rincian
                    </h4>
                    <div className="grid grid-cols-2 gap-y-3 text-sm text-muted-foreground">
                      <span>Penjualan Tunai</span>
                      <span className="text-right tabular-nums">
                        {formatIDR(totalMasuk)}
                      </span>
                      {Object.entries(summary.detail?.non_cash_sales || {}).map(([method, amount]) => (
                        <Fragment key={method}>
                          <span>Penjualan {method}</span>
                          <span className="text-right tabular-nums">
                            {formatIDR(amount as number)}
                          </span>
                        </Fragment>
                      ))}
                      <span className="font-semibold text-foreground pt-2 border-t border-border mt-1">Total Keseluruhan</span>
                      <span className="text-right font-semibold tabular-nums text-foreground pt-2 border-t border-border mt-1">
                        {formatIDR(Number(summary.detail?.grand_total_sales || totalMasuk))}
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground/70 mt-3 leading-relaxed">
                      Pembelian barang & pengeluaran operasional tidak tercatat
                      di laci kasir — keduanya dikelola lewat Kas Admin.
                    </p>
                  </div>
                </div>

                <div className="flex flex-col space-y-8">
                  {sudahDitutup ? (
                    <div className="flex flex-col gap-4">
                      <div className="flex items-start gap-3 p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
                        <Check className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                        <div className="text-sm">
                          <p className="font-medium text-emerald-800">
                            Sesi kasir sudah ditutup
                          </p>
                          <p className="text-emerald-700 mt-1">
                            Uang aktual{" "}
                            {formatIDR(Number(summary.uang_aktual ?? 0))},
                            selisih {formatIDR(Number(summary.selisih ?? 0))}.
                            Lihat riwayat di menu Laporan Kasir Harian.
                          </p>
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        className="mt-4"
                        onClick={() => window.print()}
                      >
                        <Printer className="w-4 h-4 mr-2" /> Cetak Laporan
                      </Button>
                    </div>
                  ) : (
                    <>
                      <div className="space-y-4">
                        <label
                          htmlFor="aktual"
                          className="font-medium text-foreground"
                        >
                          Fisik Laci (Uang Aktual)
                        </label>
                        <div className="relative">
                          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">
                            Rp
                          </span>
                          <Input
                            id="aktual"
                            type="number"
                            placeholder="0"
                            value={uangAktual}
                            onChange={(e) =>
                              setUangAktual(
                                e.target.value === "" ? "" : e.target.value,
                              )
                            }
                            className="pl-12 h-14 text-2xl font-semibold tabular-nums shadow-sm"
                          />
                        </div>
                      </div>

                      <div className="pt-4">
                        <span className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground block mb-1">
                          Selisih
                        </span>
                        <div
                          className={`text-4xl font-semibold tabular-nums flex items-center gap-3 ${
                            uangAktual === ""
                              ? "text-muted-foreground/30"
                              : selisih === 0
                                ? "text-emerald-600"
                                : Math.abs(selisih) < 1000
                                  ? "text-yellow-600"
                                  : "text-rose-600"
                          }`}
                        >
                          {uangAktual === ""
                            ? "-"
                            : `${selisih > 0 ? "+" : ""}${formatIDR(selisih)}`}
                          {uangAktual !== "" && selisih === 0 && (
                            <Check className="w-8 h-8 opacity-80" />
                          )}
                          {uangAktual !== "" && selisih !== 0 && (
                            <AlertCircle className="w-8 h-8 opacity-80" />
                          )}
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
                        <Button
                          variant="ghost"
                          type="button"
                          className="h-11 px-6 font-medium"
                          onClick={() => window.print()}
                        >
                          <Printer className="w-4 h-4 mr-2" />
                          Cetak
                        </Button>
                        <Button
                          onClick={handleSubmit}
                          disabled={submitting || uangAktual === ""}
                          className="h-11 px-8 rounded-full bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm font-medium"
                        >
                          {submitting ? (
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          ) : (
                            <Save className="w-4 h-4 mr-2" />
                          )}
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

      {/* PRINT RECEIPT (Struk Laporan Harian) */}
      <div
        className="hidden print:block receipt-print-area text-black bg-white"
        style={{
          fontFamily: "monospace",
          width: "58mm",
          margin: "0 auto",
          fontSize: "11px",
          lineHeight: "1.4",
        }}
      >
        <div style={{ textAlign: "center", marginBottom: "8px" }}>
          <h2
            style={{
              fontSize: "14px",
              fontWeight: "bold",
              margin: "0 0 4px 0",
              letterSpacing: "0.5px",
            }}
          >
            {store?.nama_toko || "TOKO POS"}
          </h2>
          <p style={{ margin: "0", fontSize: "10px" }}>
            {store?.alamat || "Alamat Toko"}
          </p>
          <p style={{ margin: "0", fontSize: "10px" }}>
            Telp: {store?.telepon || "-"}
          </p>
        </div>

        <div
          style={{
            borderTop: "1px dashed #000",
            borderBottom: "1px dashed #000",
            padding: "6px 0",
            marginBottom: "8px",
            fontSize: "10px",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span>TANGGAL</span>
            <span>{date ? format(new Date(date), "dd-MM-yyyy") : "-"}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span>KASIR</span>
            <span>{username.toUpperCase()}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span>CETAK</span>
            <span>{format(new Date(), "dd-MM-yyyy HH:mm")}</span>
          </div>
        </div>

        <div
          style={{
            textAlign: "center",
            fontWeight: "bold",
            marginBottom: "8px",
            fontSize: "12px",
          }}
        >
          LAPORAN KAS HARIAN
        </div>

        <div
          style={{
            marginBottom: "8px",
            paddingBottom: "8px",
            borderBottom: "1px dashed #000",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginBottom: "2px",
            }}
          >
            <span>MODAL AWAL</span>
            <span>{formatIDR(Number(summary?.uang_awal ?? saldoAwal))}</span>
          </div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginBottom: "2px",
            }}
          >
            <span>PENJUALAN TUNAI</span>
            <span>{formatIDR(totalMasuk)}</span>
          </div>
          {Object.entries(summary?.detail?.non_cash_sales || {}).map(([method, amount]) => (
            <div
              key={method}
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginBottom: "2px",
              }}
            >
              <span style={{textTransform: "uppercase"}}>PENJUALAN {method}</span>
              <span>{formatIDR(amount as number)}</span>
            </div>
          ))}

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontWeight: "bold",
              marginTop: "4px",
              paddingTop: "4px",
              borderTop: "1px dashed #000",
            }}
          >
            <span>TOTAL PENJUALAN</span>
            <span>{formatIDR(Number(summary?.detail?.grand_total_sales || totalMasuk))}</span>
          </div>

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontWeight: "bold",
              marginTop: "4px",
              paddingTop: "4px",
              borderTop: "1px solid #000",
            }}
          >
            <span>TOTAL LACI SISTEM</span>
            <span>{formatIDR(expectedSaldoAkhir)}</span>
          </div>
        </div>

        <div style={{ marginBottom: "12px" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginBottom: "2px",
              fontWeight: "bold",
            }}
          >
            <span>FISIK LACI</span>
            <span>{formatIDR(Number(summary?.uang_aktual ?? 0))}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span>SELISIH</span>
            <span>{formatIDR(Number(summary?.selisih ?? 0))}</span>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginTop: "20px",
            textAlign: "center",
            fontSize: "10px",
          }}
        >
          <div style={{ width: "45%" }}>
            <p style={{ margin: "0 0 30px 0" }}>Diserahkan Oleh,</p>
            <p style={{ margin: "0", textDecoration: "underline" }}>
              {username}
            </p>
          </div>
          <div style={{ width: "45%" }}>
            <p style={{ margin: "0 0 30px 0" }}>Diterima Oleh,</p>
            <p style={{ margin: "0", textDecoration: "underline" }}>
              Admin/Owner
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
