"use client";

import { useState, useMemo, useEffect, useTransition, useDeferredValue } from "react";
import { Plus, Trash2, Database, Check, Loader2, Edit2, X, Upload } from "lucide-react";
import { useTable } from "@/hooks/use-table";
import DataTable, { type Column, type DeleteModalConfig } from "@/components/data-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TableCell } from "@/components/ui/table";
import { createReferenceData, updateReferenceData, deleteReferenceData, importReferenceData } from "./actions";
import { exportToCSV, exportToPDF } from "@/lib/export-utils";
import ImportCSVModal from "@/components/import-csv-modal";
import { ExportDropdown } from "@/components/export-dropdown";

type ReferenceItem = { id: number; nama: string; kode?: string };
type TabType = "kategori" | "satuan" | "merk" | "metode_bayar" | "lokasi_area";

export function ReferenceClient({
  initialKategori,
  initialSatuan,
  initialMerk,
  initialMetodeBayar,
  initialLokasiArea,
}: {
  initialKategori: ReferenceItem[];
  initialSatuan: ReferenceItem[];
  initialMerk: ReferenceItem[];
  initialMetodeBayar: ReferenceItem[];
  initialLokasiArea: ReferenceItem[];
}) {
  const [activeTab, setActiveTab] = useState<TabType>("kategori");
  const [kategori, setKategori] = useState<ReferenceItem[]>(initialKategori);
  const [satuan, setSatuan] = useState<ReferenceItem[]>(initialSatuan);
  const [merk, setMerk] = useState<ReferenceItem[]>(initialMerk);
  const [metodeBayar, setMetodeBayar] = useState<ReferenceItem[]>(initialMetodeBayar);
  const [lokasiArea, setLokasiArea] = useState<ReferenceItem[]>(initialLokasiArea);

  const [searchQuery, setSearchQuery] = useState("");
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const [isImportOpen, setIsImportOpen] = useState(false);

  const [isPending, startTransition] = useTransition();

  const [editingId, setEditingId] = useState<number | 'new' | null>(null);
  const [editForm, setEditForm] = useState<{ nama?: string; kode?: string }>({});

  const [deleteTarget, setDeleteTarget] = useState<ReferenceItem | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => { setKategori(initialKategori); }, [initialKategori]);
  useEffect(() => { setSatuan(initialSatuan); }, [initialSatuan]);
  useEffect(() => { setMerk(initialMerk); }, [initialMerk]);
  useEffect(() => { setMetodeBayar(initialMetodeBayar); }, [initialMetodeBayar]);
  useEffect(() => { setLokasiArea(initialLokasiArea); }, [initialLokasiArea]);

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
    if (activeTab === "merk" && !editForm.kode?.trim()) {
      setErrorMsg("Kode tidak boleh kosong");
      return;
    }
    setErrorMsg("");
    startTransition(async () => {
      const formData = new FormData();
      formData.append("nama", editForm.nama || "");
      if (activeTab === "merk") {
        formData.append("kode", editForm.kode || "");
      }

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
        if (editingId !== 'new') {
          const newItem = { id: editingId as number, nama: editForm.nama!, kode: editForm.kode };
          const updater = (prev: ReferenceItem[]) => prev.map(i => i.id === editingId ? newItem : i);
          if (activeTab === "kategori") setKategori(updater);
          else if (activeTab === "satuan") setSatuan(updater);
          else if (activeTab === "merk") setMerk(updater);
          else if (activeTab === "lokasi_area") setLokasiArea(updater);
          else setMetodeBayar(updater);
        }
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
        else if (activeTab === "merk") setMerk(filterFn);
        else if (activeTab === "lokasi_area") setLokasiArea(filterFn);
        else setMetodeBayar(filterFn);
        setDeleteTarget(null);
      }
    });
  };

  const getActiveData = () => {
    if (activeTab === "kategori") return kategori;
    if (activeTab === "satuan") return satuan;
    if (activeTab === "merk") return merk;
    if (activeTab === "lokasi_area") return lokasiArea;
    return metodeBayar;
  };

  const activeData = getActiveData();

  const filteredData = useMemo(() => {
    let result = [...activeData];
    if (deferredSearchQuery.trim()) {
      const q = deferredSearchQuery.toLowerCase();
      result = result.filter((i) => i.nama.toLowerCase().includes(q) || String(i.id).includes(q) || i.kode?.toLowerCase().includes(q));
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
    if (tab === "merk") return "Merk";
    if (tab === "lokasi_area") return "Lokasi Area";
    return "Metode Pembayaran";
  };

  const handleExportCSV = () => {
    const headers = activeTab === "merk" ? ["No", "Kode", "Nama"] : ["No", "Nama"];
    const data = filteredData.map((item, idx) => activeTab === "merk" ? [idx + 1, item.kode || "-", item.nama] : [idx + 1, item.nama]);
    exportToCSV(`Data_${getTabLabel(activeTab).replace(" ", "_")}`, headers, data);
  };

  const handleExportPDF = () => {
    const headers = activeTab === "merk" ? ["No", "Kode", "Nama"] : ["No", "Nama"];
    const data = filteredData.map((item, idx) => activeTab === "merk" ? [String(idx + 1), item.kode || "-", item.nama] : [String(idx + 1), item.nama]);
    exportToPDF(`Data_${getTabLabel(activeTab).replace(" ", "_")}`, `Laporan ${getTabLabel(activeTab)}`, headers, data);
  };

  const columns: Column<ReferenceItem>[] = [
    ...(activeTab === "merk" ? [{ key: "kode", header: "Kode", sortable: true, headerClassName: "w-24 pl-6", render: (i: ReferenceItem) => <span className="font-mono text-sm">{i.kode || "-"}</span> }] : []),
    { key: "nama", header: "Nama", sortable: true, className: activeTab === "merk" ? "" : "pl-6", headerClassName: activeTab === "merk" ? "" : "pl-6", render: (i) => <span className="font-medium">{i.nama}</span> },
    {
      key: "actions", header: "", className: "pr-6", headerClassName: "text-right pr-6 w-32",
      render: (item) => (
        <div className="flex justify-end gap-1">
          <Button variant="ghost" size="icon" aria-label="Edit data" className="h-11 w-11 md:h-8 md:w-8 text-muted-foreground hover:text-foreground"
            onClick={() => { setEditingId(item.id); setEditForm({ nama: item.nama, kode: item.kode }); setErrorMsg(""); }}
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
        {(["kategori", "satuan", "merk", "metode_bayar", "lokasi_area"] as TabType[]).map((tab) => (
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
        renderEditRow={() => {
          return (
            <>
              {activeTab === "merk" && (
                <TableCell className="align-middle py-4">
                  <Input autoFocus aria-label="Kode" placeholder="Kode (4 char)..."
                    value={editForm.kode || ""}
                    onChange={(e) => setEditForm(prev => ({ ...prev, kode: e.target.value.toUpperCase().slice(0, 4) }))}
                    className="h-8 font-mono"
                    maxLength={4}
                  />
                </TableCell>
              )}
              <TableCell className="align-middle py-4">
                <Input autoFocus={activeTab !== "merk"} aria-label="Nama" placeholder="Nama..."
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
            </>
          );
        }}
        actions={[
          { label: "Import CSV", icon: <Upload className="w-4 h-4" />, variant: "outline", onClick: () => setIsImportOpen(true) },
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

      <ImportCSVModal
        open={isImportOpen}
        onOpenChange={setIsImportOpen}
        title={`Import Data ${getTabLabel(activeTab)}`}
        description={activeTab === "merk" ? "Unggah file CSV dengan kolom Kode dan Nama Merk." : `Unggah file CSV dengan kolom Nama ${getTabLabel(activeTab)}.`}
        templateFilename={`Template_Import_${getTabLabel(activeTab).replace(" ", "_")}`}
        templateHeaders={activeTab === "merk" ? ["Kode", "Nama Merk"] : [`Nama ${getTabLabel(activeTab)}`]}
        sampleRows={
          activeTab === "merk"
            ? [["HIOS", "HIOSHI"], ["GOMEO", "GOMEO"]]
            : [
                [activeTab === "kategori" ? "Bahan Bangunan" : activeTab === "satuan" ? "Pcs" : activeTab === "lokasi_area" ? "Rak A1" : "Transfer Bank"],
                [activeTab === "kategori" ? "Alat Pertukangan" : activeTab === "satuan" ? "Dus" : activeTab === "lokasi_area" ? "Gudang Utara" : "QRIS"],
              ]
        }
        validateRow={(row) => {
          const name = row[`Nama ${getTabLabel(activeTab)}`] || row["Nama"] || row["nama"] || row["Nama Merk"] || "";
          if (!name.trim()) {
            return `Nama ${getTabLabel(activeTab)} wajib diisi`;
          }
          return null;
        }}
        onImport={(rows) => importReferenceData(activeTab, rows)}
      />
    </div>
  );
}
