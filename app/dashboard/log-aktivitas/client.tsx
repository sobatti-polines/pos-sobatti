"use client";

import { useState, useMemo, useDeferredValue } from "react";
import { History } from "lucide-react";
import { useTable } from "@/hooks/use-table";
import DataTable, { type Column, type FilterDef } from "@/components/data-table";

function formatDateTime(dateStr: string) {
  const date = new Date(dateStr);
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

interface LogRecord {
  id: string;
  aksi: string;
  entitas: string;
  id_entitas: number | null;
  deskripsi: string;
  data_lama: unknown;
  data_baru: unknown;
  created_at: string;
  id_pengguna: number;
  pengguna: { nama: string; username: string; level: string } | null;
}

export default function LogClient({
  initialLogs,
}: {
  initialLogs: LogRecord[];
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const [filterEntitas, setFilterEntitas] = useState("");
  const [filterAksi, setFilterAksi] = useState("");
  const [dateFilter, setDateFilter] = useState({ start: "", end: "" });

  const filteredData = useMemo(() => {
    let result = [...initialLogs];

    if (deferredSearchQuery.trim()) {
      const q = deferredSearchQuery.toLowerCase();
      result = result.filter(
        (h) =>
          h.deskripsi.toLowerCase().includes(q) ||
          h.entitas.toLowerCase().includes(q) ||
          h.pengguna?.nama.toLowerCase().includes(q) ||
          h.pengguna?.username.toLowerCase().includes(q)
      );
    }

    if (filterEntitas) {
      result = result.filter((h) => h.entitas === filterEntitas);
    }

    if (filterAksi) {
      result = result.filter((h) => h.aksi === filterAksi);
    }

    if (dateFilter.start) {
      const start = new Date(dateFilter.start);
      start.setHours(0, 0, 0, 0);
      result = result.filter((h) => new Date(h.created_at) >= start);
    }
    if (dateFilter.end) {
      const end = new Date(dateFilter.end);
      end.setHours(23, 59, 59, 999);
      result = result.filter((h) => new Date(h.created_at) <= end);
    }

    return result;
  }, [initialLogs, deferredSearchQuery, filterEntitas, filterAksi, dateFilter]);

  // Collect unique entities for filter
  const entitasOptions = useMemo(() => {
    const set = new Set(initialLogs.map((h) => h.entitas));
    return Array.from(set).sort();
  }, [initialLogs]);

  const table = useTable({ data: filteredData, defaultItemsPerPage: 25 });

  const filters: FilterDef[] = [
    {
      type: "select",
      label: "Entitas",
      value: filterEntitas,
      onChange: setFilterEntitas,
      options: entitasOptions.map((e) => ({ value: e, label: e })),
    },
    {
      type: "select",
      label: "Aksi",
      value: filterAksi,
      onChange: setFilterAksi,
      options: [
        { value: "CREATE", label: "CREATE" },
        { value: "UPDATE", label: "UPDATE" },
        { value: "DELETE", label: "DELETE" },
      ],
    },
    {
      type: "date-range",
      start: dateFilter.start,
      end: dateFilter.end,
      onStartChange: (v) => setDateFilter((prev) => ({ ...prev, start: v })),
      onEndChange: (v) => setDateFilter((prev) => ({ ...prev, end: v })),
    },
  ];

  const columns: Column<LogRecord>[] = [
    {
      key: "created_at",
      header: "Waktu",
      sortable: true,
      className: "pl-6 md:pl-6",
      headerClassName: "pl-6 md:pl-6",
      render: (h) => formatDateTime(h.created_at),
    },
    {
      key: "pengguna",
      header: "Pengguna",
      sortable: true,
      sortKey: "pengguna.nama",
      render: (h) =>
        h.pengguna?.nama || h.pengguna?.username || `User #${h.id_pengguna}`,
    },
    {
      key: "aksi",
      header: "Aksi",
      align: "center",
      headerClassName: "text-center",
      render: (h) => (
        <span
          className={`tabular-nums font-semibold px-2 py-0.5 rounded-full text-[12px] ${
            h.aksi === "CREATE"
              ? "bg-emerald-50 text-emerald-600"
              : h.aksi === "UPDATE"
              ? "bg-blue-50 text-blue-600"
              : "bg-destructive/10 text-destructive"
          }`}
        >
          {h.aksi}
        </span>
      ),
    },
    {
      key: "entitas",
      header: "Entitas",
      sortable: true,
      align: "center",
      headerClassName: "text-center",
      render: (h) => (
        <span className="text-[11px] font-mono text-muted-foreground bg-muted/60 px-1.5 py-0.5 rounded">
          {h.entitas}
        </span>
      ),
    },
    {
      key: "deskripsi",
      header: "Deskripsi",
      sortable: true,
      render: (h) => h.deskripsi,
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
      searchPlaceholder="Cari deskripsi, entitas, atau pengguna..."
      sortConfig={table.sortConfig}
      onSort={table.handleSort}
      currentPage={table.currentPage}
      onPageChange={table.setCurrentPage}
      itemsPerPage={table.itemsPerPage}
      onItemsPerPageChange={table.setItemsPerPage}
      filters={filters}
      actions={[
        {
          label: "Reset",
          variant: "outline",
          onClick: () => {
            setSearchQuery("");
            setFilterEntitas("");
            setFilterAksi("");
            setDateFilter({ start: "", end: "" });
          },
        },
      ]}
      emptyState={{
        icon: History,
        title: "Tidak ada log ditemukan",
        description:
          "Coba gunakan kata kunci pencarian atau filter yang lain.",
      }}
    />
  );
}
