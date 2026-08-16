import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import Papa from "papaparse";
import * as XLSX from "xlsx";

export const exportToCSV = (filename: string, headers: string[], data: any[][]) => {
  const csvData = [headers, ...data];
  const csv = Papa.unparse(csvData);
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.setAttribute("href", url);
  link.setAttribute("download", `${filename}.csv`);
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

export const downloadCSVTemplate = (filename: string, headers: string[], sampleRows: any[][]) => {
  exportToCSV(filename, headers, sampleRows);
};

export interface TemplateColumnGuide {
  /** Nama kolom seperti di header sheet data */
  kolom: string;
  /** true = wajib diisi, false = opsional (default) */
  wajib?: boolean;
  /** Penjelasan cara mengisi, dalam Bahasa Indonesia */
  penjelasan: string;
  /** Contoh pengisian (opsional) */
  contoh?: string;
}

export interface ExcelTemplateOptions {
  /** Nama sheet berisi data (default: "Data") */
  sheetName?: string;
  /** Catatan umum pengisian yang ditampilkan di atas tabel penjelasan kolom */
  instructions?: string[];
  /** Tabel penjelasan per kolom di sheet "Petunjuk" */
  columnGuide?: TemplateColumnGuide[];
}

/**
 * Generate & unduh template Excel (.xlsx) dengan header + contoh baris.
 * Kolom otomatis dilebarkan sesuai panjang header, dan (opsional) sheet
 * "Petunjuk" ditambahkan berisi panduan pengisian.
 */
export const downloadExcelTemplate = (
  filename: string,
  headers: string[],
  sampleRows: (string | number | null)[][],
  options?: ExcelTemplateOptions
) => {
  const wb = XLSX.utils.book_new();

  // Sheet data
  const ws = XLSX.utils.aoa_to_sheet([headers, ...sampleRows]);
  ws["!cols"] = headers.map((h) => ({
    wch: Math.max(12, Math.min(30, h.length + 8)),
  }));

  XLSX.utils.book_append_sheet(wb, ws, options?.sheetName ?? "Data");

  // Sheet petunjuk (opsional): catatan umum + tabel penjelasan per kolom
  const hasInstructions = !!(options?.instructions && options.instructions.length > 0);
  const hasGuide = !!(options?.columnGuide && options.columnGuide.length > 0);
  if (hasInstructions || hasGuide) {
    const insRows: (string | number)[][] = [["PANDUAN PENGISIAN TEMPLATE"], []];

    if (hasInstructions) {
      options!.instructions!.forEach((line) => insRows.push([line]));
    }

    if (hasGuide) {
      if (hasInstructions) insRows.push([]);
      insRows.push(["TABEL PENJELASAN KOLOM"]);
      insRows.push(["No", "Kolom", "Wajib?", "Penjelasan", "Contoh Pengisian"]);
      options!.columnGuide!.forEach((g, i) => {
        insRows.push([
          i + 1,
          g.kolom,
          g.wajib ? "WAJIB" : "Opsional",
          g.penjelasan,
          g.contoh ?? "",
        ]);
      });
    }

    const insWs = XLSX.utils.aoa_to_sheet(insRows);
    insWs["!cols"] = [{ wch: 5 }, { wch: 30 }, { wch: 10 }, { wch: 95 }, { wch: 32 }];
    XLSX.utils.book_append_sheet(wb, insWs, "Petunjuk");
  }

  XLSX.writeFile(wb, `${filename}.xlsx`);
};

/**
 * Baca file Excel (.xlsx/.xls) menjadi array of rows (object key = header kolom).
 * Nilai sel dikonversi ke string dan di-trim; sel kosong menjadi string kosong.
 */
export const parseExcelToRows = (file: File): Promise<Record<string, string>[]> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, {
          defval: "",
        });
        const rows = json.map((row) => {
          const cleaned: Record<string, string> = {};
          for (const [k, v] of Object.entries(row)) {
            cleaned[k.trim()] = v == null ? "" : String(v).trim();
          }
          return cleaned;
        });
        resolve(rows);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = (e) => reject(e.target?.error ?? new Error("Gagal membaca file"));
    reader.readAsArrayBuffer(file);
  });
};

export const exportToPDF = (filename: string, title: string, headers: string[], data: any[][]) => {
  const doc = new jsPDF();
  
  doc.setFontSize(14);
  doc.text(title, 14, 15);
  doc.setFontSize(10);
  doc.text(`Generated on: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`, 14, 22);

  autoTable(doc, {
    head: [headers],
    body: data,
    startY: 28,
    styles: { fontSize: 8 },
    headStyles: { fillColor: [41, 128, 185] },
  });

  doc.save(`${filename}.pdf`);
};
