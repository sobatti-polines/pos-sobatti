"use client";

import { useState, useMemo } from "react";
import {
  Check,
  AlertCircle,
  Loader2,
  Info,
  Save,
  Package,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getPendingStockIn, updateHargaBarangMasuk, markTidakAdaHarga } from "./actions";

interface PendingItem {
  id: number;
  tgl_masuk: string;
  no_surat: string | null;
  supplied_unit: string | null;
  supplied_qty: number | null;
  applied_conversion_ratio: number | null;
  base_qty_added: number | null;
  total_cost: number;
  harga_beli: number;
  keterangan: string | null;
  supplier: { nama_supplier: string } | null;
  produk: {
    id: number;
    nama_produk: string;
    sku: string | null;
    barcode: string | null;
    conversion_ratio: number;
    stok_gudang: number;
    harga_pokok_avco: number | null;
    satuan: { nama: string } | null;
  } | null;
}

function formatIDR(n: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default function TentukanHargaClient({
  initialItems,
}: {
  initialItems: PendingItem[];
}) {
  const [items, setItems] = useState<PendingItem[]>(initialItems);
  const [prices, setPrices] = useState<Record<number, number>>({});
  const [loading, setLoading] = useState(false);
  const [loadingNoPrice, setLoadingNoPrice] = useState<number | null>(null);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const [warning, setWarning] = useState("");

  // Group items by date + supplier for better UX
  const groupedItems = useMemo(() => {
    const groups: Record<string, PendingItem[]> = {};
    for (const item of items) {
      const key = `${item.tgl_masuk}_${item.supplier?.nama_supplier ?? "Unknown"}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(item);
    }
    return groups;
  }, [items]);

  const totalItems = items.length;
  const itemsWithPrice = Object.keys(prices).filter(
    (id) => prices[Number(id)] !== undefined && prices[Number(id)] > 0
  ).length;

  const handlePriceChange = (id: number, value: string) => {
    const numValue = parseFloat(value) || 0;
    setPrices((prev) => ({ ...prev, [id]: numValue }));
  };

  const handleNoPrice = async (id: number) => {
    setLoadingNoPrice(id);
    setError("");
    setSuccess(false);

    const res = await markTidakAdaHarga({ id_barang_masuk: id });

    if (res?.error) {
      setError(res.error);
      setLoadingNoPrice(null);
      return;
    }

    // Remove item from list
    setItems((prev) => prev.filter((item) => item.id !== id));
    setSuccess(true);
    setLoadingNoPrice(null);

    setTimeout(() => setSuccess(false), 4000);
  };

  const handleSave = async () => {
    setLoading(true);
    setError("");
    setSuccess(false);
    setWarning("");

    // Prepare payload: only items with valid prices
    const payload = items
      .filter((item) => {
        const price = prices[item.id];
        return price !== undefined && price > 0;
      })
      .map((item) => ({
        id_barang_masuk: item.id,
        harga_beli: prices[item.id],
      }));

    if (payload.length === 0) {
      setError("Tidak ada harga yang diisi");
      setLoading(false);
      return;
    }

    const res = await updateHargaBarangMasuk({ items: payload });

    if (res?.error) {
      setError(res.error);
      setLoading(false);
      return;
    }

    if (res?.warning) {
      setWarning(res.warning);
    }

    setSuccess(true);
    setLoading(false);

    // Remove saved items from list
    const savedIds = new Set(payload.map((p) => p.id_barang_masuk));
    setItems((prev) => prev.filter((item) => !savedIds.has(item.id)));
    setPrices({});

    setTimeout(() => setSuccess(false), 4000);
  };

  return (
    <div className="flex-1 p-4 md:p-8 lg:p-12 w-full flex flex-col gap-4 md:gap-8 mx-auto h-full md:max-h-screen md:overflow-hidden">
      <header className="shrink-0">
        <h1 className="text-4xl font-light tracking-tighter text-foreground">
          Tentukan Harga
        </h1>
        <p className="text-muted-foreground mt-2">
          Assign harga beli untuk barang masuk yang belum memiliki harga
        </p>
      </header>

      {/* Stats */}
      <div className="shrink-0 flex items-center gap-4">
        <div className="flex items-center gap-2 px-4 py-2 bg-primary/5 rounded-lg">
          <Package className="w-4 h-4 text-primary" />
          <span className="text-sm font-medium">
            {totalItems} item menunggu harga
          </span>
        </div>
        {itemsWithPrice > 0 && (
          <div className="flex items-center gap-2 px-4 py-2 bg-emerald-50 rounded-lg">
            <Check className="w-4 h-4 text-emerald-600" />
            <span className="text-sm font-medium text-emerald-700">
              {itemsWithPrice} item sudah diisi
            </span>
          </div>
        )}
      </div>

      {/* Error/Success banners */}
      {error && (
        <div className="shrink-0 flex items-center gap-2 px-6 py-4 bg-destructive/10 text-destructive text-sm border-b border-border">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {success && !warning && (
        <div className="shrink-0 flex items-center gap-2 px-6 py-4 bg-emerald-50 text-emerald-700 text-sm border-b border-border">
          <Check className="w-4 h-4 shrink-0" />
          Harga berhasil disimpan dan AVCO telah dihitung ulang
        </div>
      )}

      {warning && (
        <div className="shrink-0 flex items-center gap-2 px-6 py-4 bg-amber-50 text-amber-700 text-sm border-b border-border">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {warning}
        </div>
      )}

      {/* Info banner */}
      <div className="shrink-0 flex items-center gap-2 px-4 py-3 bg-primary/5 text-sm rounded-lg">
        <Info className="w-4 h-4 shrink-0 text-primary" />
        <span className="text-foreground/80">
          Masukkan harga beli per item. Harga akan digunakan untuk menghitung ulang HPP (AVCO).
        </span>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto min-h-0">
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
            <Package className="w-12 h-12 mb-4 opacity-20" />
            <p className="text-base font-medium text-foreground">
              Tidak ada barang masuk yang menunggu harga
            </p>
            <p className="text-sm mt-1">
              Semua barang masuk sudah memiliki harga beli
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(groupedItems).map(([key, groupItems]) => {
              const [date, supplierName] = key.split("_");
              return (
                <div key={key} className="border border-border rounded-lg overflow-hidden">
                  {/* Group header */}
                  <div className="px-4 py-3 bg-muted/50 border-b border-border">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-foreground">
                          {supplierName}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatDate(date)} · {groupItems.length} item
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Items table */}
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border/60 bg-muted/30">
                        <th className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider h-9 text-left px-4">
                          Produk
                        </th>
                        <th className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider h-9 text-left px-4 w-[100px]">
                          Qty Masuk
                        </th>
                        <th className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider h-9 text-left px-4 w-[100px]">
                          Satuan
                        </th>
                        <th className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider h-9 text-left px-4 w-[200px]">
                          Total Harga
                        </th>
                        <th className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider h-9 text-left px-4 w-[120px]">
                          HPP Saat Ini
                        </th>
                        <th className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider h-9 text-left px-4 w-[100px]">
                          Aksi
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {groupItems.map((item) => {
                        const produk = item.produk;
                        const currentPrice = prices[item.id];
                        const perPiece =
                          item.base_qty_added && item.base_qty_added > 0 && currentPrice
                            ? currentPrice / item.base_qty_added
                            : 0;

                        return (
                          <tr
                            key={item.id}
                            className="border-b border-border/40 hover:bg-muted/20 transition-colors"
                          >
                            <td className="px-4 py-3">
                              <p className="text-sm font-medium text-foreground">
                                {produk?.nama_produk ?? "Unknown"}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {produk?.sku && `SKU: ${produk.sku}`}
                                {produk?.barcode && ` · Barcode: ${produk.barcode}`}
                              </p>
                            </td>
                            <td className="px-4 py-3 text-sm tabular-nums">
                              {item.base_qty_added ?? item.supplied_qty ?? "-"}{" "}
                              <span className="text-muted-foreground">
                                {produk?.satuan?.nama ?? "pcs"}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-sm text-muted-foreground">
                              {item.supplied_unit ?? "-"}
                            </td>
                            <td className="px-4 py-3">
                              <Input
                                type="number"
                                min={0}
                                step="any"
                                placeholder="Masukkan harga..."
                                value={currentPrice ?? ""}
                                onChange={(e) =>
                                  handlePriceChange(item.id, e.target.value)
                                }
                                className="h-9 tabular-nums font-medium"
                              />
                              {perPiece > 0 && (
                                <p className="text-xs text-muted-foreground mt-1 tabular-nums">
                                  = {formatIDR(Math.round(perPiece))}/pcs
                                </p>
                              )}
                            </td>
                            <td className="px-4 py-3 text-sm tabular-nums text-muted-foreground">
                              {produk?.harga_pokok_avco
                                ? formatIDR(produk.harga_pokok_avco)
                                : "-"}
                            </td>
                            <td className="px-4 py-3">
                              <button
                                type="button"
                                onClick={() => handleNoPrice(item.id)}
                                disabled={loadingNoPrice === item.id}
                                className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 disabled:opacity-50"
                              >
                                {loadingNoPrice === item.id ? (
                                  <span className="flex items-center gap-1">
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                    Memproses...
                                  </span>
                                ) : (
                                  "Tidak Ada Harga"
                                )}
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer */}
      {items.length > 0 && (
        <div className="shrink-0 flex items-center justify-between px-6 py-4 border-t border-border bg-background">
          <p className="text-sm text-muted-foreground">
            {itemsWithPrice} dari {totalItems} item akan diupdate
          </p>
          <Button
            onClick={handleSave}
            disabled={itemsWithPrice === 0 || loading}
            className="rounded-full px-6 h-10 bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Menyimpan...
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                Simpan & Hitung Ulang AVCO
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
