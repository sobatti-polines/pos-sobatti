"use client";

import { useState, useMemo, useDeferredValue } from "react";
import { ClipboardList, Download } from "lucide-react";
import { useTable } from "@/hooks/use-table";
import DataTable, { type Column, type FilterDef } from "@/components/data-table";
import { exportToCSV, exportToPDF } from "@/lib/export-utils";

function formatDate(dateStr: string) {
  const date = new Date(dateStr);
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

interface OpnameRecord {
  id: number;
  tgl_opname: string;
  produk: { nama_produk: string } | null;
  stok_sistem: number;
  stok_fisik: number;
  selisih: number;
  keterangan: string | null;
}

export default function OpnameHistoryClient({ initialHistory }: { initialHistory: OpnameRecord[] }) {
  const [searchQuery, setSearchQuery] = useState("");
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const [dateFilter, setDateFilter] = useState({ start: "", end: "" });

  const filteredData = useMemo(() => {
    let result = [...initialHistory];

    if (deferredSearchQuery.trim()) {
      const q = deferredSearchQuery.toLowerCase();
      result = result.filter(
        (h) => h.produk?.nama_produk.toLowerCase().includes(q) || h.keterangan?.toLowerCase().includes(q)
      );
    }

    if (dateFilter.start) {
      const start = new Date(dateFilter.start);
      start.setHours(0, 0, 0, 0);
      result = result.filter((h) => new Date(h.tgl_opname) >= start);
    }
    if (dateFilter.end) {
      const end = new Date(dateFilter.end);
      end.setHours(23, 59, 59, 999);
      result = result.filter((h) => new Date(h.tgl_opname) <= end);
    }

    return result;
  }, [initialHistory, deferredSearchQuery, dateFilter]);

  const table = useTable({ data: filteredData, defaultItemsPerPage: 15 });

  const handleExportCSV = () => {
    const headers = ["Tanggal", "Produk", "Stok Sistem", "Stok Fisik", "Selisih", "Keterangan"];
    const rows = filteredData.map(h => [
      formatDate(h.tgl_opname),
      h.produk?.nama_produk || "Produk dihapus",
      h.stok_sistem,
      h.stok_fisik,
      h.selisih > 0 ? `+${h.selisih}` : h.selisih,
      h.keterangan || "-"
    ]);
    exportToCSV(`Riwayat_Stok_Opname_${new Date().toISOString().split("T")[0]}`, headers, rows);
  };

  const handleExportPDF = () => {
    const headers = ["Tanggal", "Produk", "Stok Sistem", "Stok Fisik", "Selisih", "Keterangan"];
    const rows = filteredData.map(h => [
      formatDate(h.tgl_opname),
      h.produk?.nama_produk || "Produk dihapus",
      h.stok_sistem,
      h.stok_fisik,
      h.selisih > 0 ? `+${h.selisih}` : h.selisih,
      h.keterangan || "-"
    ]);
    exportToPDF(`Riwayat_Stok_Opname_${new Date().toISOString().split("T")[0]}`, "Riwayat Stok Opname", headers, rows);
  };

  const filters: FilterDef[] = [
    {
      type: "date-range",
      start: dateFilter.start,
      end: dateFilter.end,
      onStartChange: (v) => setDateFilter(prev => ({ ...prev, start: v })),
      onEndChange: (v) => setDateFilter(prev => ({ ...prev, end: v })),
    },
  ];

  const columns: Column<OpnameRecord>[] = [
    { key: "tgl_opname", header: "Tanggal", className: "pl-6 md:pl-6", headerClassName: "pl-6 md:pl-6", render: (h) => formatDate(h.tgl_opname) },
    { key: "produk", header: "Produk", render: (h) => h.produk?.nama_produk || "Produk dihapus" },
    { key: "stok_sistem", header: "Stok Sistem", align: "center", headerClassName: "text-center" },
    { key: "stok_fisik", header: "Stok Fisik", align: "center", headerClassName: "text-center" },
    {
      key: "selisih", header: "Selisih", align: "center", headerClassName: "text-center",
      render: (h) => (
        <span className={`tabular-nums font-semibold px-2 py-0.5 rounded-full text-[12px] ${
          h.selisih > 0 ? "bg-success/10 text-success" : h.selisih < 0 ? "bg-destructive/10 text-destructive" : "bg-muted text-muted-foreground"
        }`}>
          {h.selisih > 0 ? `+${h.selisih}` : h.selisih}
        </span>
      ),
    },
    { key: "keterangan", header: "Keterangan", render: (h) => <span className="italic">{h.keterangan || "-"}</span> },
  ];

  return (
    <DataTable
      data={table.paginatedData}
      total={table.total}
      columns={columns}
      rowKey={(h) => h.id}
      search={searchQuery}
      onSearchChange={setSearchQuery}
      searchPlaceholder="Cari produk atau keterangan..."
      sortConfig={table.sortConfig}
      onSort={table.handleSort}
      currentPage={table.currentPage}
      onPageChange={table.setCurrentPage}
      itemsPerPage={table.itemsPerPage}
      onItemsPerPageChange={table.setItemsPerPage}
      filters={filters}
      actions={[
        { label: "Reset", variant: "outline", onClick: () => { setSearchQuery(""); setDateFilter({ start: "", end: "" }); } },
        { label: "CSV", icon: <Download className="w-4 h-4" />, variant: "outline", onClick: handleExportCSV },
        { label: "PDF", icon: <Download className="w-4 h-4" />, variant: "outline", onClick: handleExportPDF },
      ]}
      emptyState={{
        icon: ClipboardList,
        title: "Tidak ada data opname ditemukan",
        description: "Coba gunakan kata kunci pencarian atau filter yang lain.",
      }}
    />
  );
}
