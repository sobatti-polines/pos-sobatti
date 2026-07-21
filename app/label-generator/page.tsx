'use client';

import { useState, useRef, useEffect } from 'react';
import Papa from 'papaparse';
import { PriceTag } from '@/components/price-tag';
import { Upload, SlidersHorizontal, Image as ImageIcon, ChevronLeft, ChevronRight, Download, Loader2, Printer } from 'lucide-react';
import { toPng } from 'html-to-image';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';

export default function LabelGeneratorPage() {
  const [data, setData] = useState<any[]>([]);
  const [previewIndex, setPreviewIndex] = useState(0);
  
  // Font Size States
  const [titleFontSize, setTitleFontSize] = useState(3.2);
  const [skuFontSize, setSkuFontSize] = useState(2.0);
  const [rpFontSize, setRpFontSize] = useState(4.5);
  const [priceFontSize, setPriceFontSize] = useState(9.5);

  // Generation States
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [captureItem, setCaptureItem] = useState<any>(null);
  const captureRef = useRef<HTMLDivElement>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      Papa.parse(file, {
        header: true,
        complete: (results) => {
          const validData = results.data.filter((r: any) => r.kd_brg);
          setData(validData);
          setPreviewIndex(0);
        }
      });
    }
  };

  const handleDownloadZip = async () => {
    if (!data.length) return;
    setIsGenerating(true);
    setProgress(0);
    
    const zip = new JSZip();
    
    // Process sequentially to avoid browser crash/lag
    for (let i = 0; i < data.length; i++) {
       const item = data[i];
       setCaptureItem(item);
       
       // Wait for React to render and jsbarcode to finish drawing
       await new Promise(resolve => setTimeout(resolve, 150)); 
       
       if (captureRef.current) {
           try {
               const dataUrl = await toPng(captureRef.current, { 
                   cacheBust: true,
                   pixelRatio: 3, // High quality for printing
               });
               
               const base64Data = dataUrl.replace(/^data:image\/(png|jpg);base64,/, "");
               const safeName = (item.kd_brg || `item_${i}`).replace(/[^a-zA-Z0-9_-]/g, '');
               const fileName = `${safeName}.png`;
               
               zip.file(fileName, base64Data, { base64: true });
           } catch(e) {
               console.error("Failed to capture", item.kd_brg, e);
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
    nama: 'AMPLAS BULAT 120 SAB',
    kd_brg: 'AMP BLT 120',
    barcode: 'MHIO01',
    modal: 3200000
  };

  const priceValue = parseInt(previewItem.modal) || 0;

  return (
    <>
      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          @page {
            size: A4 portrait;
            margin: 10mm;
          }
          body {
            background-color: white !important;
            -webkit-print-color-adjust: exact;
          }
        }
      `}} />

      {/* --- NORMAL UI (HIDDEN ON PRINT) --- */}
      <div className="min-h-screen bg-gray-50 text-gray-900 flex flex-col md:flex-row print:hidden">
        
        {/* Hidden container for rendering items to capture (zip download) */}
        <div className="absolute top-[-9999px] left-[-9999px]">
           <div ref={captureRef} className="bg-white inline-block">
              {captureItem && (
                 <PriceTag 
                   productName={captureItem.nama}
                   sku={captureItem.kd_brg}
                   barcodeValue={captureItem.barcode}
                   price={parseInt(captureItem.modal) || 0}
                   titleFontSize={titleFontSize}
                   skuFontSize={skuFontSize}
                   rpFontSize={rpFontSize}
                   priceFontSize={priceFontSize}
                 />
              )}
           </div>
        </div>

        {/* Sidebar Controls */}
        <div className="w-full md:w-[400px] bg-white border-r border-gray-200 shadow-xl z-10 flex flex-col h-screen sticky top-0 overflow-y-auto">
          <div className="p-6 border-b border-gray-100">
            <h1 className="text-2xl font-bold flex items-center gap-2 text-gray-800">
              <ImageIcon className="w-6 h-6 text-blue-600" />
              Label Generator
            </h1>
            <p className="text-sm text-gray-500 mt-1">Live preview & cetak untuk rak</p>
          </div>

          <div className="p-6 space-y-8 flex-1">
            {/* Section 1: Upload */}
            <div className="space-y-3">
              <h3 className="font-semibold text-sm tracking-wider text-gray-500 uppercase">1. Data Source (CSV)</h3>
              <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-300 border-dashed rounded-xl cursor-pointer bg-gray-50 hover:bg-gray-100 transition-colors">
                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                  <Upload className="w-8 h-8 text-gray-400 mb-2" />
                  <p className="text-sm text-gray-600"><span className="font-semibold">Klik untuk upload</span> atau drag file</p>
                  <p className="text-xs text-gray-500 mt-1">Hanya mendukung format CSV</p>
                </div>
                <input type="file" accept=".csv" className="hidden" onChange={handleFileUpload} />
              </label>
              
              {data.length > 0 && (
                <div className="bg-green-50 text-green-700 p-3 rounded-lg text-sm flex justify-between items-center border border-green-200">
                  <span>Total <b>{data.length}</b> produk dimuat.</span>
                </div>
              )}
            </div>

            {/* Section 2: Adjustments */}
            <div className="space-y-5">
              <h3 className="font-semibold text-sm tracking-wider text-gray-500 uppercase flex items-center gap-2">
                <SlidersHorizontal className="w-4 h-4" />
                2. Tipografi (mm)
              </h3>
              
              <div className="space-y-4">
                <div className="space-y-1">
                  <div className="flex justify-between">
                    <label className="text-sm font-medium text-gray-700">Nama Produk</label>
                    <span className="text-sm text-gray-500 font-mono">{titleFontSize}mm</span>
                  </div>
                  <input 
                    type="range" min="1.5" max="6.0" step="0.1" 
                    value={titleFontSize} onChange={(e) => setTitleFontSize(parseFloat(e.target.value))}
                    className="w-full accent-blue-600"
                    disabled={isGenerating}
                  />
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between">
                    <label className="text-sm font-medium text-gray-700">Kode SKU</label>
                    <span className="text-sm text-gray-500 font-mono">{skuFontSize}mm</span>
                  </div>
                  <input 
                    type="range" min="1.0" max="4.0" step="0.1" 
                    value={skuFontSize} onChange={(e) => setSkuFontSize(parseFloat(e.target.value))}
                    className="w-full accent-blue-600"
                    disabled={isGenerating}
                  />
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between">
                    <label className="text-sm font-medium text-gray-700">Label 'Rp'</label>
                    <span className="text-sm text-gray-500 font-mono">{rpFontSize}mm</span>
                  </div>
                  <input 
                    type="range" min="2.0" max="8.0" step="0.1" 
                    value={rpFontSize} onChange={(e) => setRpFontSize(parseFloat(e.target.value))}
                    className="w-full accent-blue-600"
                    disabled={isGenerating}
                  />
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between">
                    <label className="text-sm font-medium text-gray-700">Nominal Harga</label>
                    <span className="text-sm text-gray-500 font-mono">{priceFontSize}mm</span>
                  </div>
                  <input 
                    type="range" min="4.0" max="15.0" step="0.1" 
                    value={priceFontSize} onChange={(e) => setPriceFontSize(parseFloat(e.target.value))}
                    className="w-full accent-blue-600"
                    disabled={isGenerating}
                  />
                </div>
              </div>
            </div>
            
            {/* Section 3: Output */}
            <div className="pt-4 border-t border-gray-100 space-y-3">
              <h3 className="font-semibold text-sm tracking-wider text-gray-500 uppercase">3. Output</h3>
              
              <div className="flex gap-2">
                <button
                  onClick={handleDownloadZip}
                  disabled={data.length === 0 || isGenerating}
                  className="flex-1 py-3 bg-white border-2 border-blue-600 text-blue-600 hover:bg-blue-50 disabled:border-gray-300 disabled:text-gray-400 disabled:bg-gray-100 font-medium rounded-xl flex items-center justify-center gap-2 transition-colors"
                >
                  {isGenerating ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Download className="w-5 h-5" />
                  )}
                  ZIP
                </button>
                
                <button
                  onClick={handlePrint}
                  disabled={data.length === 0 || isGenerating}
                  className="flex-[2] py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-medium rounded-xl flex items-center justify-center gap-2 transition-colors"
                >
                  <Printer className="w-5 h-5" />
                  Print A4/F4
                </button>
              </div>

               {isGenerating && (
                   <div className="w-full bg-gray-200 rounded-full h-1.5 mt-2 overflow-hidden">
                       <div className="bg-blue-600 h-1.5 rounded-full transition-all duration-300" style={{ width: `${progress}%` }}></div>
                   </div>
               )}
            </div>
          </div>
        </div>

        {/* Main Preview Area */}
        <div className="flex-1 p-8 md:p-12 flex flex-col bg-gray-50 overflow-y-auto">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-800">Live Preview</h2>
            
            {data.length > 0 && (
              <div className="flex items-center gap-3 bg-white px-4 py-2 rounded-full border border-gray-200 shadow-sm">
                <button 
                  onClick={() => setPreviewIndex(i => Math.max(0, i - 1))}
                  disabled={previewIndex === 0 || isGenerating}
                  className="p-1 rounded hover:bg-gray-100 disabled:opacity-50 text-gray-600"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <span className="text-sm font-medium tabular-nums min-w-[80px] text-center">
                  {previewIndex + 1} / {data.length}
                </span>
                <button 
                  onClick={() => setPreviewIndex(i => Math.min(data.length - 1, i + 1))}
                  disabled={previewIndex === data.length - 1 || isGenerating}
                  className="p-1 rounded hover:bg-gray-100 disabled:opacity-50 text-gray-600"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            )}
          </div>

          <div className="flex-1 flex items-center justify-center bg-gray-200/50 rounded-2xl border-2 border-gray-200 border-dashed relative min-h-[400px]">
             <div className="absolute top-4 left-4 text-xs font-mono text-gray-400">Ukuran Asli: 60mm x 40mm</div>

             <div className="scale-[1.5] origin-center shadow-2xl transition-transform duration-300">
               <PriceTag 
                 productName={previewItem.nama}
                 sku={previewItem.kd_brg}
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

      {/* --- PRINT ONLY UI (HIDDEN ON SCREEN) --- */}
      <div className="hidden print:flex flex-wrap gap-[2mm] justify-start content-start bg-white w-full h-full p-[2mm]">
        {data.map((item, idx) => (
           <div 
             key={idx} 
             className="break-inside-avoid border border-dashed border-gray-300"
             style={{ width: '60mm', height: '40mm' }}
           >
             <PriceTag 
               productName={item.nama}
               sku={item.kd_brg}
               barcodeValue={item.barcode}
               price={parseInt(item.modal) || 0}
               titleFontSize={titleFontSize}
               skuFontSize={skuFontSize}
               rpFontSize={rpFontSize}
               priceFontSize={priceFontSize}
               // Remove internal border/shadow for clean printing
               className="border-0 shadow-none!" 
             />
           </div>
        ))}
      </div>
    </>
  );
}
