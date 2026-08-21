"use client";

import { useState, useMemo, useDeferredValue } from "react";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { Search, Receipt, Trash2, AlertTriangle, Loader2, X, Eye, Printer } from "lucide-react";
import { useTable } from "@/hooks/use-table";
import DataTable, { type Column, type FilterDef } from "@/components/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { voidTransaction, getTransactionDetails } from "./actions";
import { exportToCSV, exportToPDF } from "@/lib/export-utils";
import { ExportDropdown } from "@/components/export-dropdown";
import { createClient } from "@/lib/supabase/client";

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
  qty_satuan: number | null;
  satuan_jual: string | null;
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


  const [detailModal, setDetailModal] = useState<{ open: boolean; transaction: Transaction | null; items: TransactionDetail[]; loading: boolean }>({
    open: false,
    transaction: null,
    items: [],
    loading: false
  });

  const handleOpenDetail = async (t: Transaction) => {
    setDetailModal({ open: true, transaction: t, items: [], loading: true });
    try {
      const res = await getTransactionDetails(t.id);
      if (res.data) {
        setDetailModal(prev => ({ ...prev, items: res.data as unknown as TransactionDetail[], loading: false }));
      } else {
        setDetailModal(prev => ({ ...prev, loading: false }));
      }
    } catch (_e) {
      setDetailModal(prev => ({ ...prev, loading: false }));
    }
  };

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

  const supabase = createClient();
  const [isExporting, setIsExporting] = useState(false);

  const fetchExportData = async () => {
    setIsExporting(true);
    try {
      const txIds = filteredData.map(t => t.id);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const detailsMap = new Map<number, any[]>();
      
      for (let i = 0; i < txIds.length; i += 200) {
        const chunk = txIds.slice(i, i + 200);
        const { data, error } = await supabase
          .from("detail_transaksi_keluar")
          .select("id_transaksi, qty, qty_satuan, satuan_jual, harga_jual, jumlah, produk(nama_produk)")
          .in("id_transaksi", chunk);
          
        if (data && !error) {
          data.forEach(d => {
            const arr = detailsMap.get(d.id_transaksi) || [];
            arr.push(d);
            detailsMap.set(d.id_transaksi, arr);
          });
        }
      }
      return detailsMap;
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportCSV = async () => {
    const detailsMap = await fetchExportData();
    const headers = ["No. Transaksi", "Tanggal", "Kasir", "Pelanggan", "Status Pembayaran", "Nama Barang", "Harga", "Qty", "Subtotal Item", "Total Transaksi"];
    
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any[][] = [];
    filteredData.forEach(t => {
      const items = detailsMap.get(t.id) || [];
      const baseInfo = [
        `#${t.no_transaksi}`,
        formatDate(t.tgl_transaksi),
        t.pengguna?.nama || t.pengguna?.username || "-",
        t.pelanggan?.nama_pelanggan || "Umum",
        t.bayar >= t.total ? "Selesai" : (t.bayar > 0 ? "Sebagian" : "Tertunda")
      ];
      
      if (items.length === 0) {
         data.push([...baseInfo, "-", "-", "-", "-", formatIDR(t.total)]);
      } else {
         items.forEach((item, idx) => {
           data.push([
             ...baseInfo,
             item.produk?.nama_produk || "-",
             formatIDR(item.harga_jual),
             `${item.qty_satuan ?? item.qty} ${item.satuan_jual ?? ""}`.trim(),
             formatIDR(item.jumlah),
             idx === 0 ? formatIDR(t.total) : ""
           ]);
         });
      }
    });
    
    exportToCSV("Data_Transaksi", headers, data);
  };

  const handleExportPDF = async () => {
    const detailsMap = await fetchExportData();
    const headers = ["Transaksi", "Nama Barang", "Harga", "Qty", "Subtotal", "Total"];
    
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any[][] = [];
    filteredData.forEach(t => {
      const items = detailsMap.get(t.id) || [];
      const txName = `#${t.no_transaksi} - ${t.pelanggan?.nama_pelanggan || "Umum"} (${formatDate(t.tgl_transaksi)})`;
      
      if (items.length === 0) {
         data.push([txName, "-", "-", "-", "-", formatIDR(t.total)]);
      } else {
         items.forEach((item, idx) => {
           data.push([
             idx === 0 ? txName : "",
             item.produk?.nama_produk || "-",
             formatIDR(item.harga_jual),
             `${item.qty_satuan ?? item.qty} ${item.satuan_jual ?? ""}`.trim(),
             formatIDR(item.jumlah),
             idx === items.length - 1 ? formatIDR(t.total) : ""
           ]);
         });
      }
    });
    
    exportToPDF("Data_Transaksi", "Laporan Riwayat Transaksi", headers, data);
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
        <div className="flex items-center justify-end gap-1 md:gap-2">
          <Button variant="ghost" size="icon" className="h-11 w-11 md:h-8 md:w-8 text-muted-foreground hover:text-foreground" onClick={(e) => { e.stopPropagation(); handleOpenDetail(t); }}>
            <Eye className="h-4 w-4" />
          </Button>
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
        onRowClick={(t) => handleOpenDetail(t)}
        actions={[
          { label: "Reset", variant: "outline", onClick: () => { setSearchQuery(""); setPaymentFilter("all"); setDateFilter({ start: "", end: "" }); } },
          {
            label: "Export",
            customRender: () => (
              <ExportDropdown
                onExportCSV={handleExportCSV}
                onExportPDF={handleExportPDF}
                className="flex-1 md:flex-none"
                isLoading={isExporting}
              />
            ),
          },
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

      
      {/* Detail Slide-over */}
      {detailModal.open && (
        <div className="fixed inset-0 z-[60] flex justify-end bg-overlay/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-background border-l border-border shadow-2xl w-full max-w-md flex flex-col h-full animate-in slide-in-from-right duration-300">
            <div className="shrink-0 flex items-center justify-between px-6 py-5 border-b border-border">
              <h2 className="text-xl font-medium tracking-tight text-foreground flex items-center gap-2">
                <Receipt className="w-5 h-5 text-primary" />
                Detail Transaksi
              </h2>
              <button
                className="text-muted-foreground hover:text-foreground transition-colors p-1"
                onClick={() => setDetailModal({ open: false, transaction: null, items: [], loading: false })}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              <div className="space-y-4">
                <div className="bg-muted/30 rounded-xl p-4 border border-border/50 space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">No. Transaksi</span>
                    <span className="font-medium">#{detailModal.transaction?.no_transaksi}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Tanggal</span>
                    <span>{detailModal.transaction && formatDate(detailModal.transaction.tgl_transaksi)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Kasir</span>
                    <span>{detailModal.transaction?.pengguna?.nama || detailModal.transaction?.pengguna?.username || "-"}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Pelanggan</span>
                    <span>{detailModal.transaction?.pelanggan?.nama_pelanggan || "Umum"}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Pembayaran</span>
                    <Badge variant="outline" className="font-normal">{detailModal.transaction?.metode_bayar?.nama || "-"}</Badge>
                  </div>
                </div>

                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">Item Pembelian</p>
                  <div className="space-y-3">
                    {detailModal.loading ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                      </div>
                    ) : detailModal.items.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">Tidak ada detail item</p>
                    ) : (
                      detailModal.items.map((item, idx) => (
                        <div key={idx} className="flex flex-col gap-1 p-3 bg-muted/20 rounded-lg border border-border/50">
                          <div className="flex justify-between font-medium text-sm">
                            <span className="truncate pr-4">{item.produk?.nama_produk || "-"}</span>
                            <span>{formatIDR(item.jumlah ?? 0)}</span>
                          </div>
                          <div className="flex justify-between text-xs text-muted-foreground">
                            <span>{item.qty_satuan ?? item.qty} {item.satuan_jual ?? ""} x {formatIDR(item.harga_jual ?? 0)}</span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {!detailModal.loading && detailModal.items.length > 0 && (
                  <div className="border-t border-dashed border-border pt-4 space-y-2">
                    <div className="flex justify-between text-base font-semibold pt-2">
                      <span>Total Bayar</span>
                      <span className="text-primary">{detailModal.transaction && formatIDR(detailModal.transaction?.total ?? 0)}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="shrink-0 px-6 py-5 border-t border-border bg-muted/10 flex gap-3">
              <Button 
                variant="default" 
                className="w-full rounded-full shadow-sm" 
                onClick={() => router.push(`/pos/invoice/${detailModal.transaction?.id}`)}
              >
                <Printer className="w-4 h-4 mr-2" />
                Cetak Struk / Invoice
              </Button>
            </div>
          </div>
        </div>
      )}

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
                        <span className="text-muted-foreground tabular-nums">{item.qty_satuan ?? item.qty} {item.satuan_jual ?? ""} x {formatIDR(item.harga_jual)}</span>
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

            <div className="shrink-0 px-6 py-5 border-t border-border bg-transparent flex flex-col-reverse sm:flex-row justify-end gap-3">
              <Button variant="outline" className="rounded-full px-6 bg-background w-full sm:w-auto" onClick={() => setVoidModal({ open: false, transaction: null, items: [], loading: false })} disabled={voidModal.loading}>
                Batal
              </Button>
              <Button variant="destructive" className="rounded-full px-6 shadow-sm w-full sm:w-auto" onClick={handleConfirmVoid} disabled={voidModal.loading}>
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
