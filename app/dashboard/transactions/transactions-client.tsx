"use client";

import { useState, useMemo, useDeferredValue } from "react";
import { 
  Search, 
  ChevronLeft, 
  ChevronRight, 
  Receipt,
  ChevronDown,
  ChevronUp,
  Trash2,
  AlertTriangle,
  Loader2,
  X,
  Download
} from "lucide-react";
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
import { useRouter } from "next/navigation";
import { voidTransaction, getTransactionDetails } from "./actions";
import { exportToCSV, exportToPDF } from "@/lib/export-utils";

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
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export interface Transaction {
  id: number;
  no_transaksi: string;
  tgl_transaksi: string;
  total: number;
  bayar: number;
  kembali: number;
  pelanggan: { nama_pelanggan: string } | null;
  pengguna: { username: string, nama: string } | null;
  metode_bayar: { id: number, nama: string } | null;
}

interface TransactionDetail {
  id: number;
  qty: number;
  harga_jual: number;
  jumlah: number;
  produk: { nama_produk: string } | null;
}

export default function TransactionsClient({ 
  initialTransactions, 
  paymentMethods,
  role
}: { 
  initialTransactions: Transaction[];
  paymentMethods: { id: number; nama: string }[];
  role?: string;
}) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const [paymentFilter, setPaymentFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState({ start: "", end: "" });
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: "asc" | "desc" } | null>(null);

  const [voidModal, setVoidModal] = useState<{ open: boolean; transaction: Transaction | null; items: TransactionDetail[]; loading: boolean }>({
    open: false,
    transaction: null,
    items: [],
    loading: false
  });

  const isOwnerOrAdmin = role === "OWNER" || role === "ADMIN";

  const handleOpenVoid = async (e: React.MouseEvent, t: Transaction) => {
    e.stopPropagation();
    setVoidModal({ open: true, transaction: t, items: [], loading: true });
    
    const res = await getTransactionDetails(t.id);
    if (res.data) {
      setVoidModal(prev => ({ ...prev, items: res.data as unknown as TransactionDetail[], loading: false }));
    } else {
      setVoidModal(prev => ({ ...prev, loading: false }));
    }
  };

  const handleConfirmVoid = async () => {
    if (!voidModal.transaction) return;
    setVoidModal(prev => ({ ...prev, loading: true }));
    
    const res = await voidTransaction(voidModal.transaction.id);
    if (res.error) {
      alert("Gagal membatalkan transaksi: " + res.error);
      setVoidModal(prev => ({ ...prev, loading: false }));
    } else {
      setVoidModal({ open: false, transaction: null, items: [], loading: false });
    }
  };

  const filteredTransactions = useMemo(() => {
    let result = [...initialTransactions];

    // Search filter (no transaksi, kasir, pelanggan)
    if (deferredSearchQuery.trim()) {
      const q = deferredSearchQuery.toLowerCase();
      result = result.filter(
        (t) =>
          String(t.no_transaksi).toLowerCase().includes(q) ||
          t.pengguna?.nama?.toLowerCase().includes(q) ||
          t.pengguna?.username?.toLowerCase().includes(q) ||
          t.pelanggan?.nama_pelanggan?.toLowerCase().includes(q)
      );
    }

    // Payment method filter
    if (paymentFilter !== "all") {
      result = result.filter((t) => t.metode_bayar?.id.toString() === paymentFilter);
    }

    // Date range filter
    if (dateFilter.start) {
      const start = new Date(dateFilter.start);
      start.setHours(0, 0, 0, 0);
      result = result.filter((t) => new Date(t.tgl_transaksi) >= start);
    }
    if (dateFilter.end) {
      const end = new Date(dateFilter.end);
      end.setHours(23, 59, 59, 999);
      result = result.filter((t) => new Date(t.tgl_transaksi) <= end);
    }

    // Sort
    if (sortConfig) {
      result.sort((a, b) => {
        let aVal: string | number;
        let bVal: string | number;
        
        if (sortConfig.key === "kasir") {
          aVal = a.pengguna?.nama || a.pengguna?.username || "";
          bVal = b.pengguna?.nama || b.pengguna?.username || "";
        } else if (sortConfig.key === "pelanggan") {
          aVal = a.pelanggan?.nama_pelanggan || "";
          bVal = b.pelanggan?.nama_pelanggan || "";
        } else if (sortConfig.key === "metode_bayar") {
          aVal = a.metode_bayar?.nama || "";
          bVal = b.metode_bayar?.nama || "";
        } else {
          aVal = (a as unknown as Record<string, string | number>)[sortConfig.key] ?? "";
          bVal = (b as unknown as Record<string, string | number>)[sortConfig.key] ?? "";
        }
        
        if (aVal < bVal) return sortConfig.direction === "asc" ? -1 : 1;
        if (aVal > bVal) return sortConfig.direction === "asc" ? 1 : -1;
        return 0;
      });
    }

    return result;
  }, [initialTransactions, searchQuery, paymentFilter, dateFilter, sortConfig]);

  const totalSales = useMemo(() => {
    return filteredTransactions.reduce((sum, t) => sum + Number(t.total), 0);
  }, [filteredTransactions]);

  const totalPages = Math.max(1, Math.ceil(filteredTransactions.length / itemsPerPage));
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredTransactions.slice(start, start + itemsPerPage);
  }, [filteredTransactions, currentPage, itemsPerPage]);

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

  const getStatusBadge = (t: Transaction) => {
    if (t.bayar >= t.total) {
      return <Badge variant="secondary" className="bg-success/10 text-success hover:bg-success/20 font-medium border-none rounded-full px-2 py-0.5 text-[10px] uppercase tracking-widest leading-tight">Selesai</Badge>;
    }
    if (t.bayar > 0) {
      return <Badge variant="secondary" className="bg-warning/10 text-warning hover:bg-warning/20 font-medium border-none rounded-full px-2 py-0.5 text-[10px] uppercase tracking-widest leading-tight">Sebagian</Badge>;
    }
    return <Badge variant="secondary" className="bg-destructive/10 text-destructive hover:bg-destructive/20 font-medium border-none rounded-full px-2 py-0.5 text-[10px] uppercase tracking-widest leading-tight">Tertunda</Badge>;
  };

  const handleExportCSV = () => {
    const headers = ["No. Transaksi", "Tanggal", "Kasir", "Pelanggan", "Total", "Pembayaran", "Status"];
    const data = filteredTransactions.map(t => [
      `#${t.no_transaksi}`,
      formatDate(t.tgl_transaksi),
      t.pengguna?.nama || t.pengguna?.username || "-",
      t.pelanggan?.nama_pelanggan || "Umum",
      formatIDR(t.total),
      t.metode_bayar?.nama || "-",
      t.bayar >= t.total ? "Selesai" : (t.bayar > 0 ? "Sebagian" : "Tertunda")
    ]);
    exportToCSV("Data_Transaksi", headers, data);
  };

  const handleExportPDF = () => {
    const headers = ["No. Transaksi", "Tanggal", "Kasir", "Pelanggan", "Total", "Pembayaran", "Status"];
    const data = filteredTransactions.map(t => [
      `#${t.no_transaksi}`,
      formatDate(t.tgl_transaksi),
      t.pengguna?.nama || t.pengguna?.username || "-",
      t.pelanggan?.nama_pelanggan || "Umum",
      formatIDR(t.total),
      t.metode_bayar?.nama || "-",
      t.bayar >= t.total ? "Selesai" : (t.bayar > 0 ? "Sebagian" : "Tertunda")
    ]);
    exportToPDF("Data_Transaksi", "Laporan Data Transaksi", headers, data);
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-background border border-border rounded-[12px] shadow-[0_1px_3px_rgba(0,55,112,0.08)] overflow-hidden relative">
      <div className="shrink-0 flex flex-col p-4 lg:p-6 border-b border-border bg-transparent gap-6">
        {/* Subtotals Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-muted/30 rounded-xl p-4 border border-border/50">
            <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-widest mb-1">Total Penjualan</p>
            <p className="text-2xl font-light tracking-tight text-foreground tabular-nums">{formatIDR(totalSales)}</p>
          </div>
          <div className="bg-muted/30 rounded-xl p-4 border border-border/50">
            <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-widest mb-1">Jumlah Transaksi</p>
            <p className="text-2xl font-light tracking-tight text-foreground tabular-nums">{filteredTransactions.length}</p>
          </div>
          <div className="bg-muted/30 rounded-xl p-4 border border-border/50">
            <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-widest mb-1">Rata-rata Transaksi</p>
            <p className="text-2xl font-light tracking-tight text-foreground tabular-nums">
              {filteredTransactions.length > 0 ? formatIDR(totalSales / filteredTransactions.length) : formatIDR(0)}
            </p>
          </div>
        </div>

        {/* Filters Row */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="relative w-full max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input aria-label="Cari No. Transaksi, Kasir, atau Pelanggan..." placeholder="Cari No. Transaksi, Kasir, atau Pelanggan..." 
              className="pl-9 w-full max-w-sm rounded-md"
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
            />
          </div>
          
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <div className="relative">
                <Input 
                  type="date" 
                  className="rounded-md border px-3 py-2 text-sm w-40"
                  value={dateFilter.start}
                  onChange={(e) => { setDateFilter(prev => ({ ...prev, start: e.target.value })); setCurrentPage(1); }}
                />
              </div>
              <span className="text-muted-foreground text-sm">s/d</span>
              <div className="relative">
                <Input 
                  type="date" 
                  className="rounded-md border px-3 py-2 text-sm w-40"
                  value={dateFilter.end}
                  onChange={(e) => { setDateFilter(prev => ({ ...prev, end: e.target.value })); setCurrentPage(1); }}
                />
              </div>
            </div>

            <select aria-label="Filter Metode Pembayaran" value={paymentFilter}
              onChange={(e) => { setPaymentFilter(e.target.value); setCurrentPage(1); }}
              className="h-10 rounded-md border border-border bg-background px-3 py-2 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/20 text-muted-foreground min-w-[160px]"
            >
              <option value="all">Semua Pembayaran</option>
              {paymentMethods.map((pm) => (
                <option key={pm.id} value={pm.id}>{pm.nama}</option>
              ))}
            </select>

            <Button variant="outline" className="h-10 rounded-full gap-2 px-6" onClick={() => {
              setSearchQuery("");
              setPaymentFilter("all");
              setDateFilter({ start: "", end: "" });
            }}>
              Reset
            </Button>
            <Button variant="outline" className="h-10 rounded-full gap-2 px-4" onClick={handleExportCSV}>
              <Download className="w-4 h-4" /> CSV
            </Button>
            <Button variant="outline" className="h-10 rounded-full gap-2 px-4" onClick={handleExportPDF}>
              <Download className="w-4 h-4" /> PDF
            </Button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto min-h-0 relative">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[180px] pl-6 cursor-pointer select-none hover:text-foreground transition-colors" onClick={() => handleSort('no_transaksi')}>
                No. Transaksi {renderSortIcon("no_transaksi")}
              </TableHead>
              <TableHead className="w-[180px] cursor-pointer select-none hover:text-foreground transition-colors" onClick={() => handleSort('tgl_transaksi')}>
                Tanggal {renderSortIcon("tgl_transaksi")}
              </TableHead>
              <TableHead className="cursor-pointer select-none hover:text-foreground transition-colors" onClick={() => handleSort('kasir')}>
                Kasir {renderSortIcon("kasir")}
              </TableHead>
              <TableHead className="cursor-pointer select-none hover:text-foreground transition-colors" onClick={() => handleSort('pelanggan')}>
                Pelanggan {renderSortIcon("pelanggan")}
              </TableHead>
              <TableHead className="w-[140px] text-right cursor-pointer select-none hover:text-foreground transition-colors" onClick={() => handleSort('total')}>
                Total {renderSortIcon("total")}
              </TableHead>
              <TableHead className="w-[140px] text-center cursor-pointer select-none hover:text-foreground transition-colors" onClick={() => handleSort('metode_bayar')}>
                Pembayaran {renderSortIcon("metode_bayar")}
              </TableHead>
              <TableHead className="w-[120px] text-center">Status</TableHead>
              <TableHead className="w-[60px] pr-6"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedData.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-32">
                  <div className="flex flex-col items-center justify-center text-muted-foreground">
                    <Receipt className="w-12 h-12 mb-4 opacity-20" />
                    <p className="text-base font-medium text-foreground">Tidak ada transaksi ditemukan</p>
                    <p className="text-sm mt-1">Coba gunakan kata kunci pencarian atau filter yang lain.</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              paginatedData.map((t) => (
                <TableRow 
                  key={t.id} 
                  className="group cursor-pointer"
                  onClick={() => router.push(`/pos/invoice/${t.id}`)}
                >
                  <TableCell className="pl-6">
                    #{t.no_transaksi}
                  </TableCell>
                  <TableCell>
                    {formatDate(t.tgl_transaksi)}
                  </TableCell>
                  <TableCell>
                    <p className="text-foreground text-[13px]">{t.pengguna?.nama || t.pengguna?.username || "-"}</p>
                  </TableCell>
                  <TableCell>
                    <p className="text-foreground text-[13px]">{t.pelanggan?.nama_pelanggan || "Umum"}</p>
                  </TableCell>
                  <TableCell className="text-right">
                    {formatIDR(t.total)}
                  </TableCell>
                  <TableCell className="text-center">
                    <span className="text-muted-foreground text-[13px]">{t.metode_bayar?.nama || "-"}</span>
                  </TableCell>
                  <TableCell className="text-center">
                    {getStatusBadge(t)}
                  </TableCell>
                  <TableCell className="pr-6 text-right">
                    {isOwnerOrAdmin && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-11 w-11 md:h-8 md:w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                        onClick={(e) => handleOpenVoid(e, t)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
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
            {filteredTransactions.length === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1}
          </span>{" "}
          hingga{" "}
          <span className="font-medium text-foreground">
            {Math.min(currentPage * itemsPerPage, filteredTransactions.length)}
          </span>{" "}
          dari{" "}
          <span className="font-medium text-foreground">{filteredTransactions.length}</span>{" "}
          transaksi
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
              className="h-11 w-11 md:h-8 md:w-8 p-0 rounded-full bg-background"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button aria-label="Halaman Selanjutnya" variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="h-11 w-11 md:h-8 md:w-8 p-0 rounded-full bg-background"
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Void Modal */}
      {voidModal.open && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-overlay/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-background border border-border shadow-[0_8px_24px_rgba(0,55,112,0.08),0_2px_6px_rgba(0,55,112,0.04)] rounded-[12px] w-full max-w-lg flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="shrink-0 flex items-center justify-between px-6 py-5 border-b border-border">
              <h2 className="text-[22px] font-light tracking-tight text-foreground flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-destructive" />
                Batalkan Transaksi
              </h2>
              <button 
                className="text-muted-foreground hover:text-foreground transition-colors p-1"
                onClick={() => setVoidModal({ open: false, transaction: null, items: [], loading: false })}
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              <div className="bg-muted/30 rounded-xl p-4 border border-border/50">
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-muted-foreground">No. Transaksi</span>
                  <span className="font-medium">#{voidModal.transaction?.no_transaksi}</span>
                </div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-muted-foreground">Tanggal</span>
                  <span>{voidModal.transaction && formatDate(voidModal.transaction.tgl_transaksi)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Total</span>
                  <span className="font-semibold text-foreground">{voidModal.transaction && formatIDR(voidModal.transaction.total)}</span>
                </div>
              </div>

              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-2">Item Transaksi</p>
                <div className="max-h-40 overflow-y-auto space-y-2">
                  {voidModal.loading && voidModal.items.length === 0 ? (
                    <div className="flex items-center justify-center py-4">
                      <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : (
                    voidModal.items.map((item, idx) => (
                      <div key={idx} className="flex justify-between text-sm p-2 bg-muted/20 rounded-md">
                        <span className="truncate flex-1 pr-4">{item.produk?.nama_produk}</span>
                        <span className="text-muted-foreground tabular-nums">{item.qty} x {formatIDR(item.harga_jual)}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3">
                <p className="text-xs text-destructive leading-relaxed">
                  <strong>Peringatan:</strong> Menghapus transaksi ini bersifat permanen. Stok produk <strong>TIDAK</strong> akan dikembalikan secara otomatis.
                </p>
              </div>
            </div>

            <div className="shrink-0 px-6 py-5 border-t border-border bg-transparent flex justify-end gap-3">
              <Button 
                variant="outline" 
                className="rounded-full px-6 bg-background"
                onClick={() => setVoidModal({ open: false, transaction: null, items: [], loading: false })}
                disabled={voidModal.loading}
              >
                Batal
              </Button>
              <Button 
                variant="destructive" 
                className="rounded-full px-6 shadow-sm"
                onClick={handleConfirmVoid}
                disabled={voidModal.loading}
              >
                {voidModal.loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Konfirmasi Hapus
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
