"use client";

import React, { useEffect, useRef } from "react";
import JsBarcode from "jsbarcode";
import { cn } from "@/lib/utils";

interface PriceTagProps {
  productName: string;
  sku: string;
  barcodeValue?: string;
  price: number;
  className?: string;
  /**
   * 'landscape' = 6x4 cm (60mm x 40mm)
   * 'portrait' = 4x6 cm (40mm x 60mm)
   */
  orientation?: "landscape" | "portrait";
  
  // Customizable font sizes (in mm)
  titleFontSize?: number;
  skuFontSize?: number;
  rpFontSize?: number;
  priceFontSize?: number;
}

export function PriceTag({
  productName,
  sku,
  barcodeValue,
  price,
  className,
  orientation = "landscape",
  titleFontSize = 3.2,
  skuFontSize = 2.0,
  rpFontSize = 4.5,
  priceFontSize = 9.5,
}: PriceTagProps) {
  const barcodeRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (barcodeRef.current) {
      JsBarcode(barcodeRef.current, barcodeValue || sku, {
        format: "CODE128",
        displayValue: true,
        fontSize: 11,
        margin: 0,
        height: 28,
        width: 1.2,
        font: "monospace",
        textMargin: 2,
        background: "transparent",
      });
    }
  }, [sku]);

  // Format price
  const formattedPrice = new Intl.NumberFormat("id-ID").format(price);

  // Base dimensions (4x6 cm = 40mm x 60mm)
  // Umumnya label diletakkan melebar (landscape 6x4 cm)
  const isLandscape = orientation === "landscape";
  const width = isLandscape ? "60mm" : "40mm";
  const height = isLandscape ? "40mm" : "60mm";

  return (
    <div
      className={cn(
        "bg-white flex flex-col font-sans shrink-0 border border-gray-300 overflow-hidden relative",
        className,
      )}
      style={{
        width,
        height,
        boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
      }}
    >
      {/* Header */}
      <div className="px-[2.5mm] py-[1.5mm] flex flex-col bg-white">
        <h1
          className="font-bold leading-none text-black tracking-tight truncate"
          style={{
            fontFamily: "Arial, Helvetica, sans-serif",
            fontSize: `${titleFontSize}mm`,
          }}
        >
          {productName.toUpperCase()}
        </h1>
        <h2
          className="font-normal leading-none text-black mt-[0.5mm] truncate"
          style={{
            fontFamily: "Arial, Helvetica, sans-serif",
            fontSize: `${skuFontSize}mm`,
          }}
        >
          {sku.toUpperCase()}
        </h2>
      </div>

      {/* Separator */}
      <div className="w-full h-[0.25mm] bg-black"></div>

      {/* Price */}
      <div className="px-[2.5mm] py-[1.5mm] flex justify-between items-center bg-white">
        <span
          className="text-[#ff0000] leading-none"
          style={{
            fontFamily: 'Impact, "Arial Black", sans-serif',
            fontSize: `${rpFontSize}mm`,
          }}
        >
          Rp
        </span>
        <span
          className="text-[#ff0000] leading-none tracking-normal"
          style={{
            fontFamily: 'Impact, "Arial Black", sans-serif',
            fontSize: `${priceFontSize}mm`,
          }}
        >
          {formattedPrice}
        </span>
      </div>

      {/* Separator */}
      <div className="w-full h-[0.25mm] bg-black"></div>

      {/* Barcode */}
      <div className="flex flex-col items-center justify-center py-[1mm] bg-white flex-1 min-h-0">
        <svg
          ref={barcodeRef}
          style={{ maxWidth: "100%", maxHeight: "100%" }}
        ></svg>
      </div>

      {/* Footer Image */}
      <div className="bg-black w-full h-[8mm] shrink-0 relative flex items-center justify-center">
        <img
          src="/logo-perusahaan.png"
          alt="Putra Logam Kencana"
          className="w-full h-full object-cover"
        />
      </div>
    </div>
  );
}
