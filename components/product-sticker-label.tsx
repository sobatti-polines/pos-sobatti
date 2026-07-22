"use client";

import React, { useEffect, useRef } from "react";
import JsBarcode from "jsbarcode";
import { cn } from "@/lib/utils";

interface ProductStickerLabelProps {
  productName: string;
  barcodeValue: string;
  price: number;
  titleFontSize?: number;
  barcodeFontSize?: number;
  priceFontSize?: number;
  barcodeHeight?: number;
  className?: string;
}

export function ProductStickerLabel({
  productName,
  barcodeValue,
  price,
  titleFontSize = 1.9,
  barcodeFontSize = 1.5,
  priceFontSize = 2.5,
  barcodeHeight = 4.4,
  className,
}: ProductStickerLabelProps) {
  const barcodeRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (barcodeRef.current && barcodeValue) {
      try {
        JsBarcode(barcodeRef.current, barcodeValue, {
          format: "CODE128",
          displayValue: false, // We'll render the text manually to control size/position
          margin: 0,
          height: 18, // Very short barcode
          width: 1,   // Thin bars
          background: "transparent",
        });
      } catch (error) {
        console.error("Invalid barcode value", error);
      }
    }
  }, [barcodeValue]);

  const formattedPrice = new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(price);

  return (
    <div
      className={cn(
        "bg-white flex flex-col items-center justify-between font-sans shrink-0 overflow-hidden relative",
        className
      )}
      style={{
        width: "33mm",
        height: "15mm",
        padding: "1mm",
        boxSizing: "border-box",
      }}
    >
      {/* Product Name - Max 2 lines */}
      <div 
        className="text-center font-bold leading-[1.1] w-full break-words text-black"
        style={{ 
          fontSize: `${titleFontSize}mm`, 
          maxHeight: "5.5mm", 
          overflow: "hidden",
          fontFamily: "Arial, sans-serif"
        }}
      >
        {productName.toUpperCase()}
      </div>

      {/* Barcode Graphic & Text */}
      <div className="flex flex-col items-center justify-center flex-1 min-h-0 w-full">
        <svg
          ref={barcodeRef}
          style={{ maxWidth: "100%", height: `${barcodeHeight}mm`, display: "block" }}
          preserveAspectRatio="none"
        ></svg>
        <span 
          className="text-black font-mono leading-none tracking-widest"
          style={{ fontSize: `${barcodeFontSize}mm`, marginTop: "0.2mm" }}
        >
          {barcodeValue}
        </span>
      </div>

      {/* Price */}
      <div 
        className="text-center font-bold text-black leading-none"
        style={{ 
          fontSize: `${priceFontSize}mm`, 
          fontFamily: "Arial, sans-serif" 
        }}
      >
        {formattedPrice}
      </div>
    </div>
  );
}
