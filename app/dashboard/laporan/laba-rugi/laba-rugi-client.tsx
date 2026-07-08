"use client";

import { useState } from "react";
import { format } from "date-fns";
import { id } from "date-fns/locale";
import { Printer, Download, Search, Loader2, TrendingUp, TrendingDown, DollarSign, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { fetchLabaRugi } from "./actions";
import { exportToCSV } from "@/lib/export-utils";

function formatIDR(n: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
}

export default function LabaRugiClient({ initialData }: { initialData: any }) {
  const [start, setStart] = useState(initialData?.periode?.start || "");
  const [end, setEnd] = useState(initialData?.periode?.end || "");
  const [data, setData] = useState(initialData);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleFetch = async () => {
    setLoading(true);
    setError("");
    const res = await fetchLabaRugi(start, end);
    if (res.data) {
      setData(res.data);
    } else {
      setError(res.error || "Laporan tidak dapat dimuat. Silakan coba lagi.");
    }
    setLoading(false);
  };

  const handleExport = () => {
    if (!data) return;
    const headers = ["Kategori", "Item", "Jumlah"];
    const rows = [
      ["PENDAPATAN", "Penjualan Kotor", data.pendapatan.penjualan_kotor],
      ["PENDAPATAN", "Diskon Penjualan (-)", data.pendapatan.diskon],
      ["PENDAPATAN", "Total Pendapatan Bersih", data.pendapatan.pendapatan_bersih],
      ["BIAYA", "Total HPP / Beban Pokok (-)", data.biaya.hpp],
      ["HASIL", "Laba Kotor", data.hasil.laba_kotor],
      ["HASIL", "Beban Operasional", data.hasil.beban_operasional],
      ["HASIL", "Laba / Rugi Bersih", data.hasil.laba_bersih],
    ];
    exportToCSV(`laba-rugi-${start}-to-${end}`, headers, rows);
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-background border border-border rounded-[12px] shadow-[0_1px_3px_rgba(0,55,112,0.08)] overflow-hidden relative w-full print-area print:border-none print:shadow-none print:bg-transparent">
      <div className="shrink-0 flex flex-col items-start md:flex-row md:items-center justify-between p-4 lg:p-6 border-b border-border bg-transparent gap-4 print:hidden">
        <div className="flex-1 flex flex-col md:flex-row items-stretch md:items-center gap-3 w-full">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 bg-muted/50 p-1 rounded-lg border border-border w-full md:w-auto">
            <div className="flex items-center justify-between sm:justify-start gap-2 px-2 py-1 sm:py-0">
              <Label htmlFor="start" className="text-[11px] uppercase tracking-wider text-muted-foreground whitespace-nowrap">Tanggal Mulai</Label>
              <Input id="start" type="date" value={start} onChange={(e) => setStart(e.target.value)} className="w-full sm:w-[150px] h-9 text-sm bg-background" />
            </div>
            <div className="flex items-center justify-between sm:justify-start gap-2 px-2 py-1 sm:py-0 border-t sm:border-t-0 sm:border-l border-border sm:pl-3">
              <Label htmlFor="end" className="text-[11px] uppercase tracking-wider text-muted-foreground whitespace-nowrap">Tanggal Akhir</Label>
              <Input id="end" type="date" value={end} onChange={(e) => setEnd(e.target.value)} className="w-full sm:w-[150px] h-9 text-sm bg-background" />
            </div>
            <Button onClick={handleFetch} disabled={loading} className="h-9 font-medium rounded-md px-4 flex-1 sm:flex-none bg-primary text-primary-foreground hover:bg-primary/90">
              {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Search className="w-4 h-4 mr-2" />}
              Tampilkan Laporan
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 md:ml-4 shrink-0 w-full md:w-auto">
          <Button variant="outline" className="rounded-full px-4 h-10 gap-2 flex-1 md:flex-none" onClick={handleExport}>
            <Download className="w-4 h-4" /> Unduh CSV
          </Button>
          <Button variant="outline" className="rounded-full px-4 h-10 gap-2 flex-1 md:flex-none" onClick={() => window.print()}>
            <Printer className="w-4 h-4" /> Cetak Laporan
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto min-h-0 relative">
        {loading && (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        )}

        {error && !loading && (
          <div className="p-6 lg:p-8">
            <div className="p-4 bg-destructive/10 border border-destructive/20 text-destructive text-sm rounded-lg flex items-center gap-2 max-w-7xl mx-auto">
              <AlertCircle className="w-4 h-4" />
              {error}
            </div>
          </div>
        )}

        {!data && !loading && !error && (
          <div className="text-center py-20 px-4">
            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center text-muted-foreground mx-auto mb-4">
              <Search className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-medium text-foreground mb-1">Belum ada data ditampilkan</h3>
            <p className="text-sm text-muted-foreground max-w-sm mx-auto">
              Silakan atur tanggal mulai dan tanggal akhir di atas, lalu klik "Tampilkan Laporan".
            </p>
          </div>
        )}

        {data && !loading && (
          <div className="max-w-7xl mx-auto w-full p-6 lg:p-10">
            {/* Print Header */}
            <div className="hidden print:block pb-8 mb-10 text-center border-b border-border">
              <h1 className="text-2xl font-bold uppercase tracking-widest">Laporan Laba Rugi</h1>
              <p className="text-muted-foreground mt-1">
                Periode: {format(new Date(data.periode.start), "dd MMM yyyy")} - {format(new Date(data.periode.end), "dd MMM yyyy")}
              </p>
            </div>

            <div className="space-y-10 text-sm">
              {/* PENDAPATAN */}
              <div className="space-y-6">
                <h3 className="font-bold text-base uppercase border-b border-foreground pb-2">Pendapatan</h3>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span>Penjualan</span>
                    <span className="tabular-nums">{formatIDR(data.pendapatan.penjualan_kotor)}</span>
                  </div>
                  <div className="flex justify-between items-center text-muted-foreground">
                    <span>Diskon Penjualan</span>
                    <span className="tabular-nums">({formatIDR(data.pendapatan.diskon)})</span>
                  </div>
                  <div className="flex justify-between items-center pt-4 border-t border-border mt-2">
                    <span className="font-medium">Pendapatan Bersih</span>
                    <span className="font-medium tabular-nums">{formatIDR(data.pendapatan.pendapatan_bersih)}</span>
                  </div>
                </div>
              </div>

              {/* BEBAN POKOK PENJUALAN */}
              <div className="space-y-6">
                <h3 className="font-bold text-base uppercase border-b border-foreground pb-2">Beban Pokok Penjualan</h3>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span>Harga Pokok Penjualan</span>
                    <span className="tabular-nums">({formatIDR(data.biaya.hpp)})</span>
                  </div>
                  <div className="flex justify-between items-center pt-4 border-t border-border mt-2">
                    <span className="font-bold">Laba Kotor</span>
                    <span className="font-bold text-base tabular-nums border-b-2 border-foreground">{formatIDR(data.hasil.laba_kotor)}</span>
                  </div>
                </div>
              </div>

              {/* BEBAN OPERASIONAL */}
              <div className="space-y-6">
                <h3 className="font-bold text-base uppercase border-b border-foreground pb-2">Beban Operasional</h3>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span>Total Beban Operasional</span>
                    <span className="tabular-nums">({formatIDR(data.hasil.beban_operasional)})</span>
                  </div>
                </div>
              </div>

              {/* LABA BERSIH */}
              <div className="flex justify-between items-center pt-6 border-t-2 border-foreground mt-8">
                <span className="font-bold text-base uppercase">Laba (Rugi) Bersih</span>
                <span className={`font-bold text-xl tabular-nums border-b-2 border-foreground ${data.hasil.laba_bersih >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {formatIDR(data.hasil.laba_bersih)}
                </span>
              </div>
            </div>

            {/* Footer for print */}
            <div className="hidden print:grid grid-cols-2 gap-20 p-12 text-center text-sm border-t border-border mt-16">
              <div className="space-y-20">
                <p>Disetujui oleh,</p>
                <div className="border-t border-border mx-auto w-40"></div>
                <p className="font-bold">( Pemilik )</p>
              </div>
              <div className="space-y-20">
                <p>Dibuat oleh,</p>
                <div className="border-t border-border mx-auto w-40"></div>
                <p className="font-bold">( Kasir / Admin )</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
