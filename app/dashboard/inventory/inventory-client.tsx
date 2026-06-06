"use client";

import { useState, useMemo, useTransition, useDeferredValue } from "react";
import { Search, Plus, PackageOpen, X, AlertCircle, ChevronUp, ChevronDown, ChevronLeft, ChevronRight, Check, Loader2, Edit2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { addProduct, updateProduct, deleteProduct } from "./actions";
import React from "react";

function formatIDR(n: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
}

interface Product {
  id: number;
  nama_produk: string;
  id_kategori: number;
  id_satuan: number;
  hitung_stok: boolean;
  barcode: string | null;
  harga_modal: number;
  harga_jual_satuan: number;
  harga_jual_grosir: number;
  harga_jual_promo: number | null;
  diskon: number;
  stock: number | null;
  kategori: { nama: string } | null;
  satuan: { nama: string } | null;
}

export default function InventoryClient({ 
  initialProducts, 
  categories,
  units 
}: { 
  initialProducts: Product[];
  categories: { id: number; nama: string }[];
  units: { id: number; nama: string }[];
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [stockFilter, setStockFilter] = useState("all");
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: "asc" | "desc" } | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);

  const [isPending, startTransition] = useTransition();
  
  // Inline editing state
  const [editingId, setEditingId] = useState<number | 'new' | null>(null);
  const [editForm, setEditForm] = useState<Partial<Product>>({});
  
  const [errorMsg, setErrorMsg] = useState("");
  const [deleteModal, setDeleteModal] = useState<{ open: boolean; data: Product | null }>({
    open: false,
    data: null,
  });

  const processedProducts = useMemo(() => {
    let result = [...initialProducts];

    if (deferredSearchQuery.trim()) {
      const q = deferredSearchQuery.toLowerCase();
      result = result.filter(
        (p) =>
          p.nama_produk.toLowerCase().includes(q) ||
          p.barcode?.toLowerCase().includes(q) ||
          p.kategori?.nama.toLowerCase().includes(q)
      );
    }

    if (categoryFilter !== "all") {
      result = result.filter((p) => p.id_kategori.toString() === categoryFilter);
    }

    if (stockFilter !== "all") {
      result = result.filter((p) => {
        if (stockFilter === "untracked") return !p.hitung_stok;
        if (!p.hitung_stok || p.stock === null) return false;
        if (stockFilter === "out") return p.stock <= 0;
        if (stockFilter === "low") return p.stock > 0 && p.stock <= 20;
        if (stockFilter === "in") return p.stock > 20;
        return true;
      });
    }

    if (sortConfig) {
      result.sort((a, b) => {
        let aVal: string | number = "";
        let bVal: string | number = "";
        
        if (sortConfig.key === "kategori") {
          aVal = a.kategori?.nama || "";
          bVal = b.kategori?.nama || "";
        } else if (sortConfig.key === "satuan") {
          aVal = a.satuan?.nama || "";
          bVal = b.satuan?.nama || "";
        } else {
          aVal = (a[sortConfig.key as keyof Product] as string | number) ?? "";
          bVal = (b[sortConfig.key as keyof Product] as string | number) ?? "";
        }
        
        if (aVal < bVal) return sortConfig.direction === "asc" ? -1 : 1;
        if (aVal > bVal) return sortConfig.direction === "asc" ? 1 : -1;
        return 0;
      });
    }

    return result;
  }, [initialProducts, searchQuery, categoryFilter, stockFilter, sortConfig]);

  const totalPages = Math.max(1, Math.ceil(processedProducts.length / itemsPerPage));
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return processedProducts.slice(start, start + itemsPerPage);
  }, [processedProducts, currentPage, itemsPerPage]);

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
    if (!editForm.nama_produk?.trim()) {
      setErrorMsg("Nama produk wajib diisi");
      return;
    }
    if (!editForm.id_kategori) {
      setErrorMsg("Kategori wajib dipilih");
      return;
    }
    if (!editForm.id_satuan) {
      setErrorMsg("Satuan wajib dipilih");
      return;
    }
    setErrorMsg("");

    const data = {
      nama_produk: editForm.nama_produk,
      id_kategori: Number(editForm.id_kategori),
      id_satuan: Number(editForm.id_satuan),
      hitung_stok: Boolean(editForm.hitung_stok),
      barcode: editForm.barcode || null,
      harga_modal: Number(editForm.harga_modal || 0),
      harga_jual_satuan: Number(editForm.harga_jual_satuan || 0),
      harga_jual_grosir: Number(editForm.harga_jual_grosir || 0),
      harga_jual_promo: editForm.harga_jual_promo ? Number(editForm.harga_jual_promo) : null,
      diskon: Number(editForm.diskon || 0),
    };

    startTransition(async () => {
      let res;
      if (editingId === "new") {
        res = await addProduct(data);
      } else {
        res = await updateProduct(editingId as number, data);
      }
      
      if (res?.error) {
        setErrorMsg(res.error);
      } else {
        setEditingId(null);
        setEditForm({});
      }
    });
  };

  const handleDelete = () => {
    if (!deleteModal.data?.id) return;
    setErrorMsg("");
    const id = deleteModal.data.id;
    startTransition(async () => {
      const res = await deleteProduct(id);
      if (res?.error) {
        setErrorMsg(res.error);
      } else {
        setDeleteModal({ open: false, data: null });
      }
    });
  };

  const handleEditClick = (e: React.MouseEvent, product: Product) => {
    e.stopPropagation();
    setEditingId(product.id);
    setEditForm({
      ...product,
      hitung_stok: product.hitung_stok ?? true,
    });
    setErrorMsg("");
  };

  const handleCancelInline = () => {
    setEditingId(null);
    setEditForm({});
    setErrorMsg("");
  };

  const getStockBadge = (hitung_stok: boolean, stock: number | null) => {
    if (!hitung_stok) return <Badge variant="outline" className="text-muted-foreground border-border/50 font-normal rounded-full px-2 py-0.5 text-[10px] uppercase tracking-widest leading-tight">Tidak dilacak</Badge>;
    if (stock === null) return null;
    
    if (stock <= 0) {
      return <Badge variant="secondary" className="bg-destructive/10 text-destructive hover:bg-destructive/20 font-medium border-none rounded-full px-2 py-0.5 text-[10px] uppercase tracking-widest leading-tight">Habis</Badge>;
    }
    if (stock <= 20) {
      return <Badge variant="secondary" className="bg-warning/10 text-warning hover:bg-warning/20 font-medium border-none rounded-full px-2 py-0.5 text-[10px] uppercase tracking-widest leading-tight">{stock} Sisa</Badge>;
    }
    return <Badge variant="secondary" className="bg-primary/10 text-primary hover:bg-primary/20 font-medium border-none rounded-full px-2 py-0.5 text-[10px] uppercase tracking-widest leading-tight">Tersedia ({stock})</Badge>;
  };

  const renderInlineEditExpandedRow = () => (
    <TableRow className="bg-muted/10 border-t-0">
      <TableCell colSpan={8} className="py-3 px-6 bg-muted/5 border-b">
        <div className="flex flex-wrap items-center gap-6">
          <div className="flex items-center gap-2">
            <span className="text-[13px] text-muted-foreground">Satuan:</span>
            <select aria-label="Satuan Produk"
              value={editForm.id_satuan || ""} 
              onChange={(e) => setEditForm(prev => ({ ...prev, id_satuan: Number(e.target.value) }))}
              className="h-8 rounded-md border border-input bg-background px-2 text-[13px] shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/20"
            >
              <option value="">Pilih</option>
              {units.map((u) => <option key={u.id} value={u.id}>{u.nama}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[13px] text-muted-foreground">Diskon:</span>
            <Input 
              type="number"
              value={editForm.diskon || 0}
              onChange={(e) => setEditForm(prev => ({ ...prev, diskon: Number(e.target.value) }))}
              className="h-8 w-24 text-[13px] tabular-nums"
            />
          </div>
          <div className="flex items-center gap-2">
            <input 
              type="checkbox" 
              id="hitung_stok"
              checked={editForm.hitung_stok || false}
              onChange={(e) => setEditForm(prev => ({ ...prev, hitung_stok: e.target.checked }))}
              className="h-4 w-4 rounded-[4px] border border-input text-primary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/20 focus-visible:border-primary shadow-sm" 
            />
            <label htmlFor="hitung_stok" className="text-[13px] font-medium text-foreground cursor-pointer">
              Lacak Stok
            </label>
          </div>
          {errorMsg && (
            <div className="text-[13px] text-destructive flex items-center gap-1 ml-auto">
              <AlertCircle className="w-3 h-3" /> {errorMsg}
            </div>
          )}
        </div>
      </TableCell>
    </TableRow>
  );

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-background border border-border rounded-[12px] shadow-[0_1px_3px_rgba(0,55,112,0.08)] overflow-hidden relative">
      <div className="shrink-0 flex items-center justify-between p-4 lg:p-6 border-b border-border bg-transparent gap-4">
        <div className="flex-1 flex flex-wrap items-center gap-3">
          <div className="relative w-full max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input aria-label="Cari produk atau barcode..." placeholder="Cari produk atau barcode..." 
              className="pl-9 rounded-md"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              disabled={editingId !== null}
            />
          </div>
          
          <select aria-label="Filter Kategori" value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            disabled={editingId !== null}
            className="h-10 rounded-md border border-border bg-background px-3 py-2 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/20 text-muted-foreground disabled:opacity-50"
          >
            <option value="all">Semua Kategori</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.nama}</option>
            ))}
          </select>

          <select aria-label="Filter Stok" value={stockFilter}
            onChange={(e) => setStockFilter(e.target.value)}
            disabled={editingId !== null}
            className="h-10 rounded-md border border-border bg-background px-3 py-2 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/20 text-muted-foreground disabled:opacity-50"
          >
            <option value="all">Semua Stok</option>
            <option value="in">Tersedia</option>
            <option value="low">Hampir Habis</option>
            <option value="out">Habis</option>
            <option value="untracked">Tidak dilacak</option>
          </select>
        </div>

        <Button 
          className="rounded-full px-6 h-10 bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm ml-4 font-normal shrink-0"
          disabled={editingId !== null}
          onClick={() => {
            setEditingId('new');
            setEditForm({ hitung_stok: true, diskon: 0 });
            setCurrentPage(1);
            setErrorMsg("");
          }}
        >
          <Plus className="w-4 h-4 mr-2" />
          Tambah Produk
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
          <TableHeader className="hidden xl:table-header-group">
            <TableRow>
              <TableHead className="w-[140px] xl:pl-6 cursor-pointer select-none hover:text-foreground transition-colors" onClick={() => handleSort('barcode')}>
                Barcode {renderSortIcon("barcode")}
              </TableHead>
              <TableHead className="cursor-pointer select-none hover:text-foreground transition-colors" onClick={() => handleSort('nama_produk')}>
                Item {renderSortIcon("nama_produk")}
              </TableHead>
              <TableHead className="w-[160px] cursor-pointer select-none hover:text-foreground transition-colors" onClick={() => handleSort('kategori')}>
                Kategori {renderSortIcon("kategori")}
              </TableHead>
              <TableHead className="w-[140px] cursor-pointer select-none hover:text-foreground transition-colors" onClick={() => handleSort('stock')}>
                Status Stok {renderSortIcon("stock")}
              </TableHead>
              <TableHead className="text-left w-[140px] cursor-pointer select-none hover:text-foreground transition-colors" onClick={() => handleSort('harga_modal')}>
                Harga Modal {renderSortIcon("harga_modal")}
              </TableHead>
              <TableHead className="text-left w-[140px] cursor-pointer select-none hover:text-foreground transition-colors" onClick={() => handleSort('harga_jual_satuan')}>
                Harga Retail {renderSortIcon("harga_jual_satuan")}
              </TableHead>
              <TableHead className="text-left w-[140px] cursor-pointer select-none hover:text-foreground transition-colors" onClick={() => handleSort('harga_jual_grosir')}>
                Harga Grosir {renderSortIcon("harga_jual_grosir")}
              </TableHead>
              <TableHead className="text-left w-[140px] cursor-pointer select-none hover:text-foreground transition-colors" onClick={() => handleSort('harga_jual_promo')}>
                Harga Promo {renderSortIcon("harga_jual_promo")}
              </TableHead>
              <TableHead className="w-[80px] xl:pr-6"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {editingId === 'new' && (
              <>
                <TableRow className="bg-muted/10 border-b-2 xl:border-b-0 hover:bg-muted/10 flex flex-col xl:table-row p-4 xl:p-0 gap-3 xl:gap-0">
                  <TableCell className="xl:pl-6 align-top xl:pt-4 p-0 xl:p-2 block xl:table-cell">
                    <span className="xl:hidden text-xs font-medium text-muted-foreground uppercase tracking-widest mb-1 block">Barcode</span>
                    <Input aria-label="Barcode" placeholder="Barcode"
                      value={editForm.barcode || ""}
                      onChange={(e) => setEditForm(prev => ({ ...prev, barcode: e.target.value }))}
                      className="h-10 xl:h-8 text-[15px] xl:text-[13px] font-mono"
                    />
                  </TableCell>
                  <TableCell className="align-top xl:pt-4 p-0 xl:p-2 block xl:table-cell">
                    <span className="xl:hidden text-xs font-medium text-muted-foreground uppercase tracking-widest mb-1 block">Nama Produk</span>
                    <Input autoFocus aria-label="Nama Produk" placeholder="Nama Produk"
                      value={editForm.nama_produk || ""}
                      onChange={(e) => setEditForm(prev => ({ ...prev, nama_produk: e.target.value }))}
                      className="h-10 xl:h-8 text-[15px] xl:text-[13px]"
                    />
                  </TableCell>
                  <TableCell className="align-top xl:pt-4 p-0 xl:p-2 block xl:table-cell">
                    <span className="xl:hidden text-xs font-medium text-muted-foreground uppercase tracking-widest mb-1 block">Kategori Produk</span>
                    <select aria-label="Kategori Produk"
                      value={editForm.id_kategori || ""} 
                      onChange={(e) => setEditForm(prev => ({ ...prev, id_kategori: Number(e.target.value) }))}
                      className="w-full h-10 xl:h-8 rounded-md border border-input bg-background px-3 xl:px-2 text-[15px] xl:text-[13px] shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/20"
                    >
                      <option value="">Pilih</option>
                      {categories.map((c) => <option key={c.id} value={c.id}>{c.nama}</option>)}
                    </select>
                  </TableCell>
                  <TableCell className="align-top xl:pt-4 p-0 xl:p-2 block xl:table-cell">
                    <span className="xl:hidden text-xs font-medium text-muted-foreground uppercase tracking-widest mb-1 block">Status Stok</span>
                    {getStockBadge(editForm.hitung_stok ?? true, null)}
                  </TableCell>
                  <TableCell className="align-top xl:pt-4 p-0 xl:p-2 block xl:table-cell">
                    <span className="xl:hidden text-xs font-medium text-muted-foreground uppercase tracking-widest mb-1 block">Harga Modal</span>
                    <Input type="number" aria-label="0" placeholder="0"
                      value={editForm.harga_modal || ""}
                      onChange={(e) => setEditForm(prev => ({ ...prev, harga_modal: Number(e.target.value) }))}
                      className="h-10 xl:h-8 text-[15px] xl:text-[13px] tabular-nums"
                    />
                  </TableCell>
                  <TableCell className="align-top xl:pt-4 p-0 xl:p-2 block xl:table-cell">
                    <span className="xl:hidden text-xs font-medium text-muted-foreground uppercase tracking-widest mb-1 block">Harga Retail</span>
                    <Input type="number" aria-label="0" placeholder="0"
                      value={editForm.harga_jual_satuan || ""}
                      onChange={(e) => setEditForm(prev => ({ ...prev, harga_jual_satuan: Number(e.target.value) }))}
                      className="h-10 xl:h-8 text-[15px] xl:text-[13px] tabular-nums"
                    />
                  </TableCell>
                  <TableCell className="align-top xl:pt-4 p-0 xl:p-2 block xl:table-cell">
                    <span className="xl:hidden text-xs font-medium text-muted-foreground uppercase tracking-widest mb-1 block">Harga Grosir</span>
                    <Input type="number" aria-label="0" placeholder="0"
                      value={editForm.harga_jual_grosir || ""}
                      onChange={(e) => setEditForm(prev => ({ ...prev, harga_jual_grosir: Number(e.target.value) }))}
                      className="h-10 xl:h-8 text-[15px] xl:text-[13px] tabular-nums"
                    />
                  </TableCell>
                  <TableCell className="align-top xl:pt-4 p-0 xl:p-2 block xl:table-cell">
                    <span className="xl:hidden text-xs font-medium text-muted-foreground uppercase tracking-widest mb-1 block">Harga Promo</span>
                    <Input type="number" aria-label="0" placeholder="0"
                      value={editForm.harga_jual_promo || ""}
                      onChange={(e) => setEditForm(prev => ({ ...prev, harga_jual_promo: Number(e.target.value) }))}
                      className="h-10 xl:h-8 text-[15px] xl:text-[13px] tabular-nums"
                    />
                  </TableCell>
                  <TableCell className="xl:pr-6 align-top pt-2 xl:pt-4 text-right p-0 xl:p-2 block xl:table-cell mt-2 xl:mt-0">
                    <div className="flex justify-end gap-2 xl:gap-1">
                      <Button variant="outline" size="icon" aria-label="Batal Edit" className="h-11 w-11 xl:h-8 xl:w-8 text-muted-foreground hover:text-foreground" onClick={handleCancelInline} disabled={isPending}>
                        <X className="h-4 w-4" />
                      </Button>
                      <Button variant="default" size="icon" aria-label="Simpan Edit" className="h-11 w-11 xl:h-8 xl:w-8" onClick={handleSaveInline} disabled={isPending}>
                        {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
                {renderInlineEditExpandedRow()}
              </>
            )}

            {paginatedData.length === 0 && editingId !== 'new' ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-32 hover:bg-transparent">
                  <div className="flex flex-col items-center justify-center text-muted-foreground">
                    <PackageOpen className="w-12 h-12 mb-4 opacity-20" />
                    <p className="text-base font-medium text-foreground">Tidak ada produk ditemukan</p>
                    <p className="text-sm mt-1">Coba gunakan kata kunci pencarian atau filter yang lain.</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              paginatedData.map((p) => {
                if (editingId === p.id) {
                  return (
                    <React.Fragment key={p.id}>
                      <TableRow className="bg-muted/10 border-b-2 xl:border-b-0 hover:bg-muted/10 flex flex-col xl:table-row p-4 xl:p-0 gap-3 xl:gap-0">
                        <TableCell className="xl:pl-6 align-top xl:pt-4 p-0 xl:p-2 block xl:table-cell">
                          <span className="xl:hidden text-xs font-medium text-muted-foreground uppercase tracking-widest mb-1 block">Barcode</span>
                          <Input aria-label="Barcode" placeholder="Barcode"
                            value={editForm.barcode || ""}
                            onChange={(e) => setEditForm(prev => ({ ...prev, barcode: e.target.value }))}
                            className="h-10 xl:h-8 text-[15px] xl:text-[13px] font-mono"
                          />
                        </TableCell>
                        <TableCell className="align-top xl:pt-4 p-0 xl:p-2 block xl:table-cell">
                          <span className="xl:hidden text-xs font-medium text-muted-foreground uppercase tracking-widest mb-1 block">Nama Produk</span>
                          <Input autoFocus aria-label="Nama Produk" placeholder="Nama Produk"
                            value={editForm.nama_produk || ""}
                            onChange={(e) => setEditForm(prev => ({ ...prev, nama_produk: e.target.value }))}
                            className="h-10 xl:h-8 text-[15px] xl:text-[13px]"
                          />
                        </TableCell>
                        <TableCell className="align-top xl:pt-4 p-0 xl:p-2 block xl:table-cell">
                          <span className="xl:hidden text-xs font-medium text-muted-foreground uppercase tracking-widest mb-1 block">Kategori Produk</span>
                          <select aria-label="Kategori Produk"
                            value={editForm.id_kategori || ""} 
                            onChange={(e) => setEditForm(prev => ({ ...prev, id_kategori: Number(e.target.value) }))}
                            className="w-full h-10 xl:h-8 rounded-md border border-input bg-background px-3 xl:px-2 text-[15px] xl:text-[13px] shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/20"
                          >
                            <option value="">Pilih</option>
                            {categories.map((c) => <option key={c.id} value={c.id}>{c.nama}</option>)}
                          </select>
                        </TableCell>
                        <TableCell className="align-top xl:pt-4 p-0 xl:p-2 block xl:table-cell">
                          <span className="xl:hidden text-xs font-medium text-muted-foreground uppercase tracking-widest mb-1 block">Status Stok</span>
                          {getStockBadge(editForm.hitung_stok ?? true, p.stock)}
                        </TableCell>
                        <TableCell className="align-top xl:pt-4 p-0 xl:p-2 block xl:table-cell">
                          <span className="xl:hidden text-xs font-medium text-muted-foreground uppercase tracking-widest mb-1 block">Harga Modal</span>
                          <Input type="number" aria-label="0" placeholder="0"
                            value={editForm.harga_modal || ""}
                            onChange={(e) => setEditForm(prev => ({ ...prev, harga_modal: Number(e.target.value) }))}
                            className="h-10 xl:h-8 text-[15px] xl:text-[13px] tabular-nums"
                          />
                        </TableCell>
                        <TableCell className="align-top xl:pt-4 p-0 xl:p-2 block xl:table-cell">
                          <span className="xl:hidden text-xs font-medium text-muted-foreground uppercase tracking-widest mb-1 block">Harga Retail</span>
                          <Input type="number" aria-label="0" placeholder="0"
                            value={editForm.harga_jual_satuan || ""}
                            onChange={(e) => setEditForm(prev => ({ ...prev, harga_jual_satuan: Number(e.target.value) }))}
                            className="h-10 xl:h-8 text-[15px] xl:text-[13px] tabular-nums"
                          />
                        </TableCell>
                        <TableCell className="align-top xl:pt-4 p-0 xl:p-2 block xl:table-cell">
                          <span className="xl:hidden text-xs font-medium text-muted-foreground uppercase tracking-widest mb-1 block">Harga Grosir</span>
                          <Input type="number" aria-label="0" placeholder="0"
                            value={editForm.harga_jual_grosir || ""}
                            onChange={(e) => setEditForm(prev => ({ ...prev, harga_jual_grosir: Number(e.target.value) }))}
                            className="h-10 xl:h-8 text-[15px] xl:text-[13px] tabular-nums"
                          />
                        </TableCell>
                        <TableCell className="align-top xl:pt-4 p-0 xl:p-2 block xl:table-cell">
                          <span className="xl:hidden text-xs font-medium text-muted-foreground uppercase tracking-widest mb-1 block">Harga Promo</span>
                          <Input type="number" aria-label="0" placeholder="0"
                            value={editForm.harga_jual_promo || ""}
                            onChange={(e) => setEditForm(prev => ({ ...prev, harga_jual_promo: Number(e.target.value) }))}
                            className="h-10 xl:h-8 text-[15px] xl:text-[13px] tabular-nums"
                          />
                        </TableCell>
                        <TableCell className="xl:pr-6 align-top pt-2 xl:pt-4 text-right p-0 xl:p-2 block xl:table-cell mt-2 xl:mt-0">
                          <div className="flex justify-end gap-2 xl:gap-1">
                            <Button variant="outline" size="icon" aria-label="Batal Edit" className="h-11 w-11 xl:h-8 xl:w-8 text-muted-foreground hover:text-foreground" onClick={handleCancelInline} disabled={isPending}>
                              <X className="h-4 w-4" />
                            </Button>
                            <Button variant="default" size="icon" aria-label="Simpan Edit" className="h-11 w-11 xl:h-8 xl:w-8" onClick={handleSaveInline} disabled={isPending}>
                              {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                {renderInlineEditExpandedRow()}
                    </React.Fragment>
                  );
                }

                return (
                  <TableRow 
                    key={p.id} 
                    className="group hover:bg-muted/30 transition-colors flex flex-col xl:table-row p-4 xl:p-0 border-b"
                  >
                    <TableCell className="xl:pl-6 py-2 xl:py-4 block xl:table-cell">
                      <span className="xl:hidden text-xs font-medium text-muted-foreground uppercase tracking-widest mb-1 block">Barcode</span>
                      <span className="font-mono text-[14px]">{p.barcode || "-"}</span>
                    </TableCell>
                    <TableCell className="py-2 xl:py-4 block xl:table-cell">
                      <span className="xl:hidden text-xs font-medium text-muted-foreground uppercase tracking-widest mb-1 block">Item</span>
                      <p className="text-foreground text-[15px] xl:text-[14px] font-medium xl:font-normal line-clamp-2 xl:line-clamp-1">{p.nama_produk}</p>
                    </TableCell>
                    <TableCell className="py-2 xl:py-4 block xl:table-cell">
                      <span className="xl:hidden text-xs font-medium text-muted-foreground uppercase tracking-widest mb-1 block">Kategori</span>
                      {p.kategori?.nama || "-"}
                    </TableCell>
                    <TableCell className="py-2 xl:py-4 block xl:table-cell">
                      <span className="xl:hidden text-xs font-medium text-muted-foreground uppercase tracking-widest mb-1 block">Status Stok</span>
                      {getStockBadge(p.hitung_stok, p.stock)}
                    </TableCell>
                    <TableCell className="xl:text-left py-2 xl:py-4 tabular-nums block xl:table-cell">
                      <span className="xl:hidden text-xs font-medium text-muted-foreground uppercase tracking-widest mb-1 block">Harga Modal</span>
                      {formatIDR(p.harga_modal)}
                    </TableCell>
                    <TableCell className="xl:text-left py-2 xl:py-4 tabular-nums block xl:table-cell">
                      <span className="xl:hidden text-xs font-medium text-muted-foreground uppercase tracking-widest mb-1 block">Harga Retail</span>
                      {formatIDR(p.harga_jual_satuan)}
                    </TableCell>
                    <TableCell className="xl:text-left py-2 xl:py-4 tabular-nums block xl:table-cell">
                      <span className="xl:hidden text-xs font-medium text-muted-foreground uppercase tracking-widest mb-1 block">Harga Grosir</span>
                      {formatIDR(p.harga_jual_grosir)}
                    </TableCell>
                    <TableCell className="xl:text-left py-2 xl:py-4 tabular-nums block xl:table-cell">
                      <span className="xl:hidden text-xs font-medium text-muted-foreground uppercase tracking-widest mb-1 block">Harga Promo</span>
                      {p.harga_jual_promo != null ? formatIDR(p.harga_jual_promo) : "-"}
                    </TableCell>
                    <TableCell className="xl:pr-6 py-3 xl:py-4 text-right block xl:table-cell mt-2 xl:mt-0 border-t xl:border-t-0 border-border/50">
                      <div className="flex justify-end gap-2 xl:gap-1 opacity-100 xl:opacity-0 xl:group-hover:opacity-100 transition-opacity">
                        <Button variant="outline" size="icon" aria-label="Edit p" className="h-11 w-11 xl:h-8 xl:w-8 xl:border-transparent xl:bg-transparent text-muted-foreground hover:text-foreground" onClick={(e) => handleEditClick(e, p)} disabled={editingId !== null}>
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button variant="outline" size="icon" aria-label="Hapus p" className="h-11 w-11 xl:h-8 xl:w-8 xl:border-transparent xl:bg-transparent text-muted-foreground hover:text-destructive hover:bg-destructive/10" onClick={(e) => { e.stopPropagation(); setDeleteModal({ open: true, data: p }); }} disabled={editingId !== null}>
                          <Trash2 className="h-4 w-4" />
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

      <div className="shrink-0 flex items-center justify-between gap-4 px-4 lg:px-6 py-3 border-t border-border bg-background">
        <p className="text-[13px] text-muted-foreground tabular-nums">
          Menampilkan{" "}
          <span className="font-medium text-foreground">
            {processedProducts.length === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1}
          </span>{" "}
          hingga{" "}
          <span className="font-medium text-foreground">
            {Math.min(currentPage * itemsPerPage, processedProducts.length)}
          </span>{" "}
          dari{" "}
          <span className="font-medium text-foreground">{processedProducts.length}</span>{" "}
          produk
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

      {deleteModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-overlay/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-background border border-border shadow-[0_8px_24px_rgba(0,55,112,0.08),0_2px_6px_rgba(0,55,112,0.04)] rounded-[12px] w-full max-w-md flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 text-center">
              <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center text-destructive mx-auto mb-4">
                <Trash2 className="w-6 h-6" />
              </div>
              <h2 className="text-[22px] font-light tracking-tight text-foreground mb-2">Hapus Produk?</h2>
              <p className="text-sm text-muted-foreground">
                Apakah Anda yakin ingin menghapus data produk <strong className="text-foreground">{deleteModal.data?.nama_produk}</strong>? Tindakan ini tidak dapat dibatalkan.
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
                Hapus Produk
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
