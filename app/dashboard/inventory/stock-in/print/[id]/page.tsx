import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PrintButton } from "./print-button";
import { terbilangRupiah } from "@/lib/terbilang";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

function formatIDR(n: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
}

function formatDate(dateStr: string) {
  return new Intl.DateTimeFormat("id-ID", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date(dateStr));
}

interface PrintItem {
  id: number;
  status: string | null;
  harga_beli: number | null;
  jumlah: number | null;
  total: number | null;
  supplied_unit: string | null;
  supplied_qty: number | null;
  applied_conversion_ratio: number | null;
  base_qty_added: number | null;
  total_cost: number | null;
  base_cost_per_piece: number | null;
  keterangan: string | null;
  produk: {
    nama_produk: string;
    sku: string | null;
    satuan: { nama: string } | null;
  } | null;
}

interface SupplierInfo {
  id: number;
  nama_supplier: string | null;
  alamat: string | null;
  telepon: string | null;
}

export default async function StockInPrintPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const supabase = await createClient();

  // VULN-003 fix: layouts are not a security boundary in Next.js; verify auth per-page.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/");
  }

  const resolvedParams = await params;
  const id = parseInt(resolvedParams.id, 10);
  if (isNaN(id)) {
    notFound();
  }

  // Primary row — identifies the "receipt" (supplier + tanggal + no faktur)
  const { data: primary, error: primaryError } = await supabase
    .from("barang_masuk")
    .select(
      `id, tgl_masuk, no_surat, status,
       supplier(id, nama_supplier, alamat, telepon)`
    )
    .eq("id", id)
    .single();

  if (primaryError || !primary) {
    console.error("Error fetching barang masuk for print:", primaryError);
    notFound();
  }

  const rawSupplier = primary.supplier as unknown;
  const supplier = (
    Array.isArray(rawSupplier) ? rawSupplier[0] : rawSupplier
  ) as SupplierInfo | null;

  // All lines belonging to the same receipt
  let docQuery = supabase
    .from("barang_masuk")
    .select(
      `id, status, harga_beli, jumlah, total,
       supplied_unit, supplied_qty, applied_conversion_ratio,
       base_qty_added, total_cost, base_cost_per_piece, keterangan,
       produk(nama_produk, sku, satuan:id_satuan(nama))`
    )
    .eq("tgl_masuk", primary.tgl_masuk)
    .order("id", { ascending: true });

  if (supplier) {
    docQuery = docQuery.eq("id_supplier", supplier.id);
  } else {
    docQuery = docQuery.is("id_supplier", null);
  }

  if (primary.no_surat) {
    docQuery = docQuery.eq("no_surat", primary.no_surat);
  } else {
    docQuery = docQuery.is("no_surat", null);
  }

  const { data: items, error: itemsError } = await docQuery;
  if (itemsError) {
    console.error("Error fetching receipt items:", itemsError);
  }

  const itemList = (items?.length ? items : []) as unknown as PrintItem[];
  if (itemList.length === 0) {
    // Fallback: at least show the row itself so the page never 404s
    const { data: fallback } = await supabase
      .from("barang_masuk")
      .select(
        `id, status, harga_beli, jumlah, total,
         supplied_unit, supplied_qty, applied_conversion_ratio,
         base_qty_added, total_cost, base_cost_per_piece, keterangan,
         produk(nama_produk, sku, satuan:id_satuan(nama))`
      )
      .eq("id", id)
      .single();
    if (fallback) itemList.push(fallback as unknown as PrintItem);
  }

  const { data: pengaturan } = await supabase
    .from("pengaturan")
    .select("*")
    .eq("id", 1)
    .single();

  const activeItems = itemList.filter((i) => i.status !== "DIVOID");
  const hasVoided = activeItems.length !== itemList.length;
  const totalNilai = activeItems.reduce((sum, i) => {
    const v = Number(i.total_cost ?? i.total ?? 0);
    return sum + (isNaN(v) ? 0 : v);
  }, 0);

  const lineQtySuplai = (i: PrintItem) => i.supplied_qty ?? i.jumlah;
  const lineUnitSuplai = (i: PrintItem) =>
    i.supplied_unit || i.produk?.satuan?.nama || "pcs";
  const lineBaseQty = (i: PrintItem) =>
    i.base_qty_added ??
    (i.supplied_qty != null
      ? Number(i.supplied_qty) * Number(i.applied_conversion_ratio ?? 1)
      : i.jumlah);
  const lineBaseUnit = (i: PrintItem) => i.produk?.satuan?.nama || "pcs";
  const lineHargaPcs = (i: PrintItem) =>
    Number(i.base_cost_per_piece ?? i.harga_beli ?? 0);
  const lineTotal = (i: PrintItem) => Number(i.total_cost ?? i.total ?? 0);

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
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
      <div className="min-h-screen bg-muted/20 py-8 print:p-0 print:bg-white flex flex-col items-center">
      {/* Sticky action bar — always visible, hidden in print */}
      <div className="fixed top-0 left-0 right-0 z-50 bg-background/90 backdrop-blur-sm border-b border-border print:hidden">
        <div className="w-full max-w-[210mm] mx-auto px-4 py-2 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
          <Link
            href="/dashboard/inventory/stock-in/history"
            className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-4 h-9 rounded-full text-sm font-medium text-foreground bg-muted hover:bg-muted/80 transition-colors border border-border"
          >
            <ArrowLeft className="w-4 h-4" />
            Kembali ke Riwayat
          </Link>
          <PrintButton />
        </div>
      </div>

      {/* Spacer to offset sticky bar height */}
      <div className="h-14 print:hidden" />

      <div className="invoice-print-area w-full max-w-[210mm] bg-white shadow-level-2 print:shadow-none p-6 sm:p-10 md:p-16 print:p-0 flex flex-col mx-auto text-[#0d253d]">
        {/* Header */}
        <header className="flex flex-col md:flex-row justify-between items-start md:items-end border-b border-border/60 pb-8 mb-8">
          <div>
            <h1 className="text-[32px] font-light tracking-[-0.64px] text-[#0d253d] mb-1 uppercase">
              Surat Jalan
            </h1>
            <div className="text-[14px] text-[#64748d] font-light mt-3 space-y-0.5">
              {pengaturan?.nama_toko && (
                <p className="font-medium text-[#0d253d] text-[15px] mb-1">
                  {pengaturan.nama_toko}
                </p>
              )}
              {pengaturan?.alamat && <p>{pengaturan.alamat}</p>}
              {(pengaturan?.telepon || pengaturan?.email) && (
                <p>
                  {pengaturan?.telepon && <span>Telp: {pengaturan.telepon}</span>}
                  {pengaturan?.telepon && pengaturan?.email && (
                    <span className="mx-2">|</span>
                  )}
                  {pengaturan?.email && <span>Email: {pengaturan.email}</span>}
                </p>
              )}
            </div>
          </div>
          <div className="mt-6 md:mt-0 text-left md:text-right">
            <p className="text-[15px] font-light text-[#0d253d]">
              No. Faktur:{" "}
              <span className="tabular-nums tracking-[-0.42px] font-light">
                {primary.no_surat || "-"}
              </span>
            </p>
            <p className="text-[14px] text-[#64748d] tabular-nums tracking-[-0.42px] font-light mt-1">
              {formatDate(primary.tgl_masuk)}
            </p>
          </div>
        </header>

        {/* Info Grid */}
        <div className="invoice-info-grid grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
          <div>
            <h3 className="text-[10px] font-normal text-[#64748d] uppercase tracking-[0.1px] mb-2">
              Supplier
            </h3>
            <p className="text-[15px] font-light text-[#0d253d]">
              {supplier?.nama_supplier || "Umum"}
            </p>
            {supplier?.alamat && (
              <p className="text-[13px] font-light text-[#64748d] mt-1">
                {supplier.alamat}
              </p>
            )}
            {supplier?.telepon && (
              <p className="text-[14px] font-light text-[#64748d] mt-1 tabular-nums tracking-[-0.42px]">
                {supplier.telepon}
              </p>
            )}
          </div>
          <div className="md:text-right">
            <h3 className="text-[10px] font-normal text-[#64748d] uppercase tracking-[0.1px] mb-2">
              Dokumen Penerimaan
            </h3>
            <p className="text-[15px] font-light text-[#0d253d]">
              No. {String(id).padStart(4, "0")}
            </p>
            <p className="text-[13px] font-light text-[#64748d] mt-1">
              {itemList.length} item
              {hasVoided ? " · sebagian dibatalkan" : ""}
            </p>
          </div>
        </div>

        {/* Table */}
        <div className="invoice-table-wrap mb-12 overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b-2 border-border/60">
                <th className="py-3 text-[10px] text-[#64748d] uppercase tracking-[0.1px] font-normal w-8">
                  No
                </th>
                <th className="py-3 text-[10px] text-[#64748d] uppercase tracking-[0.1px] font-normal">
                  Produk
                </th>
                <th className="py-3 text-[10px] text-[#64748d] uppercase tracking-[0.1px] font-normal text-center w-24">
                  Qty Suplai
                </th>
                <th className="py-3 text-[10px] text-[#64748d] uppercase tracking-[0.1px] font-normal text-right w-20">
                  Base Qty
                </th>
                <th className="py-3 text-[10px] text-[#64748d] uppercase tracking-[0.1px] font-normal text-right w-28">
                  Harga/Pcs
                </th>
                <th className="py-3 text-[10px] text-[#64748d] uppercase tracking-[0.1px] font-normal text-right w-32">
                  Total
                </th>
              </tr>
            </thead>
            <tbody>
              {itemList.map((item, i) => {
                const isVoided = item.status === "DIVOID";
                const cell = (content: React.ReactNode) =>
                  isVoided ? (
                    <span className="line-through text-[#64748d]/70">
                      {content}
                    </span>
                  ) : (
                    content
                  );
                return (
                  <tr
                    key={item.id}
                    className="border-b border-[#e3e8ee]"
                  >
                    <td className="py-4 text-[14px] font-light tabular-nums text-[#64748d]">
                      {cell(i + 1)}
                    </td>
                    <td className="py-4">
                      <p className="text-[15px] font-light text-[#0d253d]">
                        {cell(item.produk?.nama_produk || "Produk dihapus")}
                        {isVoided && (
                          <span className="ml-2 text-[10px] font-medium uppercase tracking-wider text-destructive">
                            (DIVOID)
                          </span>
                        )}
                      </p>
                      {item.produk?.sku && (
                        <p className="text-[13px] font-light text-[#64748d] mt-1 tabular-nums tracking-[-0.42px]">
                          {cell(`SKU: ${item.produk.sku}`)}
                        </p>
                      )}
                    </td>
                    <td className="py-4 text-[14px] font-light tabular-nums text-center text-[#0d253d]">
                      {cell(
                        `${lineQtySuplai(item)} ${lineUnitSuplai(item)}`
                      )}
                    </td>
                    <td className="py-4 text-[14px] font-light tabular-nums text-right text-[#64748d]">
                      {cell(
                        `${lineBaseQty(item)} ${lineBaseUnit(item)}`
                      )}
                    </td>
                    <td className="py-4 text-[14px] font-light tabular-nums text-right text-[#64748d]">
                      {cell(formatIDR(lineHargaPcs(item)))}
                    </td>
                    <td className="py-4 text-[14px] font-light tabular-nums text-right text-[#0d253d]">
                      {cell(formatIDR(lineTotal(item)))}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Summary Footer */}
        <div className="invoice-summary flex flex-col md:flex-row justify-end items-end gap-8">
          <div className="w-full md:w-[300px]">
            <div className="border-t border-[#e3e8ee] pt-4 mb-4">
              <div className="flex justify-between text-[26px] font-light tracking-[-0.26px] text-[#0d253d]">
                <span>Total</span>
                <span className="tabular-nums tracking-[-0.42px]">
                  {formatIDR(totalNilai)}
                </span>
              </div>
              <div className="text-[12px] italic text-[#64748d] mt-1 text-right">
                Terbilang: {terbilangRupiah(totalNilai)}
              </div>
            </div>
            {hasVoided && (
              <p className="text-[12px] text-destructive font-light text-right">
                Sebagian baris dibatalkan (DIVOID) dan tidak dihitung dalam
                total.
              </p>
            )}
          </div>
        </div>

        {/* Signature */}
        <div
          className="invoice-bank-sig grid grid-cols-2 gap-12 mt-14 pt-8 border-t border-border/60"
          style={{ pageBreakInside: "avoid" }}
        >
          <div>
            <p className="text-[13px] font-light text-[#0d253d] mb-20 text-center">
              Penerima
            </p>
            <p className="text-[12px] font-light text-[#64748d] text-center">
              ( Nama &amp; Tanda Tangan )
            </p>
          </div>
          <div>
            <p className="text-[13px] font-light text-[#0d253d] mb-20 text-center">
              {supplier?.nama_supplier || "Supplier"}
            </p>
            <p className="text-[12px] font-light text-[#64748d] text-center">
              ( Nama &amp; Tanda Tangan )
            </p>
          </div>
        </div>

        {/* Footer Notes */}
        <div className="invoice-footer mt-12 pt-8 border-t border-border/60 text-center space-y-1">
          {pengaturan?.footer_invoice_1 && (
            <p className="text-[12px] text-[#64748d] font-light">
              {pengaturan.footer_invoice_1}
            </p>
          )}
          {pengaturan?.footer_invoice_2 && (
            <p className="text-[12px] text-[#64748d] font-light">
              {pengaturan.footer_invoice_2}
            </p>
          )}
          {pengaturan?.footer_invoice_3 && (
            <p className="text-[12px] text-[#64748d] font-light">
              {pengaturan.footer_invoice_3}
            </p>
          )}
        </div>
      </div>
    </div>
    </>
  );
}
