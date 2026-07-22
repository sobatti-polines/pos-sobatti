'use client';

import { useState, useRef } from 'react';
import { PriceTag } from '@/components/price-tag';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { SlidersHorizontal, Tag, ChevronLeft, ChevronRight, Download, Loader2, Printer, Plus, Trash2, ListChecks } from 'lucide-react';
import { toPng } from 'html-to-image';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { ProductSelectorModal, PrintProduct } from '../product-label/product-selector-modal';

export default function LabelGeneratorPage() {
  const [data, setData] = useState<PrintProduct[]>([]);
  const [previewIndex, setPreviewIndex] = useState(0);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const [titleFontSize, setTitleFontSize] = useState(3.2);
  const [skuFontSize, setSkuFontSize] = useState(2.0);
  const [rpFontSize, setRpFontSize] = useState(4.5);
  const [priceFontSize, setPriceFontSize] = useState(9.5);

  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [captureItem, setCaptureItem] = useState<PrintProduct | null>(null);
  const captureRef = useRef<HTMLDivElement>(null);

  const handleInsert = (selected: PrintProduct[]) => {
    setData((prev) => {
      const newData = [...prev];
      selected.forEach((product) => {
        if (!newData.find((item) => item.id === product.id)) {
          newData.push(product);
        }
      });
      return newData;
    });
  };

  const handleRemove = (id: number) => {
    setData((prev) => {
      const newData = prev.filter((item) => item.id !== id);
      if (previewIndex >= newData.length) {
        setPreviewIndex(Math.max(0, newData.length - 1));
      }
      return newData;
    });
  };

  const handleDownloadZip = async () => {
    if (!data.length) return;
    setIsGenerating(true);
    setProgress(0);

    const zip = new JSZip();

    for (let i = 0; i < data.length; i++) {
      const item = data[i];
      setCaptureItem(item);

      await new Promise(resolve => setTimeout(resolve, 150));

      if (captureRef.current) {
        try {
          const dataUrl = await toPng(captureRef.current, {
            cacheBust: true,
            pixelRatio: 3,
          });

          const base64Data = dataUrl.replace(/^data:image\/(png|jpg);base64,/, "");
          const safeName = (item.sku || `item_${i}`).replace(/[^a-zA-Z0-9_-]/g, '');
          zip.file(`${safeName}.png`, base64Data, { base64: true });
        } catch (e) {
          console.error("Failed to capture", item.sku, e);
        }
      }
      setProgress(Math.round(((i + 1) / data.length) * 100));
    }

    try {
      const content = await zip.generateAsync({ type: "blob" });
      saveAs(content, "PriceTags.zip");
    } catch (e) {
      console.error("Failed to zip", e);
    }

    setIsGenerating(false);
    setCaptureItem(null);
  };

  const handlePrint = () => {
    window.print();
  };

  const previewItem = data.length > 0 ? data[previewIndex] : {
    nama_produk: 'AMPLAS BULAT 120 SAB',
    sku: 'AMP BLT 120',
    barcode: 'MHIO01',
    harga_modal: 3200000
  };

  const priceValue = previewItem.harga_modal || 0;

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          @page { size: A4 portrait; margin: 10mm; }
          html, body { 
            background-color: white !important; 
            -webkit-print-color-adjust: exact; 
            height: auto !important;
            overflow: visible !important;
          }
          /* Matikan flex dan batasan tinggi dari layout dashboard agar print multi-halaman bekerja */
          .md\:h-\[100dvh\], .min-h-\[100dvh\] { height: auto !important; min-height: 0 !important; }
          .md\:overflow-hidden { overflow: visible !important; }
          .md\:flex-row { display: block !important; }
        }
      `}} />

      <div className="flex-1 flex flex-col min-h-0 print:hidden">
        <div className="px-6 pt-6 pb-4 border-b border-border">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Tag className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h1 className="text-xl font-light tracking-tight text-foreground">Pricetag Generator</h1>
                <p className="text-sm text-muted-foreground">Buat dan cetak label harga untuk rak (A4)</p>
              </div>
            </div>
            <Button onClick={() => setIsModalOpen(true)} className="gap-2">
              <Plus className="w-4 h-4" />
              Pilih Produk
            </Button>
          </div>
        </div>

        <div className="flex-1 flex flex-col lg:flex-row min-h-0 overflow-hidden">
          {/* Hidden container for zip capture */}
          <div className="absolute top-[-9999px] left-[-9999px]">
            <div ref={captureRef} className="bg-white inline-block">
              {captureItem && (
                <PriceTag
                  productName={captureItem.nama_produk}
                  sku={captureItem.sku}
                  barcodeValue={captureItem.barcode}
                  price={captureItem.harga_modal || 0}
                  titleFontSize={titleFontSize}
                  skuFontSize={skuFontSize}
                  rpFontSize={rpFontSize}
                  priceFontSize={priceFontSize}
                />
              )}
            </div>
          </div>

          {/* Left Panel — Controls */}
          <div className="w-full lg:w-[420px] shrink-0 border-b lg:border-b-0 lg:border-r border-border bg-muted/30 flex flex-col overflow-hidden">
            <div className="flex-1 overflow-y-auto p-5 space-y-8 custom-scrollbar">
              
              {/* Section 1: Typography */}
              <div className="space-y-5">
                <h3 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                  <SlidersHorizontal className="w-3.5 h-3.5" />
                  1. Tipografi
                </h3>

                <div className="space-y-5">
                  {[
                    { label: 'Nama Produk', value: titleFontSize, set: setTitleFontSize, min: 1.5, max: 6.0 },
                    { label: 'Kode SKU', value: skuFontSize, set: setSkuFontSize, min: 1.0, max: 4.0 },
                    { label: 'Label Rp', value: rpFontSize, set: setRpFontSize, min: 2.0, max: 8.0 },
                    { label: 'Nominal Harga', value: priceFontSize, set: setPriceFontSize, min: 4.0, max: 15.0 },
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
                        disabled={isGenerating}
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
                <div className="flex items-center justify-between">
                  <h3 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                    <ListChecks className="w-3.5 h-3.5" />
                    2. Antrean Cetak
                  </h3>
                  {data.length > 0 && (
                    <Badge variant="outline" className="text-xs font-normal">
                      {data.length} produk
                    </Badge>
                  )}
                </div>
                
                {data.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-muted-foreground border-2 border-dashed border-border rounded-xl bg-background">
                    <Tag className="w-8 h-8 mb-3 text-muted" />
                    <p className="text-sm">Belum ada produk di antrean</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {data.map((item) => (
                      <div key={item.id} className="flex items-center gap-3 p-3 border rounded-lg bg-background shadow-sm">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-sm truncate">{item.nama_produk}</h3>
                          <div className="text-xs text-muted-foreground flex items-center gap-2 mt-1">
                            <span className="font-mono bg-muted px-1.5 py-0.5 rounded">{item.sku || '-'}</span>
                            <span>{new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(item.harga_modal)}</span>
                          </div>
                        </div>
                        <Button variant="ghost" size="icon-xs" onClick={() => handleRemove(item.id)} className="text-destructive hover:bg-destructive/10 shrink-0 h-8 w-8" disabled={isGenerating}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Section 3: Output */}
            <div className="p-5 border-t border-border bg-background space-y-4">
              <h3 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">3. Output</h3>

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={handleDownloadZip}
                  disabled={data.length === 0 || isGenerating}
                  className="flex-1 gap-2"
                >
                  {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                  ZIP
                </Button>
                <Button
                  onClick={handlePrint}
                  disabled={data.length === 0 || isGenerating}
                  className="flex-[2] gap-2"
                >
                  <Printer className="w-4 h-4" />
                  Print A4/F4
                </Button>
              </div>

              {isGenerating && (
                <div className="space-y-1">
                  <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                    <div className="bg-primary h-1.5 rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
                  </div>
                  <p className="text-xs text-muted-foreground text-right tabular-nums">{progress}%</p>
                </div>
              )}
            </div>
          </div>

          {/* Right Panel — Preview */}
          <div className="flex-1 flex flex-col min-h-0 overflow-y-auto">
            <div className="p-6 flex items-center justify-between border-b border-border bg-background sticky top-0 z-10">
              <h2 className="text-sm font-medium text-foreground">Live Preview</h2>

              {data.length > 0 && (
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    onClick={() => setPreviewIndex(i => Math.max(0, i - 1))}
                    disabled={previewIndex === 0 || isGenerating}
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <span className="text-sm text-muted-foreground tabular-nums min-w-[60px] text-center">
                    {previewIndex + 1} / {data.length}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    onClick={() => setPreviewIndex(i => Math.min(data.length - 1, i + 1))}
                    disabled={previewIndex === data.length - 1 || isGenerating}
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              )}
            </div>

            <div className="flex-1 flex items-center justify-center p-8 bg-muted/20 min-h-[400px]">
              <div className="relative">
                <p className="absolute -top-5 left-0 text-[10px] text-muted-foreground font-mono">60mm × 40mm</p>
                <div className="scale-[1.5] origin-center shadow-xl transition-transform duration-300 rounded-sm overflow-hidden">
                  <PriceTag
                    productName={previewItem.nama_produk}
                    sku={previewItem.sku}
                    barcodeValue={previewItem.barcode}
                    price={priceValue}
                    titleFontSize={titleFontSize}
                    skuFontSize={skuFontSize}
                    rpFontSize={rpFontSize}
                    priceFontSize={priceFontSize}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Print UI */}
      <div className="hidden print:block bg-white w-full">
        {Array.from({ length: Math.ceil(data.length / 18) }).map((_, pageIndex) => (
          <div 
            key={`page-${pageIndex}`}
            className="flex flex-wrap gap-[2mm] justify-start content-start p-[2mm]"
            style={{ breakAfter: 'page', pageBreakAfter: 'always' }}
          >
            {data.slice(pageIndex * 18, (pageIndex + 1) * 18).map((item, idx) => (
              <div key={`item-${pageIndex}-${idx}`} className="break-inside-avoid" style={{ width: '60mm', height: '40mm' }}>
                <PriceTag
                  productName={item.nama_produk}
                  sku={item.sku}
                  barcodeValue={item.barcode}
                  price={item.harga_modal || 0}
                  titleFontSize={titleFontSize}
                  skuFontSize={skuFontSize}
                  rpFontSize={rpFontSize}
                  priceFontSize={priceFontSize}
                  className="border-0 shadow-none!"
                />
              </div>
            ))}
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
