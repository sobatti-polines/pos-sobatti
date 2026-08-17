"use client";

import { useState, useTransition } from "react";
import {
  Wallet,
  Plus,
  Trash2,
  Pencil,
  X,
  ArrowDownLeft,
  ArrowUpRight,
  Loader2,
  AlertCircle,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { exportToCSV } from "@/lib/export-utils";
import { ExportDropdown } from "@/components/export-dropdown";
import { addKasAdminTopup, deleteKasAdminTopup, editKasAdminTopup, getKasAdminData, type KasAdminMutasi } from "./actions";

function formatIDR(n: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
}

interface KasAdminData {
  saldo: number;
  total_masuk_bulan: number;
  total_keluar_bulan: number;
  mutasi: KasAdminMutasi[];
}

export default function KasAdminClient({ initialData }: { initialData: KasAdminData }) {
  const [data, setData] = useState(initialData);
  const [tanggal, setTanggal] = useState(new Date().toISOString().slice(0, 10));
  const [jumlah, setJumlah] = useState<string>("");
  const [keterangan, setKeterangan] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isPending, startTransition] = useTransition();
  // Mode edit: sedang mengoreksi penambahan saldo yang salah input
  const [editingTopup, setEditingTopup] = useState<{ id: string } | null>(null);

  const resetForm = () => {
    setTanggal(new Date().toISOString().slice(0, 10));
    setJumlah("");
    setKeterangan("");
    setEditingTopup(null);
    setError("");
    setSuccess("");
  };

  const handleStartEdit = (id: string, row: KasAdminMutasi) => {
    setError("");
    setSuccess("");
    setEditingTopup({ id });
    setTanggal(row.tanggal);
    setJumlah(String(row.jumlah));
    setKeterangan(row.keterangan);
  };

  const handleSave = () => {
    setError("");
    setSuccess("");
    const num = Number(jumlah);
    if (!tanggal) { setError("Tanggal wajib diisi"); return; }
    if (isNaN(num) || num <= 0) { setError("Jumlah harus lebih dari 0"); return; }

    startTransition(async () => {
      const res = editingTopup
        ? await editKasAdminTopup({ id: editingTopup.id, tanggal, jumlah: num, keterangan: keterangan || undefined })
        : await addKasAdminTopup({ tanggal, jumlah: num, keterangan: keterangan || undefined });
      if (res?.error) {
        setError(res.error);
      } else {
        setSuccess(editingTopup ? "Perubahan berhasil disimpan" : "Penambahan saldo berhasil disimpan");
        setJumlah("");
        setKeterangan("");
        setEditingTopup(null);
        // Muat ulang data dari server
        const fresh = await getKasAdminData();
        if (fresh.data) setData(fresh.data);
      }
    });
  };

  const handleDeleteTopup = (id: string) => {
    if (!window.confirm("Hapus penambahan saldo ini? Saldo kas admin akan berkurang.")) return;
    setError("");
    setSuccess("");
    startTransition(async () => {
      const res = await deleteKasAdminTopup(id);
      if (res?.error) {
        setError(res.error);
      } else {
        setSuccess("Penambahan saldo dihapus");
        const fresh = await getKasAdminData();
        if (fresh.data) setData(fresh.data);
      }
    });
  };

  const handleExport = () => {
    const headers = ["Tanggal", "Jenis", "Keterangan", "Sumber", "Jumlah", "Oleh"];
    const rows = data.mutasi.map((m) => [
      m.tanggal,
      m.jenis === "MASUK" ? "Masuk" : "Keluar",
      m.keterangan,
      m.sumber === "topup" ? "Penambahan Saldo" : m.sumber === "retur" ? "Refund Retur" : "Pengeluaran",
      m.jenis === "MASUK" ? m.jumlah : -m.jumlah,
      m.oleh || "-",
    ]);
    exportToCSV(`kas-admin-${new Date().toISOString().slice(0, 10)}`, headers, rows);
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 gap-4 md:gap-6">
      {/* Kartu ringkasan */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 shrink-0">
        <div className="bg-background border border-border rounded-xl p-5 shadow-[0_1px_3px_rgba(0,55,112,0.08)]">
          <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground mb-3">
            <Wallet className="w-4 h-4" /> Saldo Saat Ini
          </div>
          <div className={`text-2xl font-semibold tabular-nums ${data.saldo >= 0 ? "text-foreground" : "text-rose-600"}`}>
            {formatIDR(data.saldo)}
          </div>
          <p className="text-xs text-muted-foreground mt-1">Rollover otomatis dari saldo sebelumnya</p>
        </div>
        <div className="bg-background border border-border rounded-xl p-5 shadow-[0_1px_3px_rgba(0,55,112,0.08)]">
          <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground mb-3">
            <ArrowDownLeft className="w-4 h-4 text-emerald-600" /> Masuk Bulan Ini
          </div>
          <div className="text-2xl font-semibold tabular-nums text-emerald-600">
            +{formatIDR(data.total_masuk_bulan)}
          </div>
          <p className="text-xs text-muted-foreground mt-1">Top-up owner + refund retur</p>
        </div>
        <div className="bg-background border border-border rounded-xl p-5 shadow-[0_1px_3px_rgba(0,55,112,0.08)]">
          <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground mb-3">
            <ArrowUpRight className="w-4 h-4 text-rose-600" /> Keluar Bulan Ini
          </div>
          <div className="text-2xl font-semibold tabular-nums text-rose-600">
            -{formatIDR(data.total_keluar_bulan)}
          </div>
          <p className="text-xs text-muted-foreground mt-1">Pengeluaran operasional (Tunai)</p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 md:gap-6 flex-1 min-h-0">
        {/* Form Penambahan Saldo */}
        <div className="bg-background border border-border rounded-xl shadow-[0_1px_3px_rgba(0,55,112,0.08)] overflow-hidden flex flex-col shrink-0 xl:shrink xl:max-h-fit">
          <div className="p-5 border-b border-border">
            <h3 className="font-medium text-foreground flex items-center gap-2">
              {editingTopup ? <Pencil className="w-4 h-4 text-primary" /> : <Plus className="w-4 h-4 text-primary" />}
              {editingTopup ? "Edit Penambahan Saldo" : "Penambahan Saldo"}
            </h3>
            <p className="text-xs text-muted-foreground mt-1">
              {editingTopup
                ? "Koreksi data penambahan saldo yang salah input."
                : "Catat saat owner memberikan uang kas ke kas admin (kapan pun dibutuhkan)."}
            </p>
          </div>
          <div className="p-5 flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ka-tanggal" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Tanggal
              </Label>
              <Input id="ka-tanggal" type="date" value={tanggal} onChange={(e) => setTanggal(e.target.value)} className="h-11" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ka-jumlah" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Jumlah (Rp)
              </Label>
              <Input
                id="ka-jumlah"
                type="number"
                min={0}
                placeholder="Contoh: 500000"
                value={jumlah}
                onChange={(e) => setJumlah(e.target.value)}
                className="h-11 tabular-nums"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ka-ket" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Keterangan <span className="font-normal normal-case">(opsional)</span>
              </Label>
              <Input
                id="ka-ket"
                placeholder="Contoh: untuk belanja kebersihan"
                value={keterangan}
                onChange={(e) => setKeterangan(e.target.value)}
                className="h-11"
              />
            </div>

            {error && (
              <div className="flex items-center gap-2 p-3 bg-destructive/10 text-destructive text-sm rounded-md border border-destructive/20">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {error}
              </div>
            )}
            {success && (
              <div className="flex items-center gap-2 p-3 bg-emerald-50 text-emerald-700 text-sm rounded-md border border-emerald-100">
                <Check className="w-4 h-4 shrink-0" />
                {success}
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-2">
              <Button onClick={handleSave} disabled={isPending} className="h-11 rounded-full flex-1">
                {isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : editingTopup ? <Pencil className="w-4 h-4 mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
                {editingTopup ? "Simpan Perubahan" : "Simpan Penambahan"}
              </Button>
              {editingTopup && (
                <Button variant="outline" onClick={resetForm} disabled={isPending} className="h-11 rounded-full">
                  <X className="w-4 h-4 mr-2" />
                  Batal
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Tabel Mutasi */}
        <div className="xl:col-span-2 bg-background border border-border rounded-xl shadow-[0_1px_3px_rgba(0,55,112,0.08)] overflow-hidden flex flex-col min-h-0">
          <div className="shrink-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-5 border-b border-border">
            <div>
              <h3 className="font-medium text-foreground">Mutasi Kas Admin</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Uang masuk (top-up owner & refund retur) dan uang keluar (pengeluaran operasional Tunai)
              </p>
            </div>
            <ExportDropdown onExportCSV={handleExport} className="flex-1 sm:flex-none" />
          </div>

          <div className="flex-1 overflow-auto min-h-0">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 border-b border-border sticky top-0 z-10">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground uppercase tracking-wider text-[11px]">Tanggal</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground uppercase tracking-wider text-[11px]">Keterangan</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground uppercase tracking-wider text-[11px]">Jumlah</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground uppercase tracking-wider text-[11px] hidden md:table-cell">Oleh</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground uppercase tracking-wider text-[11px] w-16"></th>
                </tr>
              </thead>
              <tbody>
                {data.mutasi.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center py-16 text-muted-foreground">
                      <Wallet className="w-12 h-12 mx-auto mb-3 opacity-20" />
                      Belum ada mutasi kas admin
                    </td>
                  </tr>
                ) : (
                  data.mutasi.map((m) => (
                    <tr key={m.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3 whitespace-nowrap text-muted-foreground tabular-nums">{m.tanggal}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-start gap-2">
                          {m.jenis === "MASUK" ? (
                            <ArrowDownLeft className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                          ) : (
                            <ArrowUpRight className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                          )}
                          <div>
                            <p className="text-foreground">{m.keterangan}</p>
                            <span className={`inline-block mt-0.5 text-[10px] uppercase tracking-wider font-medium rounded-full px-2 py-0.5 ${
                              m.sumber === "topup"
                                ? "bg-primary/10 text-primary"
                                : m.sumber === "retur"
                                  ? "bg-sky-100 text-sky-700"
                                  : "bg-amber-100 text-amber-700"
                            }`}>
                              {m.sumber === "topup" ? "Top-up Owner" : m.sumber === "retur" ? "Refund Retur" : "Pengeluaran"}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className={`px-4 py-3 text-right font-medium tabular-nums whitespace-nowrap ${m.jenis === "MASUK" ? "text-emerald-600" : "text-rose-600"}`}>
                        {m.jenis === "MASUK" ? "+" : "-"}{formatIDR(m.jumlah)}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">{m.oleh || "-"}</td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        {m.sumber === "topup" && (
                          <div className="inline-flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label="Edit penambahan saldo"
                              className="h-8 w-8 text-muted-foreground hover:text-primary hover:bg-primary/10"
                              onClick={() => handleStartEdit(m.id.replace("topup-", ""), m)}
                              disabled={isPending}
                            >
                              <Pencil className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label="Hapus penambahan saldo"
                              className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                              onClick={() => handleDeleteTopup(m.id.replace("topup-", ""))}
                              disabled={isPending}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
