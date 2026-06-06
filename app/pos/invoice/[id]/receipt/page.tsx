import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { terbilang } from "@/lib/terbilang";

function formatIDR(n: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n).replace("Rp", "").trim();
}

function formatDate(dateStr: string) {
  return new Intl.DateTimeFormat("id-ID", {
    year: "2-digit",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(dateStr));
}

export default async function ReceiptPage({ params }: { params: Promise<{ id: string }> }) {
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

  // Fetch transaction details
  const { data: transaksi, error } = await supabase
    .from("transaksi_keluar")
    .select(`
      *,
      pelanggan:id_pelanggan ( nama_pelanggan ),
      kasir:pengguna!transaksi_keluar_id_kasir_fkey ( username )
    `)
    .eq("id", id)
    .single();

  if (error || !transaksi) {
    notFound();
  }

  // Fetch transaction items
  const { data: details } = await supabase
    .from("detail_transaksi_keluar")
    .select(`
      *,
      produk:id_produk ( nama_produk )
    `)
    .eq("id_transaksi", id);

  // Fetch store settings
  const { data: pengaturan } = await supabase
    .from("pengaturan")
    .select("*")
    .eq("id", 1)
    .single();

  const items = details || [];

  return (
    <div className="min-h-screen bg-white flex justify-center p-0 md:p-8">
      <div className="w-[58mm] flex flex-col font-mono text-[10px] leading-tight text-black print:w-full print:m-0">
        {/* Header */}
        <div className="text-center mb-4">
          <h1 className="text-xs font-bold uppercase mb-1">{pengaturan?.nama_toko || "SOBATTI POS"}</h1>
          <p className="whitespace-pre-wrap">{pengaturan?.alamat}</p>
          <p>{pengaturan?.telepon}</p>
        </div>

        {/* Divider */}
        <div className="border-b border-dashed border-black mb-2" />

        {/* Info */}
        <div className="mb-2">
          <div className="flex justify-between">
            <span>NO: {transaksi.no_transaksi}</span>
            <span>{formatDate(transaksi.tgl_transaksi)}</span>
          </div>
          <div className="flex justify-between">
            <span>KSR: {transaksi.kasir?.username}</span>
            <span>PLG: {transaksi.pelanggan?.nama_pelanggan || "Umum"}</span>
          </div>
        </div>

        {/* Divider */}
        <div className="border-b border-dashed border-black mb-2" />

        {/* Items */}
        <div className="mb-2">
          {items.map((item: any, i: number) => (
            <div key={i} className="mb-1">
              <div className="uppercase">{item.produk?.nama_produk}</div>
              <div className="flex justify-between pl-2">
                <span>{item.qty} x {formatIDR(item.harga_jual)}</span>
                <span>{formatIDR(item.jumlah)}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Divider */}
        <div className="border-b border-dashed border-black mb-2" />

        {/* Summary */}
        <div className="mb-2 space-y-0.5">
          <div className="flex justify-between">
            <span>SUBTOTAL</span>
            <span>{formatIDR(transaksi.subtotal)}</span>
          </div>
          {transaksi.diskon_nominal > 0 && (
            <div className="flex justify-between">
              <span>DISKON</span>
              <span>-{formatIDR(transaksi.diskon_nominal)}</span>
            </div>
          )}
          {transaksi.pajak_nominal > 0 && (
            <div className="flex justify-between">
              <span>PAJAK</span>
              <span>{formatIDR(transaksi.pajak_nominal)}</span>
            </div>
          )}
          <div className="flex justify-between font-bold text-xs pt-1 border-t border-dotted border-black mt-1">
            <span>TOTAL</span>
            <span>{formatIDR(transaksi.total)}</span>
          </div>
          <div className="flex justify-between pt-1">
            <span>BAYAR</span>
            <span>{formatIDR(transaksi.bayar)}</span>
          </div>
          {transaksi.kembali > 0 && (
            <div className="flex justify-between">
              <span>KEMBALI</span>
              <span>{formatIDR(transaksi.kembali)}</span>
            </div>
          )}
          {transaksi.dp > 0 && (
            <div className="flex justify-between">
              <span>DP</span>
              <span>{formatIDR(transaksi.dp)}</span>
            </div>
          )}
          {transaksi.sisa > 0 && (
            <div className="flex justify-between font-bold">
              <span>SISA</span>
              <span>{formatIDR(transaksi.sisa)}</span>
            </div>
          )}
        </div>

        {/* Divider */}
        <div className="border-b border-dashed border-black mb-2" />

        {/* Terbilang */}
        <div className="mb-4 italic text-[9px] leading-[1.1]">
          Terbilang: {terbilang(transaksi.total)} Rupiah
        </div>

        {/* Footer */}
        <div className="text-center space-y-1 mt-2">
          {pengaturan?.footer_struk_1 && <p>{pengaturan.footer_struk_1}</p>}
          {pengaturan?.footer_struk_2 && <p>{pengaturan.footer_struk_2}</p>}
          {pengaturan?.footer_struk_3 && <p>{pengaturan.footer_struk_3}</p>}
          <p className="mt-4">*** TERIMA KASIH ***</p>
        </div>

        {/* Print triggering script */}
        <script dangerouslySetInnerHTML={{ __html: `window.onload = function() { window.print(); }` }} />
      </div>

      {/* Print styles */}
      <style dangerouslySetInnerHTML={{
        __html: `
        @media print {
          body { background: white; margin: 0; padding: 0; }
          .min-h-screen { min-height: 0; background: white; padding: 0; }
          @page { margin: 0; }
        }
      `}} />
    </div>
  );
}
