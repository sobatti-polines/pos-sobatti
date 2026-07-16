"use client";

import { useState, useEffect, useMemo } from "react";
import {
  Loader2,
  AlertCircle,
  TrendingUp,
  TrendingDown,
  X,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { getProductMutationHistory } from "@/app/dashboard/inventory/actions";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface MutationRecord {
  id: string;
  tanggal: string;
  jenis_mutasi: string;
  qty_masuk: number | null;
  qty_keluar: number | null;
  harga_satuan_transaksi: number | null;
  avco_sebelum: number | null;
  avco_sesudah: number | null;
  stok_sebelum: number | null;
  stok_sesudah: number | null;
  nilai_persediaan_sesudah: number | null;
  id_referensi: number | null;
  supplier: { nama_supplier: string } | null;
}

type Fluctuation = "up" | "down" | "none";

export interface ProductWithAvco {
  id: number;
  nama_produk: string;
  barcode: string | null;
  id_kategori: number;
  id_satuan: number;
  hitung_stok: boolean;
  stock: number | null;
  stok_gudang: number;
  stok_minimum: number;
  harga_modal: number;
  harga_jual_satuan: number;
  harga_jual_grosir: number;
  harga_jual_promo: number | null;
  diskon: number;
  harga_pokok_avco: number;
  nilai_persediaan: number;
  kategori: { nama: string } | null;
  satuan: { nama: string } | null;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function formatIDR(n: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
}

function formatDate(ts: string) {
  const d = new Date(ts);
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

const MUTASI_LABEL: Record<string, string> = {
  pembelian: "Pembelian",
  penjualan: "Penjualan",
  koreksi: "Koreksi",
  retur_beli: "Retur Pembelian",
  retur_jual: "Retur Penjualan",
};

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function ProductDetailSheet({
  product,
  open,
  onOpenChange,
}: {
  product: ProductWithAvco | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [mutations, setMutations] = useState<MutationRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState("");

  useEffect(() => {
    if (!open || !product) return;
    setLoading(true);
    setFetchError("");
    getProductMutationHistory(product.id).then((res) => {
      if (res.error) {
        setFetchError(res.error);
      } else {
        setMutations(res.data as MutationRecord[]);
      }
      setLoading(false);
    });
  }, [open, product]);

  /* ---- Price fluctuation calculation ---- */
  const enrichedRecords = useMemo(() => {
    const sorted = [...mutations];
    let lastBeliPrice: number | null = null;

    for (const record of sorted) {
      let fluctuation: Fluctuation = "none";
      if (
        record.jenis_mutasi === "pembelian" &&
        record.harga_satuan_transaksi != null
      ) {
        if (lastBeliPrice !== null) {
          if (record.harga_satuan_transaksi > lastBeliPrice) {
            fluctuation = "up";
          } else if (record.harga_satuan_transaksi < lastBeliPrice) {
            fluctuation = "down";
          }
        }
        lastBeliPrice = record.harga_satuan_transaksi;
      }
      (record as any)._fluctuation = fluctuation;
    }

    return [...sorted].reverse();
  }, [mutations]);

  /* ---- Basic info fields ---- */
  const infoFields = useMemo(() => {
    if (!product) return [];
    return [
      { label: "Nama Produk", value: product.nama_produk, full: true },
      { label: "Barcode", value: product.barcode || "-" },
      { label: "Kategori", value: product.kategori?.nama || "-" },
      { label: "Satuan", value: product.satuan?.nama || "-" },
      {
        label: "Stok Display",
        value: product.hitung_stok
          ? String(product.stock ?? 0)
          : "Tidak dilacak",
      },
      {
        label: "Stok Gudang",
        value: product.hitung_stok ? String(product.stok_gudang) : "-",
      },
      {
        label: "Min Stok",
        value: product.hitung_stok ? String(product.stok_minimum) : "-",
      },
      { label: "Harga Modal", value: formatIDR(product.harga_modal), mono: true },
      {
        label: "HPP (AVCO)",
        value: formatIDR(product.harga_pokok_avco),
        mono: true,
        highlight: true,
      },
      { label: "Harga Retail", value: formatIDR(product.harga_jual_satuan), mono: true },
      { label: "Harga Grosir", value: formatIDR(product.harga_jual_grosir), mono: true },
      {
        label: "Harga Promo",
        value:
          product.harga_jual_promo != null
            ? formatIDR(product.harga_jual_promo)
            : "-",
        mono: true,
      },
      {
        label: "Total Aset",
        value: formatIDR(product.nilai_persediaan),
        mono: true,
        highlight: true,
        full: true,
      },
    ];
  }, [product]);

  if (!product) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-0 shrink-0">
          <DialogTitle className="text-xl font-light tracking-tight text-foreground">
            Detail Produk
          </DialogTitle>
          <p className="text-sm text-muted-foreground mt-0.5">
            {product.nama_produk}
          </p>
        </DialogHeader>

        <Tabs
          defaultValue="info"
          className="flex-1 flex flex-col min-h-0 px-6 pb-6 pt-4 overflow-hidden"
        >
          <TabsList className="mb-4 shrink-0">
            <TabsTrigger value="info">Informasi Dasar</TabsTrigger>
            <TabsTrigger value="mutasi">Kartu Stok &amp; Mutasi</TabsTrigger>
          </TabsList>

          {/* ── Tab 1: Basic Info ── */}
          <TabsContent value="info" className="flex-1 overflow-y-auto">
            <div className="grid grid-cols-2 gap-x-8 gap-y-5">
              {infoFields.map((f) => (
                <div key={f.label} className={f.full ? "col-span-2" : ""}>
                  <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-1">
                    {f.label}
                  </p>
                  <p
                    className={`text-[15px] ${
                      f.highlight
                        ? "font-semibold text-[#533afd]"
                        : "font-medium text-foreground"
                    } ${f.mono ? "tabular-nums" : ""}`}
                  >
                    {f.value}
                  </p>
                </div>
              ))}
            </div>
          </TabsContent>

          {/* ── Tab 2: Stock Card ── */}
          <TabsContent value="mutasi" className="flex-1 overflow-y-auto min-h-0">
            {loading && (
              <div className="flex items-center justify-center py-20 text-muted-foreground">
                <Loader2 className="w-5 h-5 animate-spin mr-2" />
                Memuat riwayat mutasi...
              </div>
            )}

            {fetchError && (
              <div className="flex items-center gap-2 px-4 py-3 bg-destructive/10 text-destructive text-sm rounded-lg">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {fetchError}
              </div>
            )}

            {!loading && !fetchError && enrichedRecords.length === 0 && (
              <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                <p className="text-base font-medium text-foreground">
                  Belum ada mutasi
                </p>
                <p className="text-sm mt-1">
                  Riwayat stok dan AVCO akan muncul di sini
                </p>
              </div>
            )}

            {!loading && !fetchError && enrichedRecords.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[500px]">
                  <thead>
                    <tr className="border-b border-border/60 bg-muted/40">
                      <th className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider h-9 text-left px-2 whitespace-nowrap">
                        Tanggal
                      </th>
                      <th className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider h-9 text-left px-2 whitespace-nowrap">
                        Jenis Mutasi
                      </th>
                      <th className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider h-9 text-right px-2 whitespace-nowrap">
                        Qty
                      </th>
                      <th className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider h-9 text-right px-2 whitespace-nowrap">
                        Harga Beli
                      </th>
                      <th className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider h-9 text-right px-2 whitespace-nowrap">
                        HPP (AVCO)
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {enrichedRecords.map((m) => {
                      const fluc = (m as any)._fluctuation as Fluctuation;
                      const qty = m.qty_masuk ?? m.qty_keluar;
                      const jenisLabel =
                        MUTASI_LABEL[m.jenis_mutasi] || m.jenis_mutasi;
                      const supplierName = m.supplier?.nama_supplier;

                      return (
                        <tr
                          key={m.id}
                          className="border-b border-border/40 hover:bg-muted/20 transition-colors"
                        >
                          <td className="px-2 py-2.5 text-sm text-foreground tabular-nums whitespace-nowrap">
                            {formatDate(m.tanggal)}
                          </td>
                          <td className="px-2 py-2.5 text-sm text-foreground">
                            {jenisLabel}
                            {supplierName && (
                              <span className="text-muted-foreground">
                                {" "}
                                &mdash; {supplierName}
                              </span>
                            )}
                          </td>
                          <td className="px-2 py-2.5 text-sm text-right tabular-nums text-foreground">
                            {qty != null ? qty : "-"}
                          </td>
                          <td className="px-2 py-2.5 text-sm text-right tabular-nums text-foreground">
                            {m.harga_satuan_transaksi != null ? (
                              <span className="inline-flex items-center justify-end gap-1">
                                {fluc === "up" && (
                                  <TrendingUp className="w-3.5 h-3.5 text-red-500 shrink-0" />
                                )}
                                {fluc === "down" && (
                                  <TrendingDown className="w-3.5 h-3.5 text-green-500 shrink-0" />
                                )}
                                {formatIDR(m.harga_satuan_transaksi)}
                              </span>
                            ) : (
                              "-"
                            )}
                          </td>
                          <td className="px-2 py-2.5 text-sm text-right tabular-nums font-medium text-foreground">
                            {m.avco_sesudah != null
                              ? formatIDR(m.avco_sesudah)
                              : "-"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
