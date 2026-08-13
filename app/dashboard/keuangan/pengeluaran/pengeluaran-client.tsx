"use client";

import { useState, useMemo, useDeferredValue, useTransition } from "react";
import { Wallet, Pencil, Ban, Plus, AlertCircle, Check } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTable } from "@/hooks/use-table";
import DataTable, { type Column, type FilterDef } from "@/components/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  createPengeluaran,
  updatePengeluaran,
  voidPengeluaran,
} from "./actions";

function formatIDR(n: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
}

function formatDate(dateStr: string) {
  const date = new Date(`${dateStr}T00:00:00`);
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function todayStr() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

interface PengeluaranRecord {
  id: string;
  tanggal: string;
  id_kategori_beban: number;
  kategori_nama: string | null;
  kategori_kelompok: string | null;
  nama_pengeluaran: string;
  jumlah: number;
  metode_bayar: "Tunai" | "Transfer" | "QRIS";
  keterangan: string | null;
  status: "AKTIF" | "DIVOID";
  created_at: string | null;
  voided_at: string | null;
  alasan_void: string | null;
  id_pengguna: number;
}

interface KategoriBebanRecord {
  id: number;
  nama: string;
  kelompok: string | null;
}

type MetodeBayar = "Tunai" | "Transfer" | "QRIS";

interface FormState {
  tanggal: string;
  id_kategori_beban: string;
  nama_pengeluaran: string;
  jumlah: string;
  metode_bayar: MetodeBayar;
  keterangan: string;
}

const emptyForm: FormState = {
  tanggal: "",
  id_kategori_beban: "",
  nama_pengeluaran: "",
  jumlah: "",
  metode_bayar: "Tunai",
  keterangan: "",
};

const METODE_OPTIONS: { value: MetodeBayar; label: string }[] = [
  { value: "Tunai", label: "Tunai" },
  { value: "Transfer", label: "Transfer" },
  { value: "QRIS", label: "QRIS" },
];

function validateForm(form: FormState): string | null {
  if (!form.tanggal) return "Tanggal wajib diisi";
  if (!form.id_kategori_beban) return "Kategori beban wajib dipilih";
  if (!form.nama_pengeluaran.trim()) return "Nama pengeluaran wajib diisi";
  if (!form.jumlah || Number(form.jumlah) <= 0)
    return "Jumlah harus lebih dari 0";
  return null;
}

export default function PengeluaranClient({
  initialData,
  kategoriBeban,
}: {
  initialData: PengeluaranRecord[];
  kategoriBeban: KategoriBebanRecord[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [searchQuery, setSearchQuery] = useState("");
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const [kategoriFilter, setKategoriFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState({ start: "", end: "" });
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<PengeluaranRecord | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);

  const [voidTarget, setVoidTarget] = useState<PengeluaranRecord | null>(null);
  const [voidReason, setVoidReason] = useState("");

  const isVoided = (p: PengeluaranRecord) => p.status === "DIVOID";

  const filteredData = useMemo(() => {
    let result = [...initialData];

    if (deferredSearchQuery.trim()) {
      const q = deferredSearchQuery.toLowerCase();
      result = result.filter(
        (p) =>
          p.nama_pengeluaran.toLowerCase().includes(q) ||
          (p.kategori_nama ?? "").toLowerCase().includes(q)
      );
    }

    if (kategoriFilter !== "all") {
      result = result.filter(
        (p) => p.id_kategori_beban.toString() === kategoriFilter
      );
    }

    if (statusFilter !== "all") {
      result = result.filter((p) => p.status === statusFilter);
    }

    if (dateFilter.start) {
      const start = new Date(`${dateFilter.start}T00:00:00`);
      result = result.filter((p) => new Date(`${p.tanggal}T00:00:00`) >= start);
    }
    if (dateFilter.end) {
      const end = new Date(`${dateFilter.end}T23:59:59`);
      result = result.filter((p) => new Date(`${p.tanggal}T23:59:59`) <= end);
    }

    return result;
  }, [initialData, deferredSearchQuery, kategoriFilter, statusFilter, dateFilter]);

  const activeData = useMemo(() => {
    return filteredData.filter((p) => !isVoided(p));
  }, [filteredData]);

  const totalPengeluaran = useMemo(() => {
    return activeData.reduce((sum, p) => sum + Number(p.jumlah), 0);
  }, [activeData]);

  const totalTunai = useMemo(() => {
    return activeData
      .filter((p) => p.metode_bayar === "Tunai")
      .reduce((sum, p) => sum + Number(p.jumlah), 0);
  }, [activeData]);

  const table = useTable({ data: filteredData, defaultItemsPerPage: 25 });

  const handleOpenCreate = () => {
    setError(null);
    setSuccess(null);
    setEditing(null);
    setForm({ ...emptyForm, tanggal: todayStr() });
    setFormOpen(true);
  };

  const handleOpenEdit = (p: PengeluaranRecord) => {
    if (isVoided(p)) return;
    setError(null);
    setSuccess(null);
    setEditing(p);
    setForm({
      tanggal: (p.tanggal || "").slice(0, 10),
      id_kategori_beban: String(p.id_kategori_beban),
      nama_pengeluaran: p.nama_pengeluaran,
      jumlah: String(p.jumlah),
      metode_bayar: p.metode_bayar,
      keterangan: p.keterangan || "",
    });
    setFormOpen(true);
  };

  const handleCloseForm = () => {
    if (isPending) return;
    setFormOpen(false);
    setEditing(null);
    setForm(emptyForm);
    setError(null);
    setSuccess(null);
  };

  const handleSave = () => {
    const errMsg = validateForm(form);
    if (errMsg) {
      setError(errMsg);
      return;
    }

    setError(null);
    setSuccess(null);
    startTransition(async () => {
      const payload = {
        tanggal: form.tanggal,
        id_kategori_beban: Number(form.id_kategori_beban),
        nama_pengeluaran: form.nama_pengeluaran.trim(),
        jumlah: Number(form.jumlah),
        metode_bayar: form.metode_bayar,
        keterangan: form.keterangan.trim() || "",
      };

      const res = editing
        ? await updatePengeluaran({ id: editing.id, ...payload })
        : await createPengeluaran(payload);

      if (res.error) {
        setError(res.error);
      } else {
        setFormOpen(false);
        setEditing(null);
        setForm(emptyForm);
        setSuccess(editing ? "Pengeluaran berhasil diperbarui" : "Pengeluaran berhasil ditambahkan");
        router.refresh();
      }
    });
  };

  const handleOpenVoid = (p: PengeluaranRecord) => {
    if (isVoided(p)) return;
    setError(null);
    setVoidReason("");
    setVoidTarget(p);
  };

  const handleConfirmVoid = () => {
    if (!voidTarget) return;
    if (!voidReason.trim()) {
      setError("Alasan pembatalan wajib diisi");
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await voidPengeluaran(voidTarget.id, voidReason.trim());
      if (res.error) {
        setError(res.error);
      } else {
        setVoidTarget(null);
        setVoidReason("");
        setSuccess("Pengeluaran berhasil dibatalkan");
        router.refresh();
      }
    });
  };

  const filters: FilterDef[] = [
    {
      type: "select",
      label: "Kategori",
      value: kategoriFilter,
      onChange: setKategoriFilter,
      options: kategoriBeban.map((k) => ({
        value: String(k.id),
        label: k.nama,
      })),
    },
    {
      type: "select",
      label: "Status",
      value: statusFilter,
      onChange: setStatusFilter,
      options: [
        { value: "AKTIF", label: "AKTIF" },
        { value: "DIVOID", label: "DIVOID" },
      ],
      placeholder: "Semua Status",
    },
    {
      type: "date-range",
      start: dateFilter.start,
      end: dateFilter.end,
      onStartChange: (v) => setDateFilter((prev) => ({ ...prev, start: v })),
      onEndChange: (v) => setDateFilter((prev) => ({ ...prev, end: v })),
    },
  ];

  const statusBadge = (p: PengeluaranRecord) => {
    if (isVoided(p)) {
      return (
        <Badge
          variant="secondary"
          className="bg-destructive/10 text-destructive hover:bg-destructive/20 font-medium border-none rounded-full px-2 py-0.5 text-[10px] uppercase tracking-widest leading-tight line-through"
        >
          DIVOID
        </Badge>
      );
    }
    return (
      <Badge
        variant="secondary"
        className="bg-success/10 text-success hover:bg-success/20 font-medium border-none rounded-full px-2 py-0.5 text-[10px] uppercase tracking-widest leading-tight"
      >
        AKTIF
      </Badge>
    );
  };

  const rowText = (p: PengeluaranRecord, content: React.ReactNode) =>
    isVoided(p) ? (
      <span className="line-through text-muted-foreground/70">{content}</span>
    ) : (
      content
    );

  const columns: Column<PengeluaranRecord>[] = [
    {
      key: "tanggal",
      header: "Tanggal",
      sortable: true,
      className: "pl-6",
      headerClassName: "pl-6 w-[120px]",
      render: (p) => rowText(p, formatDate(p.tanggal)),
    },
    {
      key: "kategori",
      header: "Kategori",
      sortable: true,
      sortKey: "kategori_nama",
      headerClassName: "w-[140px]",
      render: (p) => rowText(p, p.kategori_nama || "-"),
    },
    {
      key: "nama_pengeluaran",
      header: "Nama Pengeluaran",
      sortable: true,
      render: (p) => (
        <span className="font-medium">
          {rowText(p, p.nama_pengeluaran)}
        </span>
      ),
    },
    {
      key: "jumlah",
      header: "Jumlah",
      sortable: true,
      headerClassName: "w-[140px] text-right",
      render: (p) => (
        <span className="tabular-nums">
          {rowText(p, formatIDR(p.jumlah))}
        </span>
      ),
    },
    {
      key: "metode_bayar",
      header: "Metode",
      sortable: true,
      headerClassName: "w-[110px]",
      render: (p) => rowText(p, p.metode_bayar),
    },
    {
      key: "status",
      header: "Status",
      sortable: true,
      headerClassName: "w-[110px] text-center",
      render: (p) => <div className="flex justify-center">{statusBadge(p)}</div>,
    },
    {
      key: "aksi",
      header: "",
      headerClassName: "w-[120px] pr-6",
      className: "pr-6",
      render: (p) => {
        if (isVoided(p)) return null;
        return (
          <div className="flex justify-end gap-1">
            <Button
              variant="ghost"
              size="icon"
              aria-label="Edit"
              className="h-11 w-11 md:h-8 md:w-8 rounded-full text-muted-foreground hover:text-primary hover:bg-primary/10"
              disabled={isPending}
              onClick={() => handleOpenEdit(p)}
            >
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Batalkan"
              className="h-11 w-11 md:h-8 md:w-8 rounded-full text-muted-foreground hover:text-destructive hover:bg-destructive/10"
              disabled={isPending}
              onClick={() => handleOpenVoid(p)}
            >
              <Ban className="h-4 w-4" />
            </Button>
          </div>
        );
      },
    },
  ];

  const kategoriOptions = kategoriBeban.map((k) => ({
    value: String(k.id),
    label: k.nama,
  }));

  const details = editing ? (
    <>
      <div className="flex justify-between">
        <span className="text-muted-foreground">Kategori</span>
        <span className="font-medium text-right">
          {editing.kategori_nama || "-"}
        </span>
      </div>
      <div className="flex justify-between">
        <span className="text-muted-foreground">Tanggal</span>
        <span>{formatDate(editing.tanggal)}</span>
      </div>
      <div className="flex justify-between">
        <span className="text-muted-foreground">Nama</span>
        <span className="font-medium text-right">
          {editing.nama_pengeluaran}
        </span>
      </div>
      <div className="flex justify-between">
        <span className="text-muted-foreground">Metode</span>
        <span>{editing.metode_bayar}</span>
      </div>
      <div className="flex justify-between">
        <span className="text-muted-foreground">Jumlah</span>
        <span className="font-semibold tabular-nums">
          {formatIDR(editing.jumlah)}
        </span>
      </div>
    </>
  ) : null;

  return (
    <>
      <DataTable
        data={table.paginatedData}
        total={table.total}
        columns={columns}
        rowKey={(p) => p.id}
        search={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder="Cari nama / kategori..."
        sortConfig={table.sortConfig}
        onSort={table.handleSort}
        currentPage={table.currentPage}
        onPageChange={table.setCurrentPage}
        itemsPerPage={table.itemsPerPage}
        onItemsPerPageChange={table.setItemsPerPage}
        filters={filters}
        errorBanner={success ? null : error}
        actions={[
          {
            label: "Tambah Pengeluaran",
            kind: "primary",
            icon: <Plus className="h-4 w-4" />,
            onClick: handleOpenCreate,
          },
          {
            label: "Reset",
            variant: "outline",
            onClick: () => {
              setSearchQuery("");
              setKategoriFilter("all");
              setStatusFilter("all");
              setDateFilter({ start: "", end: "" });
              setError(null);
            },
          },
        ]}
        topContent={
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-muted/30 rounded-xl p-4 border border-border/50">
              <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-widest mb-1">
                Total Pengeluaran (AKTIF)
              </p>
              <p className="text-2xl font-light tracking-tight text-foreground tabular-nums">
                {formatIDR(totalPengeluaran)}
              </p>
            </div>
            <div className="bg-muted/30 rounded-xl p-4 border border-border/50">
              <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-widest mb-1">
                Tunai (Laci)
              </p>
              <p className="text-2xl font-light tracking-tight text-foreground tabular-nums">
                {formatIDR(totalTunai)}
              </p>
            </div>
            <div className="bg-muted/30 rounded-xl p-4 border border-border/50">
              <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-widest mb-1">
                Jumlah Catatan
              </p>
              <p className="text-2xl font-light tracking-tight text-foreground tabular-nums">
                {activeData.length}
              </p>
            </div>
          </div>
        }
        emptyState={{
          icon: Wallet,
          title: "Belum ada pengeluaran",
          description: "Gunakan tombol 'Tambah Pengeluaran' untuk mencatat beban operasional.",
        }}
      />

      {success && !error && (
        <div className="fixed bottom-5 right-5 z-50 flex items-center gap-2 px-4 py-3 rounded-xl bg-success/10 text-success border border-success/20 shadow-lg">
          <Check className="h-4 w-4 shrink-0" />
          <span className="text-sm font-medium">{success}</span>
          <button
            aria-label="Tutup notifikasi"
            onClick={() => setSuccess(null)}
            className="ml-2 text-muted-foreground hover:text-foreground"
          >
            &times;
          </button>
        </div>
      )}

      {/* Create / Edit Dialog */}
      <Dialog
        open={formOpen}
        onOpenChange={(open) => {
          if (!open) handleCloseForm();
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editing ? "Edit Pengeluaran" : "Tambah Pengeluaran"}
            </DialogTitle>
            <DialogDescription>
              {editing
                ? "Ubah data pengeluaran operasional."
                : "Catat pengeluaran operasional (beban) toko."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="field-tanggal">
                Tanggal <span className="text-destructive">*</span>
              </Label>
              <Input
                id="field-tanggal"
                type="date"
                value={form.tanggal}
                onChange={(e) => setForm((f) => ({ ...f, tanggal: e.target.value }))}
                disabled={isPending}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="field-kategori">
                Kategori Beban <span className="text-destructive">*</span>
              </Label>
              <Select
                id="field-kategori"
                value={form.id_kategori_beban}
                onChange={(e) =>
                  setForm((f) => ({ ...f, id_kategori_beban: e.target.value }))
                }
                disabled={isPending}
              >
                <option value="">Pilih kategori...</option>
                {kategoriOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="field-nama">
                Nama Pengeluaran <span className="text-destructive">*</span>
              </Label>
              <Input
                id="field-nama"
                placeholder="Contoh: Gaji karyawan bulanan"
                value={form.nama_pengeluaran}
                onChange={(e) =>
                  setForm((f) => ({ ...f, nama_pengeluaran: e.target.value }))
                }
                disabled={isPending}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="field-jumlah">
                  Jumlah (Rp) <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="field-jumlah"
                  type="number"
                  min="0"
                  placeholder="0"
                  value={form.jumlah}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, jumlah: e.target.value }))
                  }
                  disabled={isPending}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="field-metode">Metode Bayar</Label>
                <Select
                  id="field-metode"
                  value={form.metode_bayar}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      metode_bayar: e.target.value as MetodeBayar,
                    }))
                  }
                  disabled={isPending}
                >
                  {METODE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="field-keterangan">Keterangan</Label>
              <textarea
                id="field-keterangan"
                rows={3}
                placeholder="Opsional"
                value={form.keterangan}
                onChange={(e) =>
                  setForm((f) => ({ ...f, keterangan: e.target.value }))
                }
                disabled={isPending}
                className="flex w-full rounded-[6px] border border-input bg-background px-3 py-2 text-sm shadow-xs transition-[color,box-shadow] outline-none placeholder:text-muted-foreground focus-visible:border-primary focus-visible:ring-[3px] focus-visible:ring-primary/20 disabled:pointer-events-none disabled:opacity-50"
              />
            </div>

            {error && (
              <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg p-3">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {error}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              className="rounded-full px-6 bg-background"
              disabled={isPending}
              onClick={handleCloseForm}
            >
              Batal
            </Button>
            <Button
              className="rounded-full px-6"
              disabled={isPending}
              onClick={handleSave}
            >
              {isPending && (
                <span className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
              )}
              {editing ? "Simpan Perubahan" : "Simpan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Void Dialog */}
      <Dialog
        open={voidTarget !== null}
        onOpenChange={(open) => {
          if (!open && !isPending) setVoidTarget(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Ban className="h-5 w-5 text-destructive" />
              Batalkan Pengeluaran
            </DialogTitle>
            <DialogDescription>
              Apakah Anda yakin membatalkan pengeluaran ini? Catatan akan ditandai DIVOID dan tidak lagi dihitung dalam laporan.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {voidTarget && (
              <div className="bg-muted/30 rounded-xl p-4 border border-border/50 space-y-1.5 text-sm">
                {details}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="void-alasan">
                Alasan Pembatalan <span className="text-destructive">*</span>
              </Label>
              <textarea
                id="void-alasan"
                rows={3}
                placeholder="Wajib diisi"
                value={voidReason}
                onChange={(e) => setVoidReason(e.target.value)}
                disabled={isPending}
                className="flex w-full rounded-[6px] border border-input bg-background px-3 py-2 text-sm shadow-xs transition-[color,box-shadow] outline-none placeholder:text-muted-foreground focus-visible:border-primary focus-visible:ring-[3px] focus-visible:ring-primary/20 disabled:pointer-events-none disabled:opacity-50"
              />
            </div>
            {error && (
              <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg p-3">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {error}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              className="rounded-full px-6 bg-background"
              disabled={isPending}
              onClick={() => {
                setVoidTarget(null);
                setVoidReason("");
                setError(null);
              }}
            >
              Batal
            </Button>
            <Button
              variant="destructive"
              className="rounded-full px-6"
              disabled={isPending}
              onClick={handleConfirmVoid}
            >
              {isPending && (
                <span className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
              )}
              Ya, Batalkan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}