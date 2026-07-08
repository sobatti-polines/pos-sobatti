"use client";

import { useState } from "react";
import { format } from "date-fns";
import { id } from "date-fns/locale";
import { Printer, Search, Loader2, Scale, Download, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { fetchNeraca } from "./actions";
import { exportToCSV } from "@/lib/export-utils";

function formatIDR(n: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
}

export default function NeracaClient({ initialData }: { initialData: any }) {
  const [date, setDate] = useState(initialData?.tanggal || new Date().toISOString().slice(0, 10));
  const [data, setData] = useState(initialData);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleFetch = async () => {
    setLoading(true);
    setError("");
    const res = await fetchNeraca(date);
    if (res.data) {
      setData(res.data);
    } else {
      setError(res.error || "Neraca tidak dapat dimuat. Silakan coba lagi.");
    }
    setLoading(false);
  };

  const handleExport = () => {
    if (!data) return;
    const headers = ["Kategori", "Sub-Kategori", "Item", "Jumlah"];
    const rows = [
      ["ASET (AKTIVA)", "Aset Lancar", "Kas & Setara Kas", data.aset.kas],
      ["ASET (AKTIVA)", "Aset Lancar", "Piutang Dagang", data.aset.piutang],
      ["ASET (AKTIVA)", "Aset Lancar", "Persediaan Barang", data.aset.persediaan],
      ["ASET (AKTIVA)", "", "TOTAL ASET", data.aset.total_aset],
      ["KEWAJIBAN (PASIVA)", "Kewajiban", "Hutang Dagang", data.kewajiban.hutang],
      ["KEWAJIBAN (PASIVA)", "", "Total Kewajiban", data.kewajiban.total_kewajiban],
      ["MODAL (EKUITAS)", "Ekuitas", "Modal Awal", data.ekuitas.modal_awal],
      ["MODAL (EKUITAS)", "Ekuitas", "Laba Ditahan", data.ekuitas.laba_ditahan],
      ["MODAL (EKUITAS)", "", "Total Modal", data.ekuitas.total_ekuitas],
      ["RINGKASAN", "", "TOTAL KEWAJIBAN + MODAL", data.kewajiban.total_kewajiban + data.ekuitas.total_ekuitas],
    ];
    exportToCSV(`neraca-${date}`, headers, rows);
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-background border border-border rounded-[12px] shadow-[0_1px_3px_rgba(0,55,112,0.08)] overflow-hidden relative w-full print-area print:border-none print:shadow-none print:bg-transparent">
      <div className="shrink-0 flex flex-col items-start md:flex-row md:items-center justify-between p-4 lg:p-6 border-b border-border bg-transparent gap-4 print:hidden">
        <div className="flex-1 flex flex-col md:flex-row items-stretch md:items-center gap-3 w-full">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 bg-muted/50 p-1 rounded-lg border border-border w-full md:w-auto">
            <div className="flex items-center justify-between sm:justify-start gap-2 px-2 py-1 sm:py-0">
              <Label htmlFor="date" className="text-[11px] uppercase tracking-wider text-muted-foreground whitespace-nowrap">Tanggal Laporan</Label>
              <Input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full sm:w-[150px] h-9 text-sm bg-background" />
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
              Silakan atur tanggal laporan di atas, lalu klik "Tampilkan Laporan". Pastikan Modal Awal sudah diatur di Pengaturan.
            </p>
          </div>
        )}

        {data && !loading && (
        <div className="max-w-7xl mx-auto w-full p-6 lg:p-10">
          {/* Print Header */}
          <div className="hidden print:block pb-8 mb-10 text-center border-b border-border">
            <h1 className="text-2xl font-bold uppercase tracking-widest">Neraca</h1>
            <p className="text-muted-foreground mt-1">
              Per Tanggal: {format(new Date(data.tanggal), "dd MMMM yyyy", { locale: id })}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-16 gap-y-16">
            {/* LEFT COLUMN: ASSETS */}
            <div className="space-y-6 text-sm">
              <h3 className="font-bold text-base uppercase border-b border-foreground pb-2">Aset</h3>

              <div>
                <h4 className="text-[11px] font-bold text-muted-foreground uppercase mb-3">Aset Lancar</h4>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span>Kas & Setara Kas</span>
                    <span className="tabular-nums">{formatIDR(data.aset.kas)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Piutang Dagang</span>
                    <span className="tabular-nums">{formatIDR(data.aset.piutang)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Persediaan Barang</span>
                    <span className="tabular-nums">{formatIDR(data.aset.persediaan)}</span>
                  </div>
                </div>
              </div>

              <div className="flex justify-between items-center pt-4 border-t border-border mt-4">
                <span className="font-bold">Total Aset</span>
                <span className="font-bold text-base tabular-nums border-b-2 border-foreground">
                  {formatIDR(data.aset.total_aset)}
                </span>
              </div>
            </div>

            {/* RIGHT COLUMN: LIABILITIES & EQUITY */}
            <div className="space-y-10 text-sm">
              {/* LIABILITIES */}
              <div className="space-y-6">
                <h3 className="font-bold text-base uppercase border-b border-foreground pb-2">Kewajiban</h3>
                
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span>Hutang Dagang</span>
                    <span className="tabular-nums">{formatIDR(data.kewajiban.hutang)}</span>
                  </div>
                  <div className="flex justify-between items-center pt-4 border-t border-border mt-2">
                    <span className="font-medium">Total Kewajiban</span>
                    <span className="font-medium tabular-nums">{formatIDR(data.kewajiban.total_kewajiban)}</span>
                  </div>
                </div>
              </div>

              {/* EQUITY */}
              <div className="space-y-6">
                <h3 className="font-bold text-base uppercase border-b border-foreground pb-2">Ekuitas</h3>
                
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span>Modal Awal</span>
                    <span className="tabular-nums">{formatIDR(data.ekuitas.modal_awal)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Laba Ditahan</span>
                    <span className="tabular-nums">{formatIDR(data.ekuitas.laba_ditahan)}</span>
                  </div>
                  <div className="flex justify-between items-center pt-4 border-t border-border mt-2">
                    <span className="font-medium">Total Ekuitas</span>
                    <span className="font-medium tabular-nums">{formatIDR(data.ekuitas.total_ekuitas)}</span>
                  </div>
                </div>
              </div>

              {/* SUMMARY TOTAL */}
              <div className="flex justify-between items-center pt-4 border-t-2 border-foreground">
                <span className="font-bold uppercase">Total Kewajiban dan Ekuitas</span>
                <span className="font-bold text-base tabular-nums border-b-2 border-foreground">
                  {formatIDR(data.kewajiban.total_kewajiban + data.ekuitas.total_ekuitas)}
                </span>
              </div>
              
              {/* BALANCE CHECK */}
              {Math.abs(data.aset.total_aset - (data.kewajiban.total_kewajiban + data.ekuitas.total_ekuitas)) > 1 && (
                <div className="p-3 bg-destructive/10 text-destructive text-[10px] rounded-md border border-destructive/20 flex items-center gap-2 uppercase font-bold tracking-widest mt-6">
                  <Scale className="w-4 h-4" />
                  Neraca tidak seimbang (Selisih: {formatIDR(data.aset.total_aset - (data.kewajiban.total_kewajiban + data.ekuitas.total_ekuitas))})
                </div>
              )}
            </div>
          </div>
          
          {/* Footer for print */}
          <div className="hidden print:grid grid-cols-2 gap-20 p-12 text-center text-sm border-t border-border mt-10">
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
