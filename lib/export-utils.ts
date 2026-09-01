import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import Papa from "papaparse";
import * as XLSX from "xlsx";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
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

export interface PDFExportOptions {
  /** Subtitle baris kedua (default: "Generated on: <date> <time>") */
  subtitle?: string;
  /** Footer text di bawah tabel */
  footer?: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const exportToPDF = (filename: string, title: string, headers: string[], data: any[][], options?: PDFExportOptions) => {
  const doc = new jsPDF();
  
  doc.setFontSize(14);
  doc.text(title, 14, 15);
  doc.setFontSize(10);
  const subtitle = options?.subtitle ?? `Generated on: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`;
  doc.text(subtitle, 14, 22);

  autoTable(doc, {
    head: [headers],
    body: data,
    startY: 28,
    styles: { fontSize: 8 },
    headStyles: { fillColor: [41, 128, 185] },
    didDrawPage() {
      if (options?.footer) {
        const pageHeight = doc.internal.pageSize.getHeight();
        doc.setFontSize(8);
        doc.setTextColor(100, 100, 100);
        doc.text(options.footer, 14, pageHeight - 10);
      }
    },
  });

  doc.save(`${filename}.pdf`);
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const exportToExcel = (filename: string, headers: string[], data: any[][], sheetName = "Data") => {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([headers, ...data]);
  ws["!cols"] = headers.map((h) => ({
    wch: Math.max(12, Math.min(30, h.length + 8)),
  }));
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, `${filename}.xlsx`);
};

/* ------------------------------------------------------------------ */
/*  Template PDF Stok Opname — cetak untuk penghitungan fisik          */
/*  A4 Portrait (vertical) — 1 PDF, area dipisah per halaman           */
/* ------------------------------------------------------------------ */

export interface OpnameProduct {
  id: number;
  nama_produk: string;
  stok: number;
  stok_gudang: number;
  barcode?: string | null;
  lokasi?: string | null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PDFDoc = any;

/**
 * Muat gambar dari URL → base64 data URL.
 */
function loadImage(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const c = document.createElement("canvas");
      c.width = img.naturalWidth;
      c.height = img.naturalHeight;
      const ctx = c.getContext("2d");
      if (!ctx) { reject(new Error("Canvas not supported")); return; }
      ctx.drawImage(img, 0, 0);
      resolve(c.toDataURL("image/png"));
    };
    img.onerror = () => reject(new Error("Gagal memuat logo"));
    img.src = url;
  });
}

/**
 * Gambar kop surat (logo besar + judul + info area) di posisi Y yang diberikan.
 * Mengembalikan Y position setelah kop selesai (untuk memulai tabel).
 */
function drawKop(
  doc: PDFDoc,
  pw: number,
  mx: number,
  startY: number,
  storeName: string,
  area: string | null,
  tglOpname: string,
  noSesi: string | undefined,
  logoDataURL: string | null,
  areaIndex: number,
  totalAreas: number
): number {
  const y = startY;

  // Logo besar: lebar 35mm, tinggi proporsional
  if (logoDataURL) {
    const logoW = 35;
    const logoH = 23;
    doc.addImage(logoDataURL, "PNG", mx, y, logoW, logoH);
  }

  // Judul toko — di sebelah kanan logo
  const textX = logoDataURL ? mx + 38 : mx;
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(83, 58, 253);
  doc.text(storeName, textX, y + 8);

  // Subtitle
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 100, 100);
  doc.text("PUSAT ALAT TUKANG & BANGUNAN", textX, y + 14);

  // Garis pemisah
  const lineY = y + 27;
  doc.setDrawColor(83, 58, 253);
  doc.setLineWidth(0.6);
  doc.line(mx, lineY, mx + pw - 2 * mx, lineY);

  // Judul form
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 30, 30);
  doc.text("FORMULIR STOK OPNAME", mx, lineY + 7);

  // Info baris
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(60, 60, 60);
  const infoY = lineY + 13;
  doc.text(`Tanggal: ${tglOpname}`, mx, infoY);
  if (noSesi) {
    doc.text(`No Sesi: ${noSesi}`, mx + 70, infoY);
  }
  if (area) {
    doc.text(`Area / Lokasi: ${area}`, mx + 130, infoY);
  }

  // Halaman info
  if (totalAreas > 1) {
    doc.setFontSize(8);
    doc.setTextColor(130, 130, 130);
    doc.text(`Area ${areaIndex + 1} dari ${totalAreas}`, pw - mx, infoY, { align: "right" });
  }

  return infoY + 7;
}

/**
 * Gambar footer (petunjuk + tanda tangan) di akhir tabel.
 */
function drawFooter(
  doc: PDFDoc,
  pw: number,
  mx: number,
  tableEndY: number,
  totalItems: number,
  ph: number,
  marginBottom: number
) {
  const footerY = tableEndY + 4;

  // Garis ringkasan
  doc.setDrawColor(83, 58, 253);
  doc.setLineWidth(0.3);
  doc.line(mx, footerY, mx + pw - 2 * mx, footerY);

  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(60, 60, 60);
  doc.text(`Total: ${totalItems} produk`, mx, footerY + 5);
  doc.text(
    `Dicetak: ${new Date().toLocaleDateString("id-ID", { day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })}`,
    mx + 60,
    footerY + 5
  );

  // Petunjuk
  doc.setFontSize(8);
  doc.setFont("helvetica", "italic");
  doc.setTextColor(100, 100, 100);
  doc.text(
    'Petunjuk: Isi kolom "Stok Fisik Gdg" dan "Stok Fisik Disp". Status: "+" = lebih, "-" = kurang, "\u2713" = pas. Tulis keterangan jika ada selisih.',
    mx,
    footerY + 10
  );

  // Tanda tangan (2 kolom)
  const sigY = Math.min(footerY + 18, ph - marginBottom - 10);
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(30, 30, 30);
  doc.text("Dihitung oleh:", mx, sigY);
  doc.text("Diperiksa oleh:", pw / 2, sigY);
  doc.line(mx, sigY + 16, mx + 45, sigY + 16);
  doc.line(pw / 2, sigY + 16, pw / 2 + 45, sigY + 16);
  doc.setFontSize(7);
  doc.setTextColor(150, 150, 150);
  doc.text("(Nama & Tanda Tangan)", mx, sigY + 20);
  doc.text("(Nama & Tanda Tangan)", pw / 2, sigY + 20);
}

/**
 * Generate & unduh template PDF stok opname — A4 Portrait.
 *
 * - 1 PDF untuk semua area (area berbeda = halaman baru)
 * - Kolom "Stok Fisik" dikosongkan untuk diisi manual
 * - Status: + (lebih), - (kurang), \u2713 (pas)
 * - Menggunakan autoTable untuk text wrap otomatis
 *
 * @param areaProducts  Array of { area, products } — sudah dikelompok per area
 * @param tglOpname     Tanggal opname (format: "24 Agustus 2026")
 * @param noSesi        Nomor sesi opname (opsional)
 */
export async function generateOpnameTemplate(
  areaProducts: { area: string; products: OpnameProduct[] }[],
  tglOpname: string,
  noSesi?: string
) {
  if (areaProducts.length === 0) return;

  // Load logo
  let logoDataURL: string | null = null;
  try {
    logoDataURL = await loadImage("/logo-perusahaan.png");
  } catch {
    logoDataURL = null;
  }

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pw = doc.internal.pageSize.getWidth();   // 210
  const ph = doc.internal.pageSize.getHeight();   // 297
  const mx = 12;   // margin kiri/kanan
  const mb = 12;   // margin bawah
  const storeName = "PLK POS";

  for (let areaIdx = 0; areaIdx < areaProducts.length; areaIdx++) {
    const { area, products } = areaProducts[areaIdx];

    // Halaman baru kecuali halaman pertama
    if (areaIdx > 0) {
      doc.addPage();
    }

    // Draw kop
    const tableStartY = drawKop(
      doc, pw, mx, 12,
      storeName, area, tglOpname, noSesi, logoDataURL,
      areaIdx, areaProducts.length
    );

    // AutoTable — text wrap otomatis, row height fleksibel
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tableBody: any[][] = products.map((p, i) => [
      String(i + 1),
      p.nama_produk,
      p.barcode || "-",
      String(p.stok_gudang ?? 0),
      "",  // Fisik Gudang — kosong
      String(p.stok ?? 0),
      "",  // Fisik Display — kosong
      "",  // Status +/-/\u2713 — kosong
      "",  // Keterangan — kosong
    ]);

    autoTable(doc, {
      startY: tableStartY,
      margin: { left: mx, right: mx },
      head: [[
        "No",
        "Nama Produk",
        "Barcode",
        "Stok\nSistem\nGdg",
        "Stok\nFisik\nGdg",
        "Stok\nSistem\nDisp",
        "Stok\nFisik\nDisp",
        "Status\n(+/-/\u2713)",
        "Keterangan",
      ]],
      body: tableBody,
      theme: "grid",
      styles: {
        fontSize: 8,
        cellPadding: 2,
        valign: "middle",
        overflow: "linebreak",
        font: "helvetica",
        textColor: [30, 30, 30],
        lineColor: [200, 200, 215],
        lineWidth: 0.2,
      },
      headStyles: {
        fillColor: [240, 240, 255],
        textColor: [40, 40, 60],
        fontStyle: "bold",
        fontSize: 7.5,
        halign: "center",
        valign: "middle",
        cellPadding: 2.5,
        lineColor: [83, 58, 253],
        lineWidth: 0.4,
      },
      columnStyles: {
        0:  { halign: "center", cellWidth: 9  },     // No
        1:  { halign: "left",   cellWidth: 52 },     // Nama Produk — LEBAR
        2:  { halign: "left",   cellWidth: 22 },     // Barcode
        3:  { halign: "center", cellWidth: 16 },     // Stok Sistem Gdg
        4:  { halign: "center", cellWidth: 16 },     // Stok Fisik Gdg
        5:  { halign: "center", cellWidth: 16 },     // Stok Sistem Disp
        6:  { halign: "center", cellWidth: 16 },     // Stok Fisik Disp
        7:  { halign: "center", cellWidth: 14 },     // Status
        8:  { halign: "left",   cellWidth: 25 },     // Keterangan
      },
      didParseCell(data) {
        // Baris ganjil warna beda
        if (data.section === "body" && data.row.index % 2 === 0) {
          data.cell.styles.fillColor = [248, 248, 255];
        }
        // Kolom kosong (fisik, status, keterangan) — garis putus-putus
        if (data.section === "body" && (data.column.index === 4 || data.column.index === 6 || data.column.index === 7 || data.column.index === 8)) {
          if (!data.cell.raw || data.cell.raw === "") {
            data.cell.styles.textColor = [180, 180, 180];
            data.cell.text = ["________"];
          }
        }
      },
      didDrawPage(data) {
        // autoTable handle page break — tapi kita perlu draw kop di page baru
        if (data.pageNumber > 1) {
          // Page break由autoTable处理，kop已在didDrawPage中画好
        }
      },
    });

    // Draw footer setelah tabel
    const tableEndY = (doc as PDFDoc).lastAutoTable?.finalY ?? tableStartY + 50;
    drawFooter(doc, pw, mx, tableEndY, products.length, ph, mb);
  }

  // Download 1 file
  const filename = noSesi
    ? `Template_Stok_Opname_${noSesi}.pdf`
    : `Template_Stok_Opname_${new Date().toISOString().split("T")[0]}.pdf`;
  doc.save(filename);
}
