"use client";

import { useState } from "react";
import { format } from "date-fns";
import { ArrowLeftRight, Printer, Search, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { fetchArusKas } from "./actions";
import { exportToCSV } from "@/lib/export-utils";
import { ExportDropdown } from "@/components/export-dropdown";
import { terbilangRupiah } from "@/lib/terbilang";
import type { StoreSettings } from "@/lib/store-settings";

function formatIDR(n: number | null) {
  if (n == null) return "—";
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
}

interface ArusKasReport {
  periode: { start: string; end: string };
  kas_awal: { saldo_awal: number };
  arus_operasi: {
    penerimaan_penjualan_tunai: number;
    penerimaan_retur: number;
    total_penerimaan: number;
    pembayaran_pembelian: number;
    pembayaran_pengeluaran: number;
    total_pembayaran: number;
    kas_bersih_operasi: number;
  };
  arus_investasi: { total: number };
  arus_pendanaan: { total: number };
  kas_akhir: { saldo_akhir: number };
  konsistensi: {
    saldo_akhir_sistem: number | null;
    selisih_arus_kas: number | null;
  };
}

export default function ArusKasClient({
  initialData,
  store,
}: {
  initialData: ArusKasReport | null;
  store?: StoreSettings | null;
}) {
  const [start, setStart] = useState(initialData?.periode?.start || "");
  const [end, setEnd] = useState(initialData?.periode?.end || "");
  const [data, setData] = useState<ArusKasReport | null>(initialData);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleFetch = async () => {
    if (!start || !end) {
      setError("Tanggal mulai dan tanggal akhir wajib diisi");
      return;
    }
    if (start > end) {
      setError("Tanggal mulai tidak boleh lebih besar dari tanggal akhir");
      return;
    }
    setLoading(true);
    setError("");
    const res = await fetchArusKas(start, end);
    if (res.data) {
      setData(res.data);
    } else {
      setError(res.error || "Laporan tidak dapat dimuat. Silakan coba lagi.");
    }
    setLoading(false);
  };

  const handleExport = () => {
    if (!data) return;
    const headers = ["Kategori", "Item", "Jumlah"];
    const rows: Array<[string, string, number | null]> = [
      ["KAS AWAL", "Saldo Awal", data.kas_awal.saldo_awal],
      ["ARUS OPERASI", "Penerimaan Penjualan Tunai", data.arus_operasi.penerimaan_penjualan_tunai],
      ["ARUS OPERASI", "Penerimaan Retur Pembelian", data.arus_operasi.penerimaan_retur],
      ["ARUS OPERASI", "Total Penerimaan", data.arus_operasi.total_penerimaan],
      ["ARUS OPERASI", "Pembayaran Pembelian (-)", data.arus_operasi.pembayaran_pembelian],
      ["ARUS OPERASI", "Pembayaran Pengeluaran Operasional (-)", data.arus_operasi.pembayaran_pengeluaran],
      ["ARUS OPERASI", "Total Pembayaran (-)", data.arus_operasi.total_pembayaran],
      ["ARUS OPERASI", "Kas Bersih Operasi", data.arus_operasi.kas_bersih_operasi],
      ["ARUS INVESTASI", "Total Aktivitas Investasi", data.arus_investasi.total],
      ["ARUS PENDANAAN", "Total Aktivitas Pendanaan", data.arus_pendanaan.total],
      ["KAS AKHIR", "Saldo Akhir Kas", data.kas_akhir.saldo_akhir],
      ["KONSISTENSI", "Saldo Akhir Sistem (Tutup Kasir)", data.konsistensi?.saldo_akhir_sistem ?? null],
      ["KONSISTENSI", "Selisih Arus Kas", data.konsistensi?.selisih_arus_kas ?? null],
    ];
    exportToCSV(`arus-kas-${start}-to-${end}`, headers, rows);
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-background border border-border rounded-[12px] shadow-[0_1px_3px_rgba(0,55,112,0.08)] overflow-hidden relative w-full print-area print:border-none print:shadow-none print:bg-transparent">
      <div className="shrink-0 flex flex-col items-start xl:flex-row xl:items-center justify-between p-4 lg:p-6 border-b border-border bg-transparent gap-4 print:hidden">
        <div className="flex-1 flex flex-col xl:flex-row items-stretch xl:items-center gap-3 w-full">
          <div className="flex flex-col xl:flex-row items-stretch xl:items-center gap-2 bg-muted/50 p-1 rounded-lg border border-border w-full xl:w-auto">
            <div className="flex items-center justify-between sm:justify-start gap-2 px-2 py-1 xl:py-0">
              <Label htmlFor="ak-start" className="text-[11px] uppercase tracking-wider text-muted-foreground whitespace-nowrap">Tanggal Mulai</Label>
              <Input id="ak-start" type="date" value={start} onChange={(e) => setStart(e.target.value)} className="w-full sm:w-[150px] h-9 text-sm bg-background" />
            </div>
            <div className="flex items-center justify-between sm:justify-start gap-2 px-2 py-1 xl:py-0 border-t xl:border-t-0 xl:border-l border-border xl:pl-3">
              <Label htmlFor="ak-end" className="text-[11px] uppercase tracking-wider text-muted-foreground whitespace-nowrap">Tanggal Akhir</Label>
              <Input id="ak-end" type="date" value={end} onChange={(e) => setEnd(e.target.value)} className="w-full sm:w-[150px] h-9 text-sm bg-background" />
            </div>
            <Button onClick={handleFetch} disabled={loading} className="h-9 font-medium rounded-md px-4 flex-1 sm:flex-none bg-primary text-primary-foreground hover:bg-primary/90">
              {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Search className="w-4 h-4 mr-2" />}
              Tampilkan Laporan
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 xl:ml-4 shrink-0 w-full xl:w-auto">
          <ExportDropdown onExportCSV={handleExport} className="flex-1 md:flex-none" />
          <Button variant="outline" className="rounded-full px-4 h-10 gap-2 flex-1 md:flex-none" onClick={() => window.print()}>
            <Printer className="w-4 h-4" /> Cetak Laporan
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto min-h-0 relative">
        {loading && (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        )}

        {error && !loading && (
          <div className="p-6 lg:p-8">
            <div className="p-4 bg-destructive/10 border border-destructive/20 text-destructive text-sm rounded-lg flex items-center gap-2 max-w-7xl mx-auto">
              <AlertCircle className="w-4 h-4" />
              {error}
            </div>
          </div>
        )}

        {!data && !loading && !error && (
          <div className="text-center py-20 px-4">
            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center text-muted-foreground mx-auto mb-4">
              <ArrowLeftRight className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-medium text-foreground mb-1">Belum ada data ditampilkan</h3>
            <p className="text-sm text-muted-foreground max-w-sm mx-auto">
              Silakan atur tanggal mulai dan tanggal akhir di atas, lalu klik “Tampilkan Laporan”.
            </p>
          </div>
        )}

        {data && !loading && (
          <div className="max-w-7xl mx-auto w-full p-6 lg:p-10">
            {/* Print Header */}
            <div className="hidden print:block pb-8 mb-10 text-center border-b border-border">
              {store?.nama_toko && <p className="text-lg font-semibold uppercase tracking-widest">{store.nama_toko}</p>}
              {store?.alamat && <p className="text-sm text-muted-foreground mt-1">{store.alamat}</p>}
              {(store?.telepon || store?.email) && (
                <p className="text-xs text-muted-foreground mt-1">
                  {store.telepon && <span>Telp: {store.telepon}</span>}
                  {store.telepon && store.email && <span className="mx-2">|</span>}
                  {store.email && <span>Email: {store.email}</span>}
                </p>
              )}
              <h1 className="text-2xl font-bold uppercase tracking-widest mt-4">Laporan Arus Kas</h1>
              <p className="text-muted-foreground mt-1">
                Periode: {format(new Date(data.periode.start), "dd MMM yyyy")} - {format(new Date(data.periode.end), "dd MMM yyyy")}
              </p>
            </div>

            <div className="space-y-10 text-sm">
              {/* SALDO AWAL */}
              <div className="space-y-6">
                <h3 className="font-bold text-base uppercase border-b border-foreground pb-2">Kas Awal</h3>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span>Saldo Awal (Laci)</span>
                    <span className="tabular-nums">{formatIDR(data.kas_awal.saldo_awal)}</span>
                  </div>
                </div>
              </div>

              {/* ARUS OPERASI */}
              <div className="space-y-6">
                <h3 className="font-bold text-base uppercase border-b border-foreground pb-2">
                  Arus Kas dari Aktivitas Operasi
                </h3>

                <div className="space-y-3">
                  <h4 className="text-[11px] font-bold text-muted-foreground uppercase mb-2">Penerimaan</h4>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span>Penjualan Tunai</span>
                      <span className="tabular-nums">{formatIDR(data.arus_operasi.penerimaan_penjualan_tunai)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span>Penerimaan Retur Pembelian</span>
                      <span className="tabular-nums">{formatIDR(data.arus_operasi.penerimaan_retur)}</span>
                    </div>
                    <div className="flex justify-between items-center pt-2 border-t border-border mt-2">
                      <span className="font-medium">Total Penerimaan</span>
                      <span className="font-medium tabular-nums">{formatIDR(data.arus_operasi.total_penerimaan)}</span>
                    </div>
                  </div>

                  <h4 className="text-[11px] font-bold text-muted-foreground uppercase mb-2 mt-6">Pembayaran</h4>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span>Pembelian Barang</span>
                      <span className="tabular-nums">({formatIDR(data.arus_operasi.pembayaran_pembelian)})</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span>Pengeluaran Operasional</span>
                      <span className="tabular-nums">({formatIDR(data.arus_operasi.pembayaran_pengeluaran)})</span>
                    </div>
                    <div className="flex justify-between items-center pt-2 border-t border-border mt-2">
                      <span className="font-medium">Total Pembayaran</span>
                      <span className="font-medium tabular-nums">({formatIDR(data.arus_operasi.total_pembayaran)})</span>
                    </div>
                  </div>

                  <div className="flex justify-between items-center pt-4 border-t border-border mt-6">
                    <span className="font-bold">Kas Bersih Operasi</span>
                    <span className={`font-bold text-base tabular-nums border-b-2 border-foreground ${
                      data.arus_operasi.kas_bersih_operasi >= 0 ? "text-emerald-600" : "text-rose-600"
                    }`}>
                      {data.arus_operasi.kas_bersih_operasi >= 0 ? "+" : ""}{formatIDR(data.arus_operasi.kas_bersih_operasi)}
                    </span>
                  </div>
                </div>
              </div>

              {/* INVESTASI & PENDANAAN (placeholder) */}
              <div className="space-y-6">
                <h3 className="font-bold text-base uppercase border-b border-foreground pb-2">Aktivitas Investasi</h3>
                <div className="flex justify-between items-center">
                  <span>Total Aktivitas Investasi</span>
                  <span className="tabular-nums">{formatIDR(data.arus_investasi.total)}</span>
                </div>
              </div>

              <div className="space-y-6">
                <h3 className="font-bold text-base uppercase border-b border-foreground pb-2">Aktivitas Pendanaan</h3>
                <div className="flex justify-between items-center">
                  <span>Total Aktivitas Pendanaan</span>
                  <span className="tabular-nums">{formatIDR(data.arus_pendanaan.total)}</span>
                </div>
              </div>

              {/* SALDO AKHIR */}
              <div className="flex justify-between items-center pt-6 border-t-2 border-foreground mt-8">
                <span className="font-bold text-base uppercase">Saldo Akhir Kas</span>
                <span className="font-bold text-xl tabular-nums border-b-2 border-foreground">
                  {formatIDR(data.kas_akhir.saldo_akhir)}
                </span>
              </div>
              <p className="hidden print:block text-sm text-muted-foreground text-right mt-2">
                Terbilang: {terbilangRupiah(data.kas_akhir.saldo_akhir)}
              </p>

              {/* KONSISTENSI */}
              {data.konsistensi && (
                <div className={`flex justify-between items-center pt-3 text-[13px] ${
                  data.konsistensi.selisih_arus_kas != null && Math.abs(data.konsistensi.selisih_arus_kas) < 1
                    ? "text-emerald-600"
                    : "text-amber-600"
                }`}>
                  <span className="font-medium">Saldo Akhir Sistem (Tutup Kasir)</span>
                  <span className="font-medium tabular-nums">{formatIDR(data.konsistensi.saldo_akhir_sistem)}</span>
                </div>
              )}
              {data.konsistensi && (
                <div className={`flex justify-between items-center pt-1 text-[13px] -mt-6 ${
                  data.konsistensi.selisih_arus_kas != null && Math.abs(data.konsistensi.selisih_arus_kas) < 1
                    ? "text-emerald-600"
                    : "text-amber-600"
                }`}>
                  <span className="font-medium">Selisih Arus Kas</span>
                  <span className="font-medium tabular-nums">{formatIDR(data.konsistensi.selisih_arus_kas)}</span>
                </div>
              )}
            </div>

            {/* Footer for print */}
            <div className="hidden print:grid grid-cols-2 gap-20 p-12 text-center text-sm border-t border-border mt-16">
              <div className="space-y-20">
                <p>Disetujui oleh,</p>
                <div className="border-t border-border mx-auto w-40"></div>
                <p className="font-bold">( Pemilik )</p>
              </div>
              <div className="space-y-20">
                <p>Dibuat oleh,</p>
                <div className="border-t border-border mx-auto w-40"></div>
                <p className="font-bold">( Kasir / Admin )</p>
              </div>
            </div>

            {/* Catatan atas Laporan Keuangan (CaLK) */}
            <div className="text-[11px] text-muted-foreground border-t border-dashed border-border pt-4 mt-10 space-y-1">
              <p className="font-semibold uppercase tracking-wider text-[10px]">Catatan atas Laporan Keuangan</p>
              <p>1. Disusun menggunakan basis kas (cash basis); persediaan dinilai dengan metode biaya rata-rata (AVCO).</p>
              <p>2. Piutang dan hutang dalam keadaan normal = 0 karena seluruh transaksi diselesaikan pada saat itu.</p>
              <p>3. Kas Bank / QRIS merupakan akumulasi penjualan non-tunai (Bank / QRIS).</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}