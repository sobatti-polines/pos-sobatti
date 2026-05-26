"use client";

import { useState, useMemo, useTransition, useEffect } from "react";
import { Search, Plus, Trash2, Users, X, AlertCircle, ChevronUp, ChevronDown, ChevronLeft, ChevronRight, Check, Loader2, Edit2 } from "lucide-react";
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
import { addCustomer, updateCustomer, deleteCustomer } from "./actions";

interface Customer {
  id: number;
  nama_pelanggan: string;
  alamat: string | null;
  no_hp: string | null;
  email: string | null;
  keterangan: string | null;
  created_at: string;
}

export default function CustomersClient({ initialCustomers }: { initialCustomers: Customer[] }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: "asc" | "desc" } | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);

  const [isPending, startTransition] = useTransition();
  
  // Inline editing state
  const [editingId, setEditingId] = useState<number | 'new' | null>(null);
  const [editForm, setEditForm] = useState<Partial<Customer>>({});
  
  const [deleteModal, setDeleteModal] = useState<{ open: boolean; data: Customer | null }>({
    open: false,
    data: null,
  });
  const [errorMsg, setErrorMsg] = useState("");

  const processedCustomers = useMemo(() => {
    let result = [...initialCustomers];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (c) =>
          c.nama_pelanggan.toLowerCase().includes(q) ||
          c.no_hp?.toLowerCase().includes(q) ||
          c.email?.toLowerCase().includes(q) ||
          c.alamat?.toLowerCase().includes(q)
      );
    }

    if (sortConfig) {
      result.sort((a: any, b: any) => {
        const aVal = a[sortConfig.key] || "";
        const bVal = b[sortConfig.key] || "";
        if (aVal < bVal) return sortConfig.direction === "asc" ? -1 : 1;
        if (aVal > bVal) return sortConfig.direction === "asc" ? 1 : -1;
        return 0;
      });
    }

    return result;
  }, [initialCustomers, searchQuery, sortConfig]);

  const totalPages = Math.max(1, Math.ceil(processedCustomers.length / itemsPerPage));
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return processedCustomers.slice(start, start + itemsPerPage);
  }, [processedCustomers, currentPage, itemsPerPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, sortConfig, itemsPerPage]);

  const handleSort = (key: string) => {
    let direction: "asc" | "desc" = "asc";
    if (sortConfig && sortConfig.key === key && sortConfig.direction === "asc") {
      direction = "desc";
    }
    setSortConfig({ key, direction });
  };

  const SortIcon = ({ columnKey }: { columnKey: string }) => {
    if (sortConfig?.key !== columnKey) return <ChevronDown className="w-3 h-3 opacity-20 ml-1 inline-block" />;
    return sortConfig.direction === "asc" 
      ? <ChevronUp className="w-3 h-3 text-foreground ml-1 inline-block" /> 
      : <ChevronDown className="w-3 h-3 text-foreground ml-1 inline-block" />;
  };

  const handleSaveInline = () => {
    if (!editForm.nama_pelanggan?.trim()) {
      setErrorMsg("Nama pelanggan wajib diisi");
      return;
    }
    setErrorMsg("");

    const data = {
      nama_pelanggan: editForm.nama_pelanggan,
      alamat: editForm.alamat || null,
      no_hp: editForm.no_hp || null,
      email: editForm.email || null,
      keterangan: editForm.keterangan || null,
    };

    startTransition(async () => {
      const result = editingId === "new" 
        ? await addCustomer(data as any)
        : await updateCustomer(editingId as number, data);

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
      const result = await deleteCustomer(deleteModal.data!.id, deleteModal.data!.nama_pelanggan);
      if (result.error) {
        setErrorMsg(result.error);
      } else {
        setDeleteModal({ open: false, data: null });
      }
    });
  };

  const handleEditClick = (e: React.MouseEvent, customer: Customer) => {
    e.stopPropagation();
    if (customer.nama_pelanggan?.toUpperCase() === "UMUM") return;
    setEditingId(customer.id);
    setEditForm(customer);
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
            <Input aria-label="Pencarian" placeholder="Cari nama, telp, atau alamat..."
              className="pl-9 rounded-md"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
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
          Tambah Pelanggan
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
          <TableHeader>
            <TableRow>
              <TableHead onClick={() => handleSort("nama_pelanggan")} className="cursor-pointer select-none hover:text-foreground transition-colors pl-6">
                Nama <SortIcon columnKey="nama_pelanggan" />
              </TableHead>
              <TableHead onClick={() => handleSort("no_hp")} className="cursor-pointer select-none hover:text-foreground transition-colors">No. HP <SortIcon columnKey="no_hp" /></TableHead>
              <TableHead onClick={() => handleSort("email")} className="cursor-pointer select-none hover:text-foreground transition-colors">Email <SortIcon columnKey="email" /></TableHead>
              <TableHead onClick={() => handleSort("alamat")} className="cursor-pointer select-none hover:text-foreground transition-colors">Alamat <SortIcon columnKey="alamat" /></TableHead>
              <TableHead onClick={() => handleSort("keterangan")} className="cursor-pointer select-none hover:text-foreground transition-colors">Keterangan <SortIcon columnKey="keterangan" /></TableHead>
              <TableHead className="w-[100px] pr-6"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {editingId === 'new' && (
              <TableRow className="bg-muted/30">
                <TableCell className="pl-6 align-top pt-4">
                  <Input autoFocus aria-label="Nama Pelanggan" placeholder="Nama Pelanggan"
                    value={editForm.nama_pelanggan || ""}
                    onChange={(e) => setEditForm(prev => ({ ...prev, nama_pelanggan: e.target.value }))}
                    className="h-8 text-[13px]"
                  />
                </TableCell>
                <TableCell className="align-top pt-4">
                  <Input aria-label="No. HP" placeholder="No. HP"
                    value={editForm.no_hp || ""}
                    onChange={(e) => setEditForm(prev => ({ ...prev, no_hp: e.target.value }))}
                    className="h-8 text-[13px] tabular-nums"
                  />
                </TableCell>
                <TableCell className="align-top pt-4">
                  <Input aria-label="Email" placeholder="Email"
                    value={editForm.email || ""}
                    onChange={(e) => setEditForm(prev => ({ ...prev, email: e.target.value }))}
                    className="h-8 text-[13px]"
                  />
                </TableCell>
                <TableCell className="align-top pt-4">
                  <Input aria-label="Alamat" placeholder="Alamat"
                    value={editForm.alamat || ""}
                    onChange={(e) => setEditForm(prev => ({ ...prev, alamat: e.target.value }))}
                    className="h-8 text-[13px]"
                  />
                </TableCell>
                <TableCell className="align-top pt-4">
                  <Input aria-label="Keterangan" placeholder="Keterangan"
                    value={editForm.keterangan || ""}
                    onChange={(e) => setEditForm(prev => ({ ...prev, keterangan: e.target.value }))}
                    className="h-8 text-[13px]"
                  />
                </TableCell>
                <TableCell className="pr-6 align-top pt-4 text-right">
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

            {paginatedData.map((customer) => {
              const isUmum = customer.nama_pelanggan?.toUpperCase() === "UMUM";
              
              if (editingId === customer.id) {
                return (
                  <TableRow key={customer.id} className="bg-muted/10">
                    <TableCell className="pl-6 align-top pt-4">
                      <Input autoFocus aria-label="Nama Pelanggan" placeholder="Nama Pelanggan"
                        value={editForm.nama_pelanggan || ""}
                        onChange={(e) => setEditForm(prev => ({ ...prev, nama_pelanggan: e.target.value }))}
                        className="h-8 text-[13px]"
                      />
                      {errorMsg && <p className="text-[11px] text-destructive mt-1">{errorMsg}</p>}
                    </TableCell>
                    <TableCell className="align-top pt-4">
                      <Input aria-label="No. HP" placeholder="No. HP"
                        value={editForm.no_hp || ""}
                        onChange={(e) => setEditForm(prev => ({ ...prev, no_hp: e.target.value }))}
                        className="h-8 text-[13px] tabular-nums"
                      />
                    </TableCell>
                    <TableCell className="align-top pt-4">
                      <Input aria-label="Email" placeholder="Email"
                        value={editForm.email || ""}
                        onChange={(e) => setEditForm(prev => ({ ...prev, email: e.target.value }))}
                        className="h-8 text-[13px]"
                      />
                    </TableCell>
                    <TableCell className="align-top pt-4">
                      <Input aria-label="Alamat" placeholder="Alamat"
                        value={editForm.alamat || ""}
                        onChange={(e) => setEditForm(prev => ({ ...prev, alamat: e.target.value }))}
                        className="h-8 text-[13px]"
                      />
                    </TableCell>
                    <TableCell className="align-top pt-4">
                      <Input aria-label="Keterangan" placeholder="Keterangan"
                        value={editForm.keterangan || ""}
                        onChange={(e) => setEditForm(prev => ({ ...prev, keterangan: e.target.value }))}
                        className="h-8 text-[13px]"
                      />
                    </TableCell>
                    <TableCell className="pr-6 align-top pt-4 text-right">
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
                <TableRow 
                  key={customer.id} 
                  className="group hover:bg-muted/30 transition-colors"
                >
                  <TableCell className="pl-6 py-4">{customer.nama_pelanggan}</TableCell>
                  <TableCell className="py-4 tabular-nums">{customer.no_hp || "-"}</TableCell>
                  <TableCell className="py-4">{customer.email || "-"}</TableCell>
                  <TableCell className="py-4 max-w-xs truncate">{customer.alamat || "-"}</TableCell>
                  <TableCell className="py-4 max-w-xs truncate">{customer.keterangan || "-"}</TableCell>
                  <TableCell className="pr-6 py-4 text-right">
                    {!isUmum && (
                      <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button variant="ghost" size="icon" aria-label="Edit customer" className="h-11 w-11 md:h-8 md:w-8 text-muted-foreground hover:text-foreground" onClick={(e) => handleEditClick(e, customer)} disabled={editingId !== null}>
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" aria-label="Hapus customer" className="h-11 w-11 md:h-8 md:w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10" onClick={(e) => { e.stopPropagation(); setDeleteModal({ open: true, data: customer }); }} disabled={editingId !== null}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
            
            {paginatedData.length === 0 && editingId !== 'new' && (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-32 hover:bg-transparent">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <Users className="w-12 h-12 mb-4 opacity-20" />
                    <p className="text-base font-medium text-foreground">Tidak ada data pelanggan ditemukan</p>
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
            {processedCustomers.length === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1}
          </span>{" "}
          hingga{" "}
          <span className="font-medium text-foreground">
            {Math.min(currentPage * itemsPerPage, processedCustomers.length)}
          </span>{" "}
          dari{" "}
          <span className="font-medium text-foreground">{processedCustomers.length}</span>{" "}
          pelanggan
        </p>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-[13px] text-muted-foreground whitespace-nowrap">Baris per halaman</span>
            <select aria-label="Baris per halaman" value={itemsPerPage}
              onChange={(e) => setItemsPerPage(Number(e.target.value))}
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
              <h2 className="text-[22px] font-light tracking-tight text-foreground mb-2">Hapus Pelanggan?</h2>
              <p className="text-sm text-muted-foreground">
                Apakah Anda yakin ingin menghapus data pelanggan <strong className="text-foreground">{deleteModal.data?.nama_pelanggan}</strong>? Tindakan ini tidak dapat dibatalkan.
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
                Hapus Pelanggan
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
