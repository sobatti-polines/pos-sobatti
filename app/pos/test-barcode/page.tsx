"use client";

import React, { useState, useEffect, useRef } from "react";
import Papa from "papaparse";
import JsBarcode from "jsbarcode";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// Conversion: 1 cm = 96 px / 2.54 = 37.7952755906 px
const CM_TO_PX = 37.7952755906;

const PAGE_WIDTH_PX = 16.8 * CM_TO_PX;
const PAGE_HEIGHT_PX = 25 * CM_TO_PX; //21.3
// Margin from paper edge to first label
const TOP_MARGIN_PX = 1 * CM_TO_PX; //0.1
const SIDE_MARGIN_PX = 0.3 * CM_TO_PX;
// Pitch is the distance from start of one label to start of the next (Label Size + Margin Gap)
const HORIZONTAL_PITCH_PX = (5 + 0.384) * CM_TO_PX;
const VERTICAL_PITCH_PX = (1.9 + 0.285) * CM_TO_PX;
// Individual Label Size
const LABEL_WIDTH_PX = 5 * CM_TO_PX;
const LABEL_HEIGHT_PX = 1.9 * CM_TO_PX;

const LABELS_ACROSS = 3;
const LABELS_DOWN = 10;
const LABELS_PER_PAGE = LABELS_ACROSS * LABELS_DOWN;

type CSVRow = {
  Barcode: string;
  Item: string;
  "Harga Retail": string;
};

const BarcodeImage = ({ value }: { value: string }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (canvasRef.current) {
      try {
        JsBarcode(canvasRef.current, value || "0000000000000", {
          format: "CODE128",
          displayValue: true,
          fontSize: 11,
          margin: 0,
          textMargin: 0,
          height: 28,
        });
      } catch (err) {
        console.error("Failed to generate barcode:", err);
      }
    }
  }, [value]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        maxWidth: "100%",
        maxHeight: "100%",
        objectFit: "contain"
      }}
    />
  );
};

export default function BarcodeTestPage() {
  const [file, setFile] = useState<File | null>(null);
  const [data, setData] = useState<CSVRow[]>([]);

  const handleProcessCSV = async () => {
    if (!file) return alert("Please select a CSV file first.");

    Papa.parse<CSVRow>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        setData(results.data);
      },
      error: (error) => {
        console.error("CSV parse error:", error);
        alert("Failed to parse CSV");
      }
    });
  };

  // Split data into pages
  const pages: CSVRow[][] = [];
  for (let i = 0; i < data.length; i += LABELS_PER_PAGE) {
    pages.push(data.slice(i, i + LABELS_PER_PAGE));
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 pb-12">
      <div className="container mx-auto p-8 space-y-6 max-w-4xl print:hidden">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
          Barcode Layout Print Preview
        </h1>

        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border dark:border-gray-700 shadow-sm max-w-xl space-y-4">
          <div className="space-y-2">
            <Label htmlFor="csvFile">Upload Barcode Data (CSV)</Label>
            <Input
              id="csvFile"
              type="file"
              accept=".csv"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
            />
          </div>
          <div className="flex gap-4">
            <Button onClick={handleProcessCSV} disabled={!file}>
              Process CSV
            </Button>
            <Button
              variant="outline"
              onClick={() => window.print()}
              disabled={data.length === 0}
            >
              Print Labels (Ctrl+P)
            </Button>
          </div>
        </div>
      </div>

      <div className="flex flex-col items-center print:block">
        {pages.map((pageData, pageIndex) => (
          <div
            key={pageIndex}
            className="relative bg-white shadow-xl print:shadow-none mx-auto overflow-hidden border border-gray-300 print:border-none mb-8 print:mb-0"
            style={{
              width: `${PAGE_WIDTH_PX}px`,
              height: `${PAGE_HEIGHT_PX}px`,
              pageBreakAfter: "always",
              breakAfter: "page"
            }}
          >
            {pageData.map((row, index) => {
              const col = index % LABELS_ACROSS;
              const rowNum = Math.floor(index / LABELS_ACROSS);

              // Absolute position of the label container
              const left = SIDE_MARGIN_PX + col * HORIZONTAL_PITCH_PX;
              const top = TOP_MARGIN_PX + rowNum * VERTICAL_PITCH_PX;

              return (
                <div
                  key={index}
                  className="absolute flex flex-col justify-between items-center"
                  style={{
                    left: `${left}px`,
                    top: `${top}px`,
                    width: `${LABEL_WIDTH_PX}px`,
                    height: `${LABEL_HEIGHT_PX}px`,
                    boxSizing: "border-box",
                    padding: "2px 4px",
                  }}
                >
                  {/* Item Name */}
                  <div
                    className="text-[9px] font-bold text-center w-full truncate leading-tight text-gray-900"
                    title={row.Item}
                  >
                    {row.Item || "Unknown Item"}
                  </div>

                  {/* Barcode Canvas */}
                  <div className="flex-1 flex justify-center items-center overflow-hidden w-full">
                    <BarcodeImage value={row.Barcode} />
                  </div>

                  {/* Price */}
                  <div className="text-[10px] text-center w-full font-medium leading-none text-gray-900">
                    Rp {parseInt(row["Harga Retail"] || "0", 10).toLocaleString("id-ID")}
                  </div>
                </div>
              );
            })}
          </div>
        ))}

        {pages.length === 0 && (
          <div className="text-gray-400 print:hidden text-center mt-12">
            Preview will appear here after processing CSV
          </div>
        )}
      </div>

      {/* Global Print Styles to enforce exact sizing */}
      <style dangerouslySetInnerHTML={{
        __html: `
        @media print {
          @page {
            size: ${PAGE_WIDTH_PX}px ${PAGE_HEIGHT_PX}px;
            margin: 0;
          }
          body {
            margin: 0;
            padding: 0;
            background: white !important;
            -webkit-print-color-adjust: exact;
          }
        }
      `}} />
    </div>
  );
}
