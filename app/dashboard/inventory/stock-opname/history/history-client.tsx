"use client";

import { useState, useMemo, useDeferredValue, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ClipboardList, ChevronDown, ChevronRight, Loader2, Search, X } from "lucide-react";
import { exportToCSV, exportToPDF } from "@/lib/export-utils";
import { ExportDropdown } from "@/components/export-dropdown";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { batalkanOpname } from "../actions";

function formatDate(dateStr: string) {
  const date = new Date(dateStr + (dateStr.includes("T") ? "" : "T00:00:00"));
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function formatIDR(n: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(n);
}

/* ------------------------------------------------------------------ */
/*  Types                                                               */
/* ------------------------------------------------------------------ */

interface OpnameItem {
  id: number;
  id_produk: number;
  stok_sistem: number;
  stok_fisik: number;
  selisih: number;
  klasifikasi: string | null;
  harga_pokok_snap: number | null;
  keterangan: string | null;
  produk: { nama_produk: string; sku: string | null } | null;
}

interface SesiRecord {
  id: string;
  no_sesi: string;
  tgl_sesi: string;
  status: string;
  keterangan: string | null;
  total_item: number;
  total_selisih: number;
  total_nilai: number;
  created_at: string;
  applied_at: string | null;
  pengguna: { nama: string; username: string } | null;
  stok_opname: OpnameItem[] | null;
}

/* ------------------------------------------------------------------ */
/*  Status badge                                                        */
/* ------------------------------------------------------------------ */

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    DRAFT: "bg-amber-50 text-amber-700 border-amber-200",
    SELESAI: "bg-emerald-50 text-emerald-700 border-emerald-200",
    DIBATALKAN: "bg-muted text-muted-foreground border-border",
  };
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[12px] font-semibold border ${
        styles[status] || styles.DRAFT
      }`}
    >
      {status}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/*  SesiAccordion — expandable per sesi                                 */
/* ------------------------------------------------------------------ */

function SesiAccordion({
  sesi,
  onExportCSV,
  onExportPDF,
  onCancel,
}: {
  sesi: SesiRecord;
  onExportCSV: () => void;
  onExportPDF: () => void;
  onCancel?: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const items = sesi.stok_opname ?? [];
  const operator = sesi.pengguna?.nama || sesi.pengguna?.username || "-";

  const handleCancel = async () => {
    if (!onCancel) return;
    setCancelling(true);
    const res = await batalkanOpname(sesi.id);
    if (!res?.error) {
      onCancel();
    }
    setCancelling(false);
  };

  return (
    <div className="bg-background border border-border rounded-[12px] shadow-[0_1px_3px_rgba(0,55,112,0.08)] overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 lg:px-6 py-4 hover:bg-muted/30 transition-colors">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="flex-1 flex items-center gap-3 text-left min-w-0"
        >
          {expanded ? (
            <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
          ) : (
            <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
          )}
          <span className="text-sm font-medium text-foreground tabular-nums">
            {sesi.no_sesi}
          </span>
          <StatusBadge status={sesi.status} />
          <span className="text-[11px] text-muted-foreground hidden md:inline">
            {formatDate(sesi.tgl_sesi)}
          </span>
          <span className="text-[11px] text-muted-foreground hidden md:inline">
            Operator: {operator}
          </span>
          <span className="ml-auto text-[11px] text-muted-foreground tabular-nums">
            {sesi.total_item} item
          </span>
          {sesi.total_nilai !== 0 && (
            <span
              className={`text-[11px] tabular-nums font-medium ${
                sesi.total_nilai > 0 ? "text-emerald-600" : "text-destructive"
              }`}
            >
              {formatIDR(sesi.total_nilai)}
            </span>
          )}
        </button>
        {sesi.status === "DRAFT" && onCancel && (
          <button
            type="button"
            onClick={handleCancel}
            disabled={cancelling}
            className="shrink-0 flex items-center gap-1 h-7 px-3 rounded-full text-[11px] font-medium text-destructive bg-destructive/10 hover:bg-destructive/20 transition-colors disabled:opacity-50"
          >
            {cancelling ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <X className="w-3 h-3" />
            )}
            Hapus
          </button>
        )}
      </div>

      {/* Body */}
      {expanded && (
        <div className="border-t border-border">
          {/* Meta */}
          <div className="flex flex-wrap gap-x-4 gap-y-1 px-4 lg:px-6 py-3 bg-muted/20 text-[11px] text-muted-foreground">
            <span>Dibuat: {new Date(sesi.created_at).toLocaleString("id-ID")}</span>
            {sesi.applied_at && (
              <span>Diterapkan: {new Date(sesi.applied_at).toLocaleString("id-ID")}</span>
            )}
            {sesi.keterangan && <span>Keterangan: {sesi.keterangan}</span>}
          </div>

          {/* Items table */}
          {items.length > 0 ? (
            <div className="overflow-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border/60 bg-muted/40">
                    <th className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider h-9 text-center px-3">#</th>
                    <th className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider h-9 text-left px-3">Produk</th>
                    <th className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider h-9 text-center px-3">Sistem</th>
                    <th className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider h-9 text-center px-3">Fisik</th>
                    <th className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider h-9 text-center px-3">Selisih</th>
                    <th className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider h-9 text-center px-3">Klasifikasi</th>
                    <th className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider h-9 text-left px-3">Keterangan</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, idx) => (
                    <tr key={item.id} className="border-b border-border/30 hover:bg-muted/10 transition-colors">
                      <td className="text-center text-sm text-muted-foreground tabular-nums px-3 py-2">{idx + 1}</td>
                      <td className="text-sm text-foreground px-3 py-2">{item.produk?.nama_produk || "Produk dihapus"}</td>
                      <td className="text-sm text-center tabular-nums px-3 py-2">{item.stok_sistem}</td>
                      <td className="text-sm text-center tabular-nums px-3 py-2 font-medium">{item.stok_fisik}</td>
                      <td className="text-center px-3 py-2">
                        <span
                          className={`tabular-nums font-semibold px-2 py-0.5 rounded-full text-[12px] ${
                            item.selisih > 0
                              ? "bg-emerald-50 text-emerald-600"
                              : item.selisih < 0
                              ? "bg-destructive/10 text-destructive"
                              : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {item.selisih > 0 ? `+${item.selisih}` : item.selisih}
                        </span>
                      </td>
                      <td className="text-sm text-center px-3 py-2">{item.klasifikasi || "-"}</td>
                      <td className="text-sm text-muted-foreground italic px-3 py-2">{item.keterangan || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="px-4 lg:px-6 py-6 text-sm text-muted-foreground text-center">
              Tidak ada item dalam sesi ini
            </div>
          )}

          {/* Footer totals + export */}
          <div className="flex items-center justify-between px-4 lg:px-6 py-3 border-t border-border bg-muted/20">
            <div className="flex gap-4 text-[11px] text-muted-foreground">
              <span>
                Total Item: <strong className="tabular-nums">{sesi.total_item}</strong>
              </span>
              <span>
                Selisih:{" "}
                <strong
                  className={`tabular-nums ${
                    sesi.total_selisih > 0 ? "text-emerald-600" : sesi.total_selisih < 0 ? "text-destructive" : ""
                  }`}
                >
                  {sesi.total_selisih > 0 ? `+${sesi.total_selisih}` : sesi.total_selisih}
                </strong>
              </span>
              <span>
                Nilai:{" "}
                <strong
                  className={`tabular-nums ${
                    sesi.total_nilai > 0 ? "text-emerald-600" : sesi.total_nilai < 0 ? "text-destructive" : ""
                  }`}
                >
                  {formatIDR(sesi.total_nilai)}
                </strong>
              </span>
            </div>
            <ExportDropdown onExportCSV={onExportCSV} onExportPDF={onExportPDF} />
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Client Component                                               */
/* ------------------------------------------------------------------ */

export default function OpnameHistoryClient({
  initialSesi,
}: {
  initialSesi: SesiRecord[];
}) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const [dateFilter, setDateFilter] = useState({ start: "", end: "" });
  const [statusFilter, setStatusFilter] = useState("aktif");

  const handleRefresh = useCallback(() => {
    router.refresh();
  }, [router]);

  const filteredData = useMemo(() => {
    let result = [...initialSesi];

    if (deferredSearchQuery.trim()) {
      const q = deferredSearchQuery.toLowerCase();
      result = result.filter(
        (s) =>
          s.no_sesi.toLowerCase().includes(q) ||
          s.keterangan?.toLowerCase().includes(q) ||
          s.pengguna?.nama?.toLowerCase().includes(q) ||
          s.stok_opname?.some(
            (item) => item.produk?.nama_produk?.toLowerCase().includes(q)
          )
      );
    }

    if (dateFilter.start) {
      const start = new Date(dateFilter.start);
      start.setHours(0, 0, 0, 0);
      result = result.filter((s) => new Date(s.tgl_sesi) >= start);
    }
    if (dateFilter.end) {
      const end = new Date(dateFilter.end);
      end.setHours(23, 59, 59, 999);
      result = result.filter((s) => new Date(s.tgl_sesi) <= end);
    }

    if (statusFilter === "DRAFT") {
      result = result.filter((s) => s.status === "DRAFT");
    } else if (statusFilter === "SELESAI") {
      result = result.filter((s) => s.status === "SELESAI");
    } else if (statusFilter === "DIBATALKAN") {
      result = result.filter((s) => s.status === "DIBATALKAN");
    } else if (statusFilter === "semua") {
      // show all, no filter
    } else {
      // "aktif" default: hide DIBATALKAN
      result = result.filter((s) => s.status !== "DIBATALKAN");
    }

    return result;
  }, [initialSesi, deferredSearchQuery, dateFilter, statusFilter]);

  const handleExportAllCSV = () => {
    const headers = [
      "No Sesi",
      "Tanggal",
      "Status",
      "Operator",
      "Total Item",
      "Selisih",
      "Nilai (Rp)",
      "Keterangan",
    ];
    const rows = filteredData.map((s) => [
      s.no_sesi,
      formatDate(s.tgl_sesi),
      s.status,
      s.pengguna?.nama || "-",
      s.total_item,
      s.total_selisih,
      s.total_nilai,
      s.keterangan || "-",
    ]);
    exportToCSV(
      `Riwayat_Stok_Opname_${new Date().toISOString().split("T")[0]}`,
      headers,
      rows
    );
  };

  const handleExportAllPDF = () => {
    const headers = [
      "No Sesi",
      "Tanggal",
      "Status",
      "Operator",
      "Total Item",
      "Selisih",
      "Nilai (Rp)",
    ];
    const rows = filteredData.map((s) => [
      s.no_sesi,
      formatDate(s.tgl_sesi),
      s.status,
      s.pengguna?.nama || "-",
      s.total_item,
      s.total_selisih,
      s.total_nilai,
    ]);
    exportToPDF(
      `Riwayat_Stok_Opname_${new Date().toISOString().split("T")[0]}`,
      "Riwayat Stok Opname",
      headers,
      rows
    );
  };

  const handleExportSesiCSV = (sesi: SesiRecord) => {
    const headers = ["#", "Produk", "Stok Sistem", "Stok Fisik", "Selisih", "Klasifikasi", "Keterangan"];
    const rows = (sesi.stok_opname ?? []).map((item, idx) => [
      idx + 1,
      item.produk?.nama_produk || "Produk dihapus",
      item.stok_sistem,
      item.stok_fisik,
      item.selisih,
      item.klasifikasi || "-",
      item.keterangan || "-",
    ]);
    exportToCSV(`Stok_Opname_${sesi.no_sesi}`, headers, rows);
  };

  const handleExportSesiPDF = (sesi: SesiRecord) => {
    const headers = ["#", "Produk", "Stok Sistem", "Stok Fisik", "Selisih", "Klasifikasi"];
    const rows = (sesi.stok_opname ?? []).map((item, idx) => [
      idx + 1,
      item.produk?.nama_produk || "Produk dihapus",
      item.stok_sistem,
      item.stok_fisik,
      item.selisih,
      item.klasifikasi || "-",
    ]);
    exportToPDF(
      `Stok_Opname_${sesi.no_sesi}`,
      `Stok Opname ${sesi.no_sesi}`,
      headers,
      rows
    );
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 gap-4 md:gap-8">
      {/* Search & Filter bar */}
      <div className="shrink-0 bg-background border border-border rounded-[12px] shadow-[0_1px_3px_rgba(0,55,112,0.08)] p-4 lg:p-6">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div className="flex flex-1 flex-col md:flex-row md:items-end gap-3 min-w-0">
            <div className="flex flex-col gap-1.5 w-full md:w-64">
              <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Cari</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Cari no sesi atau operator..."
                  className="pl-9 w-full"
                />
              </div>
            </div>
            <div className="flex flex-col gap-1.5 w-full md:w-44">
              <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Status</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="h-10 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/20 focus-visible:border-primary"
              >
                <option value="aktif">Aktif (Draft + Selesai)</option>
                <option value="DRAFT">Draft</option>
                <option value="SELESAI">Selesai</option>
                <option value="DIBATALKAN">Dibatalkan</option>
                <option value="semua">Tampilkan Semua</option>
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Dari</label>
              <Input
                type="date"
                value={dateFilter.start}
                onChange={(e) => setDateFilter((prev) => ({ ...prev, start: e.target.value }))}
                className="w-full md:w-40"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Sampai</label>
              <Input
                type="date"
                value={dateFilter.end}
                onChange={(e) => setDateFilter((prev) => ({ ...prev, end: e.target.value }))}
                className="w-full md:w-40"
              />
            </div>
          </div>
          <div className="flex gap-2 shrink-0 md:ml-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => { setSearchQuery(""); setDateFilter({ start: "", end: "" }); setStatusFilter("aktif"); }}
              className="flex-1 md:flex-none"
            >
              Reset
            </Button>
            <ExportDropdown
              onExportCSV={handleExportAllCSV}
              onExportPDF={handleExportAllPDF}
              className="flex-1 md:flex-none"
            />
          </div>
        </div>
      </div>

      {/* Accordion list */}
      <div className="flex-1 overflow-auto space-y-3">
        {filteredData.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
            <ClipboardList className="w-12 h-12 mb-4 opacity-20" />
            <p className="text-base font-medium text-foreground">Tidak ada riwayat</p>
            <p className="text-sm mt-1">Belum ada sesi stok opname yang tercatat.</p>
          </div>
        ) : (
          filteredData.map((sesi) => (
            <SesiAccordion
              key={sesi.id}
              sesi={sesi}
              onExportCSV={() => handleExportSesiCSV(sesi)}
              onExportPDF={() => handleExportSesiPDF(sesi)}
              onCancel={handleRefresh}
            />
          ))
        )}
      </div>
    </div>
  );
}
