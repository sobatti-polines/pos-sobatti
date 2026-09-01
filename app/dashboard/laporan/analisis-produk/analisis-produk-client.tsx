"use client";

import { useMemo, useState, useTransition } from "react";
import { BarChart3, Eye, Loader2, PackageSearch, RefreshCw } from "lucide-react";
import DataTable, { type Column } from "@/components/data-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ExportDropdown } from "@/components/export-dropdown";
import { exportToCSV, exportToPDF } from "@/lib/export-utils";
import { useTable } from "@/hooks/use-table";
import { fetchAnalisisProduk, fetchRiwayatPenjualanProduk, type ProductSalesHistory, type ProductSalesReport, type ProductSalesRow, type UnitTotal } from "./actions";

type DateFilter = { startDate: string; endDate: string };

const idr = new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0, maximumFractionDigits: 0 });
const quantity = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 3 });

function formatUnits(values: UnitTotal[]) {
  return values.map(({ satuan, qty }) => `${quantity.format(qty)} ${satuan}`).join(" · ");
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta" }).format(new Date(value));
}

function quickRange(kind: "today" | "7" | "30" | "month") {
  const date = new Date();
  const endDate = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" }).format(date);
  if (kind === "today") return { startDate: endDate, endDate };
  if (kind === "month") return { startDate: `${endDate.slice(0, 8)}01`, endDate };
  const start = new Date(`${endDate}T00:00:00+07:00`);
  start.setDate(start.getDate() - (Number(kind) - 1));
  return { startDate: new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" }).format(start), endDate };
}

function Summary({ report }: { report: ProductSalesReport }) {
  const values = [
    ["Produk terjual", quantity.format(report.summary.produk_terjual)],
    ["Omzet item", idr.format(report.summary.omzet_item)],
    ["Pendapatan neto", idr.format(report.summary.pendapatan_neto)],
  ];
  return <div className="grid overflow-hidden rounded-[12px] border border-border bg-background md:grid-cols-3">{values.map(([label, value], index) => <div key={label} className={`p-4 ${index < values.length - 1 ? "border-b border-border md:border-b-0 md:border-r" : ""}`}><p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{label}</p><p className="mt-1 text-2xl font-light tabular-nums text-foreground">{value}</p></div>)}</div>;
}

function DetailPanel({ report, loading, error }: { report: ProductSalesHistory | null; loading: boolean; error: string | null }) {
  if (loading) return <div className="flex flex-1 items-center justify-center text-muted-foreground"><Loader2 className="mr-2 size-4 animate-spin" /> Memuat riwayat penjualan…</div>;
  if (error) return <div className="m-4 rounded-[8px] border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">{error}</div>;
  if (!report) return null;
  return <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-8 pt-2 sm:px-7 lg:px-8"><div className="grid overflow-hidden rounded-[12px] border border-border md:grid-cols-3"><div className="border-b border-border p-5 md:border-b-0 md:border-r"><p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Qty terjual</p><p className="mt-1.5 text-base font-medium tabular-nums">{formatUnits(report.qty_per_satuan)}</p></div><div className="border-b border-border p-5 md:border-b-0 md:border-r"><p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Omzet item</p><p className="mt-1.5 text-xl font-light tabular-nums">{idr.format(report.omzet_item)}</p></div><div className="p-5"><p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Pendapatan neto</p><p className="mt-1.5 text-xl font-light tabular-nums">{idr.format(report.pendapatan_neto)}</p></div></div><div className="mt-8"><h3 className="text-lg font-medium text-foreground">Riwayat penjualan</h3><p className="mt-1 text-sm text-muted-foreground">Setiap transaksi pada periode yang dipilih.</p></div><div className="mt-4 overflow-hidden rounded-[12px] border border-border"><table className="w-full"><thead className="bg-muted/40"><tr><th className="px-5 py-3 text-left text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Waktu</th><th className="px-5 py-3 text-right text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Qty</th><th className="hidden px-5 py-3 text-right text-[11px] font-medium uppercase tracking-wider text-muted-foreground sm:table-cell">Omzet</th><th className="px-5 py-3 text-right text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Neto</th></tr></thead><tbody>{report.transactions.map((transaction) => <tr key={transaction.id} className="border-t border-border/70"><td className="px-5 py-4"><p className="text-sm font-medium">#{transaction.no_transaksi}</p><p className="mt-0.5 text-xs text-muted-foreground">{formatDate(transaction.tgl_transaksi)}</p></td><td className="px-5 py-4 text-right text-sm tabular-nums">{formatUnits(transaction.qty_per_satuan)}</td><td className="hidden px-5 py-4 text-right text-sm tabular-nums sm:table-cell">{idr.format(transaction.omzet_item)}</td><td className="px-5 py-4 text-right text-sm tabular-nums">{idr.format(transaction.pendapatan_neto)}</td></tr>)}</tbody></table></div></div>;
}

export default function AnalisisProdukClient({ initialReport, initialError, initialFilter }: { initialReport: ProductSalesReport | null; initialError: string | null; initialFilter: DateFilter }) {
  const [filter, setFilter] = useState(initialFilter);
  const [report, setReport] = useState(initialReport);
  const [error, setError] = useState(initialError);
  const [search, setSearch] = useState("");
  const [isPending, startTransition] = useTransition();
  const [selected, setSelected] = useState<ProductSalesRow | null>(null);
  const [history, setHistory] = useState<ProductSalesHistory | null>(null);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [historyLoading, startHistoryTransition] = useTransition();

  const filteredRows = useMemo(() => report?.rows.filter((row) => [row.nama_produk, row.sku, row.barcode].filter(Boolean).join(" ").toLocaleLowerCase("id").includes(search.trim().toLocaleLowerCase("id"))) ?? [], [report, search]);
  const table = useTable({ data: filteredRows, defaultSortKey: "frekuensi_transaksi", defaultSortDir: "desc" });

  const load = () => startTransition(() => { void (async () => { setError(null); const result = await fetchAnalisisProduk(filter); if (result.error) { setReport(null); setError(result.error); return; } setReport(result.data ?? null); setSelected(null); setHistory(null); })(); });
  const openDetail = (row: ProductSalesRow) => { setSelected(row); setHistory(null); setHistoryError(null); startHistoryTransition(() => { void (async () => { const result = await fetchRiwayatPenjualanProduk({ ...filter, id_produk: row.id_produk }); if (result.error) { setHistoryError(result.error); return; } setHistory(result.data ?? null); })(); }); };
  const setQuickRange = (kind: "today" | "7" | "30" | "month") => setFilter(quickRange(kind));

  const exportRows = useMemo(() => {
    const sort = table.sortConfig;
    if (!sort) return filteredRows;
    return [...filteredRows].sort((a, b) => {
      const left = a[sort.key as keyof ProductSalesRow];
      const right = b[sort.key as keyof ProductSalesRow];
      if (left === right) return 0;
      return (left! < right! ? -1 : 1) * (sort.direction === "asc" ? 1 : -1);
    });
  }, [filteredRows, table.sortConfig]);
  const exportData = exportRows.map((row) => [row.nama_produk, row.sku ?? "-", formatUnits(row.qty_per_satuan), row.frekuensi_transaksi, row.omzet_item, row.pendapatan_neto]);
  const exportCsv = () => exportToCSV("Analisis_Produk", ["Produk", "SKU", "Qty Terjual", "Frekuensi Transaksi", "Omzet Item", "Pendapatan Neto"], exportData);
  const exportPdf = () => exportToPDF("Analisis_Produk", "Analisis Produk", ["Produk", "SKU", "Qty Terjual", "Frekuensi", "Omzet", "Neto"], exportRows.map((row) => [row.nama_produk, row.sku ?? "-", formatUnits(row.qty_per_satuan), row.frekuensi_transaksi, idr.format(row.omzet_item), idr.format(row.pendapatan_neto)]));

  const columns: Column<ProductSalesRow>[] = [
    { key: "nama_produk", header: "Produk", sortable: true, render: (row) => <div><p className="font-medium text-foreground">{row.nama_produk}</p>{(row.sku || row.barcode) && <p className="mt-0.5 text-xs text-muted-foreground">{[row.sku, row.barcode].filter(Boolean).join(" · ")}</p>}</div> },
    { key: "qty_per_satuan", header: "Qty terjual", render: (row) => <span className="tabular-nums">{formatUnits(row.qty_per_satuan)}</span>, mobileLabel: "Qty" },
    { key: "frekuensi_transaksi", header: "Transaksi", sortable: true, align: "right", render: (row) => <span className="tabular-nums">{quantity.format(row.frekuensi_transaksi)}</span>, mobileLabel: "Transaksi" },
    { key: "omzet_item", header: "Omzet item", sortable: true, align: "right", render: (row) => <span className="tabular-nums">{idr.format(row.omzet_item)}</span>, mobileLabel: "Omzet" },
    { key: "pendapatan_neto", header: "Pendapatan neto", sortable: true, align: "right", render: (row) => <span className="tabular-nums">{idr.format(row.pendapatan_neto)}</span>, mobileLabel: "Neto" },
    { key: "detail", header: "Detail", align: "right", className: "w-20 pr-6 lg:pr-8", headerClassName: "w-20 pr-6 lg:pr-8", render: (row) => <Button type="button" variant="ghost" size="icon-sm" className="rounded-full" onClick={(event) => { event.stopPropagation(); openDetail(row); }} aria-label={`Lihat detail ${row.nama_produk}`}><Eye className="size-4" /></Button>, mobileLabel: "Detail" },
  ];

  return <div className="flex min-h-0 flex-1 flex-col gap-4 md:gap-6"><div className="shrink-0"><h1 className="text-4xl font-light tracking-tighter text-foreground">Analisis Produk</h1><p className="mt-2 text-muted-foreground">Lihat produk yang paling sering terjual dan telusuri transaksi setiap item.</p></div><div className="rounded-[12px] border border-border bg-background p-4"><div className="flex flex-col gap-3 xl:flex-row xl:items-end"><div className="flex flex-wrap gap-2">{([ ["today", "Hari ini"], ["7", "7 hari"], ["30", "30 hari"], ["month", "Bulan ini"] ] as const).map(([kind, label]) => <Button key={kind} type="button" variant="outline" onClick={() => setQuickRange(kind)} className="h-9 rounded-full">{label}</Button>)}</div><label className="flex flex-col gap-1.5"><span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Dari</span><Input type="date" value={filter.startDate} onChange={(event) => setFilter((value) => ({ ...value, startDate: event.target.value }))} /></label><label className="flex flex-col gap-1.5"><span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Sampai</span><Input type="date" value={filter.endDate} onChange={(event) => setFilter((value) => ({ ...value, endDate: event.target.value }))} /></label><Button type="button" onClick={load} disabled={isPending} className="rounded-full">{isPending ? <Loader2 className="mr-2 size-4 animate-spin" /> : <RefreshCw className="mr-2 size-4" />}Terapkan</Button></div></div>{error && <div className="rounded-[8px] border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">{error}</div>}{report && <Summary report={report} />}<div className="min-h-0 flex-1 overflow-hidden rounded-[12px] border border-border bg-background"><DataTable data={table.paginatedData} total={table.total} columns={columns} rowKey={(row) => row.id_produk} search={search} onSearchChange={setSearch} searchPlaceholder="Cari nama produk, SKU, atau barcode" sortConfig={table.sortConfig} onSort={table.handleSort} currentPage={table.currentPage} onPageChange={table.setCurrentPage} itemsPerPage={table.itemsPerPage} onItemsPerPageChange={table.setItemsPerPage} mobileCards mobileBreakpoint="lg" loading={isPending} actions={[{ label: "Ekspor", customRender: () => <ExportDropdown onExportCSV={exportCsv} onExportPDF={exportPdf} /> }]} emptyState={{ icon: PackageSearch, title: "Belum ada penjualan", description: "Tidak ada produk terjual pada periode ini." }} topContent={<div className="flex items-center gap-2 px-4 py-3 text-sm text-muted-foreground"><BarChart3 className="size-4" /> Gunakan ikon mata untuk melihat riwayat penjualan produk.</div>} /></div><Dialog open={Boolean(selected)} onOpenChange={(open) => !open && setSelected(null)}><DialogContent className="h-[min(88dvh,760px)] w-[calc(100%-2rem)] max-w-none grid-rows-[auto_minmax(0,1fr)] gap-0 overflow-hidden p-0 lg:w-[min(92vw,1100px)]"><DialogHeader className="border-b border-border px-5 py-6 pr-14 sm:px-7 lg:px-8"><DialogTitle className="text-lg">{selected?.nama_produk ?? "Riwayat penjualan"}</DialogTitle><DialogDescription>{selected && [selected.sku, selected.barcode].filter(Boolean).join(" · ") || "Rincian transaksi produk pada periode yang dipilih."}</DialogDescription></DialogHeader><DetailPanel report={history} loading={historyLoading} error={historyError} /></DialogContent></Dialog></div>;
}
