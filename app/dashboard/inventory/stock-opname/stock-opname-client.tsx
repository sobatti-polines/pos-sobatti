"use client";

import { useState, useTransition } from "react";
import { Search, Save, AlertCircle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { saveStockOpname } from "./actions";

interface Product {
  id: number;
  nama_produk: string;
  stok: number | null;
}

export default function StockOpnameClient({ products }: { products: Product[] }) {
  const [isPending, startTransition] = useTransition();
  const [selectedProductId, setSelectedProductId] = useState<string>("");
  const [stokFisik, setStokFisik] = useState<string>("");
  const [keterangan, setKeterangan] = useState<string>("");
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const selectedProduct = products.find(p => p.id.toString() === selectedProductId);
  const stokSistem = selectedProduct?.stok ?? 0;
  const selisih = stokFisik !== "" ? Number(stokFisik) - stokSistem : 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProductId || stokFisik === "") return;

    setMessage(null);
    startTransition(async () => {
      const res = await saveStockOpname({
        id_produk: Number(selectedProductId),
        stok_sistem: stokSistem,
        stok_fisik: Number(stokFisik),
        selisih: selisih,
        keterangan: keterangan
      });

      if (res.success) {
        setMessage({ type: "success", text: "Stok opname berhasil disimpan." });
        setSelectedProductId("");
        setStokFisik("");
        setKeterangan("");
      } else {
        setMessage({ type: "error", text: res.error || "Gagal menyimpan data." });
      }
    });
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-background border border-border rounded-[12px] shadow-[0_1px_3px_rgba(0,55,112,0.08)] overflow-hidden relative max-w-3xl">
      <div className="flex-1 overflow-y-auto p-6 lg:p-8">
        <form onSubmit={handleSubmit} className="space-y-8">
          {message && (
            <div className={`flex items-center gap-2 px-4 py-3 rounded-md text-sm font-medium ${
              message.type === "success" ? "bg-emerald-50 text-emerald-700 border border-emerald-100" : "bg-destructive/10 text-destructive border border-destructive/20"
            }`}>
              {message.type === "success" ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
              {message.text}
            </div>
          )}

            <div className="space-y-2">
              <label htmlFor="id_produk" className="text-sm font-medium text-foreground">Pilih Produk</label>
              <div className="relative">
                <select id="id_produk" value={selectedProductId}
                  onChange={(e) => setSelectedProductId(e.target.value)}
                  required
                  className="w-full h-11 rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/20 focus-visible:border-primary"
                >
                  <option value="">-- Pilih Produk untuk Opname --</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nama_produk}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <span className="text-sm font-medium text-muted-foreground uppercase tracking-wider text-[10px] block">Stok Sistem</span>
                <div className="h-11 flex items-center px-3 bg-muted/50 border border-border rounded-md tabular-nums font-medium text-foreground">
                  {selectedProductId ? stokSistem : "-"}
                </div>
                <p className="text-[10px] text-muted-foreground italic">Jumlah stok yang tercatat di database</p>
              </div>

              <div className="space-y-2">
                <label htmlFor="stok_fisik" className="text-sm font-medium text-foreground uppercase tracking-wider text-[10px]">Stok Fisik</label>
                <Input
                  id="stok_fisik"
                  type="number"
                  placeholder="0"
                  value={stokFisik}
                  onChange={(e) => setStokFisik(e.target.value)}
                  required
                  className="h-11 tabular-nums"
                />
                <p className="text-[10px] text-muted-foreground italic">Jumlah stok hasil hitung manual</p>
              </div>
            </div>

            <div className="bg-muted/30 rounded-xl p-4 border border-border/50 flex justify-between items-center">
              <div>
                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-widest mb-1">Selisih</p>
                <p className={`text-2xl font-semibold tabular-nums ${
                  selisih > 0 ? "text-emerald-600" : selisih < 0 ? "text-destructive" : "text-foreground"
                }`}>
                  {selectedProductId && stokFisik !== "" ? (selisih > 0 ? `+${selisih}` : selisih) : "0"}
                </p>
              </div>
              <div className="text-right">
                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-widest mb-1">Status</p>
                <p className="text-sm font-medium">
                  {selisih === 0 ? "Sesuai" : selisih > 0 ? "Surplus" : "Kurang"}
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="keterangan" className="text-sm font-medium text-foreground">Keterangan</label>
              <textarea id="keterangan" value={keterangan}
                onChange={(e) => setKeterangan(e.target.value)}
                placeholder="Alasan selisih atau catatan lainnya..."
                className="w-full min-h-[100px] rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/20 focus-visible:border-primary"
              />
            </div>

            <div className="pt-4 border-t border-border flex justify-end">
              <Button
                type="submit"
                disabled={isPending || !selectedProductId || stokFisik === ""}
                className="h-10 rounded-full px-8 bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm font-normal"
              >
                {isPending ? "Menyimpan..." : (
                  <span className="flex items-center gap-2">
                    <Save className="w-4 h-4" />
                    Simpan Stok Opname
                  </span>
                )}
              </Button>
            </div>
          </form>
      </div>
    </div>
  );
}
