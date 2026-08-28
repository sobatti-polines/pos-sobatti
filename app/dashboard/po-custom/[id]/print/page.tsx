import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { terbilangRupiah } from "@/lib/terbilang";
import { PrintButton } from "./print-button";
import { isAdminOrOwnerLike } from "@/lib/roles";

function formatIDR(value: number | string | null | undefined) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Number(value ?? 0));
}

function formatNumber(value: number | string | null | undefined) {
  return new Intl.NumberFormat("id-ID", { maximumFractionDigits: 2 }).format(
    Number(value ?? 0)
  );
}

function formatDate(value: string | null | undefined) {
  if (!value) return "-";
  return new Date(`${value}T00:00:00`).toLocaleDateString("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function statusLabel(status: string | null | undefined) {
  const labels: Record<string, string> = {
    DRAFT: "Draft",
    MENUNGGU_DP: "Menunggu DP",
    DIPROSES: "Diproses",
    SIAP_KIRIM: "Siap Kirim",
    SELESAI: "Selesai",
    BATAL: "Batal",
  };
  return status ? labels[status] ?? status : "-";
}

interface PaymentRow {
  id: number;
  tanggal_bayar: string;
  jumlah_bayar: number;
  jenis_pembayaran: string;
  keterangan: string | null;
  metode_bayar: { nama: string } | null;
}

export default async function PoCustomPrintPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/");

  const { data: pengguna } = await supabase
    .from("pengguna")
    .select("level")
    .eq("username", user.email?.split("@")[0])
    .single();

  if (!isAdminOrOwnerLike(pengguna?.level)) {
    redirect("/dashboard");
  }

  const resolvedParams = await params;
  const id = Number(resolvedParams.id);
  if (!Number.isInteger(id) || id <= 0) notFound();

  const { data: po, error } = await supabase
    .from("po_custom")
    .select(
      `
      *,
      pelanggan(id, nama_pelanggan, alamat, no_hp, email),
      produk(id, nama_produk, sku, satuan:id_satuan(nama)),
      po_custom_pembayaran(
        id,
        tanggal_bayar,
        jumlah_bayar,
        jenis_pembayaran,
        keterangan,
        metode_bayar(id, nama)
      )
    `
    )
    .eq("id", id)
    .single();

  if (error || !po) {
    console.error("Error fetching PO custom print:", error);
    notFound();
  }

  const { data: pengaturan } = await supabase
    .from("pengaturan")
    .select("*")
    .eq("id", 1)
    .single();

  const payments = ([...(po.po_custom_pembayaran ?? [])] as PaymentRow[]).sort(
    (a, b) => String(a.tanggal_bayar).localeCompare(String(b.tanggal_bayar))
  );
  const totalDibayar = payments.reduce(
    (sum, payment) => sum + Number(payment.jumlah_bayar ?? 0),
    0
  );
  const hargaTotal = Number(po.harga_total ?? 0);
  const sisa = Math.max(hargaTotal - totalDibayar, 0);
  const attributes = Object.entries((po.atribut_custom ?? {}) as Record<string, string>);

  return (
    <>
      <style
        dangerouslySetInnerHTML={{
          __html: `
            @media print {
              html, body {
                background-color: white !important;
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
                height: auto !important;
                overflow: visible !important;
              }
              .md\\:h-\\[100dvh\\], .min-h-\\[100dvh\\] {
                height: auto !important;
                min-height: 0 !important;
              }
              .md\\:overflow-hidden { overflow: visible !important; }
              .md\\:flex-row { display: block !important; }
            }
          `,
        }}
      />
      <div className="flex min-h-screen flex-col items-center bg-muted/20 py-8 print:bg-white print:p-0">
        <div className="fixed left-0 right-0 top-0 z-50 border-b border-border bg-background/90 backdrop-blur-sm print:hidden">
          <div className="mx-auto flex w-full max-w-[210mm] flex-col items-stretch justify-between gap-2 px-4 py-2 sm:flex-row sm:items-center">
            <Link
              href="/dashboard/po-custom"
              className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-full border border-border bg-muted px-4 text-sm font-medium text-foreground transition-colors hover:bg-muted/80 sm:flex-none"
            >
              <ArrowLeft className="h-4 w-4" />
              Kembali ke PO Custom
            </Link>
            <PrintButton />
          </div>
        </div>

        <div className="h-14 print:hidden" />

        <div className="invoice-print-area mx-auto flex w-full max-w-[210mm] flex-col bg-white p-6 text-[#0d253d] shadow-level-2 print:p-0 print:shadow-none sm:p-10 md:p-16">
          <header className="mb-8 flex flex-col items-start justify-between border-b border-border/60 pb-8 md:flex-row md:items-end">
            <div>
              <h1 className="mb-1 text-[32px] font-light uppercase tracking-[-0.64px] text-[#0d253d]">
                Purchase Order Custom
              </h1>
              <div className="mt-3 space-y-0.5 text-[14px] font-light text-[#64748d]">
                {pengaturan?.nama_toko && (
                  <p className="mb-1 text-[15px] font-medium text-[#0d253d]">
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
            <div className="mt-6 text-left md:mt-0 md:text-right">
              <p className="text-[15px] font-light text-[#0d253d]">
                No. PO:{" "}
                <span className="font-light tabular-nums tracking-[-0.42px]">
                  {po.no_po}
                </span>
              </p>
              <p className="mt-1 text-[14px] font-light text-[#64748d]">
                {formatDate(po.tanggal_po)}
              </p>
              <p className="mt-1 text-[14px] font-light text-[#64748d]">
                Status: {statusLabel(po.status)}
              </p>
            </div>
          </header>

          <div className="invoice-info-grid mb-10 grid grid-cols-1 gap-8 md:grid-cols-2">
            <div>
              <h3 className="mb-2 text-[10px] font-normal uppercase tracking-[0.1px] text-[#64748d]">
                Pelanggan
              </h3>
              <p className="text-[15px] font-light text-[#0d253d]">
                {po.pelanggan?.nama_pelanggan ?? "-"}
              </p>
              {po.pelanggan?.alamat && (
                <p className="mt-1 text-[13px] font-light text-[#64748d]">
                  {po.pelanggan.alamat}
                </p>
              )}
              {po.pelanggan?.no_hp && (
                <p className="mt-1 text-[14px] font-light tabular-nums tracking-[-0.42px] text-[#64748d]">
                  {po.pelanggan.no_hp}
                </p>
              )}
            </div>
            <div className="md:text-right">
              <h3 className="mb-2 text-[10px] font-normal uppercase tracking-[0.1px] text-[#64748d]">
                Jadwal
              </h3>
              <p className="text-[15px] font-light text-[#0d253d]">
                Target selesai: {formatDate(po.target_selesai)}
              </p>
              <p className="mt-1 text-[13px] font-light text-[#64748d]">
                Dokumen untuk supplier, arsip toko, atau pelanggan.
              </p>
            </div>
          </div>

          <section className="mb-10">
            <h2 className="mb-3 text-[10px] font-normal uppercase tracking-[0.1px] text-[#64748d]">
              Detail Pesanan
            </h2>
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b-2 border-border/60">
                  <th className="py-3 text-[10px] font-normal uppercase tracking-[0.1px] text-[#64748d]">
                    Deskripsi
                  </th>
                  <th className="w-24 py-3 text-center text-[10px] font-normal uppercase tracking-[0.1px] text-[#64748d]">
                    Qty
                  </th>
                  <th className="w-36 py-3 text-right text-[10px] font-normal uppercase tracking-[0.1px] text-[#64748d]">
                    Total
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-[#e3e8ee]">
                  <td className="py-4">
                    <p className="text-[15px] font-light text-[#0d253d]">
                      {po.nama_pesanan}
                    </p>
                    <p className="mt-1 text-[13px] font-light text-[#64748d]">
                      Produk: {po.produk?.nama_produk ?? "-"}
                      {po.produk?.sku ? ` / SKU ${po.produk.sku}` : ""}
                    </p>
                  </td>
                  <td className="py-4 text-center text-[14px] font-light tabular-nums tracking-[-0.42px] text-[#0d253d]">
                    {formatNumber(po.qty)} {po.produk?.satuan?.nama ?? ""}
                  </td>
                  <td className="py-4 text-right text-[14px] font-light tabular-nums tracking-[-0.42px] text-[#0d253d]">
                    {formatIDR(hargaTotal)}
                  </td>
                </tr>
              </tbody>
            </table>
          </section>

          {(attributes.length > 0 || po.spesifikasi) && (
            <section className="mb-10">
              <h2 className="mb-3 text-[10px] font-normal uppercase tracking-[0.1px] text-[#64748d]">
                Spesifikasi Custom
              </h2>
              {attributes.length > 0 && (
                <div className="grid grid-cols-1 gap-x-8 gap-y-2 md:grid-cols-2">
                  {attributes.map(([key, value]) => (
                    <div key={key} className="flex justify-between gap-4 border-b border-[#e3e8ee] py-2 text-[14px]">
                      <span className="font-light text-[#64748d]">{key}</span>
                      <span className="text-right font-light text-[#0d253d]">{value}</span>
                    </div>
                  ))}
                </div>
              )}
              {po.spesifikasi && (
                <p className="mt-4 whitespace-pre-line text-[14px] font-light leading-6 text-[#0d253d]">
                  {po.spesifikasi}
                </p>
              )}
            </section>
          )}

          <section className="invoice-summary mb-10 flex flex-col items-end">
            <div className="w-full md:w-[340px]">
              <div className="mb-4 space-y-3">
                <div className="flex justify-between text-[15px] font-light text-[#64748d]">
                  <span>Total PO</span>
                  <span className="tabular-nums tracking-[-0.42px] text-[#0d253d]">
                    {formatIDR(hargaTotal)}
                  </span>
                </div>
                <div className="flex justify-between text-[15px] font-light text-[#64748d]">
                  <span>Total Dibayar</span>
                  <span className="tabular-nums tracking-[-0.42px] text-[#0d253d]">
                    {formatIDR(totalDibayar)}
                  </span>
                </div>
              </div>
              <div className="border-t border-[#e3e8ee] pt-4">
                <div className="flex justify-between text-[26px] font-light tracking-[-0.26px] text-[#0d253d]">
                  <span>Sisa</span>
                  <span className="tabular-nums tracking-[-0.42px]">
                    {formatIDR(sisa)}
                  </span>
                </div>
              </div>
              <p className="mt-3 text-right text-[13px] italic text-[#64748d]">
                {terbilangRupiah(sisa)}
              </p>
            </div>
          </section>

          {payments.length > 0 && (
            <section className="mb-12">
              <h2 className="mb-3 text-[10px] font-normal uppercase tracking-[0.1px] text-[#64748d]">
                Riwayat Pembayaran
              </h2>
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="border-b-2 border-border/60">
                    <th className="py-3 text-[10px] font-normal uppercase tracking-[0.1px] text-[#64748d]">
                      Tanggal
                    </th>
                    <th className="py-3 text-[10px] font-normal uppercase tracking-[0.1px] text-[#64748d]">
                      Keterangan
                    </th>
                    <th className="w-32 py-3 text-right text-[10px] font-normal uppercase tracking-[0.1px] text-[#64748d]">
                      Jumlah
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((payment) => (
                    <tr key={payment.id} className="border-b border-[#e3e8ee]">
                      <td className="py-3 text-[13px] font-light text-[#64748d]">
                        {formatDate(payment.tanggal_bayar)}
                      </td>
                      <td className="py-3 text-[13px] font-light text-[#0d253d]">
                        {payment.jenis_pembayaran} - {payment.metode_bayar?.nama ?? "-"}
                        {payment.keterangan ? ` - ${payment.keterangan}` : ""}
                      </td>
                      <td className="py-3 text-right text-[13px] font-light tabular-nums tracking-[-0.42px] text-[#0d253d]">
                        {formatIDR(payment.jumlah_bayar)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}

          <footer className="mt-auto grid grid-cols-1 gap-10 pt-8 text-center md:grid-cols-3">
            <div>
              <p className="text-[13px] font-light text-[#64748d]">Dibuat oleh</p>
              <div className="mx-auto mt-16 w-40 border-t border-[#0d253d]" />
            </div>
            <div>
              <p className="text-[13px] font-light text-[#64748d]">Disetujui pelanggan</p>
              <div className="mx-auto mt-16 w-40 border-t border-[#0d253d]" />
            </div>
            <div>
              <p className="text-[13px] font-light text-[#64748d]">Diterima supplier/arsip</p>
              <div className="mx-auto mt-16 w-40 border-t border-[#0d253d]" />
            </div>
          </footer>
        </div>
      </div>
    </>
  );
}
