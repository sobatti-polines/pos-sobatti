"use client";

import { format } from "date-fns";
import { id } from "date-fns/locale";
import { FileText, Search, Printer, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { exportToCSV } from "@/lib/export-utils";

function formatIDR(n: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
}

export default function LaporanKasirClient({ data }: { data: any[] }) {
  const handleExport = () => {
    const headers = ["Tanggal", "Saldo Awal", "Total Masuk", "Total Keluar", "Saldo Sistem", "Uang Aktual", "Selisih", "Kasir"];
    const rows = data.map(r => [
      format(new Date(r.tanggal), "yyyy-MM-dd"),
      r.saldo_awal,
      r.total_masuk,
      r.total_keluar,
      r.saldo_akhir,
      r.uang_aktual,
      r.selisih,
      r.pengguna?.nama || r.pengguna?.username || "-"
    ]);
    exportToCSV(`laporan-kasir-${format(new Date(), "yyyyMMdd")}`, headers, rows);
  };

  return (
    <div className="p-4 md:p-8 w-full max-w-7xl mx-auto space-y-6 print-area">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 print:hidden">
        <div className="space-y-1">
          <h1 className="text-3xl font-light tracking-tighter">Laporan Kasir Harian</h1>
          <p className="text-muted-foreground">Riwayat penutupan kas dan rekonsiliasi harian.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </Button>
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <Printer className="w-4 h-4 mr-2" />
            Cetak
          </Button>
        </div>
      </div>

      <div className="bg-background border border-border rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b border-border">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground uppercase tracking-wider text-[11px]">Tanggal</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground uppercase tracking-wider text-[11px]">Saldo Awal</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground uppercase tracking-wider text-[11px]">In (Tunai)</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground uppercase tracking-wider text-[11px]">Out (Tunai)</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground uppercase tracking-wider text-[11px]">Sistem</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground uppercase tracking-wider text-[11px]">Aktual</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground uppercase tracking-wider text-[11px]">Selisih</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground uppercase tracking-wider text-[11px]">Kasir</th>
              </tr>
            </thead>
            <tbody>
              {data.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-muted-foreground">
                    <FileText className="w-12 h-12 mx-auto mb-3 opacity-20" />
                    Belum ada riwayat laporan kasir
                  </td>
                </tr>
              ) : (
                data.map((r) => (
                  <tr key={r.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-4 font-medium">
                      {format(new Date(r.tanggal), "eeee, dd MMMM yyyy", { locale: id })}
                    </td>
                    <td className="px-4 py-4 text-right tabular-nums text-muted-foreground">{formatIDR(r.saldo_awal)}</td>
                    <td className="px-4 py-4 text-right tabular-nums text-emerald-600">+{formatIDR(r.total_masuk)}</td>
                    <td className="px-4 py-4 text-right tabular-nums text-rose-600">-{formatIDR(r.total_keluar)}</td>
                    <td className="px-4 py-4 text-right tabular-nums font-medium">{formatIDR(r.saldo_akhir)}</td>
                    <td className="px-4 py-4 text-right tabular-nums font-bold">{formatIDR(r.uang_aktual)}</td>
                    <td className={`px-4 py-4 text-right tabular-nums font-semibold ${
                      r.selisih === 0 ? 'text-emerald-600' : 'text-rose-600'
                    }`}>
                      {r.selisih > 0 ? "+" : ""}{formatIDR(r.selisih)}
                    </td>
                    <td className="px-4 py-4 text-muted-foreground">
                      {r.pengguna?.nama || r.pengguna?.username || "-"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
