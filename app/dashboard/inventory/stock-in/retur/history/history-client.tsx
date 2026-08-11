"use client";

import { useState, useMemo, useDeferredValue } from "react";
import { PackageX, ArrowLeftRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTable } from "@/hooks/use-table";
import DataTable, { type Column, type FilterDef } from "@/components/data-table";
import { Button } from "@/components/ui/button";
import { ExportDropdown } from "@/components/export-dropdown";
import { exportToCSV, exportToPDF } from "@/lib/export-utils";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface ReturHistoryRecord {
  id: string;
  no_retur: string;
  tgl_retur: string;
  total_nilai: number;
  keterangan: string | null;
  created_at: string;
  supplier: { id: number; nama_supplier: string } | null;
  pengguna: { id: number; nama: string | null; username: string | null } | null;
  barang_masuk: {
    id: number;
    no_surat: string | null;
    produk: { nama_produk: string } | null;
  } | null;
  jumlah_item: number;
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

function formatIDR(n: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
}

/* ------------------------------------------------------------------ */
/*  Main client component                                              */
/* ------------------------------------------------------------------ */

export default function ReturHistoryClient({
  history,
  suppliers,
}: {
  history: ReturHistoryRecord[];
  suppliers: Supplier[];
}) {
  const router = useRouter();

  const [searchQuery, setSearchQuery] = useState("");
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const [supplierFilter, setSupplierFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState({ start: "", end: "" });

  const filteredData = useMemo(() => {
    let result = [...history];

    if (deferredSearchQuery.trim()) {
      const q = deferredSearchQuery.toLowerCase();
      result = result.filter(
        (h) =>
          h.no_retur.toLowerCase().includes(q) ||
          (h.supplier?.nama_supplier ?? "").toLowerCase().includes(q) ||
          (h.barang_masuk?.produk?.nama_produk ?? "").toLowerCase().includes(q) ||
          (h.barang_masuk?.no_surat ?? "").toLowerCase().includes(q)
      );
    }

    if (supplierFilter !== "all") {
      result = result.filter((h) => h.supplier?.id.toString() === supplierFilter);
    }

    if (dateFilter.start) {
      const start = new Date(dateFilter.start);
      start.setHours(0, 0, 0, 0);
      result = result.filter((h) => new Date(h.tgl_retur) >= start);
    }
    if (dateFilter.end) {
      const end = new Date(dateFilter.end);
      end.setHours(23, 59, 59, 999);
      result = result.filter((h) => new Date(h.tgl_retur) <= end);
    }

    return result;
  }, [history, deferredSearchQuery, supplierFilter, dateFilter]);

  const table = useTable({ data: filteredData, defaultItemsPerPage: 25 });

  const totalNilai = useMemo(() => {
    return filteredData.reduce((sum, h) => sum + Number(h.total_nilai || 0), 0);
  }, [filteredData]);

  const handleExportCSV = () => {
    const headers = ["No. Retur", "Tanggal", "Supplier", "Barang Masuk", "No. Faktur", "Jumlah Item", "Total Nilai", "Operator", "Keterangan"];
    const rows = filteredData.map((h) => [
      h.no_retur,
      formatDate(h.tgl_retur),
      h.supplier?.nama_supplier || "Umum",
      h.barang_masuk?.produk?.nama_produk || "Produk dihapus",
      h.barang_masuk?.no_surat || "",
      h.jumlah_item,
      h.total_nilai,
      h.pengguna?.nama || h.pengguna?.username || "-",
      h.keterangan || "",
    ]);
    exportToCSV(`Riwayat_Retur_${new Date().toISOString().split("T")[0]}`, headers, rows);
  };

  const handleExportPDF = () => {
    const headers = ["No. Retur", "Tanggal", "Supplier", "Barang Masuk", "Jumlah Item", "Total Nilai", "Operator"];
    const rows = filteredData.map((h) => [
      h.no_retur,
      formatDate(h.tgl_retur),
      h.supplier?.nama_supplier || "Umum",
      h.barang_masuk?.produk?.nama_produk || "Produk dihapus",
      String(h.jumlah_item),
      formatIDR(h.total_nilai),
      h.pengguna?.nama || h.pengguna?.username || "-",
    ]);
    exportToPDF(`Riwayat_Retur_${new Date().toISOString().split("T")[0]}`, "Riwayat Retur Pembelian", headers, rows);
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
      onStartChange: (v) => setDateFilter((prev) => ({ ...prev, start: v })),
      onEndChange: (v) => setDateFilter((prev) => ({ ...prev, end: v })),
    },
  ];

  const columns: Column<ReturHistoryRecord>[] = [
    {
      key: "no_retur",
      header: "No. Retur",
      sortable: true,
      className: "pl-6",
      headerClassName: "pl-6 w-[150px]",
      render: (h) => (
        <span className="font-medium tabular-nums text-primary">
          {h.no_retur}
        </span>
      ),
    },
    {
      key: "tgl_retur",
      header: "Tanggal",
      sortable: true,
      headerClassName: "w-[120px]",
      render: (h) => formatDate(h.tgl_retur),
    },
    {
      key: "supplier",
      header: "Supplier",
      sortable: true,
      sortKey: "supplier.nama_supplier",
      render: (h) => h.supplier?.nama_supplier || "Umum",
    },
    {
      key: "barang_masuk",
      header: "Barang Masuk",
      sortable: true,
      sortKey: "barang_masuk.produk.nama_produk",
      render: (h) => (
        <span>
          {h.barang_masuk?.produk?.nama_produk || "Produk dihapus"}
          {h.barang_masuk?.no_surat && (
            <span className="block text-[11px] text-muted-foreground">
              {h.barang_masuk.no_surat}
            </span>
          )}
        </span>
      ),
    },
    {
      key: "jumlah_item",
      header: "Item",
      sortable: true,
      headerClassName: "w-[80px] text-center",
      className: "text-center",
      render: (h) => <span className="tabular-nums">{h.jumlah_item}</span>,
    },
    {
      key: "total_nilai",
      header: "Total Nilai",
      sortable: true,
      className: "pr-6",
      headerClassName: "w-[150px] text-right pr-6",
      render: (h) => (
        <span className="text-right tabular-nums font-medium">
          {formatIDR(h.total_nilai)}
        </span>
      ),
    },
    {
      key: "operator",
      header: "Operator",
      sortable: true,
      sortKey: "pengguna.nama",
      mobileHide: true,
      render: (h) => h.pengguna?.nama || h.pengguna?.username || "-",
    },
    {
      key: "keterangan",
      header: "Keterangan",
      mobileHide: true,
      render: (h) => h.keterangan || "-",
    },
  ];

  return (
    <DataTable
      data={table.paginatedData}
      total={table.total}
      columns={columns}
      rowKey={(h) => h.id}
      search={searchQuery}
      onSearchChange={setSearchQuery}
      searchPlaceholder="Cari No. Retur / produk / supplier..."
      sortConfig={table.sortConfig}
      onSort={table.handleSort}
      currentPage={table.currentPage}
      onPageChange={table.setCurrentPage}
      itemsPerPage={table.itemsPerPage}
      onItemsPerPageChange={table.setItemsPerPage}
      filters={filters}
      actions={[
        { label: "Reset", variant: "outline", onClick: () => { setSearchQuery(""); setSupplierFilter("all"); setDateFilter({ start: "", end: "" }); } },
        {
          label: "Buat Retur",
          customRender: () => (
            <Button
              variant="default"
              className="rounded-full px-6 h-10 bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm font-normal shrink-0 gap-2 flex-1 md:flex-none"
              onClick={() => router.push("/dashboard/inventory/stock-in/retur")}
            >
              <ArrowLeftRight className="w-4 h-4" />
              Buat Retur
            </Button>
          ),
        },
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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-muted/30 rounded-xl p-4 border border-border/50">
            <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-widest mb-1">Jumlah Retur</p>
            <p className="text-2xl font-light tracking-tight text-foreground tabular-nums">{filteredData.length}</p>
          </div>
          <div className="bg-muted/30 rounded-xl p-4 border border-border/50 col-span-1 md:col-span-2">
            <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-widest mb-1">Total Nilai Retur</p>
            <p className="text-2xl font-light tracking-tight text-foreground tabular-nums">{formatIDR(totalNilai)}</p>
          </div>
        </div>
      }
      emptyState={{
        icon: PackageX,
        title: "Belum ada riwayat retur",
        description: "Belum ada retur pembelian tercatat.",
      }}
    />
  );
}