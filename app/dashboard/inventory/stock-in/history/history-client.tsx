"use client";

import { useState, useMemo, useEffect } from "react";
import { Search, Calendar, ChevronLeft, ChevronRight, PackagePlus, Filter, ChevronDown, ChevronUp } from "lucide-react";
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

function formatIDR(n: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
}

function formatDate(dateStr: string) {
  const date = new Date(dateStr);
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

export default function StockInHistoryClient({ 
  initialHistory, 
  suppliers 
}: { 
  initialHistory: any[];
  suppliers: any[];
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [supplierFilter, setSupplierFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState({ start: "", end: "" });
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: "asc" | "desc" } | null>(null);

  const filteredHistory = useMemo(() => {
    let result = [...initialHistory];

    // Search filter (produk)
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (h) => h.produk?.nama_produk.toLowerCase().includes(q)
      );
    }

    // Supplier filter
    if (supplierFilter !== "all") {
      result = result.filter((h) => h.supplier?.id.toString() === supplierFilter);
    }

    // Date range filter
    if (dateFilter.start) {
      const start = new Date(dateFilter.start);
      start.setHours(0, 0, 0, 0);
      result = result.filter((h) => new Date(h.tgl_masuk) >= start);
    }
    if (dateFilter.end) {
      const end = new Date(dateFilter.end);
      end.setHours(23, 59, 59, 999);
      result = result.filter((h) => new Date(h.tgl_masuk) <= end);
    }

    // Sort
    if (sortConfig) {
      result.sort((a: any, b: any) => {
        let aVal = a[sortConfig.key];
        let bVal = b[sortConfig.key];
        
        if (sortConfig.key === "supplier") {
          aVal = a.supplier?.nama_supplier || "Umum";
          bVal = b.supplier?.nama_supplier || "Umum";
        } else if (sortConfig.key === "produk") {
          aVal = a.produk?.nama_produk || "";
          bVal = b.produk?.nama_produk || "";
        }
        
        if (aVal < bVal) return sortConfig.direction === "asc" ? -1 : 1;
        if (aVal > bVal) return sortConfig.direction === "asc" ? 1 : -1;
        return 0;
      });
    }

    return result;
  }, [initialHistory, searchQuery, supplierFilter, dateFilter, sortConfig]);

  const totalValue = useMemo(() => {
    return filteredHistory.reduce((sum, h) => sum + Number(h.total), 0);
  }, [filteredHistory]);

  const totalPages = Math.max(1, Math.ceil(filteredHistory.length / itemsPerPage));
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredHistory.slice(start, start + itemsPerPage);
  }, [filteredHistory, currentPage, itemsPerPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, supplierFilter, dateFilter, itemsPerPage, sortConfig]);

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

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-background border border-border rounded-[12px] shadow-[0_1px_3px_rgba(0,55,112,0.08)] overflow-hidden relative">
      <div className="shrink-0 flex flex-col p-4 lg:p-6 border-b border-border bg-transparent gap-6">
        {/* Subtotals Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-muted/30 rounded-xl p-4 border border-border/50">
            <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-widest mb-1">Total Nilai Pembelian</p>
            <p className="text-2xl font-light tracking-tight text-foreground tabular-nums">{formatIDR(totalValue)}</p>
          </div>
          <div className="bg-muted/30 rounded-xl p-4 border border-border/50">
            <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-widest mb-1">Jumlah Catatan</p>
            <p className="text-2xl font-light tracking-tight text-foreground tabular-nums">{filteredHistory.length}</p>
          </div>
        </div>

        {/* Filters Row */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex-1 flex flex-wrap items-center gap-3">
            <div className="relative w-full max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input 
                placeholder="Cari produk..." 
                className="pl-9 rounded-md"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            
            <div className="flex items-center gap-2">
              <div className="relative">
                <Input 
                  type="date" 
                  className="rounded-md border px-3 py-2 text-sm w-40"
                  value={dateFilter.start}
                  onChange={(e) => setDateFilter(prev => ({ ...prev, start: e.target.value }))}
                />
              </div>
              <span className="text-muted-foreground">s/d</span>
              <div className="relative">
                <Input 
                  type="date" 
                  className="rounded-md border px-3 py-2 text-sm w-40"
                  value={dateFilter.end}
                  onChange={(e) => setDateFilter(prev => ({ ...prev, end: e.target.value }))}
                />
              </div>
            </div>

            <select value={supplierFilter}
              onChange={(e) => setSupplierFilter(e.target.value)}
              className="h-10 rounded-md border border-border bg-background px-3 py-2 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/20 text-muted-foreground"
            >
              <option value="all">Semua Supplier</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>{s.nama_supplier}</option>
              ))}
            </select>
          </div>

          <Button variant="outline" className="h-10 rounded-full gap-2 shrink-0" onClick={() => {
            setSearchQuery("");
            setSupplierFilter("all");
            setDateFilter({ start: "", end: "" });
          }}>
            Reset
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto min-h-0 relative">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[140px] pl-6 cursor-pointer select-none hover:text-foreground transition-colors" onClick={() => handleSort('tgl_masuk')}>
                Tanggal <SortIcon columnKey="tgl_masuk" />
              </TableHead>
              <TableHead className="cursor-pointer select-none hover:text-foreground transition-colors" onClick={() => handleSort('supplier')}>
                Supplier <SortIcon columnKey="supplier" />
              </TableHead>
              <TableHead className="cursor-pointer select-none hover:text-foreground transition-colors" onClick={() => handleSort('produk')}>
                Produk <SortIcon columnKey="produk" />
              </TableHead>
              <TableHead className="w-[140px] text-right cursor-pointer select-none hover:text-foreground transition-colors" onClick={() => handleSort('harga_beli')}>
                Harga Beli <SortIcon columnKey="harga_beli" />
              </TableHead>
              <TableHead className="w-[100px] text-center cursor-pointer select-none hover:text-foreground transition-colors" onClick={() => handleSort('jumlah')}>
                Jumlah <SortIcon columnKey="jumlah" />
              </TableHead>
              <TableHead className="w-[160px] text-right pr-6 cursor-pointer select-none hover:text-foreground transition-colors" onClick={() => handleSort('total')}>
                Total <SortIcon columnKey="total" />
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedData.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-32">
                  <div className="flex flex-col items-center justify-center text-muted-foreground">
                    <PackagePlus className="w-12 h-12 mb-4 opacity-20" />
                    <p className="text-base font-medium text-foreground">Tidak ada riwayat barang masuk ditemukan</p>
                    <p className="text-sm mt-1">Coba gunakan kata kunci pencarian atau filter yang lain.</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              paginatedData.map((h) => (
                <TableRow key={h.id}>
                  <TableCell className="pl-6">
                    {formatDate(h.tgl_masuk)}
                  </TableCell>
                  <TableCell>
                    {h.supplier?.nama_supplier || "Umum"}
                  </TableCell>
                  <TableCell>
                    {h.produk?.nama_produk || "Produk dihapus"}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatIDR(h.harga_beli)}
                  </TableCell>
                  <TableCell className="text-center">
                    {h.jumlah}
                  </TableCell>
                  <TableCell className="text-right pr-6">
                    {formatIDR(h.total)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="shrink-0 flex items-center justify-between gap-4 px-4 lg:px-6 py-3 border-t border-border bg-background">
        <p className="text-[13px] text-muted-foreground tabular-nums">
          Menampilkan{" "}
          <span className="font-medium text-foreground">
            {filteredHistory.length === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1}
          </span>{" "}
          hingga{" "}
          <span className="font-medium text-foreground">
            {Math.min(currentPage * itemsPerPage, filteredHistory.length)}
          </span>{" "}
          dari{" "}
          <span className="font-medium text-foreground">{filteredHistory.length}</span>{" "}
          catatan
        </p>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-[13px] text-muted-foreground whitespace-nowrap">Baris per halaman</span>
            <select
              value={itemsPerPage}
              onChange={(e) => setItemsPerPage(Number(e.target.value))}
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
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="h-11 w-11 md:h-8 md:w-8 p-0 rounded-full bg-background"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="h-11 w-11 md:h-8 md:w-8 p-0 rounded-full bg-background"
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
