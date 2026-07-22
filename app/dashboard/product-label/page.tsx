"use client";

import { useState, useMemo } from "react";
import { Plus, Trash2, Printer, SlidersHorizontal, ListChecks, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ProductSelectorModal, PrintProduct } from "./product-selector-modal";
import { ProductStickerLabel } from "@/components/product-sticker-label";
import { Badge } from "@/components/ui/badge";

interface PrintQueueItem extends PrintProduct {
  qty: number;
}

export default function ProductLabelPage() {
  const [queue, setQueue] = useState<PrintQueueItem[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const [titleFontSize, setTitleFontSize] = useState(1.9);
  const [barcodeFontSize, setBarcodeFontSize] = useState(1.5);
  const [priceFontSize, setPriceFontSize] = useState(2.5);
  const [barcodeHeight, setBarcodeHeight] = useState(4.4);

  const handleInsert = (selected: PrintProduct[]) => {
    setQueue((prev) => {
      const newQueue = [...prev];
      selected.forEach((product) => {
        if (!newQueue.find((item) => item.id === product.id)) {
          newQueue.push({ ...product, qty: 3 }); // default 3 to match 3-up
        }
      });
      return newQueue;
    });
  };

  const handleUpdateQty = (id: number, qty: number) => {
    setQueue((prev) =>
      prev.map((item) => (item.id === id ? { ...item, qty: Math.max(1, qty) } : item))
    );
  };

  const handleRemove = (id: number) => {
    setQueue((prev) => prev.filter((item) => item.id !== id));
  };

  const handlePrint = () => {
    window.print();
  };

  // Generate the flat list of labels based on qty
  const printItems = useMemo(() => {
    const items: PrintProduct[] = [];
    queue.forEach((item) => {
      for (let i = 0; i < item.qty; i++) {
        items.push(item);
      }
    });
    return items;
  }, [queue]);

  const totalLabels = printItems.length;

  return (
    <>
      {/* CSS untuk Printer Label Khusus */}
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          @page {
            /* 107mm width untuk kertas roll printer Codeshop CB-199BT. 15mm height for the label. */
            size: 107mm 15mm; 
            margin: 0;
          }
          body { 
            background-color: white !important; 
            -webkit-print-color-adjust: exact; 
          }
          /* Sembunyikan elemen non-print */
          .no-print { display: none !important; }
        }
      `}} />

      <div className="flex-1 flex flex-col min-h-0 print:hidden">
        <div className="px-6 pt-6 pb-4 border-b border-border">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Printer className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h1 className="text-xl font-light tracking-tight text-foreground">Cetak Label Produk</h1>
                <p className="text-sm text-muted-foreground">Khusus printer thermal Codeshop CB-199BT (33x15mm)</p>
              </div>
            </div>
            <Button onClick={() => setIsModalOpen(true)} className="gap-2">
              <Plus className="w-4 h-4" />
              Pilih Produk
            </Button>
          </div>
        </div>

        <div className="flex-1 flex flex-col lg:flex-row min-h-0 overflow-hidden">
          {/* Left Panel — Controls */}
          <div className="w-full lg:w-[420px] shrink-0 border-b lg:border-b-0 lg:border-r border-border bg-muted/30 flex flex-col overflow-hidden">
            <div className="flex-1 overflow-y-auto p-5 space-y-8 custom-scrollbar">
              
              {/* Section 1: Typography */}
              <div className="space-y-5">
                <h3 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                  <SlidersHorizontal className="w-3.5 h-3.5" />
                  1. Pengaturan Ukuran (Tipografi)
                </h3>

                <div className="space-y-5">
                  {[
                    { label: 'Nama Produk', value: titleFontSize, set: setTitleFontSize, min: 1.5, max: 4.5 },
                    { label: 'Teks Barcode', value: barcodeFontSize, set: setBarcodeFontSize, min: 1.0, max: 3.0 },
                    { label: 'Tinggi Barcode', value: barcodeHeight, set: setBarcodeHeight, min: 2.0, max: 8.0 },
                    { label: 'Nominal Harga', value: priceFontSize, set: setPriceFontSize, min: 2.0, max: 6.0 },
                  ].map(({ label, value, set, min, max }) => (
                    <div key={label} className="space-y-1.5">
                      <div className="flex justify-between items-center">
                        <label className="text-sm text-foreground">{label}</label>
                        <span className="text-xs text-muted-foreground font-mono tabular-nums">{value.toFixed(1)}mm</span>
                      </div>
                      <input
                        type="range"
                        min={min}
                        max={max}
                        step="0.1"
                        value={value}
                        onChange={(e) => set(parseFloat(e.target.value))}
                        className="w-full accent-primary h-1.5 appearance-none bg-border rounded-full cursor-pointer
                          [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4
                          [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:shadow-sm
                          [&::-webkit-slider-thumb]:cursor-pointer"
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Section 2: Queue */}
              <div className="space-y-4">
                <h3 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                  <ListChecks className="w-3.5 h-3.5" />
                  2. Antrean Cetak
                </h3>
                
                {queue.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-muted-foreground border-2 border-dashed border-border rounded-xl bg-background">
                    <Tag className="w-8 h-8 mb-3 text-muted" />
                    <p className="text-sm">Belum ada produk di antrean</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {queue.map((item) => (
                      <div key={item.id} className="flex items-center gap-3 p-3 border rounded-lg bg-background shadow-sm">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-sm truncate">{item.nama_produk}</h3>
                          <div className="text-xs text-muted-foreground flex items-center gap-2 mt-1">
                            <span className="font-mono bg-muted px-1.5 py-0.5 rounded">{item.barcode}</span>
                            <span>{new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(item.harga_jual_satuan)}</span>
                          </div>
                        </div>
                        <div className="flex flex-col w-20 shrink-0">
                          <Input
                            type="number"
                            min="1"
                            value={item.qty}
                            onChange={(e) => handleUpdateQty(item.id, parseInt(e.target.value) || 1)}
                            className="h-8 text-center font-bold px-2"
                          />
                        </div>
                        <Button variant="ghost" size="icon-xs" onClick={() => handleRemove(item.id)} className="text-destructive hover:bg-destructive/10 shrink-0 h-8 w-8">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Section 3: Output */}
            {queue.length > 0 && (
              <div className="p-5 border-t border-border bg-background">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-sm text-muted-foreground">Total Cetak</span>
                  <span className="text-lg font-bold text-primary">{totalLabels} <span className="text-sm font-normal text-muted-foreground">label</span></span>
                </div>
                <Button onClick={handlePrint} className="w-full gap-2" size="lg">
                  <Printer className="w-4 h-4" />
                  Print Sekarang
                </Button>
              </div>
            )}
          </div>

          {/* Right Panel — Preview */}
          <div className="flex-1 flex flex-col min-h-0 overflow-y-auto">
            <div className="p-6 flex items-center justify-between border-b border-border bg-background sticky top-0 z-10">
              <div>
                <h2 className="text-sm font-medium text-foreground">Live Preview</h2>
                <p className="text-xs text-muted-foreground mt-0.5">Tampilan simulasi cetak di kertas 3-up (33x15mm)</p>
              </div>
              
              {queue.length > 0 && (
                <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20">
                  {totalLabels} Labels
                </Badge>
              )}
            </div>

            <div className="flex-1 flex items-center justify-center p-8 bg-muted/20 min-h-[400px]">
              {queue.length === 0 ? (
                <div className="text-center text-muted-foreground flex flex-col items-center">
                  <p className="text-sm">Preview akan muncul setelah Anda memilih produk.</p>
                </div>
              ) : (
                <div className="bg-white shadow-xl border border-gray-200 p-8 transform scale-[1.2] origin-center transition-transform">
                  <div 
                    className="flex flex-wrap"
                    style={{
                      width: "103mm", // 33mm + 2mm gap + 33mm + 2mm gap + 33mm
                      gap: "3mm 2mm", // Row gap 3mm, Column gap 2mm
                    }}
                  >
                    {printItems.map((item, idx) => (
                      <ProductStickerLabel
                        key={`${item.id}-${idx}`}
                        productName={item.nama_produk}
                        barcodeValue={item.barcode}
                        price={item.harga_jual_satuan}
                        titleFontSize={titleFontSize}
                        barcodeFontSize={barcodeFontSize}
                        priceFontSize={priceFontSize}
                        barcodeHeight={barcodeHeight}
                        className="border border-gray-300 shadow-sm"
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Tampilan Khusus Print (Hidden on screen) */}
      <div className="hidden print:flex flex-wrap bg-white w-[104mm] p-0 m-0"
        style={{
          gap: "3mm 2mm", // Row gap 3mm, Column gap 2mm
        }}
      >
        {printItems.map((item, idx) => (
          <div key={`print-${item.id}-${idx}`} className="break-inside-avoid">
            <ProductStickerLabel
              productName={item.nama_produk}
              barcodeValue={item.barcode}
              price={item.harga_jual_satuan}
              titleFontSize={titleFontSize}
              barcodeFontSize={barcodeFontSize}
              priceFontSize={priceFontSize}
              barcodeHeight={barcodeHeight}
              className="border-none shadow-none" // Remove border/shadow for actual print
            />
          </div>
        ))}
      </div>

      <ProductSelectorModal
        open={isModalOpen}
        onOpenChange={setIsModalOpen}
        onInsert={handleInsert}
      />
    </>
  );
}
