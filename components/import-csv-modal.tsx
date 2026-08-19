"use client";

import React, { useState, useRef } from "react";
import Papa from "papaparse";
import {
  Upload,
  Download,
  FileSpreadsheet,
  AlertCircle,
  CheckCircle2,
  Loader2,
  X,
  FileText,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  downloadExcelTemplate,
  parseExcelToRows,
  type TemplateColumnGuide,
} from "@/lib/export-utils";

export interface ImportCSVModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  templateFilename: string;
  templateHeaders: string[];
  sampleRows: any[][];
  /** Catatan umum pengisian yang disertakan di sheet "Petunjuk" pada template Excel */
  templateInstructions?: string[];
  /** Tabel penjelasan per kolom yang disertakan di sheet "Petunjuk" pada template Excel */
  templateColumnGuide?: TemplateColumnGuide[];
  /**
   * Validate a row parsed from CSV.
   * Return error message string if invalid, or null if valid.
   */
  validateRow?: (row: Record<string, string>, index: number) => string | null;
  /**
   * Called when user clicks "Impor Data". Receives all valid parsed rows.
   */
  onImport: (
    validRows: Record<string, string>[]
  ) => Promise<{ success?: boolean; error?: string; count?: number; message?: string }>;
  onSuccess?: () => void;
}

export interface ParsedRowItem {
  raw: Record<string, string>;
  index: number;
  error: string | null;
}

export default function ImportCSVModal({
  open,
  onOpenChange,
  title,
  description,
  templateFilename,
  templateHeaders,
  sampleRows,
  validateRow,
  onImport,
  onSuccess,
  templateInstructions,
  templateColumnGuide,
}: ImportCSVModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [parsedRows, setParsedRows] = useState<ParsedRowItem[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [isParsing, setIsParsing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDownloadTemplate = () => {
    const hasNotes =
      (templateInstructions && templateInstructions.length > 0) ||
      (templateColumnGuide && templateColumnGuide.length > 0);
    downloadExcelTemplate(
      templateFilename,
      templateHeaders,
      sampleRows,
      hasNotes
        ? {
            sheetName: "Data Produk",
            instructions: templateInstructions,
            columnGuide: templateColumnGuide,
          }
        : undefined
    );
  };

  const resetState = () => {
    setFile(null);
    setParsedRows([]);
    setHeaders([]);
    setIsParsing(false);
    setIsSubmitting(false);
    setServerError(null);
    setSuccessMessage(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      resetState();
    }
    onOpenChange(newOpen);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      processFile(selectedFile);
    }
  };

  const isExcelFile = (f: File) =>
    /\.(xlsx|xls)$/i.test(f.name) ||
    f.type === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
    f.type === "application/vnd.ms-excel";

  const parseCsvFile = (fileToProcess: File): Promise<Record<string, string>[]> => {
    return new Promise((resolve, reject) => {
      Papa.parse<Record<string, string>>(fileToProcess, {
        header: true,
        skipEmptyLines: "greedy",
        transformHeader: (h) => h.trim(),
        complete: (results) => {
          if (results.errors && results.errors.length > 0 && results.data.length === 0) {
            reject(new Error(`Gagal membaca file CSV: ${results.errors[0].message}`));
            return;
          }
          const rows = results.data.map((row) => {
            const cleanedRow: Record<string, string> = {};
            Object.keys(row).forEach((k) => {
              cleanedRow[k] = (row[k] ?? "").toString().trim();
            });
            return cleanedRow;
          });
          resolve(rows);
        },
        error: (err) => reject(err),
      });
    });
  };

  const processFile = async (fileToProcess: File) => {
    setFile(fileToProcess);
    setServerError(null);
    setSuccessMessage(null);
    setIsParsing(true);

    try {
      const rows = isExcelFile(fileToProcess)
        ? await parseExcelToRows(fileToProcess)
        : await parseCsvFile(fileToProcess);

      const rawHeaders = rows.length > 0 ? Object.keys(rows[0]) : [];
      setHeaders(rawHeaders);

      const items: ParsedRowItem[] = rows.map((cleanedRow, idx) => {
        const err = validateRow ? validateRow(cleanedRow, idx) : null;
        return {
          raw: cleanedRow,
          index: idx + 1,
          error: err,
        };
      });

      setParsedRows(items);
    } catch (err: unknown) {
      setServerError(err instanceof Error ? err.message : "Gagal membaca file. Pastikan format file didukung (.xlsx, .xls, atau .csv).");
    } finally {
      setIsParsing(false);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const validRows = parsedRows.filter((r) => !r.error);
  const invalidRows = parsedRows.filter((r) => r.error);

  const handleImportSubmit = async () => {
    if (validRows.length === 0) return;
    setIsSubmitting(true);
    setServerError(null);
    setSuccessMessage(null);

    try {
      const payload = validRows.map((r) => r.raw);
      const res = await onImport(payload);

      if (res.error) {
        setServerError(res.error);
      } else {
        const msg = res.message || `Berhasil mengimpor ${res.count ?? validRows.length} data.`;
        setSuccessMessage(msg);
        if (onSuccess) onSuccess();
      }
    } catch (err: any) {
      setServerError(err?.message || "Terjadi kesalahan saat mengimpor data.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-6xl w-[95vw] max-h-[92vh] flex flex-col p-6 overflow-hidden sm:rounded-2xl">
        <DialogHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between pb-3 border-b space-y-0">
          <div>
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-primary" />
              {title}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground mt-1">
              {description || "Unggah berkas CSV/Excel untuk memperbarui atau memasukkan data massal."}
            </DialogDescription>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleDownloadTemplate}
            className="gap-2 text-xs rounded-full border-primary/30 text-primary hover:bg-primary/5 w-full sm:w-auto justify-center"
          >
            <Download className="w-3.5 h-3.5" />
            Unduh Templat Excel
          </Button>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto py-4 space-y-4 pr-1">
          {/* Server / Parsing Error Notification */}
          {serverError && (
            <div className="p-3 bg-destructive/10 border border-destructive/20 text-destructive text-sm rounded-xl flex items-start gap-2">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <div className="flex-1">{serverError}</div>
            </div>
          )}

          {/* Success Notification */}
          {successMessage && (
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-sm rounded-xl flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <div>{successMessage}</div>
            </div>
          )}

          {/* File Upload Box */}
          {!file ? (
            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-muted-foreground/25 hover:border-primary/50 bg-muted/20 hover:bg-muted/40 transition-colors rounded-2xl p-8 text-center cursor-pointer flex flex-col items-center justify-center gap-3"
            >
              <div className="p-3 rounded-full bg-primary/10 text-primary">
                <Upload className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">
                  Klik atau seret file Excel / CSV ke area ini
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Format berkas yang didukung: .xlsx, .xls, .csv
                </p>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv"
                onChange={handleFileChange}
                className="hidden"
              />
            </div>
          ) : (
            <div className="border rounded-2xl p-4 bg-card flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0">
                <div className="p-2.5 rounded-xl bg-primary/10 text-primary shrink-0">
                  <FileText className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate">{file.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {(file.size / 1024).toFixed(1)} KB • {parsedRows.length} baris terbaca
                  </p>
                </div>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={resetState}
                disabled={isSubmitting}
                className="rounded-full hover:bg-destructive/10 text-muted-foreground hover:text-destructive shrink-0"
              >
                <X className="w-4 h-4 mr-1" /> Ganti File
              </Button>
            </div>
          )}

          {/* Parsing Spinner */}
          {isParsing && (
            <div className="flex items-center justify-center py-8 gap-2 text-sm text-muted-foreground">
              <Loader2 className="w-5 h-5 animate-spin text-primary" />
              Membaca dan memvalidasi berkas...
            </div>
          )}

          {/* Parsed Preview Table */}
          {file && !isParsing && parsedRows.length > 0 && (
            <div className="space-y-3">
              {/* Summary Stats */}
              <div className="flex items-center justify-between text-xs font-medium text-muted-foreground px-1">
                <span>Total Baris: {parsedRows.length}</span>
                <div className="flex items-center gap-3">
                  <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> {validRows.length} Valid
                  </span>
                  {invalidRows.length > 0 && (
                    <span className="text-destructive flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5" /> {invalidRows.length} Error
                    </span>
                  )}
                </div>
              </div>

              {/* Table Wrapper */}
              <div className="border rounded-xl overflow-x-auto max-h-[50vh] overflow-y-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-muted/50 text-muted-foreground sticky top-0 font-medium">
                    <tr>
                      <th className="px-3 py-2 w-12 text-center">#</th>
                      <th className="px-3 py-2 w-20">Status</th>
                      {headers.map((h) => (
                        <th key={h} className="px-3 py-2 font-semibold">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {parsedRows.slice(0, 50).map((row) => (
                      <tr
                        key={row.index}
                        className={row.error ? "bg-destructive/5" : "hover:bg-muted/30"}
                      >
                        <td className="px-3 py-2 text-center text-muted-foreground">
                          {row.index}
                        </td>
                        <td className="px-3 py-2">
                          {row.error ? (
                            <span className="inline-flex items-center text-[10px] font-medium text-destructive bg-destructive/10 px-2 py-0.5 rounded-full" title={row.error}>
                              Error
                            </span>
                          ) : (
                            <span className="inline-flex items-center text-[10px] font-medium text-emerald-600 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                              Valid
                            </span>
                          )}
                        </td>
                        {headers.map((h) => (
                          <td key={h} className="px-3 py-2 truncate max-w-[150px]">
                            {row.raw[h] ?? "-"}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {parsedRows.length > 50 && (
                <p className="text-[11px] text-muted-foreground text-center italic">
                  Menampilkan 50 dari total {parsedRows.length} baris data.
                </p>
              )}

              {/* Error Detail List */}
              {invalidRows.length > 0 && (
                <div className="p-3 bg-destructive/5 border border-destructive/20 rounded-xl space-y-1 max-h-32 overflow-y-auto">
                  <p className="text-xs font-semibold text-destructive flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5" /> Detail Kesalahan Validasi:
                  </p>
                  <ul className="text-[11px] text-destructive/90 list-disc list-inside space-y-0.5">
                    {invalidRows.map((inv) => (
                      <li key={inv.index}>
                        Baris {inv.index}: {inv.error}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="pt-3 border-t flex flex-row items-center justify-between sm:justify-between space-x-2">
          <Button
            type="button"
            variant="ghost"
            onClick={() => handleOpenChange(false)}
            disabled={isSubmitting}
            className="rounded-full text-xs"
          >
            Batal
          </Button>

          {successMessage ? (
            <Button
              type="button"
              onClick={() => handleOpenChange(false)}
              className="gap-2 text-xs rounded-full px-6 bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              Tutup
            </Button>
          ) : (
            <Button
              type="button"
              onClick={handleImportSubmit}
              disabled={!file || validRows.length === 0 || isSubmitting || isParsing}
              className="gap-2 text-xs rounded-full px-5"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Memproses Impor...
                </>
              ) : (
                <>
                  <Upload className="w-3.5 h-3.5" />
                  Impor {validRows.length > 0 ? `${validRows.length} Data Valid` : "Data"}
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
