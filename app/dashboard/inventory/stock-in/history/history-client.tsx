"use client";

import { useState, useMemo, useDeferredValue } from "react";
import { PackagePlus, Download } from "lucide-react";
import { useTable } from "@/hooks/use-table";
import DataTable, { type Column, type FilterDef } from "@/components/data-table";
import { exportToCSV, exportToPDF } from "@/lib/export-utils";

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

interface StockInHistoryRecord {
  id: number;
  tgl_masuk: string;
  supplier: { id: number; nama_supplier: string } | null;
  produk: { nama_produk: string } | null;
  harga_beli: number;
  jumlah: number;
  total: number;
  keterangan?: string;
  supplied_unit: string | null;
  supplied_qty: number | null;
  applied_conversion_ratio: number | null;
  base_qty_added: number | null;
  total_cost: number | null;
  base_cost_per_piece: number | null;
}

interface SupplierRecord {
  id: number;
  nama_supplier: string;
}

export default function StockInHistoryClient({
  initialHistory,
  suppliers
}: {
  initialHistory: StockInHistoryRecord[];
  suppliers: SupplierRecord[];
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const [supplierFilter, setSupplierFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState({ start: "", end: "" });

  const filteredData = useMemo(() => {
    let result = [...initialHistory];

    if (deferredSearchQuery.trim()) {
      const q = deferredSearchQuery.toLowerCase();
      result = result.filter(
        (h) => h.produk?.nama_produk.toLowerCase().includes(q)
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

  const totalValue = useMemo(() => {
    return filteredData.reduce((sum, h) => sum + Number(h.total_cost || h.total), 0);
  }, [filteredData]);

  const handleExportCSV = () => {
    const headers = ["Tanggal", "Supplier", "Produk", "Satuan Suplai", "Qty Suplai", "Rasio", "Base Qty", "HPP/Pcs", "Total Biaya", "Keterangan"];
    const rows = filteredData.map(h => [
      formatDate(h.tgl_masuk),
      h.supplier?.nama_supplier || "Umum",
      h.produk?.nama_produk || "Produk dihapus",
      h.supplied_unit || "-",
      h.supplied_qty ?? "-",
      h.applied_conversion_ratio ?? "-",
      h.base_qty_added ?? h.jumlah,
      h.base_cost_per_piece ?? h.harga_beli,
      h.total_cost ?? h.total,
      h.keterangan || "",
    ]);
    exportToCSV(`Riwayat_Stok_Masuk_${new Date().toISOString().split("T")[0]}`, headers, rows);
  };

  const handleExportPDF = () => {
    const headers = ["Tanggal", "Supplier", "Produk", "Base Qty", "HPP/Pcs", "Total Biaya"];
    const rows = filteredData.map(h => [
      formatDate(h.tgl_masuk),
      h.supplier?.nama_supplier || "Umum",
      h.produk?.nama_produk || "Produk dihapus",
      String(h.base_qty_added ?? h.jumlah),
      formatIDR(h.base_cost_per_piece ?? h.harga_beli),
      formatIDR(h.total_cost ?? h.total),
    ]);
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

  const columns: Column<StockInHistoryRecord>[] = [
    { key: "tgl_masuk", header: "Tanggal", sortable: true, className: "pl-6", headerClassName: "pl-6 w-[120px]", render: (h) => formatDate(h.tgl_masuk) },
    { key: "supplier", header: "Supplier", sortable: true, sortKey: "nama_supplier", render: (h) => h.supplier?.nama_supplier || "Umum" },
    { key: "produk", header: "Produk", sortable: true, sortKey: "nama_produk", render: (h) => h.produk?.nama_produk || "Produk dihapus" },
    {
      key: "suplai", header: "Suplai", headerClassName: "w-[100px] text-center",
      render: (h) => {
        const isUom = h.supplied_qty != null;
        return <span className="text-center text-sm">{isUom ? `${h.supplied_qty} ${h.supplied_unit}` : `${h.jumlah} pcs`}</span>;
      },
    },
    {
      key: "rasio", header: "Rasio", headerClassName: "w-[80px] text-center",
      render: (h) => {
        const isUom = h.supplied_qty != null;
        return <span className="text-center text-sm text-muted-foreground">{isUom ? `1:${h.applied_conversion_ratio}` : "-"}</span>;
      },
    },
    { key: "base_qty", header: "Base Qty", headerClassName: "w-[100px] text-right", render: (h) => <span className="tabular-nums">{h.base_qty_added ?? h.jumlah}</span> },
    { key: "harga_beli", header: "HPP/Pcs", sortable: true, headerClassName: "w-[120px] text-right", render: (h) => <span className="tabular-nums">{formatIDR(h.base_cost_per_piece ?? h.harga_beli)}</span> },
    { key: "total", header: "Total", sortable: true, className: "pr-6", headerClassName: "w-[140px] text-right pr-6", render: (h) => <span className="tabular-nums">{formatIDR(h.total_cost ?? h.total)}</span> },
  ];

  return (
    <DataTable
      data={table.paginatedData}
      total={table.total}
      columns={columns}
      rowKey={(h) => h.id}
      search={searchQuery}
      onSearchChange={setSearchQuery}
      searchPlaceholder="Cari produk..."
      sortConfig={table.sortConfig}
      onSort={table.handleSort}
      currentPage={table.currentPage}
      onPageChange={table.setCurrentPage}
      itemsPerPage={table.itemsPerPage}
      onItemsPerPageChange={table.setItemsPerPage}
      filters={filters}
      actions={[
        { label: "Reset", variant: "outline", onClick: () => { setSearchQuery(""); setSupplierFilter("all"); setDateFilter({ start: "", end: "" }); } },
        { label: "CSV", icon: <Download className="w-4 h-4" />, variant: "outline", onClick: handleExportCSV },
        { label: "PDF", icon: <Download className="w-4 h-4" />, variant: "outline", onClick: handleExportPDF },
      ]}
      topContent={
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-muted/30 rounded-xl p-4 border border-border/50">
            <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-widest mb-1">Total Nilai Pembelian</p>
            <p className="text-2xl font-light tracking-tight text-foreground tabular-nums">{formatIDR(totalValue)}</p>
          </div>
          <div className="bg-muted/30 rounded-xl p-4 border border-border/50">
            <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-widest mb-1">Jumlah Catatan</p>
            <p className="text-2xl font-light tracking-tight text-foreground tabular-nums">{filteredData.length}</p>
          </div>
        </div>
      }
      emptyState={{
        icon: PackagePlus,
        title: "Tidak ada riwayat barang masuk ditemukan",
        description: "Coba gunakan kata kunci pencarian atau filter yang lain.",
      }}
    />
  );
}
