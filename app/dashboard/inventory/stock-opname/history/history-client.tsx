"use client";

import { useState, useMemo } from "react";
import { Search, Calendar, ChevronLeft, ChevronRight, ClipboardList, Filter } from "lucide-react";
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

function formatDate(dateStr: string) {
  const date = new Date(dateStr);
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

export default function OpnameHistoryClient({ initialHistory }: { initialHistory: any[] }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [dateFilter, setDateFilter] = useState({ start: "", end: "" });
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15;

  const filteredHistory = useMemo(() => {
    let result = [...initialHistory];

    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (h) => h.produk?.nama_produk.toLowerCase().includes(q) || h.keterangan?.toLowerCase().includes(q)
      );
    }

    // Date range filter
    if (dateFilter.start) {
      const start = new Date(dateFilter.start);
      start.setHours(0, 0, 0, 0);
      result = result.filter((h) => new Date(h.tgl_opname) >= start);
    }
    if (dateFilter.end) {
      const end = new Date(dateFilter.end);
      end.setHours(23, 59, 59, 999);
      result = result.filter((h) => new Date(h.tgl_opname) <= end);
    }

    return result;
  }, [initialHistory, searchQuery, dateFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredHistory.length / itemsPerPage));
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredHistory.slice(start, start + itemsPerPage);
  }, [filteredHistory, currentPage]);

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-background border border-border rounded-[12px] shadow-[0_1px_3px_rgba(0,55,112,0.08)] overflow-hidden relative">
      <div className="shrink-0 flex items-center justify-between p-4 lg:p-6 border-b border-border bg-transparent gap-4">
        <div className="flex-1 flex flex-wrap items-center gap-3">
          <div className="relative w-full max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input 
              placeholder="Cari produk atau keterangan..." 
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
        </div>

        <Button variant="outline" className="h-10 rounded-full gap-2 shrink-0" onClick={() => {
          setSearchQuery("");
          setDateFilter({ start: "", end: "" });
        }}>
          Reset
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto min-h-0 relative">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[140px] pl-6">Tanggal</TableHead>
              <TableHead>Produk</TableHead>
              <TableHead className="w-[140px] text-center">Stok Sistem</TableHead>
              <TableHead className="w-[140px] text-center">Stok Fisik</TableHead>
              <TableHead className="w-[140px] text-center">Selisih</TableHead>
              <TableHead>Keterangan</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedData.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-32">
                  <div className="flex flex-col items-center justify-center text-muted-foreground">
                    <ClipboardList className="w-12 h-12 mb-4 opacity-20" />
                    <p className="text-base font-medium text-foreground">Tidak ada data opname ditemukan</p>
                    <p className="text-sm mt-1">Coba gunakan kata kunci pencarian atau filter yang lain.</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              paginatedData.map((h) => (
                <TableRow key={h.id}>
                  <TableCell className="pl-6">
                    {formatDate(h.tgl_opname)}
                  </TableCell>
                  <TableCell>
                    {h.produk?.nama_produk || "Produk dihapus"}
                  </TableCell>
                  <TableCell className="text-center">
                    {h.stok_sistem}
                  </TableCell>
                  <TableCell className="text-center">
                    {h.stok_fisik}
                  </TableCell>
                  <TableCell className="text-center">
                    <span className={`tabular-nums font-semibold px-2 py-0.5 rounded-full text-[12px] ${
                      h.selisih > 0 ? "bg-success/10 text-success" : h.selisih < 0 ? "bg-destructive/10 text-destructive" : "bg-muted text-muted-foreground"
                    }`}>
                      {h.selisih > 0 ? `+${h.selisih}` : h.selisih}
                    </span>
                  </TableCell>
                  <TableCell className="italic">
                    {h.keterangan || "-"}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="shrink-0 flex items-center justify-between p-4 border-t border-border bg-background">
        <p className="text-[13px] text-muted-foreground tabular-nums">
          Menampilkan <span className="font-medium text-foreground">{filteredHistory.length === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1}</span> hingga <span className="font-medium text-foreground">{Math.min(currentPage * itemsPerPage, filteredHistory.length)}</span> dari <span className="font-medium text-foreground">{filteredHistory.length}</span> catatan
        </p>
        <div className="flex items-center gap-2">
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
  );
}
