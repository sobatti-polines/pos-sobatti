"use client";

import { useState, useMemo, useEffect, useTransition, useDeferredValue } from "react";
import { Search, Plus, Edit2, Trash2, CheckCircle2, Database, AlertCircle, Loader2, ChevronUp, ChevronDown, ChevronLeft, ChevronRight, Download, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { createReferenceData, updateReferenceData, deleteReferenceData } from "./actions";
import { exportToCSV, exportToPDF } from "@/lib/export-utils";

type ReferenceItem = {
  id: number;
  nama: string;
};

type TabType = "kategori" | "satuan" | "metode_bayar";

// Removed SubmitButton and ReferenceActionState usage here

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
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: "asc" | "desc" } | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);

  const [isPending, startTransition] = useTransition();

  // Sync state when props change (due to revalidatePath)
  useEffect(() => { setKategori(initialKategori); }, [initialKategori]);
  useEffect(() => { setSatuan(initialSatuan); }, [initialSatuan]);
  useEffect(() => { setMetodeBayar(initialMetodeBayar); }, [initialMetodeBayar]);

  // Reset pagination & search when tab changes
  useEffect(() => {
    setSearchQuery("");
    setCurrentPage(1);
    setSortConfig(null);
  }, [activeTab]);

  const [editingId, setEditingId] = useState<number | 'new' | null>(null);
  const [editForm, setEditForm] = useState<{ nama?: string }>({});

  const [deleteModal, setDeleteModal] = useState<{ open: boolean; data: ReferenceItem | null }>({
    open: false,
    data: null,
  });
  const [errorMsg, setErrorMsg] = useState("");

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
        if (activeTab === "kategori") {
          setKategori(prev => editingId === 'new' ? [...prev, newItem] : prev.map(i => i.id === editingId ? newItem : i));
        } else if (activeTab === "satuan") {
          setSatuan(prev => editingId === 'new' ? [...prev, newItem] : prev.map(i => i.id === editingId ? newItem : i));
        } else {
          setMetodeBayar(prev => editingId === 'new' ? [...prev, newItem] : prev.map(i => i.id === editingId ? newItem : i));
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

  const handleDelete = async () => {
    if (!deleteModal.data) return;
    setErrorMsg("");
    startTransition(async () => {
      const res = await deleteReferenceData(activeTab, deleteModal.data!.id);
      if (res.error) {
        setErrorMsg(res.error);
      } else {
        const id = deleteModal.data!.id;
        if (activeTab === "kategori") setKategori(kategori.filter((i) => i.id !== id));
        else if (activeTab === "satuan") setSatuan(satuan.filter((i) => i.id !== id));
        else if (activeTab === "metode_bayar") setMetodeBayar(metodeBayar.filter((i) => i.id !== id));
        setDeleteModal({ open: false, data: null });
      }
    });
  };

  const getActiveData = () => {
    if (activeTab === "kategori") return kategori;
    if (activeTab === "satuan") return satuan;
    return metodeBayar;
  };

  const activeData = getActiveData();

  const processedData = useMemo(() => {
    let result = [...activeData];

    if (deferredSearchQuery.trim()) {
      const q = deferredSearchQuery.toLowerCase();
      result = result.filter(
        (i) => i.nama.toLowerCase().includes(q) || String(i.id).includes(q)
      );
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
  }, [activeData, searchQuery, sortConfig]);

  const totalPages = Math.max(1, Math.ceil(processedData.length / itemsPerPage));
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return processedData.slice(start, start + itemsPerPage);
  }, [processedData, currentPage, itemsPerPage]);

  const handleSort = (key: string) => {
    let direction: "asc" | "desc" = "asc";
    if (sortConfig && sortConfig.key === key && sortConfig.direction === "asc") {
      direction = "desc";
    }
    setSortConfig({ key, direction });
    setCurrentPage(1);
  };

  const renderSortIcon = (columnKey: string) => {
    if (sortConfig?.key !== columnKey) return <ChevronDown className="w-3 h-3 opacity-20 ml-1 inline-block" />;
    return sortConfig.direction === "asc" 
      ? <ChevronUp className="w-3 h-3 text-foreground ml-1 inline-block" /> 
      : <ChevronDown className="w-3 h-3 text-foreground ml-1 inline-block" />;
  };

  const getTabLabel = (tab: TabType) => {
    if (tab === "kategori") return "Kategori Produk";
    if (tab === "satuan") return "Satuan Barang";
    return "Metode Pembayaran";
  };

  const handleExportCSV = () => {
    const headers = ["ID", "Nama"];
    const data = processedData.map(item => [
      item.id,
      item.nama
    ]);
    exportToCSV(`Data_${getTabLabel(activeTab).replace(" ", "_")}`, headers, data);
  };

  const handleExportPDF = () => {
    const headers = ["ID", "Nama"];
    const data = processedData.map(item => [
      item.id,
      item.nama
    ]);
    exportToPDF(`Data_${getTabLabel(activeTab).replace(" ", "_")}`, `Laporan ${getTabLabel(activeTab)}`, headers, data);
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 gap-6">
      {/* Tabs */}
      <div className="shrink-0 flex space-x-1 bg-muted/50 p-1 rounded-[12px] overflow-x-auto custom-scrollbar">
        {(["kategori", "satuan", "metode_bayar"] as TabType[]).map((tab) => (
          <button
            key={tab}
            onClick={() => {
              setActiveTab(tab);
              setEditingId(null);
              setEditForm({});
              setErrorMsg("");
            }}
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

      {/* Table Container matching others */}
      <div className="flex-1 flex flex-col min-h-0 bg-background border border-border rounded-[12px] shadow-[0_1px_3px_rgba(0,55,112,0.08)] overflow-hidden relative">
        <div className="shrink-0 flex flex-col items-start md:flex-row md:items-center justify-between p-4 lg:p-6 border-b border-border bg-transparent gap-4">
          <div className="flex-1 flex flex-col md:flex-row items-stretch md:items-center gap-3 w-full">
            <div className="relative w-full md:max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input aria-label="Pencarian" placeholder={`Cari ${getTabLabel(activeTab).toLowerCase()}...`}
                className="pl-9 rounded-md w-full"
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                disabled={editingId !== null}
              />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 md:ml-4 shrink-0 w-full md:w-auto">
            <Button
              variant="outline"
              onClick={handleExportCSV}
              className="rounded-full px-4 h-10 gap-2 flex-1 md:flex-none"
            >
              <Download className="w-4 h-4" /> CSV
            </Button>
            <Button
              variant="outline"
              onClick={handleExportPDF}
              className="rounded-full px-4 h-10 gap-2 flex-1 md:flex-none"
            >
              <Download className="w-4 h-4" /> PDF
            </Button>
            <Button 
              onClick={() => {
                setEditingId('new');
                setEditForm({});
                setCurrentPage(1);
                setErrorMsg("");
              }} 
              disabled={editingId !== null}
              className="rounded-full px-6 h-10 bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm font-normal shrink-0 gap-2 w-full md:w-auto"
            >
              <Plus className="w-4 h-4" />
              Tambah Data
            </Button>
          </div>
        </div>

        {errorMsg && editingId === 'new' && (
          <div className="px-6 py-3 bg-destructive/10 border-b border-border text-destructive text-sm font-medium flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            {errorMsg}
          </div>
        )}

        <div className="flex-1 overflow-y-auto min-h-0 relative">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead onClick={() => handleSort("id")} className="cursor-pointer select-none hover:text-foreground transition-colors w-24 pl-6">
                  ID {renderSortIcon("id")}
                </TableHead>
                <TableHead onClick={() => handleSort("nama")} className="cursor-pointer select-none hover:text-foreground transition-colors">
                  Nama {renderSortIcon("nama")}
                </TableHead>
                <TableHead className="text-right pr-6 w-32">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {editingId === 'new' && (
                <TableRow className="bg-muted/30">
                  <TableCell className="pl-6 align-middle py-4 text-muted-foreground text-sm italic">
                    (Otomatis)
                  </TableCell>
                  <TableCell className="align-middle py-4">
                    <Input autoFocus aria-label="Nama" placeholder="Nama..."
                      value={editForm.nama || ""}
                      onChange={(e) => setEditForm(prev => ({ ...prev, nama: e.target.value }))}
                      className="h-8"
                    />
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
              )}

              {paginatedData.length === 0 && editingId !== 'new' ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-center py-32 hover:bg-transparent">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Database className="w-12 h-12 mb-4 opacity-20" />
                      <p className="text-base font-medium text-foreground">Tidak ada data ditemukan</p>
                      <p className="text-sm mt-1">Coba gunakan kata kunci pencarian yang lain.</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                paginatedData.map((item) => {
                  if (editingId === item.id) {
                    return (
                      <TableRow key={item.id} className="bg-muted/10">
                        <TableCell className="pl-6 align-middle py-4 text-muted-foreground tabular-nums">
                          {item.id}
                        </TableCell>
                        <TableCell className="align-middle py-4 relative">
                          <Input autoFocus aria-label="Nama" placeholder="Nama..."
                            value={editForm.nama || ""}
                            onChange={(e) => setEditForm(prev => ({ ...prev, nama: e.target.value }))}
                            className="h-8"
                          />
                          {errorMsg && (
                            <div className="absolute -bottom-5 left-4 flex items-center gap-1 text-[11px] text-destructive font-medium">
                              <AlertCircle className="w-3 h-3" />
                              {errorMsg}
                            </div>
                          )}
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
                  }

                  return (
                    <TableRow key={item.id} className="group hover:bg-muted/30 transition-colors">
                      <TableCell className="pl-6 py-4 text-muted-foreground tabular-nums">{item.id}</TableCell>
                      <TableCell className="py-4 font-medium">{item.nama}</TableCell>
                      <TableCell className="pr-6 py-4 text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" aria-label="Edit data" className="h-11 w-11 md:h-8 md:w-8 text-muted-foreground hover:text-foreground" 
                            onClick={() => {
                              setEditingId(item.id);
                              setEditForm({ nama: item.nama });
                              setErrorMsg("");
                            }}
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" aria-label="Hapus data" className="h-11 w-11 md:h-8 md:w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10" onClick={() => setDeleteModal({ open: true, data: item })}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        <div className="shrink-0 flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 lg:p-6 border-t border-border bg-background">
          <p className="text-[13px] text-muted-foreground tabular-nums">
            Menampilkan{" "}
            <span className="font-medium text-foreground">
              {processedData.length === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1}
            </span>{" "}
            hingga{" "}
            <span className="font-medium text-foreground">
              {Math.min(currentPage * itemsPerPage, processedData.length)}
            </span>{" "}
            dari{" "}
            <span className="font-medium text-foreground">{processedData.length}</span>{" "}
            data
          </p>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-[13px] text-muted-foreground whitespace-nowrap">Baris per halaman</span>
              <select aria-label="Baris per halaman" value={itemsPerPage}
                onChange={(e) => { setItemsPerPage(Number(e.target.value)); setCurrentPage(1); }}
                className="h-8 rounded-md border border-border bg-background px-2 py-1 text-[13px] shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/20 text-foreground"
              >
                {[10, 25, 50, 100].map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </div>

            <span className="text-[13px] text-muted-foreground tabular-nums whitespace-nowrap">
              Halaman{" "}
              <span className="font-medium text-foreground">{currentPage}</span>
              {" "}/{" "}
              <span className="font-medium text-foreground">{totalPages}</span>
            </span>

            <div className="flex items-center gap-1">
              <Button aria-label="Halaman Sebelumnya" variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="h-11 w-11 md:h-8 md:w-8 p-0 rounded-full bg-background disabled:opacity-50"
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <Button aria-label="Halaman Selanjutnya" variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="h-11 w-11 md:h-8 md:w-8 p-0 rounded-full bg-background disabled:opacity-50"
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Delete Confirmation */}
      {deleteModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-overlay/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-background border border-border shadow-[0_8px_24px_rgba(0,55,112,0.08),0_2px_6px_rgba(0,55,112,0.04)] rounded-[12px] w-full max-w-md flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 text-center">
              <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center text-destructive mx-auto mb-4">
                <Trash2 className="w-6 h-6" />
              </div>
              <h2 className="text-[22px] font-light tracking-tight text-foreground mb-2">Hapus {getTabLabel(activeTab)}?</h2>
              <p className="text-sm text-muted-foreground">
                Apakah Anda yakin ingin menghapus data <strong className="text-foreground">{deleteModal.data?.nama}</strong>? Tindakan ini tidak dapat dibatalkan.
              </p>
              {errorMsg && (
                <div className="mt-4 p-3 bg-destructive/10 border border-destructive/20 rounded-lg flex items-center gap-2 text-destructive text-sm text-left">
                  <AlertCircle className="w-4 h-4" />
                  {errorMsg}
                </div>
              )}
            </div>
            <div className="shrink-0 px-6 py-5 border-t border-border bg-transparent flex justify-end gap-3">
              <Button 
                type="button" 
                variant="outline" 
                className="rounded-full px-6 bg-background"
                onClick={() => setDeleteModal({ open: false, data: null })}
                disabled={isPending}
              >
                Batal
              </Button>
              <Button 
                variant="destructive" 
                className="rounded-full px-6 shadow-sm"
                onClick={handleDelete} 
                disabled={isPending}
              >
                {isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Hapus
              </Button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
