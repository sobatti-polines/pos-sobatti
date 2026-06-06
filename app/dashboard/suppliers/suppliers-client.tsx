"use client";

import { useState, useMemo, useTransition, useDeferredValue } from "react";
import { Search, Plus, Trash2, Truck, X, AlertCircle, ChevronUp, ChevronDown, ChevronLeft, ChevronRight, Check, Loader2, Edit2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { addSupplier, updateSupplier, deleteSupplier } from "./actions";

interface Supplier {
  id: number;
  nama_supplier: string;
  alamat: string | null;
  telepon: string | null;
  email: string | null;
  keterangan: string | null;
  created_at: string;
}

export default function SuppliersClient({ initialSuppliers }: { initialSuppliers: Supplier[] }) {
  const [searchQuery, setSearchQuery] = useState("");
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: "asc" | "desc" } | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);

  const [isPending, startTransition] = useTransition();
  
  // Inline editing state
  const [editingId, setEditingId] = useState<number | 'new' | null>(null);
  const [editForm, setEditForm] = useState<Partial<Supplier>>({});
  
  const [deleteModal, setDeleteModal] = useState<{ open: boolean; data: Supplier | null }>({
    open: false,
    data: null,
  });
  const [errorMsg, setErrorMsg] = useState("");

  const processedSuppliers = useMemo(() => {
    let result = [...initialSuppliers];

    if (deferredSearchQuery.trim()) {
      const q = deferredSearchQuery.toLowerCase();
      result = result.filter(
        (s) =>
          s.nama_supplier.toLowerCase().includes(q) ||
          s.telepon?.toLowerCase().includes(q) ||
          s.email?.toLowerCase().includes(q) ||
          s.alamat?.toLowerCase().includes(q)
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
  }, [initialSuppliers, searchQuery, sortConfig]);

  const totalPages = Math.max(1, Math.ceil(processedSuppliers.length / itemsPerPage));
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return processedSuppliers.slice(start, start + itemsPerPage);
  }, [processedSuppliers, currentPage, itemsPerPage]);

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

  const handleSaveInline = () => {
    if (!editForm.nama_supplier?.trim()) {
      setErrorMsg("Nama supplier wajib diisi");
      return;
    }
    setErrorMsg("");

    const data = {
      nama_supplier: editForm.nama_supplier ?? "",
      alamat: editForm.alamat || null,
      telepon: editForm.telepon || null,
      email: editForm.email || null,
      keterangan: editForm.keterangan || null,
    };

    startTransition(async () => {
      const result = editingId === "new" 
        ? await addSupplier(data)
        : await updateSupplier(editingId as number, data);

      if (result.error) {
        setErrorMsg(result.error);
      } else {
        setEditingId(null);
        setEditForm({});
      }
    });
  };

  const handleDelete = async () => {
    if (!deleteModal.data) return;
    setErrorMsg("");
    startTransition(async () => {
      const result = await deleteSupplier(deleteModal.data!.id);
      if (result.error) {
        setErrorMsg(result.error);
      } else {
        setDeleteModal({ open: false, data: null });
      }
    });
  };

  const handleEditClick = (e: React.MouseEvent, supplier: Supplier) => {
    e.stopPropagation();
    setEditingId(supplier.id);
    setEditForm(supplier);
    setErrorMsg("");
  };

  const handleCancelInline = () => {
    setEditingId(null);
    setEditForm({});
    setErrorMsg("");
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-background border border-border rounded-[12px] shadow-[0_1px_3px_rgba(0,55,112,0.08)] overflow-hidden relative">
      <div className="shrink-0 flex items-center justify-between p-4 lg:p-6 border-b border-border bg-transparent gap-4">
        <div className="flex-1 flex flex-wrap items-center gap-3">
          <div className="relative w-full max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input aria-label="Pencarian" placeholder="Cari supplier, telepon, atau alamat..."
              className="pl-9 rounded-md"
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
              disabled={editingId !== null}
            />
          </div>
        </div>
        <Button 
          onClick={() => {
            setEditingId('new');
            setEditForm({});
            setCurrentPage(1);
            setErrorMsg("");
          }}
          disabled={editingId !== null}
          className="rounded-full px-6 h-10 bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm ml-4 font-normal shrink-0 gap-2"
        >
          <Plus className="w-4 h-4" />
          Tambah Supplier
        </Button>
      </div>

      {errorMsg && editingId === 'new' && (
        <div className="px-6 py-3 bg-destructive/10 border-b border-border text-destructive text-sm font-medium flex items-center gap-2">
          <AlertCircle className="w-4 h-4" />
          {errorMsg}
        </div>
      )}

      <div className="flex-1 overflow-y-auto min-h-0 relative">
        <Table>
          <TableHeader className="hidden md:table-header-group">
            <TableRow>
              <TableHead onClick={() => handleSort("nama_supplier")} className="cursor-pointer select-none hover:text-foreground transition-colors md:pl-6">
                Nama Supplier {renderSortIcon("nama_supplier")}
              </TableHead>
              <TableHead onClick={() => handleSort("telepon")} className="cursor-pointer select-none hover:text-foreground transition-colors">Telepon {renderSortIcon("telepon")}</TableHead>
              <TableHead onClick={() => handleSort("email")} className="cursor-pointer select-none hover:text-foreground transition-colors">Email {renderSortIcon("email")}</TableHead>
              <TableHead onClick={() => handleSort("alamat")} className="cursor-pointer select-none hover:text-foreground transition-colors">Alamat {renderSortIcon("alamat")}</TableHead>
              <TableHead onClick={() => handleSort("keterangan")} className="cursor-pointer select-none hover:text-foreground transition-colors">Keterangan {renderSortIcon("keterangan")}</TableHead>
              <TableHead className="w-[100px] md:pr-6"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {editingId === 'new' && (
              <TableRow className="bg-muted/30 flex flex-col md:table-row p-4 md:p-0 gap-3 md:gap-0 border-b-2 md:border-b">
                <TableCell className="md:pl-6 align-top md:pt-4 p-0 md:p-2 block md:table-cell">
                  <span className="md:hidden text-xs font-medium text-muted-foreground uppercase tracking-widest mb-1 block">Nama Supplier</span>
                  <Input autoFocus aria-label="Nama Supplier" placeholder="Nama Supplier"
                    value={editForm.nama_supplier || ""}
                    onChange={(e) => setEditForm(prev => ({ ...prev, nama_supplier: e.target.value }))}
                    className="h-10 md:h-8 text-[15px] md:text-[13px]"
                  />
                </TableCell>
                <TableCell className="align-top md:pt-4 p-0 md:p-2 block md:table-cell">
                  <span className="md:hidden text-xs font-medium text-muted-foreground uppercase tracking-widest mb-1 block">Telepon</span>
                  <Input aria-label="Telepon" placeholder="Telepon"
                    value={editForm.telepon || ""}
                    onChange={(e) => setEditForm(prev => ({ ...prev, telepon: e.target.value }))}
                    className="h-10 md:h-8 text-[15px] md:text-[13px] tabular-nums"
                  />
                </TableCell>
                <TableCell className="align-top md:pt-4 p-0 md:p-2 block md:table-cell">
                  <span className="md:hidden text-xs font-medium text-muted-foreground uppercase tracking-widest mb-1 block">Email</span>
                  <Input aria-label="Email" placeholder="Email"
                    value={editForm.email || ""}
                    onChange={(e) => setEditForm(prev => ({ ...prev, email: e.target.value }))}
                    className="h-10 md:h-8 text-[15px] md:text-[13px]"
                  />
                </TableCell>
                <TableCell className="align-top md:pt-4 p-0 md:p-2 block md:table-cell">
                  <span className="md:hidden text-xs font-medium text-muted-foreground uppercase tracking-widest mb-1 block">Alamat</span>
                  <Input aria-label="Alamat" placeholder="Alamat"
                    value={editForm.alamat || ""}
                    onChange={(e) => setEditForm(prev => ({ ...prev, alamat: e.target.value }))}
                    className="h-10 md:h-8 text-[15px] md:text-[13px]"
                  />
                </TableCell>
                <TableCell className="align-top md:pt-4 p-0 md:p-2 block md:table-cell">
                  <span className="md:hidden text-xs font-medium text-muted-foreground uppercase tracking-widest mb-1 block">Keterangan</span>
                  <Input aria-label="Keterangan" placeholder="Keterangan"
                    value={editForm.keterangan || ""}
                    onChange={(e) => setEditForm(prev => ({ ...prev, keterangan: e.target.value }))}
                    className="h-10 md:h-8 text-[15px] md:text-[13px]"
                  />
                </TableCell>
                <TableCell className="md:pr-6 align-top pt-2 md:pt-4 text-right p-0 md:p-2 block md:table-cell mt-2 md:mt-0">
                  <div className="flex justify-end gap-2 md:gap-1">
                    <Button variant="outline" size="icon" aria-label="Batal Edit" className="h-11 w-11 md:h-8 md:w-8 text-muted-foreground hover:text-foreground" onClick={handleCancelInline} disabled={isPending}>
                      <X className="h-4 w-4" />
                    </Button>
                    <Button variant="default" size="icon" aria-label="Simpan Edit" className="h-11 w-11 md:h-8 md:w-8" onClick={handleSaveInline} disabled={isPending}>
                      {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            )}

            {paginatedData.map((supplier) => {
              if (editingId === supplier.id) {
                return (
                  <TableRow key={supplier.id} className="bg-muted/10 flex flex-col md:table-row p-4 md:p-0 gap-3 md:gap-0 border-b-2 md:border-b">
                    <TableCell className="md:pl-6 align-top md:pt-4 p-0 md:p-2 block md:table-cell">
                      <span className="md:hidden text-xs font-medium text-muted-foreground uppercase tracking-widest mb-1 block">Nama Supplier</span>
                      <Input autoFocus aria-label="Nama Supplier" placeholder="Nama Supplier"
                        value={editForm.nama_supplier || ""}
                        onChange={(e) => setEditForm(prev => ({ ...prev, nama_supplier: e.target.value }))}
                        className="h-10 md:h-8 text-[15px] md:text-[13px]"
                      />
                      {errorMsg && <p className="text-[11px] text-destructive mt-1">{errorMsg}</p>}
                    </TableCell>
                    <TableCell className="align-top md:pt-4 p-0 md:p-2 block md:table-cell">
                      <span className="md:hidden text-xs font-medium text-muted-foreground uppercase tracking-widest mb-1 block">Telepon</span>
                      <Input aria-label="Telepon" placeholder="Telepon"
                        value={editForm.telepon || ""}
                        onChange={(e) => setEditForm(prev => ({ ...prev, telepon: e.target.value }))}
                        className="h-10 md:h-8 text-[15px] md:text-[13px] tabular-nums"
                      />
                    </TableCell>
                    <TableCell className="align-top md:pt-4 p-0 md:p-2 block md:table-cell">
                      <span className="md:hidden text-xs font-medium text-muted-foreground uppercase tracking-widest mb-1 block">Email</span>
                      <Input aria-label="Email" placeholder="Email"
                        value={editForm.email || ""}
                        onChange={(e) => setEditForm(prev => ({ ...prev, email: e.target.value }))}
                        className="h-10 md:h-8 text-[15px] md:text-[13px]"
                      />
                    </TableCell>
                    <TableCell className="align-top md:pt-4 p-0 md:p-2 block md:table-cell">
                      <span className="md:hidden text-xs font-medium text-muted-foreground uppercase tracking-widest mb-1 block">Alamat</span>
                      <Input aria-label="Alamat" placeholder="Alamat"
                        value={editForm.alamat || ""}
                        onChange={(e) => setEditForm(prev => ({ ...prev, alamat: e.target.value }))}
                        className="h-10 md:h-8 text-[15px] md:text-[13px]"
                      />
                    </TableCell>
                    <TableCell className="align-top md:pt-4 p-0 md:p-2 block md:table-cell">
                      <span className="md:hidden text-xs font-medium text-muted-foreground uppercase tracking-widest mb-1 block">Keterangan</span>
                      <Input aria-label="Keterangan" placeholder="Keterangan"
                        value={editForm.keterangan || ""}
                        onChange={(e) => setEditForm(prev => ({ ...prev, keterangan: e.target.value }))}
                        className="h-10 md:h-8 text-[15px] md:text-[13px]"
                      />
                    </TableCell>
                    <TableCell className="md:pr-6 align-top pt-2 md:pt-4 text-right p-0 md:p-2 block md:table-cell mt-2 md:mt-0">
                      <div className="flex justify-end gap-2 md:gap-1">
                        <Button variant="outline" size="icon" aria-label="Batal Edit" className="h-11 w-11 md:h-8 md:w-8 text-muted-foreground hover:text-foreground" onClick={handleCancelInline} disabled={isPending}>
                          <X className="h-4 w-4" />
                        </Button>
                        <Button variant="default" size="icon" aria-label="Simpan Edit" className="h-11 w-11 md:h-8 md:w-8" onClick={handleSaveInline} disabled={isPending}>
                          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              }

              return (
                <TableRow 
                  key={supplier.id} 
                  className="group hover:bg-muted/30 transition-colors flex flex-col md:table-row p-4 md:p-0 border-b"
                >
                  <TableCell className="md:pl-6 py-2 md:py-4 block md:table-cell">
                    <span className="md:hidden text-xs font-medium text-muted-foreground uppercase tracking-widest mb-1 block">Nama Supplier</span>
                    <span className="text-base md:text-[15px] font-medium md:font-normal">{supplier.nama_supplier}</span>
                  </TableCell>
                  <TableCell className="py-2 md:py-4 tabular-nums block md:table-cell">
                    <span className="md:hidden text-xs font-medium text-muted-foreground uppercase tracking-widest mb-1 block">Telepon</span>
                    {supplier.telepon || "-"}
                  </TableCell>
                  <TableCell className="py-2 md:py-4 block md:table-cell">
                    <span className="md:hidden text-xs font-medium text-muted-foreground uppercase tracking-widest mb-1 block">Email</span>
                    {supplier.email || "-"}
                  </TableCell>
                  <TableCell className="py-2 md:py-4 max-w-xs md:max-w-[200px] xl:max-w-xs truncate block md:table-cell">
                    <span className="md:hidden text-xs font-medium text-muted-foreground uppercase tracking-widest mb-1 block">Alamat</span>
                    <span className="whitespace-normal md:whitespace-nowrap md:truncate block">{supplier.alamat || "-"}</span>
                  </TableCell>
                  <TableCell className="py-2 md:py-4 max-w-xs md:max-w-[150px] xl:max-w-xs truncate block md:table-cell">
                    <span className="md:hidden text-xs font-medium text-muted-foreground uppercase tracking-widest mb-1 block">Keterangan</span>
                    <span className="whitespace-normal md:whitespace-nowrap md:truncate block">{supplier.keterangan || "-"}</span>
                  </TableCell>
                  <TableCell className="md:pr-6 py-3 md:py-4 text-right block md:table-cell mt-2 md:mt-0 border-t md:border-t-0 border-border/50">
                    <div className="flex justify-end gap-2 md:gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                      <Button variant="outline" size="icon" aria-label="Edit supplier" className="h-11 w-11 md:h-8 md:w-8 md:border-transparent md:bg-transparent text-muted-foreground hover:text-foreground" onClick={(e) => handleEditClick(e, supplier)} disabled={editingId !== null}>
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button variant="outline" size="icon" aria-label="Hapus supplier" className="h-11 w-11 md:h-8 md:w-8 md:border-transparent md:bg-transparent text-muted-foreground hover:text-destructive hover:bg-destructive/10" onClick={(e) => { e.stopPropagation(); setDeleteModal({ open: true, data: supplier }); }} disabled={editingId !== null}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
            
            {paginatedData.length === 0 && editingId !== 'new' && (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-32 hover:bg-transparent">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <Truck className="w-12 h-12 mb-4 opacity-20" />
                    <p className="text-base font-medium text-foreground">Tidak ada data supplier ditemukan</p>
                    <p className="text-sm mt-1">Coba gunakan kata kunci pencarian atau filter yang lain.</p>
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className="shrink-0 flex items-center justify-between gap-4 px-4 lg:px-6 py-3 border-t border-border bg-background">
        <p className="text-[13px] text-muted-foreground tabular-nums">
          Menampilkan{" "}
          <span className="font-medium text-foreground">
            {processedSuppliers.length === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1}
          </span>{" "}
          hingga{" "}
          <span className="font-medium text-foreground">
            {Math.min(currentPage * itemsPerPage, processedSuppliers.length)}
          </span>{" "}
          dari{" "}
          <span className="font-medium text-foreground">{processedSuppliers.length}</span>{" "}
          supplier
        </p>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-[13px] text-muted-foreground whitespace-nowrap">Baris per halaman</span>
            <select aria-label="Baris per halaman" value={itemsPerPage}
              onChange={(e) => { setItemsPerPage(Number(e.target.value)); setCurrentPage(1); }}
              disabled={editingId !== null}
              className="h-8 rounded-md border border-border bg-background px-2 py-1 text-[13px] shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/20 text-foreground disabled:opacity-50"
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
              disabled={currentPage === 1 || editingId !== null}
              className="h-11 w-11 md:h-8 md:w-8 p-0 rounded-full bg-background disabled:opacity-50"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button aria-label="Halaman Selanjutnya" variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages || editingId !== null}
              className="h-11 w-11 md:h-8 md:w-8 p-0 rounded-full bg-background disabled:opacity-50"
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
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
              <h2 className="text-[22px] font-light tracking-tight text-foreground mb-2">Hapus Supplier?</h2>
              <p className="text-sm text-muted-foreground">
                Apakah Anda yakin ingin menghapus data supplier <strong className="text-foreground">{deleteModal.data?.nama_supplier}</strong>? Tindakan ini tidak dapat dibatalkan.
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
                Hapus Supplier
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

