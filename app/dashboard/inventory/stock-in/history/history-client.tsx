"use client";

import { useState, useMemo, useDeferredValue, useTransition, useRef } from "react";
import { PackagePlus, Pencil, Ban, Printer, Repeat, AlertCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTable } from "@/hooks/use-table";
import DataTable, { type Column, type FilterDef } from "@/components/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { voidBarangMasuk, updateBarangMasuk } from "../actions";
import { exportToCSV, exportToPDF } from "@/lib/export-utils";
import { ExportDropdown } from "@/components/export-dropdown";

function formatIDR(n: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
}

function formatDate(dateStr: string) {
  const date = new Date(dateStr);
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function formatDateTime(dateStr: string | null) {
  if (!dateStr) return "-";
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

interface StockInHistoryRecord {
  id: number;
  tgl_masuk: string;
  supplier: { id: number; nama_supplier: string } | null;
  produk: { nama_produk: string } | null;
  harga_beli: number;
  jumlah: number;
  total: number;
  keterangan?: string;
  no_surat: string | null;
  supplied_unit: string | null;
  supplied_qty: number | null;
  applied_conversion_ratio: number | null;
  base_qty_added: number | null;
  total_cost: number | null;
  base_cost_per_piece: number | null;
  status?: string;
  created_at: string | null;
}

interface SupplierRecord {
  id: number;
  nama_supplier: string;
}

export default function StockInHistoryClient({
  initialHistory,
  suppliers,
  isOwner = false,
}: {
  initialHistory: StockInHistoryRecord[];
  suppliers: SupplierRecord[];
  isOwner?: boolean;
}) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const [supplierFilter, setSupplierFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState({ start: "", end: "" });

  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [editTarget, setEditTarget] = useState<StockInHistoryRecord | null>(null);
  const [editForm, setEditForm] = useState({ tgl_masuk: "", no_surat: "", keterangan: "" });
  const [voidTarget, setVoidTarget] = useState<StockInHistoryRecord | null>(null);
  const [voidReason, setVoidReason] = useState("");
  const [pendingAction, setPendingAction] = useState<"edit" | "void" | null>(null);

  const voidReasonRef = useRef<HTMLTextAreaElement>(null);

  const isVoided = (h: StockInHistoryRecord) => h.status === "DIVOID";

  const handleOpenEdit = (h: StockInHistoryRecord) => {
    if (isVoided(h)) return;
    setError(null);
    setEditForm({
      tgl_masuk: (h.tgl_masuk || "").slice(0, 10),
      no_surat: h.no_surat || "",
      keterangan: h.keterangan || "",
    });
    setEditTarget(h);
  };

  const handleConfirmEdit = () => {
    if (!editTarget) return;
    setPendingAction("edit");
    setError(null);
    startTransition(async () => {
      const res = await updateBarangMasuk({
        id: editTarget.id,
        tgl_masuk: editForm.tgl_masuk,
        no_surat: editForm.no_surat,
        keterangan: editForm.keterangan,
      });
      if (res.error) {
        setError(res.error);
        setPendingAction(null);
      } else {
        setEditTarget(null);
        setPendingAction(null);
        router.refresh();
      }
    });
  };

  const handleOpenVoid = (h: StockInHistoryRecord) => {
    if (isVoided(h)) return;
    setError(null);
    setVoidReason("");
    setVoidTarget(h);
    setTimeout(() => voidReasonRef.current?.focus(), 50);
  };

  const handleConfirmVoid = () => {
    if (!voidTarget) return;
    if (!voidReason.trim()) {
      setError("Alasan pembatalan wajib diisi.");
      voidReasonRef.current?.focus();
      return;
    }
    setPendingAction("void");
    setError(null);
    startTransition(async () => {
      const res = await voidBarangMasuk(voidTarget.id, voidReason.trim());
      if (res.error) {
        setError(res.error);
        setPendingAction(null);
      } else {
        setVoidTarget(null);
        setVoidReason("");
        setPendingAction(null);
        router.refresh();
      }
    });
  };

  const filteredData = useMemo(() => {
    let result = [...initialHistory];

    if (deferredSearchQuery.trim()) {
      const q = deferredSearchQuery.toLowerCase();
      result = result.filter(
        (h) =>
          h.produk?.nama_produk.toLowerCase().includes(q) ||
          (h.no_surat ?? "").toLowerCase().includes(q)
      );
    }

    if (supplierFilter !== "all") {
      result = result.filter((h) => h.supplier?.id.toString() === supplierFilter);
    }

    if (dateFilter.start) {
      const start = new Date(dateFilter.start);
      start.setHours(0, 0, 0, 0);
      result = result.filter((h) => new Date(h.tgl_masuk) >= start);
    }
    if (dateFilter.end) {
      const end = new Date(dateFilter.end);
      end.setHours(23, 59, 59, 999);
      result = result.filter((h) => new Date(h.tgl_masuk) <= end);
    }

    return result;
  }, [initialHistory, deferredSearchQuery, supplierFilter, dateFilter]);

  const table = useTable({ data: filteredData, defaultItemsPerPage: 25 });

  const activeData = useMemo(() => {
    return filteredData.filter((h) => h.status !== "DIVOID");
  }, [filteredData]);

  const totalValue = useMemo(() => {
    return activeData.reduce((sum, h) => sum + Number(h.total_cost || h.total), 0);
  }, [activeData]);

  const handleExportCSV = () => {
    const allHeaders = ["Tanggal", "No. Faktur", "Supplier", "Produk", "Satuan Suplai", "Qty Suplai", "Rasio", "Base Qty", "HPP/Pcs", "Total Biaya", "Status", "Keterangan"];
    const headers = isOwner ? allHeaders : allHeaders.filter((_, i) => ![8, 9].includes(i));
    const rows = filteredData.map(h => {
      const row = [
        formatDate(h.tgl_masuk),
        h.no_surat || "",
        h.supplier?.nama_supplier || "Umum",
        h.produk?.nama_produk || "Produk dihapus",
        h.supplied_unit || "-",
        h.supplied_qty ?? "-",
        h.applied_conversion_ratio ?? "-",
        h.base_qty_added ?? h.jumlah,
        h.base_cost_per_piece ?? h.harga_beli,
        h.total_cost ?? h.total,
        h.status || "AKTIF",
        h.keterangan || "",
      ];
      return isOwner ? row : row.filter((_, i) => ![8, 9].includes(i));
    });
    exportToCSV(`Riwayat_Stok_Masuk_${new Date().toISOString().split("T")[0]}`, headers, rows);
  };

  const handleExportPDF = () => {
    const allHeaders = ["Tanggal", "No. Faktur", "Supplier", "Produk", "Base Qty", "HPP/Pcs", "Total Biaya", "Status"];
    const headers = isOwner ? allHeaders : allHeaders.filter((_, i) => ![4, 5].includes(i));
    const rows = filteredData.map(h => {
      const row = [
        formatDate(h.tgl_masuk),
        h.no_surat || "",
        h.supplier?.nama_supplier || "Umum",
        h.produk?.nama_produk || "Produk dihapus",
        String(h.base_qty_added ?? h.jumlah),
        formatIDR(h.base_cost_per_piece ?? h.harga_beli),
        formatIDR(h.total_cost ?? h.total),
        h.status || "AKTIF",
      ];
      return isOwner ? row : row.filter((_, i) => ![4, 5].includes(i));
    });
    exportToPDF(`Riwayat_Stok_Masuk_${new Date().toISOString().split("T")[0]}`, "Riwayat Stok Masuk", headers, rows);
  };

  const filters: FilterDef[] = [
    {
      type: "select",
      label: "Supplier",
      value: supplierFilter,
      onChange: setSupplierFilter,
      options: suppliers.map((s) => ({ value: String(s.id), label: s.nama_supplier })),
    },
    {
      type: "date-range",
      start: dateFilter.start,
      end: dateFilter.end,
      onStartChange: (v) => setDateFilter(prev => ({ ...prev, start: v })),
      onEndChange: (v) => setDateFilter(prev => ({ ...prev, end: v })),
    },
  ];

  const statusBadge = (h: StockInHistoryRecord) => {
    if (isVoided(h)) {
      return (
        <Badge variant="secondary" className="bg-destructive/10 text-destructive hover:bg-destructive/20 font-medium border-none rounded-full px-2 py-0.5 text-[10px] uppercase tracking-widest leading-tight line-through">
          DIVOID
        </Badge>
      );
    }
    return (
      <Badge variant="secondary" className="bg-success/10 text-success hover:bg-success/20 font-medium border-none rounded-full px-2 py-0.5 text-[10px] uppercase tracking-widest leading-tight">
        AKTIF
      </Badge>
    );
  };

  const rowText = (h: StockInHistoryRecord, content: React.ReactNode) => {
    return isVoided(h) ? <span className="line-through text-muted-foreground/70">{content}</span> : content;
  };

  const columns: Column<StockInHistoryRecord>[] = [
    { key: "tgl_masuk", header: "Tanggal", sortable: true, className: "pl-6", headerClassName: "pl-6 w-[120px]", render: (h) => rowText(h, formatDate(h.tgl_masuk)) },
    { key: "created_at", header: "Waktu Input", sortable: true, mobileHide: true, headerClassName: "w-[140px]", render: (h) => rowText(h, formatDateTime(h.created_at)) },
    { key: "no_surat", header: "No. Faktur", sortable: true, mobileHide: true, render: (h) => rowText(h, h.no_surat || "-") },
    { key: "supplier", header: "Supplier", sortable: true, sortKey: "supplier.nama_supplier", render: (h) => rowText(h, h.supplier?.nama_supplier || "Umum") },
    { key: "produk", header: "Produk", sortable: true, sortKey: "produk.nama_produk", render: (h) => rowText(h, h.produk?.nama_produk || "Produk dihapus") },
    {
      key: "suplai", header: "Suplai", headerClassName: "w-[100px] text-center",
      render: (h) => {
        const isUom = h.supplied_qty != null;
        return rowText(h, <span className="text-center text-sm">{isUom ? `${h.supplied_qty} ${h.supplied_unit}` : `${h.jumlah} pcs`}</span>);
      },
    },
    {
      key: "rasio", header: "Rasio", headerClassName: "w-[80px] text-center",
      render: (h) => {
        const isUom = h.supplied_qty != null;
        return rowText(h, <span className="text-center text-sm text-muted-foreground">{isUom ? `1:${h.applied_conversion_ratio}` : "-"}</span>);
      },
    },
    { key: "base_qty", header: "Base Qty", headerClassName: "w-[100px] text-right", render: (h) => rowText(h, <span className="tabular-nums">{h.base_qty_added ?? h.jumlah}</span>) },
    ...(isOwner ? [
      { key: "harga_beli" as const, header: "HPP/Pcs", sortable: true, headerClassName: "w-[120px] text-right", render: (h: StockInHistoryRecord) => rowText(h, <span className="tabular-nums">{formatIDR(h.base_cost_per_piece ?? h.harga_beli)}</span>) },
      { key: "total" as const, header: "Total", sortable: true, className: "pr-6", headerClassName: "w-[140px] text-right pr-6", render: (h: StockInHistoryRecord) => rowText(h, <span className="tabular-nums">{formatIDR(h.total_cost ?? h.total)}</span>) },
    ] : []),
    {
      key: "status", header: "Status", sortable: true, sortKey: "status", headerClassName: "w-[110px] text-center",
      render: (h) => <div className="flex justify-center">{statusBadge(h)}</div>,
    },
    {
      key: "aksi", header: "", headerClassName: "w-[150px] pr-6", className: "pr-6",
      render: (h) => {
        return (
          <div className="flex justify-end gap-1">
            <Button
              asChild
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-full text-muted-foreground hover:text-primary hover:bg-primary/10"
            >
              <a
                href={`/dashboard/inventory/stock-in/print/${h.id}`}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Cetak Dokumen"
                title="Cetak Dokumen"
              >
                <Printer className="h-4 w-4" />
              </a>
            </Button>
            {!isVoided(h) && (
              <>
                <Button
                  asChild
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-full text-muted-foreground hover:text-primary hover:bg-primary/10"
                >
                  <a
                    href={`/dashboard/inventory/stock-in?reorder=${h.id}`}
                    aria-label="Buat Ulang (Ulangi Pembelian)"
                    title="Buat Ulang (Ulangi Pembelian ini)"
                  >
                    <Repeat className="h-4 w-4" />
                  </a>
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Edit"
                  className="h-8 w-8 rounded-full text-muted-foreground hover:text-primary hover:bg-primary/10"
                  disabled={isPending}
                  onClick={() => handleOpenEdit(h)}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Batalkan"
                  className="h-8 w-8 rounded-full text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                  disabled={isPending}
                  onClick={() => handleOpenVoid(h)}
                >
                  <Ban className="h-4 w-4" />
                </Button>
              </>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <>
      <DataTable
        data={table.paginatedData}
        total={table.total}
        columns={columns}
        rowKey={(h) => h.id}
        search={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder="Cari produk / No. Faktur..."
        sortConfig={table.sortConfig}
        onSort={table.handleSort}
        currentPage={table.currentPage}
        onPageChange={table.setCurrentPage}
        itemsPerPage={table.itemsPerPage}
        onItemsPerPageChange={table.setItemsPerPage}
        filters={filters}
        errorBanner={error}
        actions={[
          { label: "Reset", variant: "outline", onClick: () => { setSearchQuery(""); setSupplierFilter("all"); setDateFilter({ start: "", end: "" }); } },
          {
            label: "Export",
            customRender: () => (
              <ExportDropdown
                onExportCSV={handleExportCSV}
                onExportPDF={handleExportPDF}
                className="flex-1 md:flex-none"
              />
            ),
          },
        ]}
        topContent={
          <div className={`grid grid-cols-1 gap-4 ${isOwner ? 'md:grid-cols-2' : ''}`}>
            {isOwner && (
              <div className="bg-muted/30 rounded-xl p-4 border border-border/50">
                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-widest mb-1">Total Nilai Pembelian</p>
                <p className="text-2xl font-light tracking-tight text-foreground tabular-nums">{formatIDR(totalValue)}</p>
              </div>
            )}
            <div className="bg-muted/30 rounded-xl p-4 border border-border/50">
              <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-widest mb-1">Jumlah Catatan</p>
              <p className="text-2xl font-light tracking-tight text-foreground tabular-nums">{activeData.length}</p>
            </div>
          </div>
        }
        emptyState={{
          icon: PackagePlus,
          title: "Tidak ada riwayat barang masuk ditemukan",
          description: "Coba gunakan kata kunci pencarian atau filter yang lain.",
        }}
      />

      {/* Edit Dialog */}
      <Dialog open={editTarget !== null} onOpenChange={(open) => { if (!open) setEditTarget(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Barang Masuk</DialogTitle>
            <DialogDescription>
              Hanya bisa mengubah detail ringan. Qty, harga, produk, dan supplier tidak dapat diedit — lakukan pembatalan lalu input ulang.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="edit-tgl">Tanggal Masuk</Label>
              <Input
                id="edit-tgl"
                type="date"
                value={editForm.tgl_masuk}
                onChange={(e) => setEditForm((f) => ({ ...f, tgl_masuk: e.target.value }))}
                disabled={pendingAction === "edit"}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-no">No. Faktur/Nota</Label>
              <Input
                id="edit-no"
                placeholder="Opsional"
                value={editForm.no_surat}
                onChange={(e) => setEditForm((f) => ({ ...f, no_surat: e.target.value }))}
                disabled={pendingAction === "edit"}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-ket">Keterangan</Label>
              <textarea
                id="edit-ket"
                rows={3}
                placeholder="Opsional"
                value={editForm.keterangan}
                onChange={(e) => setEditForm((f) => ({ ...f, keterangan: e.target.value }))}
                disabled={pendingAction === "edit"}
                className="flex w-full rounded-[6px] border border-input bg-background px-3 py-2 text-sm shadow-xs transition-[color,box-shadow] outline-none placeholder:text-muted-foreground focus-visible:border-primary focus-visible:ring-[3px] focus-visible:ring-primary/20 disabled:pointer-events-none disabled:opacity-50"
              />
            </div>
            {error && (
              <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg p-3">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {error}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              className="rounded-full px-6 bg-background"
              disabled={pendingAction === "edit"}
              onClick={() => setEditTarget(null)}
            >
              Batal
            </Button>
            <Button
              className="rounded-full px-6"
              disabled={pendingAction === "edit" || !editForm.tgl_masuk}
              onClick={handleConfirmEdit}
            >
              {pendingAction === "edit" && (
                <span className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
              )}
              Simpan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Void Modal */}
      <Dialog open={voidTarget !== null} onOpenChange={(open) => { if (!open) setVoidTarget(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Ban className="h-5 w-5 text-destructive" />
              Batalkan Barang Masuk
            </DialogTitle>
            <DialogDescription>
              Apakah Anda yakin membatalkan barang masuk ini? Stok &amp; AVCO akan dikembalikan.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {voidTarget && (
              <div className="bg-muted/30 rounded-xl p-4 border border-border/50 space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Produk</span>
                  <span className="font-medium text-right">{voidTarget.produk?.nama_produk || "Produk dihapus"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Tanggal</span>
                  <span>{formatDate(voidTarget.tgl_masuk)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total</span>
                  <span className="font-semibold tabular-nums">{formatIDR(voidTarget.total_cost ?? voidTarget.total)}</span>
                </div>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="void-alasan">
                Alasan Pembatalan <span className="text-destructive">*</span>
              </Label>
              <textarea
                ref={voidReasonRef}
                id="void-alasan"
                rows={3}
                placeholder="Wajib diisi"
                value={voidReason}
                onChange={(e) => setVoidReason(e.target.value)}
                disabled={pendingAction === "void"}
                className="flex w-full rounded-[6px] border border-input bg-background px-3 py-2 text-sm shadow-xs transition-[color,box-shadow] outline-none placeholder:text-muted-foreground focus-visible:border-primary focus-visible:ring-[3px] focus-visible:ring-primary/20 disabled:pointer-events-none disabled:opacity-50"
              />
              <p className="text-[11px] text-muted-foreground">
                Contoh: salah jumlah, atau stok terlanjur dimasukkan ganda.
              </p>
            </div>
            {error && (
              <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg p-3">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {error}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              className="rounded-full px-6 bg-background"
              disabled={pendingAction === "void"}
              onClick={() => setVoidTarget(null)}
            >
              Batal
            </Button>
            <Button
              variant="destructive"
              className="rounded-full px-6"
              disabled={pendingAction === "void"}
              onClick={handleConfirmVoid}
            >
              {pendingAction === "void" && (
                <span className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
              )}
              Ya, Batalkan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}