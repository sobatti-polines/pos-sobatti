"use client";

import { useState } from "react";
import { format } from "date-fns";
import {
  ArrowLeftRight,
  Printer,
  Search,
  Loader2,
  AlertCircle,
  Wallet,
  Coins,
  Landmark,
  TrendingUp,
  TrendingDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getLaporanKas, type LaporanKasData } from "./actions";
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

function formatTanggal(t: string) {
  try {
    return format(new Date(t), "dd MMM yyyy");
  } catch {
    return t;
  }
}

export default function LaporanKasClient({
  initialData,
  store,
}: {
  initialData: LaporanKasData | null;
  store?: StoreSettings | null;
}) {
  const [start, setStart] = useState(initialData?.periode?.start || "");
  const [end, setEnd] = useState(initialData?.periode?.end || "");
  const [data, setData] = useState<LaporanKasData | null>(initialData);
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
    const res = await getLaporanKas({ tanggal_awal: start, tanggal_akhir: end });
    if (res.data) {
      setData(res.data);
    } else {
      setError(res.error || "Laporan tidak dapat dimuat. Silakan coba lagi.");
    }
    setLoading(false);
  };

  const handleExport = () => {
    if (!data) return;
    const headers = ["Tanggal", "Keterangan", "Sumber", "Masuk", "Keluar", "Saldo Setelah", "Oleh"];
    const rows: Array<Array<string | number | null>> = [];

    rows.push(["=== KAS KASIR (LACI) ===", "", "", "", "", "", ""]);
    for (const r of data.kasir_harian) {
      rows.push([
        r.tanggal,
        r.kasir ? `Sesi kasir: ${r.kasir}` : "Sesi kasir",
        "Kas Kasir",
        r.uang_awal ?? r.saldo_awal,
        null,
        r.saldo_akhir,
        r.dikonfirmasi ? "Terkonfirmasi" : "Belum tutup",
      ]);
    }

    rows.push(["=== KAS ADMIN (OPERASIONAL) ===", "", "", "", "", "", ""]);
    for (const m of data.kas_admin_mutasi) {
      rows.push([
        m.tanggal,
        m.keterangan,
        m.sumber,
        m.jenis === "MASUK" ? m.jumlah : null,
        m.jenis === "KELUAR" ? m.jumlah : null,
        m.saldo_setelah,
        m.oleh,
      ]);
    }

    exportToCSV(`laporan-kas-${start}-to-${end}`, headers, rows);
  };

  const ring = data?.ringkasan;
  const saldo = data?.saldo_akhir_periode;

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-background border border-border rounded-[12px] shadow-[0_1px_3px_rgba(0,55,112,0.08)] overflow-hidden relative w-full print-area print:border-none print:shadow-none print:bg-transparent">
      <div className="shrink-0 flex flex-col items-start xl:flex-row xl:items-center justify-between p-4 lg:p-6 border-b border-border bg-transparent gap-4 print:hidden">
        <div className="flex-1 flex flex-col xl:flex-row items-stretch xl:items-center gap-3 w-full">
          <div className="flex flex-col xl:flex-row items-stretch xl:items-center gap-2 bg-muted/50 p-1 rounded-lg border border-border w-full xl:w-auto">
            <div className="flex items-center justify-between sm:justify-start gap-2 px-2 py-1 xl:py-0">
              <Label htmlFor="lk-start" className="text-[11px] uppercase tracking-wider text-muted-foreground whitespace-nowrap">Tanggal Mulai</Label>
              <Input id="lk-start" type="date" value={start} onChange={(e) => setStart(e.target.value)} className="w-full sm:w-[150px] h-9 text-sm bg-background" />
            </div>
            <div className="flex items-center justify-between sm:justify-start gap-2 px-2 py-1 xl:py-0 border-t xl:border-t-0 xl:border-l border-border xl:pl-3">
              <Label htmlFor="lk-end" className="text-[11px] uppercase tracking-wider text-muted-foreground whitespace-nowrap">Tanggal Akhir</Label>
              <Input id="lk-end" type="date" value={end} onChange={(e) => setEnd(e.target.value)} className="w-full sm:w-[150px] h-9 text-sm bg-background" />
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
              <h1 className="text-2xl font-bold uppercase tracking-widest mt-4">Laporan Kas</h1>
              <p className="text-muted-foreground mt-1">
                Periode: {formatTanggal(data.periode.start)} - {formatTanggal(data.periode.end)}
              </p>
            </div>

            {/* Ringkasan Saldo Akhir */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10">
              <div className="rounded-xl border border-border p-5 bg-muted/30">
                <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                  <Wallet className="w-4 h-4" /> Kas Kasir (Laci)
                </div>
                <p className="text-2xl font-light tracking-tight tabular-nums">{formatIDR(saldo?.kas_kasir ?? 0)}</p>
                <p className="text-[11px] text-muted-foreground mt-1">Saldo akhir periode</p>
              </div>
              <div className="rounded-xl border border-border p-5 bg-muted/30">
                <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                  <Coins className="w-4 h-4" /> Kas Admin (Operasional)
                </div>
                <p className="text-2xl font-light tracking-tight tabular-nums">{formatIDR(saldo?.kas_admin ?? 0)}</p>
                <p className="text-[11px] text-muted-foreground mt-1">Saldo akhir periode</p>
              </div>
              <div className="rounded-xl border border-border p-5 bg-muted/30">
                <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                  <Landmark className="w-4 h-4" /> Kas Bank / QRIS
                </div>
                <p className="text-2xl font-light tracking-tight tabular-nums">{formatIDR(saldo?.kas_bank ?? 0)}</p>
                <p className="text-[11px] text-muted-foreground mt-1">Akumulasi penjualan non-tunai</p>
              </div>
            </div>

            {/* Ringkasan Pergerakan Periode */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
              <div className="rounded-xl border border-emerald-600/20 bg-emerald-50/50 p-4">
                <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-emerald-700 mb-1">
                  <TrendingUp className="w-4 h-4" /> Penambahan Kas Kasir
                </div>
                <p className="text-xl font-light tracking-tight tabular-nums text-emerald-700">+{formatIDR(ring?.kasir_penambahan ?? 0)}</p>
                <p className="text-[11px] text-muted-foreground mt-1">Σ (saldo akhir − uang awal) per hari</p>
              </div>
              <div className="rounded-xl border border-amber-600/20 bg-amber-50/50 p-4">
                <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-amber-700 mb-1">
                  <TrendingDown className="w-4 h-4" /> Selisih Kas Kasir
                </div>
                <p className="text-xl font-light tracking-tight tabular-nums text-amber-700">{formatIDR(ring?.kasir_selisih ?? 0)}</p>
                <p className="text-[11px] text-muted-foreground mt-1">Σ selisih uang aktual vs sistem</p>
              </div>
              <div className="rounded-xl border border-emerald-600/20 bg-emerald-50/50 p-4">
                <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-emerald-700 mb-1">
                  <TrendingUp className="w-4 h-4" /> Uang Masuk Kas Admin
                </div>
                <p className="text-xl font-light tracking-tight tabular-nums text-emerald-700">+{formatIDR(ring?.kas_admin_masuk ?? 0)}</p>
                <p className="text-[11px] text-muted-foreground mt-1">Top-up owner + refund retur</p>
              </div>
              <div className="rounded-xl border border-rose-600/20 bg-rose-50/50 p-4">
                <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-rose-700 mb-1">
                  <TrendingDown className="w-4 h-4" /> Uang Keluar Kas Admin
                </div>
                <p className="text-xl font-light tracking-tight tabular-nums text-rose-700">−{formatIDR(ring?.kas_admin_keluar ?? 0)}</p>
                <p className="text-[11px] text-muted-foreground mt-1">Σ pengeluaran operasional Tunai</p>
              </div>
            </div>

            <div className="space-y-12 text-sm">
              {/* ── TABEL KAS KASIR ── */}
              <div>
                <h3 className="font-bold text-base uppercase border-b border-foreground pb-2 flex items-center gap-2">
                  <Wallet className="w-4 h-4" /> Rincian Kas Kasir Harian
                </h3>
                <div className="overflow-x-auto mt-4">
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr className="text-[11px] uppercase tracking-wider text-muted-foreground border-b border-border">
                        <th className="text-left py-2 pr-2 font-semibold">Tanggal</th>
                        <th className="text-left py-2 px-2 font-semibold">Kasir</th>
                        <th className="text-right py-2 px-2 font-semibold">Uang Awal</th>
                        <th className="text-right py-2 px-2 font-semibold">Saldo Awal</th>
                        <th className="text-right py-2 px-2 font-semibold">Penjualan Masuk</th>
                        <th className="text-right py-2 px-2 font-semibold">Uang Keluar</th>
                        <th className="text-right py-2 px-2 font-semibold">Penambahan</th>
                        <th className="text-right py-2 px-2 font-semibold">Saldo Akhir</th>
                        <th className="text-right py-2 px-2 font-semibold">Uang Aktual</th>
                        <th className="text-right py-2 px-2 font-semibold">Selisih</th>
                        <th className="text-center py-2 pl-2 font-semibold">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.kasir_harian.length === 0 && (
                        <tr>
                          <td colSpan={11} className="py-8 text-center text-muted-foreground">
                            Tidak ada sesi kasir pada periode ini.
                          </td>
                        </tr>
                      )}
                      {data.kasir_harian.map((r) => (
                        <tr key={r.tanggal} className="border-b border-border/50 hover:bg-muted/40">
                          <td className="py-2.5 pr-2 whitespace-nowrap">{formatTanggal(r.tanggal)}</td>
                          <td className="py-2.5 px-2 whitespace-nowrap">{r.kasir || "—"}</td>
                          <td className="py-2.5 px-2 text-right tabular-nums">{formatIDR(r.uang_awal)}</td>
                          <td className="py-2.5 px-2 text-right tabular-nums text-muted-foreground">{formatIDR(r.saldo_awal)}</td>
                          <td className="py-2.5 px-2 text-right tabular-nums text-emerald-600">+{formatIDR(r.total_masuk)}</td>
                          <td className="py-2.5 px-2 text-right tabular-nums text-rose-600">−{formatIDR(r.total_keluar)}</td>
                          <td className="py-2.5 px-2 text-right tabular-nums font-medium text-emerald-700">+{formatIDR(r.penambahan)}</td>
                          <td className="py-2.5 px-2 text-right tabular-nums font-medium">{formatIDR(r.saldo_akhir)}</td>
                          <td className="py-2.5 px-2 text-right tabular-nums">{formatIDR(r.uang_aktual)}</td>
                          <td className={`py-2.5 px-2 text-right tabular-nums font-medium ${(r.selisih ?? 0) !== 0 ? "text-amber-600" : "text-muted-foreground"}`}>
                            {formatIDR(r.selisih)}
                          </td>
                          <td className="py-2.5 pl-2 text-center">
                            <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider ${
                              r.dikonfirmasi ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                            }`}>
                              {r.dikonfirmasi ? "Tutup" : "Buka"}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* ── TABEL KAS ADMIN ── */}
              <div>
                <h3 className="font-bold text-base uppercase border-b border-foreground pb-2 flex items-center gap-2">
                  <Coins className="w-4 h-4" /> Mutasi Kas Admin (Saldo Berjalan)
                </h3>
                <div className="overflow-x-auto mt-4">
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr className="text-[11px] uppercase tracking-wider text-muted-foreground border-b border-border">
                        <th className="text-left py-2 pr-2 font-semibold">Tanggal</th>
                        <th className="text-left py-2 px-2 font-semibold">Keterangan</th>
                        <th className="text-left py-2 px-2 font-semibold">Jenis</th>
                        <th className="text-right py-2 px-2 font-semibold">Masuk</th>
                        <th className="text-right py-2 px-2 font-semibold">Keluar</th>
                        <th className="text-right py-2 px-2 font-semibold">Saldo Setelah</th>
                        <th className="text-left py-2 pl-2 font-semibold">Oleh</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.kas_admin_mutasi.length === 0 && (
                        <tr>
                          <td colSpan={7} className="py-8 text-center text-muted-foreground">
                            Tidak ada mutasi kas admin pada periode ini.
                          </td>
                        </tr>
                      )}
                      {data.kas_admin_mutasi.map((m) => (
                        <tr key={m.id} className="border-b border-border/50 hover:bg-muted/40">
                          <td className="py-2.5 pr-2 whitespace-nowrap">{formatTanggal(m.tanggal)}</td>
                          <td className="py-2.5 px-2">{m.keterangan}</td>
                          <td className="py-2.5 px-2">
                            <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider ${
                              m.jenis === "MASUK" ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"
                            }`}>
                              {m.jenis === "MASUK" ? "Masuk" : "Keluar"}
                            </span>
                          </td>
                          <td className="py-2.5 px-2 text-right tabular-nums text-emerald-600">
                            {m.jenis === "MASUK" ? `+${formatIDR(m.jumlah)}` : "—"}
                          </td>
                          <td className="py-2.5 px-2 text-right tabular-nums text-rose-600">
                            {m.jenis === "KELUAR" ? `−${formatIDR(m.jumlah)}` : "—"}
                          </td>
                          <td className="py-2.5 px-2 text-right tabular-nums font-medium">{formatIDR(m.saldo_setelah)}</td>
                          <td className="py-2.5 pl-2 whitespace-nowrap">{m.oleh || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <p className="hidden print:block text-sm text-muted-foreground text-right mt-4">
              Total Kas (Kas Kasir + Kas Admin + Kas Bank): {terbilangRupiah((saldo?.kas_kasir ?? 0) + (saldo?.kas_admin ?? 0) + (saldo?.kas_bank ?? 0))}
            </p>

            {/* Footer for print */}
            <div className="hidden print:grid grid-cols-2 gap-20 p-12 text-center text-sm border-t border-border mt-16">
              <div className="space-y-20">
                <p>Mengetahui,</p>
                <div className="border-t border-border mx-auto w-40"></div>
                <p className="font-bold">( Pemilik )</p>
              </div>
              <div className="space-y-20">
                <p>Dibuat oleh,</p>
                <div className="border-t border-border mx-auto w-40"></div>
                <p className="font-bold">( Admin )</p>
              </div>
            </div>

            {/* Catatan atas Laporan (CaLK) */}
            <div className="text-[11px] text-muted-foreground border-t border-dashed border-border pt-4 mt-10 space-y-1">
              <p className="font-semibold uppercase tracking-wider text-[10px]">Catatan atas Laporan Kas</p>
              <p>1. Kas Kasir = uang hasil penjualan tunai di laci (uang awal/float tidak dihitung sebagai kas usaha).</p>
              <p>2. Penambahan Kas Kasir per hari = saldo akhir − uang awal sesi kasir.</p>
              <p>3. Kas Admin = top-up owner + refund retur − pengeluaran operasional Tunai (saldo berjalan, rollover).</p>
              <p>4. Kas Bank / QRIS merupakan akumulasi penjualan non-tunai (Bank / QRIS).</p>
              <p>5. Pembelian barang tidak dipantau kas (dibayar langsung oleh owner di luar kas tercatat).</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
