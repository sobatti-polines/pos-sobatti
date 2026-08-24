"use client";

import { useMemo, useState, useTransition } from "react";
import {
  ArrowDown,
  ArrowUp,
  Check,
  Minus,
  PackageSearch,
  RefreshCw,
  Search,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
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
import {
  fetchPergerakanHarga,
  type PriceMovementPeriod,
  type PriceMovementReport,
  type ProductOption,
} from "./actions";

function formatIDR(n: number | null | undefined) {
  if (n == null) return "-";
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
}

function formatNumber(n: number | null | undefined) {
  return new Intl.NumberFormat("id-ID", {
    maximumFractionDigits: 2,
  }).format(Number(n ?? 0));
}

function formatDate(value: string | null | undefined) {
  if (!value) return "Sekarang";
  return new Date(value).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function changeBadge(period: PriceMovementPeriod) {
  if (period.arah_perubahan === "naik") {
    return (
      <Badge className="border-none bg-emerald-100 text-emerald-700">
        <ArrowUp className="mr-1 size-3" />
        Naik
      </Badge>
    );
  }

  if (period.arah_perubahan === "turun") {
    return (
      <Badge className="border-none bg-rose-100 text-rose-700">
        <ArrowDown className="mr-1 size-3" />
        Turun
      </Badge>
    );
  }

  if (period.arah_perubahan === "campuran") {
    return (
      <Badge className="border-none bg-amber-100 text-amber-700">
        Naik/Turun
      </Badge>
    );
  }

  if (period.arah_perubahan === "awal") {
    return (
      <Badge className="border-none bg-blue-100 text-blue-700">
        Harga Awal
      </Badge>
    );
  }

  return (
    <Badge variant="secondary" className="border-none">
      <Minus className="mr-1 size-3" />
      Tetap
    </Badge>
  );
}

function priceSummary(period: PriceMovementPeriod) {
  const rows = [
    ["Retail", formatIDR(period.harga_jual_satuan)],
    ["Grosir", formatIDR(period.harga_jual_grosir)],
    ["Promo", formatIDR(period.harga_jual_promo)],
  ];

  if (period.jual_satuan) {
    rows.push([
      period.jual_satuan,
      formatIDR(period.harga_jual_besar_satuan),
    ]);
  }

  return rows;
}

export default function PergerakanHargaClient({
  products,
  initialReport,
}: {
  products: ProductOption[];
  initialReport: PriceMovementReport | null;
}) {
  const [selectedProductId, setSelectedProductId] = useState(
    initialReport?.product.id ? String(initialReport.product.id) : ""
  );
  const [productSearch, setProductSearch] = useState(
    initialReport?.product.nama_produk ?? ""
  );
  const [showProductResults, setShowProductResults] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [report, setReport] = useState<PriceMovementReport | null>(initialReport);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const selectedProductLabel = useMemo(() => {
    const product = products.find((p) => String(p.id) === selectedProductId);
    if (!product) return "";
    return [product.nama_produk, product.sku, product.barcode]
      .filter(Boolean)
      .join(" · ");
  }, [products, selectedProductId]);

  const filteredProducts = useMemo(() => {
    const keyword = productSearch.trim().toLowerCase();
    if (!keyword) return products.slice(0, 20);

    return products
      .filter((product) => {
        const searchable = [
          product.nama_produk,
          product.sku,
          product.barcode,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return searchable.includes(keyword);
      })
      .slice(0, 20);
  }, [products, productSearch]);

  const selectProduct = (product: ProductOption) => {
    setSelectedProductId(String(product.id));
    setProductSearch(product.nama_produk);
    setShowProductResults(false);
    setError(null);
    setReport(null);
  };

  const clearProduct = () => {
    setSelectedProductId("");
    setProductSearch("");
    setShowProductResults(false);
    setReport(null);
    setError(null);
  };

  const loadReport = () => {
    const id_produk = Number(selectedProductId);
    if (!id_produk) {
      setError("Pilih produk terlebih dahulu.");
      return;
    }

    startTransition(() => {
      void (async () => {
        setError(null);
        const result = await fetchPergerakanHarga({
          id_produk,
          startDate: startDate || undefined,
          endDate: endDate || undefined,
        });

        if (result.error) {
          setReport(null);
          setError(result.error);
          return;
        }

        setReport(result.data ?? null);
      })();
    });
  };

  return (
    <div className="flex-1 min-h-0 overflow-hidden rounded-[12px] border border-border bg-background shadow-level-1">
      <div className="border-b border-border p-4 lg:p-6 print:hidden">
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_160px_160px_auto]">
          <label className="flex flex-col gap-1.5">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Produk
            </span>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="text"
                value={productSearch}
                onChange={(event) => {
                  setProductSearch(event.target.value);
                  setSelectedProductId("");
                  setReport(null);
                  setShowProductResults(true);
                }}
                onFocus={() => setShowProductResults(true)}
                onBlur={() => {
                  window.setTimeout(() => setShowProductResults(false), 120);
                }}
                placeholder="Ketik nama produk, SKU, atau barcode"
                className="pl-9 pr-9"
                autoComplete="off"
              />

              {productSearch && (
                <button
                  type="button"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={clearProduct}
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full text-muted-foreground transition-colors hover:text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                  aria-label="Kosongkan pilihan produk"
                >
                  <X className="size-4" />
                </button>
              )}

              {showProductResults && (
                <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-20 max-h-72 overflow-y-auto rounded-[12px] border border-border bg-background shadow-level-2">
                  {filteredProducts.length > 0 ? (
                    filteredProducts.map((product) => {
                      const isSelected = String(product.id) === selectedProductId;
                      const meta = [product.sku, product.barcode]
                        .filter(Boolean)
                        .join(" · ");

                      return (
                        <button
                          key={product.id}
                          type="button"
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={() => selectProduct(product)}
                          className="flex w-full items-start justify-between gap-3 px-3 py-2.5 text-left text-sm transition-colors hover:bg-muted/60 focus:bg-muted/60 focus:outline-none"
                        >
                          <span className="min-w-0">
                            <span className="block truncate font-medium text-foreground">
                              {product.nama_produk}
                            </span>
                            {meta && (
                              <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                                {meta}
                              </span>
                            )}
                          </span>
                          {isSelected && (
                            <Check className="mt-0.5 size-4 shrink-0 text-primary" />
                          )}
                        </button>
                      );
                    })
                  ) : (
                    <div className="px-3 py-4 text-sm text-muted-foreground">
                      Produk tidak ditemukan. Coba ketik nama, SKU, atau barcode lain.
                    </div>
                  )}
                </div>
              )}
            </div>
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Dari Tanggal
            </span>
            <Input
              type="date"
              value={startDate}
              onChange={(event) => setStartDate(event.target.value)}
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Sampai Tanggal
            </span>
            <Input
              type="date"
              value={endDate}
              onChange={(event) => setEndDate(event.target.value)}
            />
          </label>

          <div className="flex items-end">
            <Button
              type="button"
              onClick={loadReport}
              disabled={isPending || products.length === 0}
              className="w-full rounded-full"
            >
              {isPending && <RefreshCw className="mr-2 size-4 animate-spin" />}
              Lihat Laporan
            </Button>
          </div>
        </div>
      </div>

      <div className="h-full overflow-y-auto p-4 lg:p-6">
        {error && (
          <div className="mb-4 rounded-[8px] border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {!report && !error && (
          <div className="flex min-h-[360px] flex-col items-center justify-center text-center text-muted-foreground">
            <PackageSearch className="mb-4 size-10" />
            <p className="text-sm">
              Pilih produk untuk melihat kapan harga berubah dan berapa qty yang terjual.
            </p>
          </div>
        )}

        {report && (
          <div className="space-y-5">
            <div>
              <h2 className="text-2xl font-light tracking-tight text-foreground">
                {report.product.nama_produk}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {selectedProductLabel}
              </p>
            </div>

            <div className="grid grid-cols-1 rounded-[12px] border border-border md:grid-cols-3">
              <div className="border-b border-border p-4 md:border-b-0 md:border-r">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Harga Berubah
                </p>
                <p className="mt-1 text-2xl font-light tabular-nums">
                  {formatNumber(report.summary.total_perubahan)} kali
                </p>
              </div>
              <div className="border-b border-border p-4 md:border-b-0 md:border-r">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Qty Terjual
                </p>
                <p className="mt-1 text-2xl font-light tabular-nums">
                  {formatNumber(report.summary.total_qty_base)}
                </p>
              </div>
              <div className="p-4">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Total Omzet
                </p>
                <p className="mt-1 text-2xl font-light tabular-nums">
                  {formatIDR(report.summary.total_omzet)}
                </p>
              </div>
            </div>

            <div className="overflow-hidden rounded-[12px] border border-border">
              <div className="border-b border-border px-4 py-3">
                <p className="text-sm font-medium text-foreground">
                  Riwayat harga dan penjualan
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Setiap baris menunjukkan satu periode harga. Qty dan omzet dihitung dari penjualan selama harga itu berlaku.
                </p>
              </div>

              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="min-w-[220px]">Periode Harga</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="min-w-[260px]">Harga Saat Itu</TableHead>
                      <TableHead className="text-right">Transaksi</TableHead>
                      <TableHead className="text-right">Qty Terjual</TableHead>
                      <TableHead className="text-right">Omzet</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {report.periods.map((period) => (
                      <TableRow key={period.snapshot_id}>
                        <TableCell className="align-top">
                          <div className="font-medium text-foreground">
                            {formatDate(period.effective_from)}
                          </div>
                          <div className="mt-1 text-xs text-muted-foreground">
                            sampai {formatDate(period.effective_to)}
                          </div>
                        </TableCell>
                        <TableCell className="align-top">{changeBadge(period)}</TableCell>
                        <TableCell className="align-top">
                          <div className="grid grid-cols-1 gap-1.5 text-sm sm:grid-cols-2">
                            {priceSummary(period).map(([label, value]) => (
                              <div key={`${period.snapshot_id}-${label}`}>
                                <span className="text-muted-foreground">{label}: </span>
                                <span className="tabular-nums text-foreground">
                                  {value}
                                </span>
                              </div>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell className="text-right align-top tabular-nums">
                          {formatNumber(period.sales.transaksi_count)}
                        </TableCell>
                        <TableCell className="text-right align-top tabular-nums">
                          {formatNumber(period.sales.qty_base)}
                        </TableCell>
                        <TableCell className="text-right align-top tabular-nums">
                          {formatIDR(period.sales.omzet)}
                        </TableCell>
                      </TableRow>
                    ))}

                    {report.periods.length === 0 && (
                      <TableRow>
                        <TableCell
                          colSpan={6}
                          className="py-8 text-center text-muted-foreground"
                        >
                          Tidak ada riwayat harga pada rentang tanggal ini.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
