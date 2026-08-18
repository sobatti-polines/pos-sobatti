"use client";

import { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Loader2, PackageOpen, CheckSquare, Square, Filter, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { fetchAllRows } from "@/lib/supabase/fetch-all";
import { cn } from "@/lib/utils";
import { Select } from "@/components/ui/select";

export interface PrintProduct {
  id: number;
  nama_produk: string;
  barcode: string;
  harga_jual_satuan: number;
  sku: string;
  harga_modal: number;
  id_merk: number | null;
  id_lokasi_area: number | null;
}

interface ProductSelectorModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onInsert: (selected: PrintProduct[]) => void;
}

export function ProductSelectorModal({ open, onOpenChange, onInsert }: ProductSelectorModalProps) {
  const [search, setSearch] = useState("");
  const [products, setProducts] = useState<PrintProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  // Filter state
  const [merkFilter, setMerkFilter] = useState("all");
  const [lokasiFilter, setLokasiFilter] = useState("all");
  const [merks, setMerks] = useState<{ id: number; nama: string }[]>([]);
  const [lokasiAreas, setLokasiAreas] = useState<{ id: number; nama: string }[]>([]);

  useEffect(() => {
    if (open) {
      fetchProducts("");
      fetchRefData();
      setSelectedIds(new Set());
      setSearch("");
      setMerkFilter("all");
      setLokasiFilter("all");
    }
  }, [open]);

  const fetchRefData = async () => {
    const supabase = createClient();
    const [merksRes, lokasiRes] = await Promise.all([
      supabase.from("merk").select("id, nama").order("nama"),
      supabase.from("lokasi_area").select("id, nama").order("nama"),
    ]);
    setMerks(merksRes.data || []);
    setLokasiAreas(lokasiRes.data || []);
  };

  const fetchProducts = async (query: string) => {
    setLoading(true);
    const supabase = createClient();

    try {
      const data = await fetchAllRows<PrintProduct>(supabase, (db, from, to) => {
        let q = db
          .from("produk")
          .select("id, nama_produk, barcode, harga_jual_satuan, sku, harga_modal, id_merk, id_lokasi_area")
          .order("nama_produk", { ascending: true })
          .range(from, to);
        if (query) {
          q = q.ilike("nama_produk", `%${query}%`);
        }
        return q;
      });
      setProducts(data);
    } catch (e) {
      console.error("Gagal memuat produk:", e);
      setProducts([]);
    }
    setLoading(false);
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchProducts(search);
  };

  // Filter produk: hanya yang harga_jual_satuan > 0 + filter merk & lokasi
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      // Hanya produk dengan harga retail > 0
      if (!p.harga_jual_satuan || p.harga_jual_satuan <= 0) return false;
      // Filter merk
      if (merkFilter !== "all") {
        if (merkFilter === "none") {
          if (p.id_merk != null) return false;
        } else {
          if (p.id_merk?.toString() !== merkFilter) return false;
        }
      }
      // Filter lokasi
      if (lokasiFilter !== "all") {
        if (lokasiFilter === "none") {
          if (p.id_lokasi_area != null) return false;
        } else {
          if (p.id_lokasi_area?.toString() !== lokasiFilter) return false;
        }
      }
      return true;
    });
  }, [products, merkFilter, lokasiFilter]);

  const hasFilters = merkFilter !== "all" || lokasiFilter !== "all";

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredProducts.length && filteredProducts.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredProducts.map(p => p.id)));
    }
  };

  const toggleSelect = (id: number) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedIds(newSet);
  };

  const handleInsert = () => {
    const selectedProducts = products.filter(p => selectedIds.has(p.id));
    onInsert(selectedProducts);
    onOpenChange(false);
  };

  const clearFilters = () => {
    setMerkFilter("all");
    setLokasiFilter("all");
  };

  const allSelected = filteredProducts.length > 0 && selectedIds.size === filteredProducts.length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] lg:max-w-6xl h-[90vh] flex flex-col p-0 gap-0 overflow-hidden bg-background">
        
        {/* Header Section */}
        <div className="flex flex-col border-b border-border bg-muted/20">
          <DialogHeader className="px-4 sm:px-6 py-5 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <PackageOpen className="w-5 h-5 text-primary" />
              </div>
              <div>
                <DialogTitle className="text-xl">Pilih Produk</DialogTitle>
                <DialogDescription>
                  Pilih produk yang memiliki harga retail untuk antrean cetak label.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {/* Search + Filters */}
          <div className="px-4 sm:px-6 pb-4 space-y-3">
            <form onSubmit={handleSearch} className="flex gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input 
                  placeholder="Ketik nama produk lalu tekan enter..." 
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-11 h-12 text-base rounded-xl bg-background border-border shadow-sm focus-visible:ring-primary/20"
                />
              </div>
              <Button type="submit" disabled={loading} size="lg" className="h-12 px-8 rounded-xl">
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Cari"}
              </Button>
            </form>

            {/* Filter Row */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Filter className="w-3.5 h-3.5" />
                <span>Filter:</span>
              </div>
              
              <Select value={merkFilter} onChange={(e) => setMerkFilter(e.target.value)} className="w-[160px] h-9 text-sm rounded-lg">
                <option value="all">Semua Merk</option>
                {merks.map((m) => (
                  <option key={m.id} value={m.id.toString()}>{m.nama}</option>
                ))}
                <option value="none">Tanpa Merk</option>
              </Select>

              <Select value={lokasiFilter} onChange={(e) => setLokasiFilter(e.target.value)} className="w-[160px] h-9 text-sm rounded-lg">
                <option value="all">Semua Lokasi</option>
                {lokasiAreas.map((l) => (
                  <option key={l.id} value={l.id.toString()}>{l.nama}</option>
                ))}
                <option value="none">Tanpa Lokasi</option>
              </Select>

              {hasFilters && (
                <Button variant="ghost" size="sm" onClick={clearFilters} className="text-xs text-muted-foreground hover:text-foreground gap-1">
                  <X className="w-3 h-3" />
                  Reset
                </Button>
              )}

              <span className="text-xs text-muted-foreground ml-auto">
                {filteredProducts.length} produk dengan harga retail
              </span>
            </div>
          </div>
        </div>

        {/* Content Section (Table) */}
        <div className="flex-1 overflow-y-auto relative bg-background">
          {loading && products.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/50 z-10 backdrop-blur-sm">
              <div className="flex flex-col items-center gap-2">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">Memuat data produk...</p>
              </div>
            </div>
          )}
          
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-muted-foreground uppercase bg-muted/50 sticky top-0 z-10 backdrop-blur-md">
              <tr>
                <th className="px-3 sm:px-6 py-4 w-16">
                  <button 
                    onClick={toggleSelectAll}
                    disabled={filteredProducts.length === 0}
                    className="flex items-center justify-center w-full h-full text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                  >
                    {allSelected ? (
                      <CheckSquare className="w-5 h-5 text-primary" />
                    ) : (
                      <Square className="w-5 h-5" />
                    )}
                  </button>
                </th>
                <th className="px-3 sm:px-4 py-4 font-semibold tracking-wider">Nama Produk</th>
                <th className="px-3 sm:px-4 py-4 font-semibold tracking-wider">Barcode</th>
                <th className="px-3 sm:px-6 py-4 font-semibold tracking-wider text-right">Harga Jual</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredProducts.length === 0 && !loading && (
                <tr>
                  <td colSpan={4} className="px-4 py-16">
                    <div className="flex flex-col items-center justify-center text-center">
                      <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                        <Search className="w-8 h-8 text-muted-foreground/50" />
                      </div>
                      <p className="text-base font-medium text-foreground">Tidak ada produk ditemukan</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        {products.length > 0 && !hasFilters
                          ? "Tidak ada produk dengan harga retail > 0."
                          : "Coba ubah filter atau kata kunci pencarian."}
                      </p>
                    </div>
                  </td>
                </tr>
              )}
              {filteredProducts.map((product) => {
                const isSelected = selectedIds.has(product.id);
                return (
                  <tr 
                    key={product.id} 
                    className={cn(
                      "hover:bg-muted/40 cursor-pointer transition-colors group",
                      isSelected && "bg-primary/5 hover:bg-primary/10"
                    )}
                    onClick={() => toggleSelect(product.id)}
                  >
                    <td className="px-3 sm:px-6 py-4 text-center">
                      <button 
                        className={cn(
                          "transition-colors",
                          isSelected ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
                        )}
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleSelect(product.id);
                        }}
                      >
                        {isSelected ? (
                          <CheckSquare className="w-5 h-5" />
                        ) : (
                          <Square className="w-5 h-5" />
                        )}
                      </button>
                    </td>
                    <td className="px-3 sm:px-4 py-4">
                      <span className={cn("font-medium text-base", isSelected ? "text-foreground" : "text-foreground/90")}>
                        {product.nama_produk}
                      </span>
                    </td>
                    <td className="px-3 sm:px-4 py-4">
                      {product.barcode ? (
                        <span className="font-mono text-xs bg-muted px-2 py-1 rounded-md text-muted-foreground">
                          {product.barcode}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground/50 italic">Kosong</span>
                      )}
                    </td>
                    <td className="px-3 sm:px-6 py-4 text-right">
                      <span className="font-medium text-foreground">
                        {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(product.harga_jual_satuan)}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Footer Section */}
        <div className="border-t border-border bg-background p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="bg-primary/10 text-primary px-4 py-2 rounded-lg text-sm font-medium text-center whitespace-nowrap">
              {selectedIds.size} Produk Terpilih
            </div>
            {selectedIds.size > 0 && (
              <Button variant="ghost" size="sm" onClick={() => setSelectedIds(new Set())} className="text-muted-foreground hover:text-foreground">
                Batal Pilih Semua
              </Button>
            )}
          </div>
          <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
            <Button variant="outline" size="lg" onClick={() => onOpenChange(false)} className="px-4 sm:px-8 rounded-xl w-full sm:w-auto">
              Batal
            </Button>
            <Button size="lg" onClick={handleInsert} disabled={selectedIds.size === 0} className="px-4 sm:px-8 rounded-xl shadow-sm w-full sm:w-auto">
              Masukkan ke Antrean
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
