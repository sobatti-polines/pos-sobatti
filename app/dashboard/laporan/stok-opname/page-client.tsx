"use client";

import { useState } from "react";
import { ClipboardList, TrendingDown, TrendingUp, Package, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { fetchLaporanStokOpname, type LaporanStokOpnameData } from "./actions";
import { exportToCSV, exportToPDF } from "@/lib/export-utils";
import { ExportDropdown } from "@/components/export-dropdown";
import { Loader2 } from "lucide-react";

function formatIDR(n: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(n);
}

function formatBulan(yyyyMm: string): string {
  const [y, m] = yyyyMm.split("-");
  const months = [
    "Januari", "Februari", "Maret", "April", "Mei", "Juni",
    "Juli", "Agustus", "September", "Oktober", "November", "Desember",
  ];
  return `${months[parseInt(m, 10) - 1]} ${y}`;
}

/* ------------------------------------------------------------------ */
/*  Summary Cards                                                       */
/* ------------------------------------------------------------------ */

function SummaryCards({ data }: { data: LaporanStokOpnameData["summary"] }) {
  const cards = [
    {
      label: "Total Sesi",
      value: data.totalSesi,
      icon: FileText,
      color: "text-primary",
    },
    {
      label: "Total Item Diperiksa",
      value: data.totalItem,
      icon: Package,
      color: "text-foreground",
    },
    {
      label: "Total Defisit (Rp)",
      value: formatIDR(data.totalDefisit),
      icon: TrendingDown,
      color: "text-destructive",
    },
    {
      label: "Total Surplus (Rp)",
      value: formatIDR(data.totalSurplus),
      icon: TrendingUp,
      color: "text-emerald-600",
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {cards.map((c) => (
        <div key={c.label} className="bg-background border border-border rounded-xl p-5">
          <div className="flex items-center gap-2 mb-2">
            <c.icon className={`w-4 h-4 ${c.color}`} />
            <p className="text-[11px] text-muted-foreground uppercase tracking-wider">{c.label}</p>
          </div>
          <p className={`text-2xl font-light tabular-nums ${c.color}`}>{c.value}</p>
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Client Component                                               */
/* ------------------------------------------------------------------ */

export default function LaporanStokOpnameClient({
  initialData,
}: {
  initialData: LaporanStokOpnameData | null;
}) {
  const [data, setData] = useState<LaporanStokOpnameData | null>(initialData);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({
    start_date: new Date(new Date().getFullYear(), new Date().getMonth(), 1)
      .toISOString()
      .split("T")[0],
    end_date: new Date().toISOString().split("T")[0],
    status: "SELESAI",
  });

  const handleRefresh = async () => {
    setLoading(true);
    const result = await fetchLaporanStokOpname(filters);
    setData(result);
    setLoading(false);
  };

  const handleExportCSV = () => {
    if (!data) return;
    const headers = ["Bulan", "Sesi", "Item", "Selisih", "Defisit (Rp)", "Surplus (Rp)", "Shrinkage %"];
    const rows = data.bulanan.map((b) => [
      formatBulan(b.bulan),
      b.sesi,
      b.item,
      b.selisih,
      b.defisit,
      b.surplus,
      `${b.shrinkage.toFixed(1)}%`,
    ]);
    exportToCSV(`Laporan_Stok_Opname_${new Date().toISOString().split("T")[0]}`, headers, rows);
  };

  const handleExportPDF = () => {
    if (!data) return;
    const headers = ["Bulan", "Sesi", "Item", "Selisih", "Defisit (Rp)", "Surplus (Rp)", "Shrinkage %"];
    const rows = data.bulanan.map((b) => [
      formatBulan(b.bulan),
      b.sesi,
      b.item,
      b.selisih,
      b.defisit,
      b.surplus,
      `${b.shrinkage.toFixed(1)}%`,
    ]);
    exportToPDF(
      `Laporan_Stok_Opname_${new Date().toISOString().split("T")[0]}`,
      "Laporan Stok Opname",
      headers,
      rows
    );
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 gap-4 md:gap-6">
      {/* Filter bar */}
      <div className="shrink-0 flex flex-col md:flex-row md:items-end gap-3 bg-background border border-border rounded-xl p-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Dari</label>
          <input
            type="date"
            value={filters.start_date}
            onChange={(e) => setFilters((f) => ({ ...f, start_date: e.target.value }))}
            className="h-9 rounded-md border border-input bg-background px-3 py-1.5 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/20 focus-visible:border-primary"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Sampai</label>
          <input
            type="date"
            value={filters.end_date}
            onChange={(e) => setFilters((f) => ({ ...f, end_date: e.target.value }))}
            className="h-9 rounded-md border border-input bg-background px-3 py-1.5 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/20 focus-visible:border-primary"
          />
        </div>
        <Button
          variant="outline"
          onClick={handleRefresh}
          disabled={loading}
          className="rounded-full h-9 gap-1.5"
        >
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
          Muat Ulang
        </Button>
        <div className="ml-auto">
          <ExportDropdown onExportCSV={handleExportCSV} onExportPDF={handleExportPDF} />
        </div>
      </div>

      {/* Summary */}
      {data && <SummaryCards data={data.summary} />}

      {/* Bulanan table */}
      {data && data.bulanan.length > 0 && (
        <div className="bg-background border border-border rounded-xl overflow-hidden">
          <div className="px-5 py-3 border-b border-border bg-muted/30">
            <h3 className="text-sm font-medium text-foreground">Ringkasan Bulanan</h3>
          </div>
          <div className="overflow-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border/60 bg-muted/40">
                  <th className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider h-9 text-left px-4">Bulan</th>
                  <th className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider h-9 text-center px-3">Sesi</th>
                  <th className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider h-9 text-center px-3">Item</th>
                  <th className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider h-9 text-center px-3">Selisih</th>
                  <th className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider h-9 text-center px-3">Defisit (Rp)</th>
                  <th className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider h-9 text-center px-3">Surplus (Rp)</th>
                  <th className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider h-9 text-center px-3">Shrinkage %</th>
                </tr>
              </thead>
              <tbody>
                {data.bulanan.map((b) => (
                  <tr key={b.bulan} className="border-b border-border/30 hover:bg-muted/10 transition-colors">
                    <td className="text-sm text-foreground px-4 py-2.5 font-medium">{formatBulan(b.bulan)}</td>
                    <td className="text-sm text-center tabular-nums px-3 py-2.5">{b.sesi}</td>
                    <td className="text-sm text-center tabular-nums px-3 py-2.5">{b.item}</td>
                    <td className="text-center px-3 py-2.5">
                      <span
                        className={`tabular-nums font-semibold px-2 py-0.5 rounded-full text-[12px] ${
                          b.selisih > 0
                            ? "bg-emerald-50 text-emerald-600"
                            : b.selisih < 0
                            ? "bg-destructive/10 text-destructive"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {b.selisih > 0 ? `+${b.selisih}` : b.selisih}
                      </span>
                    </td>
                    <td className="text-sm text-center tabular-nums px-3 py-2.5 text-destructive">
                      {formatIDR(b.defisit)}
                    </td>
                    <td className="text-sm text-center tabular-nums px-3 py-2.5 text-emerald-600">
                      {formatIDR(b.surplus)}
                    </td>
                    <td className="text-sm text-center tabular-nums px-3 py-2.5">
                      {b.shrinkage.toFixed(1)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Empty state */}
      {data && data.bulanan.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
          <ClipboardList className="w-12 h-12 mb-4 opacity-20" />
          <p className="text-base font-medium text-foreground">Tidak ada data</p>
          <p className="text-sm mt-1">Belum ada sesi stok opname selesai pada rentang ini.</p>
        </div>
      )}
    </div>
  );
}
