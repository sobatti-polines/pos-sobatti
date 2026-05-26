import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PrintButton } from "./print-button";

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
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(dateStr));
}

export default async function InvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const resolvedParams = await params;
  const id = parseInt(resolvedParams.id, 10);

  if (isNaN(id)) {
    notFound();
  }

  // Fetch transaction details
  const { data: transaksi, error } = await supabase
    .from("transaksi_keluar")
    .select(`
      *,
      pelanggan:id_pelanggan ( nama_pelanggan, alamat, no_hp ),
      kasir:pengguna!transaksi_keluar_id_kasir_fkey ( username ),
      metode_bayar:id_metode_bayar ( nama )
    `)
    .eq("id", id)
    .single();

  if (error || !transaksi) {
    console.error("Error fetching invoice:", error);
    notFound();
  }

  // Fetch transaction items
  const { data: details, error: detailsError } = await supabase
    .from("detail_transaksi_keluar")
    .select(`
      *,
      produk:id_produk ( nama_produk, satuan:id_satuan(nama) )
    `)
    .eq("id_transaksi", id);

  if (detailsError) {
    console.error("Error fetching invoice details:", detailsError);
  }

  const items = details || [];

  return (
    <div className="min-h-screen bg-muted/20 py-8 print:p-0 print:bg-white flex justify-center">
      <div className="w-full max-w-[210mm] bg-white shadow-level-2 print:shadow-none p-10 md:p-16 print:p-0 flex flex-col mx-auto text-[#0d253d]">
        {/* Header */}
        <header className="flex flex-col md:flex-row justify-between items-start md:items-end border-b border-border/60 pb-8 mb-8">
          <div>
            <h1 className="text-[32px] font-light tracking-[-0.64px] text-[#0d253d] mb-1">INVOICE</h1>
            <p className="text-[15px] text-[#64748d] font-light">Terima kasih atas kepercayaan Anda.</p>
          </div>
          <div className="mt-6 md:mt-0 text-left md:text-right">
            <p className="text-[15px] font-light text-[#0d253d]">Invoice No: <span className="tabular-nums tracking-[-0.42px] font-light">{transaksi.no_transaksi}</span></p>
            <p className="text-[14px] text-[#64748d] tabular-nums tracking-[-0.42px] font-light mt-1">{formatDate(transaksi.tgl_transaksi)}</p>
          </div>
        </header>

        {/* Info Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
          <div>
            <h3 className="text-[10px] font-normal text-[#64748d] uppercase tracking-[0.1px] mb-2">Kasir</h3>
            <p className="text-[15px] font-light text-[#0d253d]">{transaksi.kasir?.username || "Sistem"}</p>
            <p className="text-[13px] font-light text-[#64748d] mt-1">Metode: {transaksi.metode_bayar?.nama || "-"}</p>
          </div>
          <div className="md:text-right">
            <h3 className="text-[10px] font-normal text-[#64748d] uppercase tracking-[0.1px] mb-2">Pelanggan</h3>
            {transaksi.pelanggan ? (
              <>
                <p className="text-[15px] font-light text-[#0d253d]">{transaksi.pelanggan.nama_pelanggan}</p>
                {transaksi.pelanggan.alamat && <p className="text-[13px] font-light text-[#64748d] mt-1">{transaksi.pelanggan.alamat}</p>}
                {transaksi.pelanggan.no_hp && <p className="text-[14px] font-light text-[#64748d] mt-1 tabular-nums tracking-[-0.42px]">{transaksi.pelanggan.no_hp}</p>}
              </>
            ) : (
              <p className="text-[15px] font-light text-[#0d253d]">Pelanggan Umum</p>
            )}
          </div>
        </div>

        {/* Table */}
        <div className="mb-12">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b-2 border-border/60">
                <th className="py-3 text-[10px] text-[#64748d] uppercase tracking-[0.1px] font-normal">Deskripsi</th>
                <th className="py-3 text-[10px] text-[#64748d] uppercase tracking-[0.1px] font-normal text-right w-24">Harga</th>
                <th className="py-3 text-[10px] text-[#64748d] uppercase tracking-[0.1px] font-normal text-center w-20">Qty</th>
                <th className="py-3 text-[10px] text-[#64748d] uppercase tracking-[0.1px] font-normal text-right w-32">Total</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item: { produk?: { nama_produk?: string, satuan?: { nama?: string } }, type_harga_jual?: string, harga_jual: number, qty: number, jumlah: number }, i: number) => (
                <tr key={i} className="border-b border-[#e3e8ee]">
                  <td className="py-4">
                    <p className="text-[15px] font-light text-[#0d253d]">{item.produk?.nama_produk || "Item Tidak Diketahui"}</p>
                    <p className="text-[13px] font-light text-[#64748d] mt-1">{item.type_harga_jual}</p>
                  </td>
                  <td className="py-4 text-[14px] font-light tabular-nums tracking-[-0.42px] text-right text-[#64748d]">{formatIDR(item.harga_jual)}</td>
                  <td className="py-4 text-[14px] font-light tabular-nums tracking-[-0.42px] text-center text-[#0d253d]">{item.qty} {item.produk?.satuan?.nama || ""}</td>
                  <td className="py-4 text-[14px] font-light tabular-nums tracking-[-0.42px] text-right text-[#0d253d]">{formatIDR(item.jumlah)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Summary Footer */}
        <div className="flex flex-col md:flex-row justify-between items-end gap-8">
          <div className="w-full md:w-1/2 print:hidden">
            <PrintButton />
          </div>
          <div className="w-full md:w-[280px]">
            <div className="space-y-3 mb-6">
              <div className="flex justify-between text-[15px] font-light text-[#64748d]">
                <span>Subtotal</span>
                <span className="tabular-nums tracking-[-0.42px] text-[#0d253d]">{formatIDR(transaksi.subtotal)}</span>
              </div>
              {transaksi.diskon_nominal > 0 && (
                <div className="flex justify-between text-[15px] font-light text-destructive">
                  <span>Diskon {transaksi.diskon_persen > 0 ? `(${transaksi.diskon_persen}%)` : ""}</span>
                  <span className="tabular-nums tracking-[-0.42px]">-{formatIDR(transaksi.diskon_nominal)}</span>
                </div>
              )}
              {transaksi.pajak_nominal > 0 && (
                <div className="flex justify-between text-[15px] font-light text-[#64748d]">
                  <span>Pajak {transaksi.pajak_persen > 0 ? `(${transaksi.pajak_persen}%)` : ""}</span>
                  <span className="tabular-nums tracking-[-0.42px] text-[#0d253d]">{formatIDR(transaksi.pajak_nominal)}</span>
                </div>
              )}
            </div>
            
            <div className="border-t border-[#e3e8ee] pt-4 mb-4">
              <div className="flex justify-between text-[26px] font-light tracking-[-0.26px] text-[#0d253d]">
                <span>Total</span>
                <span className="tabular-nums tracking-[-0.42px]">{formatIDR(transaksi.total)}</span>
              </div>
            </div>

            <div className="space-y-2 bg-[#f6f9fc] p-4 rounded-[12px] border border-[#e3e8ee]">
              <div className="flex justify-between text-[15px] font-light text-[#0d253d]">
                <span>Dibayar</span>
                <span className="tabular-nums tracking-[-0.42px]">{formatIDR(transaksi.bayar)}</span>
              </div>
              {transaksi.dp > 0 && (
                <div className="flex justify-between text-[15px] font-light text-[#0d253d]">
                  <span>DP</span>
                  <span className="tabular-nums tracking-[-0.42px]">{formatIDR(transaksi.dp)}</span>
                </div>
              )}
              {transaksi.kembali > 0 && (
                <div className="flex justify-between text-[15px] font-light text-[#64748d]">
                  <span>Kembali</span>
                  <span className="tabular-nums tracking-[-0.42px]">{formatIDR(transaksi.kembali)}</span>
                </div>
              )}
              {transaksi.sisa > 0 && (
                <div className="flex justify-between text-[15px] font-light text-destructive mt-2 pt-2 border-t border-[#e3e8ee]">
                  <span>Sisa Tagihan</span>
                  <span className="tabular-nums tracking-[-0.42px]">{formatIDR(transaksi.sisa)}</span>
                </div>
              )}
            </div>
          </div>
        </div>
        
        {/* Footer Note */}
        <div className="mt-auto pt-16 text-center text-[11px] text-muted-foreground">
          <p>Invoice ini sah dan diproses secara otomatis oleh sistem.</p>
        </div>
      </div>
    </div>
  );
}
