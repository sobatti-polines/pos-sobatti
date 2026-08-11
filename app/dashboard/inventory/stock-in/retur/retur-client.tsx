"use client";

import { useState, useMemo, useDeferredValue, useTransition, useRef } from "react";
import { PackageX, ArrowLeftRight, AlertCircle, Check, Loader2 } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTable } from "@/hooks/use-table";
import DataTable, { type Column, type FilterDef } from "@/components/data-table";
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
import { createReturPembelian } from "../actions";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface ReturRecord {
  id: number;
  tgl_masuk: string;
  no_surat: string | null;
  supplied_unit: string | null;
  supplied_qty: number | null;
  applied_conversion_ratio: number | null;
  base_qty_added: number;
  supplier: { id: number; nama_supplier: string } | null;
  produk: {
    id: number;
    nama_produk: string;
    sku: string | null;
    conversion_ratio: number;
    default_purchase_unit: string | null;
    stok_gudang: number;
    satuan: { nama: string } | null;
  } | null;
}

interface Supplier {
  id: number;
  nama_supplier: string;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function formatDate(dateStr: string) {
  if (!dateStr) return "-";
  const d = new Date(dateStr);
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(d);
}

/* ------------------------------------------------------------------ */
/*  Main client component                                              */
/* ------------------------------------------------------------------ */

export default function ReturClient({
  records,
  suppliers,
}: {
  records: ReturRecord[];
  suppliers: Supplier[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [searchQuery, setSearchQuery] = useState(searchParams.get("q") ?? "");
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const [supplierFilter, setSupplierFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState({ start: "", end: "" });

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const [returTarget, setReturTarget] = useState<ReturRecord | null>(null);
  const [qtyRetur, setQtyRetur] = useState("");
  const [returKeterangan, setReturKeterangan] = useState("");
  const qtyRef = useRef<HTMLInputElement>(null);

  const filteredData = useMemo(() => {
    let result = [...records];

    if (deferredSearchQuery.trim()) {
      const q = deferredSearchQuery.toLowerCase();
      result = result.filter(
        (r) =>
          r.produk?.nama_produk.toLowerCase().includes(q) ||
          (r.no_surat ?? "").toLowerCase().includes(q) ||
          (r.supplier?.nama_supplier ?? "").toLowerCase().includes(q)
      );
    }

    if (supplierFilter !== "all") {
      result = result.filter((r) => r.supplier?.id.toString() === supplierFilter);
    }

    if (dateFilter.start) {
      const start = new Date(dateFilter.start);
      start.setHours(0, 0, 0, 0);
      result = result.filter((r) => new Date(r.tgl_masuk) >= start);
    }
    if (dateFilter.end) {
      const end = new Date(dateFilter.end);
      end.setHours(23, 59, 59, 999);
      result = result.filter((r) => new Date(r.tgl_masuk) <= end);
    }

    return result;
  }, [records, deferredSearchQuery, supplierFilter, dateFilter]);

  const table = useTable({ data: filteredData, defaultItemsPerPage: 25 });

  const maxQtyFor = (r: ReturRecord) => {
    const qtyShared = Number(r.base_qty_added || 0);
    const stokGudang = Number(r.produk?.stok_gudang || 0);
    if (qtyShared > 0) return Math.max(0, Math.min(qtyShared, stokGudang));
    return stokGudang;
  };

  const openRetur = (r: ReturRecord) => {
    setError(null);
    setReturKeterangan("");
    const maxQty = maxQtyFor(r);
    setQtyRetur(maxQty > 0 ? String(maxQty) : "");
    setReturTarget(r);
    setTimeout(() => qtyRef.current?.focus(), 50);
  };

  const handleSubmit = () => {
    if (!returTarget) return;
    const qty = Number(qtyRetur);
    if (!qtyRetur || isNaN(qty) || qty <= 0) {
      setError("Qty retur harus lebih dari 0.");
      qtyRef.current?.focus();
      return;
    }
    const maxQty = maxQtyFor(returTarget);
    if (qty > maxQty) {
      setError(`Qty retur melebihi batas maksimal (${maxQty} ${returTarget.produk?.satuan?.nama || "pcs"}).`);
      return;
    }

    setError(null);
    startTransition(async () => {
      const res = await createReturPembelian({
        id_barang_masuk: returTarget.id,
        items: [
          {
            id_produk: returTarget.produk!.id,
            qty_retur: qty,
            keterangan: returKeterangan.trim() || undefined,
          },
        ],
      });

      if (res.error) {
        setError(res.error);
        return;
      }

      setReturTarget(null);
      setQtyRetur("");
      setReturKeterangan("");
      const noRetur = (res as { no_retur?: string }).no_retur;
      setSuccess(`Retur berhasil dibuat${noRetur ? ` (${noRetur})` : ""}`);
      router.refresh();
      setTimeout(() => setSuccess(null), 5000);
    });
  };

  /* ------------------------------------------------------------------ */
  /*  Columns                                                           */
  /* ------------------------------------------------------------------ */

  const columns: Column<ReturRecord>[] = [
    {
      key: "tgl_masuk",
      header: "Tanggal",
      sortable: true,
      className: "pl-6",
      headerClassName: "pl-6 w-[120px]",
      render: (r) => formatDate(r.tgl_masuk),
    },
    {
      key: "no_surat",
      header: "No. Faktur",
      sortable: true,
      mobileHide: true,
      render: (r) => r.no_surat || "-",
    },
    {
      key: "supplier",
      header: "Supplier",
      sortable: true,
      sortKey: "supplier.nama_supplier",
      render: (r) => r.supplier?.nama_supplier || "Umum",
    },
    {
      key: "produk",
      header: "Produk",
      sortable: true,
      sortKey: "produk.nama_produk",
      render: (r) => r.produk?.nama_produk || "Produk dihapus",
    },
    {
      key: "diterima",
      header: "Qty Diterima",
      headerClassName: "w-[120px] text-right",
      render: (r) => {
        const satuan = r.produk?.satuan?.nama || "pcs";
        return (
          <span className="tabular-nums">
            {r.supplied_qty != null
              ? `${r.supplied_qty} ${r.supplied_unit || satuan}`
              : `${r.base_qty_added} ${satuan}`}
          </span>
        );
      },
    },
    {
      key: "base_qty",
      header: "Qty Base",
      sortable: true,
      sortKey: "base_qty_added",
      headerClassName: "w-[100px] text-right",
      render: (r) => (
        <span className="tabular-nums">
          {r.base_qty_added} {r.produk?.satuan?.nama || "pcs"}
        </span>
      ),
    },
    {
      key: "stok_gudang",
      header: "Stok Gudang",
      sortable: true,
      sortKey: "produk.stok_gudang",
      headerClassName: "w-[110px] text-right",
      render: (r) => (
        <span className="tabular-nums">
          {r.produk ? r.produk.stok_gudang : "-"}
        </span>
      ),
    },
    {
      key: "aksi",
      header: "",
      headerClassName: "w-[120px] pr-6",
      className: "pr-6",
      render: (r) => {
        const cantRetur = !r.produk || Number(r.produk.stok_gudang || 0) <= 0;
        return (
          <div className="flex justify-end">
            <Button
              variant="outline"
              size="sm"
              className="rounded-full h-8 px-4 gap-1.5"
              disabled={cantRetur || isPending || r.base_qty_added <= 0}
              title={
                cantRetur
                  ? "Stok gudang habis — retur tidak bisa dibuat"
                  : "Buat retur"
              }
              onClick={() => openRetur(r)}
            >
              <ArrowLeftRight className="w-3.5 h-3.5" />
              Retur
            </Button>
          </div>
        );
      },
    },
  ];

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
      onStartChange: (v) => setDateFilter((prev) => ({ ...prev, start: v })),
      onEndChange: (v) => setDateFilter((prev) => ({ ...prev, end: v })),
    },
  ];

  return (
    <>
      <DataTable
        data={table.paginatedData}
        total={table.total}
        columns={columns}
        rowKey={(r) => r.id}
        search={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder="Cari produk / No. Faktur / supplier..."
        sortConfig={table.sortConfig}
        onSort={table.handleSort}
        currentPage={table.currentPage}
        onPageChange={table.setCurrentPage}
        itemsPerPage={table.itemsPerPage}
        onItemsPerPageChange={table.setItemsPerPage}
        filters={filters}
        errorBanner={success}
        actions={[
          { label: "Reset", variant: "outline", onClick: () => { setSearchQuery(""); setSupplierFilter("all"); setDateFilter({ start: "", end: "" }); } },
          {
            label: "Riwayat Retur",
            variant: "outline",
            customRender: () => (
              <Button
                variant="outline"
                className="rounded-full px-4 h-10 gap-2 flex-1 md:flex-none"
                onClick={() => router.push("/dashboard/inventory/stock-in/retur/history")}
              >
                Riwayat Retur
              </Button>
            ),
          },
        ]}
        topContent={
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-muted/30 rounded-xl p-4 border border-border/50">
              <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-widest mb-1">Catatan Masuk Aktif</p>
              <p className="text-2xl font-light tracking-tight text-foreground tabular-nums">{filteredData.length}</p>
            </div>
            <div className="bg-muted/30 rounded-xl p-4 border border-border/50 md:col-span-2">
              <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-widest mb-1">Catatan</p>
              <p className="text-sm text-foreground/80">
                Retur mengurangi dari <strong className="font-medium">stok gudang</strong> dan merekalkulasi harga pokok (AVCO).
                Qty retur dibatasi oleh qty yang diterima &amp; stok gudang saat ini.
              </p>
            </div>
          </div>
        }
        emptyState={{
          icon: PackageX,
          title: "Tidak ada barang masuk aktif ditemukan",
          description: "Tidak ada catatan barang masuk AKTIF yang bisa di-retur.",
        }}
      />

      {/* Dialog retur */}
      <Dialog open={returTarget !== null} onOpenChange={(open) => { if (!open && !isPending) setReturTarget(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowLeftRight className="h-5 w-5 text-primary" />
              Buat Retur Pembelian
            </DialogTitle>
            <DialogDescription>
              Kembalikan barang ke supplier. Stok gudang &amp; harga pokok (AVCO) akan diperbarui.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {returTarget && (
              <div className="bg-muted/30 rounded-xl p-4 border border-border/50 space-y-1.5 text-sm">
                <div className="flex justify-between gap-3">
                  <span className="text-muted-foreground shrink-0">Produk</span>
                  <span className="font-medium text-right">{returTarget.produk?.nama_produk || "Produk dihapus"}</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-muted-foreground shrink-0">Supplier</span>
                  <span>{returTarget.supplier?.nama_supplier || "Umum"}</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-muted-foreground shrink-0">Tanggal</span>
                  <span>{formatDate(returTarget.tgl_masuk)}</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-muted-foreground shrink-0">Qty Diterima (base)</span>
                  <span className="tabular-nums">{returTarget.base_qty_added} {returTarget.produk?.satuan?.nama || "pcs"}</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-muted-foreground shrink-0">Stok Gudang</span>
                  <span className="tabular-nums">{returTarget.produk?.stok_gudang ?? 0} {returTarget.produk?.satuan?.nama || "pcs"}</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-muted-foreground shrink-0">Maks. Retur</span>
                  <span className="font-semibold tabular-nums">{maxQtyFor(returTarget)} {returTarget.produk?.satuan?.nama || "pcs"}</span>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="qty-retur">
                Qty Retur <span className="text-destructive">*</span>
                <span className="text-muted-foreground font-normal normal-case ml-1">
                  (satuan base: {returTarget?.produk?.satuan?.nama || "pcs"})
                </span>
              </Label>
              <Input
                ref={qtyRef}
                id="qty-retur"
                type="number"
                min={0}
                step="any"
                disabled={isPending}
                value={qtyRetur}
                onChange={(e) => setQtyRetur(e.target.value)}
                className="h-9 tabular-nums font-medium"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="retur-ket">Keterangan Retur</Label>
              <textarea
                id="retur-ket"
                rows={2}
                placeholder="Opsional — contoh: rusak, salah kirim, kelebihan qty"
                value={returKeterangan}
                onChange={(e) => setReturKeterangan(e.target.value)}
                disabled={isPending}
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
              disabled={isPending}
              onClick={() => setReturTarget(null)}
            >
              Batal
            </Button>
            <Button
              className="rounded-full px-6"
              disabled={isPending}
              onClick={handleSubmit}
            >
              {isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Menyimpan...
                </>
              ) : (
                "Simpan Retur"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Success toast */}
      {success && !returTarget && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 bg-emerald-600 text-white text-sm rounded-full shadow-lg">
          <Check className="w-4 h-4 shrink-0" />
          {success}
        </div>
      )}
    </>
  );
}