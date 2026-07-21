"use client";

import { useState, useMemo, useEffect, useTransition, useDeferredValue } from "react";
import { Plus, Trash2, Database, Check, Loader2, Edit2, Download, X } from "lucide-react";
import { useTable } from "@/hooks/use-table";
import DataTable, { type Column, type DeleteModalConfig } from "@/components/data-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TableCell, TableRow } from "@/components/ui/table";
import { createReferenceData, updateReferenceData, deleteReferenceData } from "./actions";
import { exportToCSV, exportToPDF } from "@/lib/export-utils";

type ReferenceItem = { id: number; nama: string };
type TabType = "kategori" | "satuan" | "metode_bayar";

export function ReferenceClient({
  initialKategori,
  initialSatuan,
  initialMetodeBayar,
}: {
  initialKategori: ReferenceItem[];
  initialSatuan: ReferenceItem[];
  initialMetodeBayar: ReferenceItem[];
}) {
  const [activeTab, setActiveTab] = useState<TabType>("kategori");
  const [kategori, setKategori] = useState<ReferenceItem[]>(initialKategori);
  const [satuan, setSatuan] = useState<ReferenceItem[]>(initialSatuan);
  const [metodeBayar, setMetodeBayar] = useState<ReferenceItem[]>(initialMetodeBayar);

  const [searchQuery, setSearchQuery] = useState("");
  const deferredSearchQuery = useDeferredValue(searchQuery);

  const [isPending, startTransition] = useTransition();

  const [editingId, setEditingId] = useState<number | 'new' | null>(null);
  const [editForm, setEditForm] = useState<{ nama?: string }>({});

  const [deleteTarget, setDeleteTarget] = useState<ReferenceItem | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => { setKategori(initialKategori); }, [initialKategori]);
  useEffect(() => { setSatuan(initialSatuan); }, [initialSatuan]);
  useEffect(() => { setMetodeBayar(initialMetodeBayar); }, [initialMetodeBayar]);

  useEffect(() => {
    setSearchQuery("");
    setSortConfig(null);
  }, [activeTab]);

  const [sortConfig, setSortConfig] = useState<{ key: string; direction: "asc" | "desc" } | null>(null);

  const handleSaveInline = () => {
    if (!editForm.nama?.trim()) {
      setErrorMsg("Nama tidak boleh kosong");
      return;
    }
    setErrorMsg("");
    startTransition(async () => {
      const formData = new FormData();
      formData.append("nama", editForm.nama || "");

      let res;
      if (editingId === 'new') {
        res = await createReferenceData(activeTab, { success: false }, formData);
      } else {
        formData.append("id", String(editingId));
        res = await updateReferenceData(activeTab, { success: false }, formData);
      }

      if (res.error) {
        setErrorMsg(res.error);
      } else {
        const newItem = { id: editingId === 'new' ? Date.now() : (editingId as number), nama: editForm.nama! };
        const updater = (prev: ReferenceItem[]) =>
          editingId === 'new' ? [...prev, newItem] : prev.map(i => i.id === editingId ? newItem : i);
        if (activeTab === "kategori") setKategori(updater);
        else if (activeTab === "satuan") setSatuan(updater);
        else setMetodeBayar(updater);
        setEditingId(null);
        setEditForm({});
      }
    });
  };

  const handleCancelInline = () => {
    setEditingId(null);
    setEditForm({});
    setErrorMsg("");
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setErrorMsg("");
    startTransition(async () => {
      const res = await deleteReferenceData(activeTab, deleteTarget.id);
      if (res.error) {
        setErrorMsg(res.error);
      } else {
        const filterFn = (prev: ReferenceItem[]) => prev.filter((i) => i.id !== deleteTarget.id);
        if (activeTab === "kategori") setKategori(filterFn);
        else if (activeTab === "satuan") setSatuan(filterFn);
        else setMetodeBayar(filterFn);
        setDeleteTarget(null);
      }
    });
  };

  const getActiveData = () => {
    if (activeTab === "kategori") return kategori;
    if (activeTab === "satuan") return satuan;
    return metodeBayar;
  };

  const activeData = getActiveData();

  const filteredData = useMemo(() => {
    let result = [...activeData];
    if (deferredSearchQuery.trim()) {
      const q = deferredSearchQuery.toLowerCase();
      result = result.filter((i) => i.nama.toLowerCase().includes(q) || String(i.id).includes(q));
    }
    if (sortConfig) {
      result.sort((a, b) => {
        const aVal = (a as unknown as Record<string, unknown>)[sortConfig.key] ?? "";
        const bVal = (b as unknown as Record<string, unknown>)[sortConfig.key] ?? "";
        if (aVal < bVal) return sortConfig.direction === "asc" ? -1 : 1;
        if (aVal > bVal) return sortConfig.direction === "asc" ? 1 : -1;
        return 0;
      });
    }
    return result;
  }, [activeData, deferredSearchQuery, sortConfig]);

  const table = useTable({ data: filteredData, defaultItemsPerPage: 25 });

  const getTabLabel = (tab: TabType) => {
    if (tab === "kategori") return "Kategori Produk";
    if (tab === "satuan") return "Satuan Barang";
    return "Metode Pembayaran";
  };

  const handleExportCSV = () => {
    const headers = ["ID", "Nama"];
    const data = filteredData.map(item => [item.id, item.nama]);
    exportToCSV(`Data_${getTabLabel(activeTab).replace(" ", "_")}`, headers, data);
  };

  const handleExportPDF = () => {
    const headers = ["ID", "Nama"];
    const data = filteredData.map(item => [item.id, item.nama]);
    exportToPDF(`Data_${getTabLabel(activeTab).replace(" ", "_")}`, `Laporan ${getTabLabel(activeTab)}`, headers, data);
  };

  const columns: Column<ReferenceItem>[] = [
    { key: "id", header: "ID", sortable: true, className: "pl-6", headerClassName: "w-24 pl-6", render: (i) => <span className="text-muted-foreground tabular-nums">{i.id}</span> },
    { key: "nama", header: "Nama", sortable: true, render: (i) => <span className="font-medium">{i.nama}</span> },
    {
      key: "actions", header: "", className: "pr-6", headerClassName: "text-right pr-6 w-32",
      render: (item) => (
        <div className="flex justify-end gap-1">
          <Button variant="ghost" size="icon" aria-label="Edit data" className="h-11 w-11 md:h-8 md:w-8 text-muted-foreground hover:text-foreground"
            onClick={() => { setEditingId(item.id); setEditForm({ nama: item.nama }); setErrorMsg(""); }}
          >
            <Edit2 className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" aria-label="Hapus data" className="h-11 w-11 md:h-8 md:w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10" onClick={() => setDeleteTarget(item)}>
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      ),
    },
  ];

  const deleteModal: DeleteModalConfig | undefined = deleteTarget ? {
    open: true,
    title: `Hapus ${getTabLabel(activeTab)}?`,
    itemName: deleteTarget.nama,
    onConfirm: handleDeleteConfirm,
    onCancel: () => { setDeleteTarget(null); setErrorMsg(""); },
    isPending,
    error: errorMsg,
  } : undefined;

  return (
    <div className="flex-1 flex flex-col min-h-0 gap-6">
      {/* Tabs */}
      <div className="shrink-0 flex space-x-1 bg-muted/50 p-1 rounded-[12px] overflow-x-auto custom-scrollbar">
        {(["kategori", "satuan", "metode_bayar"] as TabType[]).map((tab) => (
          <button
            key={tab}
            onClick={() => { setActiveTab(tab); setEditingId(null); setEditForm({}); setErrorMsg(""); }}
            className={`flex-1 min-w-[150px] px-4 py-2.5 text-sm font-medium rounded-[8px] transition-colors ${
              activeTab === tab
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:bg-background/50 hover:text-foreground"
            }`}
          >
            {getTabLabel(tab)}
          </button>
        ))}
      </div>

      <DataTable
        data={table.paginatedData}
        total={table.total}
        columns={columns}
        rowKey={(i) => i.id}
        search={searchQuery}
        onSearchChange={(v) => { setSearchQuery(v); }}
        searchPlaceholder={`Cari ${getTabLabel(activeTab).toLowerCase()}...`}
        sortConfig={sortConfig}
        onSort={(key) => {
          let direction: "asc" | "desc" = "asc";
          if (sortConfig && sortConfig.key === key && sortConfig.direction === "asc") {
            direction = "desc";
          }
          setSortConfig({ key, direction });
          table.setCurrentPage(1);
        }}
        currentPage={table.currentPage}
        onPageChange={table.setCurrentPage}
        itemsPerPage={table.itemsPerPage}
        onItemsPerPageChange={table.setItemsPerPage}
        editingId={editingId as number | "new" | null}
        renderEditRow={(c) => {
          const isNew = c === null;
          return (
            <TableRow className="bg-muted/30">
              <TableCell className="pl-6 align-middle py-4 text-muted-foreground text-sm italic">
                {isNew ? "(Otomatis)" : c?.id}
              </TableCell>
              <TableCell className="align-middle py-4">
                <Input autoFocus aria-label="Nama" placeholder="Nama..."
                  value={editForm.nama || ""}
                  onChange={(e) => setEditForm(prev => ({ ...prev, nama: e.target.value }))}
                  className="h-8"
                />
                {errorMsg && <p className="text-[11px] text-destructive mt-1">{errorMsg}</p>}
              </TableCell>
              <TableCell className="pr-6 align-middle py-4 text-right">
                <div className="flex justify-end gap-1">
                  <Button variant="ghost" size="icon" aria-label="Batal Edit" className="h-11 w-11 md:h-8 md:w-8 text-muted-foreground hover:text-foreground" onClick={handleCancelInline} disabled={isPending}>
                    <X className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" aria-label="Simpan Edit" className="h-11 w-11 md:h-8 md:w-8 text-primary hover:text-primary hover:bg-primary/10" onClick={handleSaveInline} disabled={isPending}>
                    {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          );
        }}
        actions={[
          { label: "CSV", icon: <Download className="w-4 h-4" />, variant: "outline", onClick: handleExportCSV },
          { label: "PDF", icon: <Download className="w-4 h-4" />, variant: "outline", onClick: handleExportPDF },
          {
            label: "Tambah Data",
            icon: <Plus className="w-4 h-4" />,
            kind: "primary",
            onClick: () => { setEditingId("new"); setEditForm({}); setErrorMsg(""); },
            disabled: editingId !== null,
          },
        ]}
        errorBanner={errorMsg && editingId === 'new' ? errorMsg : null}
        deleteModal={deleteModal}
        emptyState={{
          icon: Database,
          title: "Tidak ada data ditemukan",
          description: "Coba gunakan kata kunci pencarian yang lain.",
        }}
      />
    </div>
  );
}
