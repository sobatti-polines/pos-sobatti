"use client";

import { useState, useMemo, useDeferredValue } from "react";
import { Search, Receipt, Trash2, AlertTriangle, Loader2, X, Download } from "lucide-react";
import { useTable } from "@/hooks/use-table";
import DataTable, { type Column, type FilterDef } from "@/components/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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

  const filteredData = useMemo(() => {
    let result = [...initialTransactions];

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

    if (paymentFilter !== "all") {
      result = result.filter((t) => t.metode_bayar?.id.toString() === paymentFilter);
    }

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

    return result;
  }, [initialTransactions, deferredSearchQuery, paymentFilter, dateFilter]);

  const table = useTable({ data: filteredData, defaultItemsPerPage: 25 });

  const totalSales = useMemo(() => {
    return filteredData.reduce((sum, t) => sum + Number(t.total), 0);
  }, [filteredData]);

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
    const data = filteredData.map(t => [
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
    const data = filteredData.map(t => [
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

  const filters: FilterDef[] = [
    {
      type: "date-range",
      start: dateFilter.start,
      end: dateFilter.end,
      onStartChange: (v) => setDateFilter(prev => ({ ...prev, start: v })),
      onEndChange: (v) => setDateFilter(prev => ({ ...prev, end: v })),
    },
    {
      type: "select",
      label: "Pembayaran",
      value: paymentFilter,
      onChange: setPaymentFilter,
      options: [
        ...paymentMethods.map((pm) => ({ value: String(pm.id), label: pm.nama })),
      ],
    },
  ];

  const columns: Column<Transaction>[] = [
    { key: "no_transaksi", header: "No. Transaksi", sortable: true, className: "pl-6", headerClassName: "pl-6 w-[180px]", render: (t) => <span>{`#${t.no_transaksi}`}</span> },
    { key: "tgl_transaksi", header: "Tanggal", sortable: true, headerClassName: "w-[180px]", render: (t) => formatDate(t.tgl_transaksi) },
    { key: "kasir", header: "Kasir", sortable: true, sortKey: "pengguna.nama", render: (t) => <p className="text-foreground text-[13px]">{t.pengguna?.nama || t.pengguna?.username || "-"}</p> },
    { key: "pelanggan", header: "Pelanggan", sortable: true, sortKey: "pelanggan.nama_pelanggan", render: (t) => <p className="text-foreground text-[13px]">{t.pelanggan?.nama_pelanggan || "Umum"}</p> },
    { key: "total", header: "Total", sortable: true, headerClassName: "w-[140px] text-right", render: (t) => <span className="tabular-nums">{formatIDR(t.total)}</span> },
    { key: "metode_bayar", header: "Pembayaran", sortable: true, sortKey: "metode_bayar.nama", headerClassName: "w-[140px] text-center", render: (t) => <span className="text-muted-foreground text-[13px]">{t.metode_bayar?.nama || "-"}</span> },
    {
      key: "status", header: "Status", headerClassName: "w-[120px] text-center",
      render: (t) => <div className="flex justify-center">{getStatusBadge(t)}</div>,
    },
    {
      key: "actions", header: "", className: "pr-6", headerClassName: "w-[60px] pr-6",
      render: (t) => (
        <div className="flex justify-end">
          {isOwnerOrAdmin && (
            <Button variant="ghost" size="icon" className="h-11 w-11 md:h-8 md:w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10" onClick={(e) => handleOpenVoid(e, t)}>
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <>
      <DataTable
        data={table.paginatedData}
        total={table.total}
        columns={columns}
        rowKey={(t) => t.id}
        search={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder="Cari No. Transaksi, Kasir, atau Pelanggan..."
        sortConfig={table.sortConfig}
        onSort={table.handleSort}
        currentPage={table.currentPage}
        onPageChange={table.setCurrentPage}
        itemsPerPage={table.itemsPerPage}
        onItemsPerPageChange={table.setItemsPerPage}
        filters={filters}
        onRowClick={(t) => router.push(`/pos/invoice/${t.id}`)}
        actions={[
          { label: "Reset", variant: "outline", onClick: () => { setSearchQuery(""); setPaymentFilter("all"); setDateFilter({ start: "", end: "" }); } },
          { label: "CSV", icon: <Download className="w-4 h-4" />, variant: "outline", onClick: handleExportCSV },
          { label: "PDF", icon: <Download className="w-4 h-4" />, variant: "outline", onClick: handleExportPDF },
        ]}
        topContent={
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pb-2">
            <div className="bg-muted/30 rounded-xl p-4 border border-border/50">
              <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-widest mb-1">Total Penjualan</p>
              <p className="text-2xl font-light tracking-tight text-foreground tabular-nums">{formatIDR(totalSales)}</p>
            </div>
            <div className="bg-muted/30 rounded-xl p-4 border border-border/50">
              <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-widest mb-1">Jumlah Transaksi</p>
              <p className="text-2xl font-light tracking-tight text-foreground tabular-nums">{filteredData.length}</p>
            </div>
            <div className="bg-muted/30 rounded-xl p-4 border border-border/50">
              <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-widest mb-1">Rata-rata Transaksi</p>
              <p className="text-2xl font-light tracking-tight text-foreground tabular-nums">
                {filteredData.length > 0 ? formatIDR(totalSales / filteredData.length) : formatIDR(0)}
              </p>
            </div>
          </div>
        }
        emptyState={{
          icon: Receipt,
          title: "Tidak ada transaksi ditemukan",
          description: "Coba gunakan kata kunci pencarian atau filter yang lain.",
        }}
      />

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
              <Button variant="outline" className="rounded-full px-6 bg-background" onClick={() => setVoidModal({ open: false, transaction: null, items: [], loading: false })} disabled={voidModal.loading}>
                Batal
              </Button>
              <Button variant="destructive" className="rounded-full px-6 shadow-sm" onClick={handleConfirmVoid} disabled={voidModal.loading}>
                {voidModal.loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Konfirmasi Hapus
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
