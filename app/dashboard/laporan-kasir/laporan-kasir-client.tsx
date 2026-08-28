"use client";

import { useMemo, useState } from "react";
import { format } from "date-fns";
import { id } from "date-fns/locale";
import {
  FileText,
  Printer,
  Pencil,
  Loader2,
  AlertCircle,
  Wallet,
  TrendingUp,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  TrendingDown,
  Scale,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { exportToCSV } from "@/lib/export-utils";
import { ExportDropdown } from "@/components/export-dropdown";
import { editSesiKasir } from "@/app/dashboard/tutup-kasir/actions";
import { terbilangRupiah } from "@/lib/terbilang";
import type { StoreSettings } from "@/lib/store-settings";
import { isOwnerLike } from "@/lib/roles";

function formatIDR(n: number | null) {
  if (n == null) return "—";
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
}

function todayStr() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function monthStartStr() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}-01`;
}

function formatTanggal(t: string) {
  try {
    return format(new Date(t), "dd MMM yyyy");
  } catch {
    return t;
  }
}

export default function LaporanKasirClient({
  data,
  store,
  role,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any[];
  store?: StoreSettings | null;
  role?: string;
}) {
  const isOwner = isOwnerLike(role);
  const router = useRouter();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const uangAwalRow = (r: any) => r.uang_awal ?? r.saldo_awal;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const penambahanRow = (r: any) => Number(r.saldo_akhir) - Number(uangAwalRow(r));

  // Filter periode (client-side dari data yang sudah dimuat server)
  const [start, setStart] = useState(monthStartStr());
  const [end, setEnd] = useState(todayStr());

  const filtered = useMemo(() => {
    return (data || []).filter((r) => {
      const t = (r.tanggal || "").slice(0, 10);
      if (start && t < start) return false;
      if (end && t > end) return false;
      return true;
    });
  }, [data, start, end]);

  const ringkasan = useMemo(() => {
    return filtered.reduce(
      (acc, r) => {
        acc.uang_awal += Number(uangAwalRow(r) || 0);
        acc.masuk += Number(r.total_masuk || 0);
        acc.penambahan += penambahanRow(r);
        acc.selisih += Number(r.selisih || 0);
        return acc;
      },
      { uang_awal: 0, masuk: 0, penambahan: 0, selisih: 0 }
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered]);

  // State dialog koreksi saldo (OWNER only)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [editing, setEditing] = useState<any | null>(null);
  const [uangAwalInput, setUangAwalInput] = useState("");
  const [uangAktualInput, setUangAktualInput] = useState("");
  const [editError, setEditError] = useState("");
  const [saving, setSaving] = useState(false);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleStartEdit = (r: any) => {
    setEditing(r);
    setUangAwalInput(String(uangAwalRow(r)));
    setUangAktualInput(r.uang_aktual != null ? String(r.uang_aktual) : "");
    setEditError("");
  };

  const handleSaveEdit = async () => {
    if (!editing) return;
    setEditError("");
    const awal = Number(uangAwalInput);
    if (isNaN(awal) || awal < 0) { setEditError("Uang awal tidak valid"); return; }
    let aktual: number | null = null;
    if (uangAktualInput.trim() !== "") {
      const a = Number(uangAktualInput);
      if (isNaN(a) || a < 0) { setEditError("Uang aktual tidak valid"); return; }
      aktual = a;
    }
    setSaving(true);
    const res = await editSesiKasir({ tanggal: editing.tanggal, uang_awal: awal, uang_aktual: aktual });
    setSaving(false);
    if (res?.error) {
      setEditError(res.error);
      return;
    }
    setEditing(null);
    router.refresh();
  };

  const handleExport = () => {
    const headers = ["Tanggal", "Uang Awal", "Total Masuk", "Penambahan", "Saldo Sistem", "Uang Aktual", "Selisih", "Kasir"];
    const rows = filtered.map(r => [
      format(new Date(r.tanggal), "yyyy-MM-dd"),
      uangAwalRow(r),
      r.total_masuk,
      penambahanRow(r),
      r.saldo_akhir,
      r.uang_aktual,
      r.selisih,
      r.pengguna?.nama || r.pengguna?.username || "-"
    ]);
    exportToCSV(`laporan-kasir-${format(new Date(), "yyyyMMdd")}`, headers, rows);
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-background border border-border rounded-[12px] shadow-[0_1px_3px_rgba(0,55,112,0.08)] overflow-hidden relative w-full print-area print:border-none print:shadow-none print:bg-transparent">
      {/* Toolbar: filter periode + aksi ekspor/cetak */}
      <div className="shrink-0 flex flex-col items-start xl:flex-row xl:items-center justify-between p-4 lg:p-6 border-b border-border bg-transparent gap-4 print:hidden">
        <div className="flex-1 flex flex-col xl:flex-row items-stretch xl:items-center gap-3 w-full">
          <div className="flex flex-col xl:flex-row items-stretch xl:items-center gap-2 bg-muted/50 p-1 rounded-lg border border-border w-full xl:w-auto">
            <div className="flex items-center justify-between sm:justify-start gap-2 px-2 py-1 xl:py-0">
              <Label htmlFor="lkr-start" className="text-[11px] uppercase tracking-wider text-muted-foreground whitespace-nowrap">Tanggal Mulai</Label>
              <Input id="lkr-start" type="date" value={start} onChange={(e) => setStart(e.target.value)} className="w-full sm:w-[150px] h-9 text-sm bg-background" />
            </div>
            <div className="flex items-center justify-between sm:justify-start gap-2 px-2 py-1 xl:py-0 border-t xl:border-t-0 xl:border-l border-border xl:pl-3">
              <Label htmlFor="lkr-end" className="text-[11px] uppercase tracking-wider text-muted-foreground whitespace-nowrap">Tanggal Akhir</Label>
              <Input id="lkr-end" type="date" value={end} onChange={(e) => setEnd(e.target.value)} className="w-full sm:w-[150px] h-9 text-sm bg-background" />
            </div>
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
            <h1 className="text-2xl font-bold uppercase tracking-widest mt-4">Laporan Kasir Harian</h1>
            <p className="text-muted-foreground mt-1">
              Periode: {formatTanggal(start)} - {formatTanggal(end)}
            </p>
          </div>

          {filtered.length === 0 ? (
            <div className="text-center py-20 px-4">
              <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center text-muted-foreground mx-auto mb-4">
                <FileText className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-medium text-foreground mb-1">Belum ada data</h3>
              <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                Tidak ada sesi kasir pada periode ini. Atur rentang tanggal di atas untuk melihat riwayat.
              </p>
            </div>
          ) : (
            <>
              {/* Ringkasan periode */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
                <div className="rounded-xl border border-border p-5 bg-muted/30">
                  <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                    <Wallet className="w-4 h-4" /> Uang Awal
                  </div>
                  <p className="text-2xl font-light tracking-tight tabular-nums">{formatIDR(ringkasan.uang_awal)}</p>
                  <p className="text-[11px] text-muted-foreground mt-1">Σ uang awal sesi kasir</p>
                </div>
                <div className="rounded-xl border border-emerald-600/20 bg-emerald-50/50 p-4">
                  <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-emerald-700 mb-1">
                    <TrendingUp className="w-4 h-4" /> Penjualan Masuk
                  </div>
                  <p className="text-xl font-light tracking-tight tabular-nums text-emerald-700">+{formatIDR(ringkasan.masuk)}</p>
                  <p className="text-[11px] text-muted-foreground mt-1">Σ penjualan tunai periode</p>
                </div>
                <div className="rounded-xl border border-emerald-600/20 bg-emerald-50/50 p-4">
                  <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-emerald-700 mb-1">
                    <TrendingUp className="w-4 h-4" /> Penambahan
                  </div>
                  <p className="text-xl font-light tracking-tight tabular-nums text-emerald-700">+{formatIDR(ringkasan.penambahan)}</p>
                  <p className="text-[11px] text-muted-foreground mt-1">Σ (saldo akhir − uang awal)</p>
                </div>
                <div className="rounded-xl border border-amber-600/20 bg-amber-50/50 p-4">
                  <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-amber-700 mb-1">
                    <Scale className="w-4 h-4" /> Selisih Kas
                  </div>
                  <p className="text-xl font-light tracking-tight tabular-nums text-amber-700">{formatIDR(ringkasan.selisih)}</p>
                  <p className="text-[11px] text-muted-foreground mt-1">Σ selisih uang aktual vs sistem</p>
                </div>
              </div>

              {/* Tabel rincian kas kasir harian */}
              <div className="space-y-12 text-sm">
                <div>
                  <h3 className="font-bold text-base uppercase border-b border-foreground pb-2 flex items-center gap-2">
                    <Wallet className="w-4 h-4" /> Rincian Kas Kasir Harian
                  </h3>
                  <div className="overflow-x-auto mt-4">
                    <table className="w-full text-sm border-collapse">
                      <thead>
                        <tr className="text-[11px] uppercase tracking-wider text-muted-foreground border-b border-border">
                          <th className="text-left py-2 pr-2 font-semibold whitespace-nowrap">Tanggal</th>
                          <th className="text-left py-2 px-2 font-semibold">Kasir</th>
                          <th className="text-right py-2 px-2 font-semibold">Uang Awal</th>
                          <th className="text-right py-2 px-2 font-semibold">Saldo Awal</th>
                          <th className="text-right py-2 px-2 font-semibold">Penjualan Masuk</th>
                          <th className="text-right py-2 px-2 font-semibold">Uang Keluar</th>
                          <th className="text-right py-2 px-2 font-semibold">Penambahan</th>
                          <th className="text-right py-2 px-2 font-semibold">Saldo Akhir</th>
                          <th className="text-right py-2 px-2 font-semibold">Uang Aktual</th>
                          <th className="text-right py-2 px-2 font-semibold">Selisih</th>
                          <th className="text-center py-2 px-2 font-semibold">Status</th>
                          {isOwner && <th className="text-right py-2 pl-2 font-semibold">Aksi</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {filtered.map((r) => (
                          <tr key={r.id} className="border-b border-border/50 hover:bg-muted/40">
                            <td className="py-2.5 pr-2 whitespace-nowrap">
                              {format(new Date(r.tanggal), "eeee, dd MMMM yyyy", { locale: id })}
                            </td>
                            <td className="py-2.5 px-2 whitespace-nowrap">
                              {r.pengguna?.nama || r.pengguna?.username || "—"}
                            </td>
                            <td className="py-2.5 px-2 text-right tabular-nums">{formatIDR(uangAwalRow(r))}</td>
                            <td className="py-2.5 px-2 text-right tabular-nums text-muted-foreground">{formatIDR(r.saldo_awal)}</td>
                            <td className="py-2.5 px-2 text-right tabular-nums text-emerald-600">+{formatIDR(r.total_masuk)}</td>
                            <td className="py-2.5 px-2 text-right tabular-nums text-rose-600">−{formatIDR(r.total_keluar)}</td>
                            <td className="py-2.5 px-2 text-right tabular-nums font-medium text-emerald-700">+{formatIDR(penambahanRow(r))}</td>
                            <td className="py-2.5 px-2 text-right tabular-nums font-medium">{formatIDR(r.saldo_akhir)}</td>
                            <td className="py-2.5 px-2 text-right tabular-nums">{formatIDR(r.uang_aktual)}</td>
                            <td className={`py-2.5 px-2 text-right tabular-nums font-medium ${(r.selisih ?? 0) !== 0 ? "text-amber-600" : "text-muted-foreground"}`}>
                              {formatIDR(r.selisih)}
                            </td>
                            <td className="py-2.5 px-2 text-center">
                              <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider ${
                                r.dikonfirmasi ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                              }`}>
                                {r.dikonfirmasi ? "Tutup" : "Buka"}
                              </span>
                            </td>
                            {isOwner && (
                              <td className="py-2.5 pl-2 text-right">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  aria-label="Edit saldo sesi kasir"
                                  title="Koreksi saldo (owner)"
                                  className="h-8 w-8 text-muted-foreground hover:text-primary hover:bg-primary/10"
                                  onClick={() => handleStartEdit(r)}
                                >
                                  <Pencil className="w-4 h-4" />
                                </Button>
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              <p className="hidden print:block text-sm text-muted-foreground text-right mt-4">
                Total Penambahan: {terbilangRupiah(ringkasan.penambahan)}
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
                  <p className="font-bold">( Kasir / Admin )</p>
                </div>
              </div>

              {/* Catatan atas Laporan (CaLK) */}
              <div className="text-[11px] text-muted-foreground border-t border-dashed border-border pt-4 mt-10 space-y-1">
                <p className="font-semibold uppercase tracking-wider text-[10px]">Catatan atas Laporan Kas</p>
                <p>1. Kas Kasir = uang hasil penjualan tunai di laci (uang awal/float tidak dihitung sebagai kas usaha).</p>
                <p>2. Penambahan Kas Kasir per hari = saldo akhir − uang awal sesi kasir.</p>
                <p>3. Uang keluar = 0 karena pengeluaran operasional dibayar dari Kas Admin, bukan laci kasir.</p>
                <p>4. Pembelian barang tidak dipantau kas (dibayar langsung oleh owner di luar kas tercatat).</p>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Dialog koreksi saldo sesi kasir (OWNER only) */}
      <Dialog open={!!editing} onOpenChange={(open) => { if (!open) setEditing(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Saldo Sesi Kasir</DialogTitle>
            <DialogDescription>
              Koreksi saldo sesi kasir untuk tanggal {editing ? format(new Date(editing.tanggal), "dd MMM yyyy") : ""}.
              Total penjualan (Masuk) tidak diubah — hanya koreksi uang awal & uang aktual (khusus owner).
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="lkr-uang-awal" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Uang Awal Sesi (Rp)</Label>
              <Input id="lkr-uang-awal" type="number" min={0} value={uangAwalInput} onChange={(e) => setUangAwalInput(e.target.value)} className="h-11 tabular-nums" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="lkr-uang-aktual" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Uang Aktual (Rp)</Label>
              <Input id="lkr-uang-aktual" type="number" min={0} value={uangAktualInput} onChange={(e) => setUangAktualInput(e.target.value)} className="h-11 tabular-nums" placeholder="Kosongkan jika sesi belum ditutup" />
            </div>
            {editError && (
              <div className="flex items-center gap-2 p-3 bg-destructive/10 text-destructive text-sm rounded-md border border-destructive/20">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {editError}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)} disabled={saving}>Batal</Button>
            <Button onClick={handleSaveEdit} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Pencil className="w-4 h-4 mr-2" />}
              Simpan Perubahan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
