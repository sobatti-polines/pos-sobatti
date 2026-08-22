"use client";

import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import {
  useForm,
  FormProvider,
} from "react-hook-form";
import {
  Plus,
  Trash2,
  Check,
  AlertCircle,
  PackagePlus,
  Loader2,
  Upload,
  RefreshCw,
  ArrowRight,
  ArrowLeft,
  FileText,
  Send,
  X,
  AlertTriangle,
  Download,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  createSesiOpname,
  saveOpnameDraft,
  refreshSnapshot,
  applyOpname,
  batalkanOpname,
} from "./actions";
import { z } from "zod";
import ImportCSVModal from "@/components/import-csv-modal";
import { exportToCSV } from "@/lib/export-utils";

/* ------------------------------------------------------------------ */
/*  Zod schemas                                                        */
/* ------------------------------------------------------------------ */

const startSchema = z.object({
  tgl_sesi: z.string().min(1, "Tanggal harus diisi"),
  keterangan: z.string().optional(),
});

type StartFormValues = z.infer<typeof startSchema>;

/* ------------------------------------------------------------------ */
/*  Inline zodResolver                                                 */
/* ------------------------------------------------------------------ */

function makeResolver(schema: z.ZodType) {
  return (values: unknown) => {
    const result = schema.safeParse(values);
    if (result.success) {
      return { values: result.data, errors: {} };
    }
    const fieldErrors: Record<string, { type: string; message: string }> = {};
    for (const issue of result.error.issues) {
      const path = issue.path.join(".");
      if (!fieldErrors[path]) {
        fieldErrors[path] = { type: "validation", message: issue.message };
      }
    }
    return { values: {} as Record<string, never>, errors: fieldErrors };
  };
}

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface Product {
  id: number;
  nama_produk: string;
  stok: number | null;
  stok_gudang: number | null;
  barcode: string | null;
  sku?: string | null;
  lokasi_area: { nama: string } | null;
}

interface SesiInfo {
  id: string;
  no_sesi: string;
  tgl_sesi: string;
  keterangan: string | null;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

const inputBase =
  "w-full h-9 rounded-md border border-input bg-background px-3 py-1.5 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/20 focus-visible:border-primary disabled:opacity-50 disabled:cursor-not-allowed";

const KLASIFIKASI_OPTIONS = [
  { value: "", label: "-" },
  { value: "KELEBIHAN", label: "Kelebihan" },
  { value: "SALAH_CATAT", label: "Salah Catat" },
  { value: "RUSAK", label: "Rusak" },
  { value: "HILANG", label: "Hilang" },
  { value: "LAINNYA", label: "Lainnya" },
];

function formatIDR(n: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(n);
}

function formatDate(d: string): string {
  return new Date(d + "T00:00:00").toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/* ------------------------------------------------------------------ */
/*  ProductCombo — search-and-select combobox                          */
/* ------------------------------------------------------------------ */

function ProductCombo({
  selectedProductId,
  products,
  onSelect,
}: {
  selectedProductId: number;
  products: Product[];
  onSelect: (product: Product) => void;
}) {
  const [searchText, setSearchText] = useState("");
  const [open, setOpen] = useState(false);
  const [highlightIdx, setHighlightIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const prevProductIdRef = useRef<number | undefined>(undefined);

  const selectedProduct = useMemo(
    () => products.find((p) => p.id === selectedProductId),
    [selectedProductId, products]
  );

  useEffect(() => {
    if (selectedProduct && selectedProductId !== prevProductIdRef.current) {
      setSearchText(selectedProduct.nama_produk);
    }
    prevProductIdRef.current = selectedProductId;
  }, [selectedProductId, selectedProduct]);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (
        inputRef.current &&
        !inputRef.current.contains(e.target as Node) &&
        listRef.current &&
        !listRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const filtered = useMemo(() => {
    if (!searchText.trim()) return products.slice(0, 50);
    const q = searchText.toLowerCase();
    return products
      .filter(
        (p) =>
          p.nama_produk.toLowerCase().includes(q) ||
          p.barcode?.toLowerCase().includes(q)
      )
      .slice(0, 80);
  }, [searchText, products]);

  const selectProduct = useCallback(
    (product: Product) => {
      setSearchText(product.nama_produk);
      setOpen(false);
      onSelect(product);
    },
    [onSelect]
  );

  const handleInputChange = (value: string) => {
    setSearchText(value);
    setHighlightIdx(0);
    setOpen(true);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (searchText) {
        const exactMatch = products.find((p) => p.barcode === searchText);
        if (exactMatch) {
          selectProduct(exactMatch);
          return;
        }
      }
      if (!open) {
        setOpen(true);
        return;
      }
      if (filtered[highlightIdx]) {
        selectProduct(filtered[highlightIdx]);
      }
      return;
    }
    if (!open) {
      if (e.key === "ArrowDown") {
        setOpen(true);
        e.preventDefault();
      }
      return;
    }
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setHighlightIdx((i) => Math.min(i + 1, filtered.length - 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setHighlightIdx((i) => Math.max(i - 1, 0));
        break;
      case "Escape":
        setOpen(false);
        break;
    }
  };

  return (
    <div className="relative min-w-[200px]">
      <input
        ref={inputRef}
        value={searchText}
        onChange={(e) => handleInputChange(e.target.value)}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKeyDown}
        placeholder="Cari produk..."
        className={inputBase + " tabular-nums"}
        autoComplete="off"
      />
      {selectedProduct && selectedProduct.sku && (
        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">
          {selectedProduct.sku}
        </span>
      )}
      {open && filtered.length > 0 && (
        <div
          ref={listRef}
          className="absolute z-20 top-full left-0 right-0 mt-1 bg-background border border-border rounded-md shadow-[0_8px_24px_rgba(0,55,112,0.08)] max-h-56 overflow-y-auto"
        >
          {filtered.map((p, i) => (
            <button
              type="button"
              key={p.id}
              className={`w-full text-left px-3 py-2 text-sm flex items-center justify-between gap-2 transition-colors ${
                i === highlightIdx
                  ? "bg-primary/10 text-primary"
                  : "hover:bg-muted text-foreground"
              }`}
              onMouseDown={() => selectProduct(p)}
              onMouseEnter={() => setHighlightIdx(i)}
            >
              <span className="truncate">{p.nama_produk}</span>
              <span className="text-[11px] text-muted-foreground tabular-nums shrink-0 flex flex-col items-end gap-0">
                <span>Stok: {(p.stok ?? 0) + (p.stok_gudang ?? 0)}</span>
                {p.lokasi_area?.nama && <span className="text-[10px]">{p.lokasi_area.nama}</span>}
              </span>
            </button>
          ))}
        </div>
      )}
      {open && filtered.length === 0 && (
        <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-background border border-border rounded-md shadow-md p-3 text-sm text-muted-foreground">
          Tidak ada produk ditemukan
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  STEP 1 — Mulai Sesi                                                */
/* ------------------------------------------------------------------ */

function Step1({ onStart, loading }: { onStart: (v: StartFormValues) => void; loading: boolean }) {
  const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Jakarta" });

  const form = useForm<StartFormValues>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: makeResolver(startSchema) as any,
    mode: "onSubmit",
    defaultValues: { tgl_sesi: today, keterangan: "" },
  });

  return (
    <div className="flex flex-col items-center justify-center py-12 px-6">
      <FileText className="w-14 h-14 text-primary/30 mb-4" />
      <h2 className="text-xl font-light tracking-tight text-foreground mb-1">
        Mulai Sesi Stok Opname
      </h2>
      <p className="text-sm text-muted-foreground mb-8 text-center max-w-md">
        Buat sesi baru untuk mencatat hasil penghitungan fisik stok.
        Stok sistem akan di-snapshot saat Anda menyimpan draft.
      </p>

      <FormProvider {...form}>
        <form
          onSubmit={form.handleSubmit(onStart)}
          className="w-full max-w-sm flex flex-col gap-5"
        >
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="tgl_sesi"
              className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider"
            >
              Tanggal Opname
            </label>
            <input
              id="tgl_sesi"
              type="date"
              {...form.register("tgl_sesi")}
              className="h-10 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/20 focus-visible:border-primary"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="keterangan"
              className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider"
            >
              Keterangan (opsional)
            </label>
            <input
              id="keterangan"
              {...form.register("keterangan")}
              placeholder="Contoh: Opname bulanan Agustus 2026"
              className="h-10 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/20 focus-visible:border-primary"
            />
          </div>

          <Button
            type="submit"
            disabled={loading}
            className="rounded-full px-8 h-11 w-full bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm disabled:opacity-50 disabled:cursor-not-allowed mt-2"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Membuat Sesi...
              </>
            ) : (
              <>
                Mulai Opname
                <ArrowRight className="w-4 h-4 ml-2" />
              </>
            )}
          </Button>
        </form>
      </FormProvider>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  STEP 2 — Input Fisik                                               */
/* ------------------------------------------------------------------ */

interface Step2Item {
  id?: number;
  id_produk: number;
  stok_sistem: number;
  stok_sistem_gudang: number;
  stok_fisik: number;
  stok_fisik_gudang: number;
  klasifikasi: string;
  keterangan: string;
}

function Step2({
  sesi,
  products,
  initialItems,
  onBack,
  onReview,
  onCancel,
}: {
  sesi: SesiInfo;
  products: Product[];
  initialItems: Step2Item[];
  onBack: () => void;
  onReview: () => void;
  onCancel: () => void;
}) {
  const [items, setItems] = useState<Step2Item[]>(initialItems);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [serverError, setServerError] = useState("");
  const [success, setSuccess] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);

  const addItem = () => {
    setItems((prev) => [
      ...prev,
      { id_produk: 0, stok_sistem: 0, stok_sistem_gudang: 0, stok_fisik: 0, stok_fisik_gudang: 0, klasifikasi: "", keterangan: "" },
    ]);
  };

  const removeItem = (idx: number) => {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  };

  const updateItem = (idx: number, field: keyof Step2Item, value: number | string) => {
    setItems((prev) =>
      prev.map((item, i) => (i === idx ? { ...item, [field]: value } : item))
    );
  };

  const handleProductSelect = useCallback(
    (idx: number, product: Product) => {
      setItems((prev) =>
        prev.map((item, i) =>
          i === idx
            ? { ...item, id_produk: product.id, stok_sistem: product.stok ?? 0, stok_sistem_gudang: product.stok_gudang ?? 0 }
            : item
        )
      );
    },
    []
  );

  const handleRefresh = async () => {
    setLoading(true);
    setServerError("");
    const res = await refreshSnapshot(sesi.id);
    if (res?.error) {
      setServerError(res.error);
    } else {
      // Re-fetch stok from products
      setItems((prev) =>
        prev.map((item) => {
          const p = products.find((pp) => pp.id === item.id_produk);
          return p ? { ...item, stok_sistem: p.stok ?? 0, stok_sistem_gudang: p.stok_gudang ?? 0 } : item;
        })
      );
      setSuccess(true);
      setTimeout(() => setSuccess(false), 2000);
    }
    setLoading(false);
  };

  const handleSaveDraft = async () => {
    setSaving(true);
    setServerError("");
    const validItems = items.filter((i) => i.id_produk > 0);
    if (validItems.length === 0) {
      setServerError("Tidak ada produk yang dipilih");
      setSaving(false);
      return;
    }
    const res = await saveOpnameDraft({
      id_sesi: sesi.id,
      items: validItems.map((i) => ({
        id_produk: i.id_produk,
        stok_fisik: i.stok_fisik,
        klasifikasi: i.klasifikasi || null,
        keterangan: i.keterangan,
      })),
    });
    if (res?.error) {
      setServerError(res.error);
    } else {
      setSuccess(true);
      setTimeout(() => setSuccess(false), 2000);
    }
    setSaving(false);
  };

  const handleCancel = async () => {
    setCancelling(true);
    setServerError("");
    const res = await batalkanOpname(sesi.id);
    if (res?.error) {
      setServerError(res.error);
      setCancelling(false);
    } else {
      onCancel();
    }
  };

  const handleExportCSV = () => {
    // Header SAMA dengan template import stok opname agar bisa round-trip
    // (export draft → isi/edit → import ulang).
    const headers = ["SKU / Barcode", "Fisik Display", "Fisik Gudang", "Keterangan"];
    const data = items
      .filter((i) => i.id_produk > 0)
      .map((item) => {
        const p = products.find((pp) => pp.id === item.id_produk);
        const code = p?.sku || p?.barcode || (p ? `#${p.id}` : "");
        return [code, item.stok_fisik, item.stok_fisik_gudang, item.keterangan || ""];
      });
    exportToCSV(`Stok_Opname_${sesi.no_sesi}`, headers, data);
  };

  const handleImportCSV = async (rows: Record<string, string>[]) => {
    let added = 0;
    for (const r of rows) {
      const code = (
        r["SKU / Barcode"] ||
        r["Barcode"] ||
        r["SKU"] ||
        r["Nama Produk"] ||
        ""
      )
        .trim()
        .toLowerCase();
      const stokFisikNum = parseFloat(r["Fisik Display"] || r["stok_fisik"] || "0");
      const stokFisikGudangNum = parseFloat(r["Fisik Gudang"] || r["stok_fisik_gudang"] || "0");
      const ket = (r["Keterangan"] || r["keterangan"] || "").trim();
      if (!code) continue;

      const matched = products.find(
        (p) =>
          (p.barcode && p.barcode.toLowerCase() === code) ||
          (p.sku && p.sku.toLowerCase() === code) ||
          p.nama_produk.toLowerCase() === code ||
          p.nama_produk.toLowerCase().includes(code)
      );

      if (matched) {
        setItems((prev) => [
          ...prev,
          {
            id_produk: matched.id,
            stok_sistem: matched.stok ?? 0,
            stok_sistem_gudang: matched.stok_gudang ?? 0,
            stok_fisik: isNaN(stokFisikNum) ? 0 : stokFisikNum,
            stok_fisik_gudang: isNaN(stokFisikGudangNum) ? 0 : stokFisikGudangNum,
            klasifikasi: "",
            keterangan: ket,
          },
        ]);
        added++;
      }
    }
    return added > 0
      ? { success: true, count: added, message: `${added} baris ditambahkan` }
      : { error: "Tidak ada produk cocok" };
  };

  const totalSelisih = useMemo(
    () => items.reduce((sum, i) => sum + ((i.stok_fisik || 0) - (i.stok_sistem || 0)) + ((i.stok_fisik_gudang || 0) - (i.stok_sistem_gudang || 0)), 0),
    [items]
  );

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Header bar */}
      <div className="shrink-0 flex flex-col md:flex-row md:items-center justify-between gap-3 px-6 py-4 border-b border-border bg-muted/30">
        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onBack}
            className="rounded-full gap-1.5 text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="w-4 h-4" />
            Kembali
          </Button>
          <div className="h-5 w-px bg-border" />
          <div>
            <p className="text-sm font-medium text-foreground">{sesi.no_sesi}</p>
            <p className="text-[11px] text-muted-foreground">
              {formatDate(sesi.tgl_sesi)} • Status: DRAFT
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={loading}
            className="rounded-full gap-1.5"
          >
            {loading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <RefreshCw className="w-3.5 h-3.5" />
            )}
            Muat Ulang Stok
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleExportCSV}
            className="rounded-full gap-1.5"
          >
            <Download className="w-3.5 h-3.5" />
            Export CSV
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setIsImportOpen(true)}
            className="rounded-full gap-1.5"
          >
            <Upload className="w-3.5 h-3.5" />
            Import CSV
          </Button>
          <div className="h-5 w-px bg-border" />
          <Button
            type="button"
            variant="destructive"
            size="sm"
            onClick={handleCancel}
            disabled={cancelling}
            className="rounded-full gap-1.5"
          >
            {cancelling ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <X className="w-3.5 h-3.5" />
            )}
            Batalkan Sesi
          </Button>
        </div>
      </div>

      {/* Error / Success banners */}
      {serverError && (
        <div className="shrink-0 flex items-center gap-2 px-6 py-3 bg-destructive/10 text-destructive text-sm border-b border-border">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {serverError}
        </div>
      )}
      {success && (
        <div className="shrink-0 flex items-center gap-2 px-6 py-3 bg-emerald-50 text-emerald-700 text-sm border-b border-border">
          <Check className="w-4 h-4 shrink-0" />
          Berhasil disimpan
        </div>
      )}

      {/* Table */}
      <div className="flex-1 overflow-auto min-h-0">
        <table className="w-full min-w-[800px]">
          <thead>
            <tr className="border-b border-border/60 bg-muted/80 backdrop-blur-md sticky top-0 z-10">
              <th className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider h-10 w-10 text-center px-2">#</th>
              <th className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider h-10 text-left px-2">Produk</th>
              <th className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider h-10 text-left px-2 w-[120px]">Lokasi</th>
              <th className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider h-10 text-center px-2">Sistem (Disp / Gdg)</th>
              <th className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider h-10 text-center px-2">Fisik (Disp / Gdg)</th>
              <th className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider h-10 text-center px-2">Selisih (Disp / Gdg)</th>
              <th className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider h-10 text-center w-[130px] px-2">Klasifikasi</th>
              <th className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider h-10 text-left w-[140px] px-2">Keterangan</th>
              <th className="w-10 px-2" />
            </tr>
          </thead>
          <tbody>
            {items.map((item, idx) => {
              const selisih = (item.stok_fisik || 0) - (item.stok_sistem || 0);
              const selisihGudang = (item.stok_fisik_gudang || 0) - (item.stok_sistem_gudang || 0);
              return (
                <tr
                  key={idx}
                  className="border-b border-border/40 hover:bg-muted/20 transition-colors"
                >
                  <td className="text-center text-sm text-muted-foreground tabular-nums px-2 py-2 align-top pt-4">
                    {idx + 1}
                  </td>
                  <td className="px-2 py-2">
                    <ProductCombo
                      selectedProductId={item.id_produk}
                      products={products}
                      onSelect={(p) => handleProductSelect(idx, p)}
                    />
                  </td>
                  <td className="px-2 py-2 text-sm text-muted-foreground align-top pt-4">
                    {products.find((p) => p.id === item.id_produk)?.lokasi_area?.nama || "-"}
                  </td>
                  <td className="px-2 py-2 text-center align-top pt-4">
                    <div className="flex items-center justify-center gap-2">
                      <span className="tabular-nums font-medium text-foreground">{item.stok_sistem || 0}</span>
                      <span className="text-muted-foreground">/</span>
                      <span className="tabular-nums font-medium text-foreground">{item.stok_sistem_gudang || 0}</span>
                    </div>
                  </td>
                  <td className="px-2 py-2">
                    <div className="flex items-center justify-center gap-1">
                      <input
                        type="number"
                        min={0}
                        step="any"
                        value={item.stok_fisik || ""}
                        onChange={(e) => updateItem(idx, "stok_fisik", parseFloat(e.target.value) || 0)}
                        className={inputBase + " tabular-nums font-medium text-center w-16 px-1"}
                        title="Fisik Display"
                      />
                      <span className="text-muted-foreground">/</span>
                      <input
                        type="number"
                        min={0}
                        step="any"
                        value={item.stok_fisik_gudang || ""}
                        onChange={(e) => updateItem(idx, "stok_fisik_gudang", parseFloat(e.target.value) || 0)}
                        className={inputBase + " tabular-nums font-medium text-center w-16 px-1"}
                        title="Fisik Gudang"
                      />
                    </div>
                  </td>
                  <td className="px-2 py-2 text-center align-top pt-4">
                    <div className="flex items-center justify-center gap-2">
                      <span
                        className={`tabular-nums font-semibold px-2 py-0.5 rounded-full text-[12px] ${
                          selisih > 0
                            ? "bg-emerald-50 text-emerald-600"
                            : selisih < 0
                            ? "bg-destructive/10 text-destructive"
                            : "bg-muted text-muted-foreground"
                        }`}
                        title="Selisih Display"
                      >
                        {selisih > 0 ? `+${selisih}` : selisih}
                      </span>
                      <span
                        className={`tabular-nums font-semibold px-2 py-0.5 rounded-full text-[12px] ${
                          selisihGudang > 0
                            ? "bg-emerald-50 text-emerald-600"
                            : selisihGudang < 0
                            ? "bg-destructive/10 text-destructive"
                            : "bg-muted text-muted-foreground"
                        }`}
                        title="Selisih Gudang"
                      >
                        {selisihGudang > 0 ? `+${selisihGudang}` : selisihGudang}
                      </span>
                    </div>
                  </td>
                  <td className="px-2 py-2">
                    <select
                      value={item.klasifikasi || ""}
                      onChange={(e) => updateItem(idx, "klasifikasi", e.target.value)}
                      className={inputBase + " h-9 text-center"}
                    >
                      {KLASIFIKASI_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-2 py-2">
                    <input
                      value={item.keterangan || ""}
                      onChange={(e) => updateItem(idx, "keterangan", e.target.value)}
                      placeholder="Catatan"
                      className={inputBase}
                    />
                  </td>
                  <td className="px-2 py-2 text-center align-top pt-4">
                    <button
                      type="button"
                      onClick={() => removeItem(idx)}
                      disabled={items.length <= 1}
                      className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                      title="Hapus baris"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {items.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
            <PackagePlus className="w-12 h-12 mb-4 opacity-20" />
            <p className="text-base font-medium text-foreground">Belum ada item</p>
            <p className="text-sm mt-1">Tambah item untuk mencatat stok opname</p>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="shrink-0 flex flex-col md:flex-row md:items-center md:justify-between gap-3 md:gap-4 px-6 py-4 border-t border-border bg-background">
        <div className="flex flex-col md:flex-row md:items-center gap-2 w-full md:w-max">
          <Button
            type="button"
            variant="ghost"
            className="rounded-full px-4 h-9 w-full md:w-auto text-muted-foreground hover:text-foreground"
            onClick={addItem}
          >
            <Plus className="w-4 h-4 mr-1.5" />
            Tambah Baris
          </Button>
        </div>

        <div className="flex flex-col md:flex-row md:items-center gap-3 md:gap-4 md:justify-end">
          <div className="text-right">
            <p className="text-[11px] text-muted-foreground uppercase tracking-wider">Total Item</p>
            <p className="text-lg font-light tabular-nums text-foreground">{items.length}</p>
          </div>
          <div className="text-right">
            <p className="text-[11px] text-muted-foreground uppercase tracking-wider">Total Selisih</p>
            <p
              className={`text-lg font-light tabular-nums ${
                totalSelisih > 0
                  ? "text-emerald-600"
                  : totalSelisih < 0
                  ? "text-destructive"
                  : "text-foreground"
              }`}
            >
              {totalSelisih > 0 ? `+${totalSelisih}` : totalSelisih}
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={saving || items.filter((i) => i.id_produk > 0).length === 0}
              onClick={handleSaveDraft}
              className="rounded-full px-5 h-10"
            >
              {saving ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : null}
              Simpan Draft
            </Button>
            <Button
              type="button"
              onClick={onReview}
              disabled={items.filter((i) => i.id_produk > 0).length === 0}
              className="rounded-full px-5 h-10 bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Review & Terapkan
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </div>
      </div>

      <ImportCSVModal
        open={isImportOpen}
        onOpenChange={setIsImportOpen}
        title="Import Hasil Stok Opname dari CSV"
        description="Unggah file Excel (.xlsx) atau CSV berisi hasil penghitungan fisik lapangan (SKU / Barcode, Stok Fisik, Keterangan)."
        templateFilename="Template_Import_Stok_Opname"
        templateHeaders={["SKU / Barcode", "Stok Fisik", "Keterangan"]}
        sampleRows={[
          ["SMN-GRS-50", "48", "2 zak rusak / bocor"],
          ["PKU-KY-03", "18", "Hitungan fisik gudang"],
        ]}
        validateRow={(row) => {
          const code = (row["SKU / Barcode"] || row["Barcode"] || row["SKU"] || row["Nama Produk"] || "").trim();
          if (!code) return "SKU / Barcode wajib diisi";
          return null;
        }}
        onImport={handleImportCSV}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  STEP 3 — Review & Terapkan                                         */
/* ------------------------------------------------------------------ */

function Step3({
  sesi,
  items,
  products,
  onBack,
  onComplete,
}: {
  sesi: SesiInfo;
  items: Step2Item[];
  products: Product[];
  onBack: () => void;
  onComplete: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);

  const validItems = items.filter((i) => i.id_produk > 0);

  const enriched = useMemo(() => {
    return validItems.map((item) => {
      const p = products.find((pp) => pp.id === item.id_produk);
      const selisih = ((item.stok_fisik || 0) - (item.stok_sistem || 0)) + ((item.stok_fisik_gudang || 0) - (item.stok_sistem_gudang || 0));
      const selisihDisplay = (item.stok_fisik || 0) - (item.stok_sistem || 0);
      const selisihGudang = (item.stok_fisik_gudang || 0) - (item.stok_sistem_gudang || 0);
      const hargaSnap = 0; // Will be fetched from DB on apply
      const nilaiRp = selisih * hargaSnap;
      return {
        ...item,
        nama_produk: p?.nama_produk || "Produk dihapus",
        lokasi: p?.lokasi_area?.nama || "-",
        selisih,
        selisihDisplay,
        selisihGudang,
        nilai_rp: nilaiRp,
      };
    });
  }, [validItems, products]);

  const totalSelisih = enriched.reduce((s, i) => s + i.selisih, 0);

  // Breakdown per klasifikasi
  const breakdown = useMemo(() => {
    const map: Record<string, { count: number; nilai: number }> = {};
    for (const item of enriched) {
      const k = item.klasifikasi || "LAINNYA";
      if (!map[k]) map[k] = { count: 0, nilai: 0 };
      map[k].count++;
      map[k].nilai += item.nilai_rp;
    }
    return Object.entries(map);
  }, [enriched]);

  const handleApply = async () => {
    setLoading(true);
    setError("");
    const res = await applyOpname(sesi.id);
    if (res?.error) {
      setError(res.error);
      setLoading(false);
    } else {
      onComplete();
    }
  };

  const handleBatalkan = async () => {
    setLoading(true);
    setError("");
    const res = await batalkanOpname(sesi.id);
    if (res?.error) {
      setError(res.error);
      setLoading(false);
    } else {
      onComplete();
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-auto">
      {/* Header bar */}
      <div className="shrink-0 flex items-center gap-3 px-6 py-4 border-b border-border bg-muted/30">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onBack}
          className="rounded-full gap-1.5 text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="w-4 h-4" />
          Kembali
        </Button>
        <div className="h-5 w-px bg-border" />
        <div>
          <p className="text-sm font-medium text-foreground">Review: {sesi.no_sesi}</p>
          <p className="text-[11px] text-muted-foreground">{formatDate(sesi.tgl_sesi)}</p>
        </div>
      </div>

      {error && (
        <div className="shrink-0 flex items-center gap-2 px-6 py-3 bg-destructive/10 text-destructive text-sm border-b border-border">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      <div className="flex-1 overflow-auto p-6 space-y-6">
        {/* Ringkasan */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-background border border-border rounded-xl p-4">
            <p className="text-[11px] text-muted-foreground uppercase tracking-wider">Total Item</p>
            <p className="text-2xl font-light tabular-nums text-foreground">{enriched.length}</p>
          </div>
          <div className="bg-background border border-border rounded-xl p-4">
            <p className="text-[11px] text-muted-foreground uppercase tracking-wider">Total Selisih</p>
            <p
              className={`text-2xl font-light tabular-nums ${
                totalSelisih > 0 ? "text-emerald-600" : totalSelisih < 0 ? "text-destructive" : "text-foreground"
              }`}
            >
              {totalSelisih > 0 ? `+${totalSelisih}` : totalSelisih}
            </p>
          </div>
          <div className="bg-background border border-border rounded-xl p-4">
            <p className="text-[11px] text-muted-foreground uppercase tracking-wider">Surplus (Rp)</p>
            <p className="text-2xl font-light tabular-nums text-emerald-600">
              {formatIDR(enriched.filter((i) => i.selisih > 0).reduce((s, i) => s + i.nilai_rp, 0))}
            </p>
          </div>
          <div className="bg-background border border-border rounded-xl p-4">
            <p className="text-[11px] text-muted-foreground uppercase tracking-wider">Defisit (Rp)</p>
            <p className="text-2xl font-light tabular-nums text-destructive">
              {formatIDR(enriched.filter((i) => i.selisih < 0).reduce((s, i) => s + i.nilai_rp, 0))}
            </p>
          </div>
        </div>

        {/* Breakdown per klasifikasi */}
        {breakdown.length > 0 && (
          <div className="bg-background border border-border rounded-xl p-5">
            <h3 className="text-sm font-medium text-foreground mb-3">Breakdown per Klasifikasi</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {breakdown.map(([key, val]) => (
                <div key={key} className="flex items-center justify-between p-3 bg-muted/40 rounded-lg">
                  <span className="text-sm text-foreground">{key}</span>
                  <div className="text-right">
                    <span className="text-sm font-medium tabular-nums">{val.count} item</span>
                    <span className="text-xs text-muted-foreground ml-2 tabular-nums">{formatIDR(val.nilai)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Detail per produk */}
        <div className="bg-background border border-border rounded-xl overflow-hidden">
          <div className="px-5 py-3 border-b border-border bg-muted/30">
            <h3 className="text-sm font-medium text-foreground">Detail per Produk</h3>
          </div>
          <div className="overflow-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border/60 bg-muted/40">
                  <th className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider h-9 text-center px-3">#</th>
                  <th className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider h-9 text-left px-3">Produk</th>
                  <th className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider h-9 text-left px-3">Lokasi</th>
                  <th className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider h-9 text-center px-3">Sistem (Disp/Gdg)</th>
                  <th className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider h-9 text-center px-3">Fisik (Disp/Gdg)</th>
                  <th className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider h-9 text-center px-3">Selisih (Disp/Gdg)</th>
                  <th className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider h-9 text-center px-3">Klasifikasi</th>
                  <th className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider h-9 text-center px-3">Nilai (Rp)</th>
                </tr>
              </thead>
              <tbody>
                {enriched.map((item, idx) => (
                  <tr key={idx} className="border-b border-border/40 hover:bg-muted/20 transition-colors">
                    <td className="text-center text-sm text-muted-foreground tabular-nums px-3 py-2.5">{idx + 1}</td>
                    <td className="text-sm text-foreground px-3 py-2.5">{item.nama_produk}</td>
                    <td className="text-sm text-muted-foreground px-3 py-2.5">{item.lokasi}</td>
                    <td className="text-sm text-center tabular-nums px-3 py-2.5">{item.stok_sistem || 0} / {item.stok_sistem_gudang || 0}</td>
                    <td className="text-sm text-center tabular-nums px-3 py-2.5 font-medium">{item.stok_fisik || 0} / {item.stok_fisik_gudang || 0}</td>
                    <td className="text-center px-3 py-2.5">
                      <div className="flex items-center justify-center gap-1">
                        <span
                          className={`tabular-nums font-semibold px-2 py-0.5 rounded-full text-[12px] ${
                            item.selisihDisplay > 0
                              ? "bg-emerald-50 text-emerald-600"
                              : item.selisihDisplay < 0
                              ? "bg-destructive/10 text-destructive"
                              : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {item.selisihDisplay > 0 ? `+${item.selisihDisplay}` : item.selisihDisplay}
                        </span>
                        <span
                          className={`tabular-nums font-semibold px-2 py-0.5 rounded-full text-[12px] ${
                            item.selisihGudang > 0
                              ? "bg-emerald-50 text-emerald-600"
                              : item.selisihGudang < 0
                              ? "bg-destructive/10 text-destructive"
                              : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {item.selisihGudang > 0 ? `+${item.selisihGudang}` : item.selisihGudang}
                        </span>
                      </div>
                    </td>
                    <td className="text-sm text-center px-3 py-2.5">{item.klasifikasi || "-"}</td>
                    <td className="text-sm text-center tabular-nums px-3 py-2.5">{formatIDR(item.nilai_rp)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="shrink-0 flex items-center justify-between px-6 py-4 border-t border-border bg-background">
        <Button
          type="button"
          variant="destructive"
          onClick={handleBatalkan}
          disabled={loading}
          className="rounded-full gap-1.5"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4" />}
          Batalkan Sesi
        </Button>
        <Button
          type="button"
          onClick={() => setConfirmOpen(true)}
          disabled={loading}
          className="rounded-full px-6 h-10 bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Send className="w-4 h-4 mr-2" />
          Terapkan Opname
        </Button>
      </div>

      {/* Confirm Dialog */}
      {confirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-background border border-border rounded-2xl shadow-xl p-6 max-w-md w-full mx-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <h3 className="text-base font-medium text-foreground">Konfirmasi Terapkan</h3>
                <p className="text-sm text-muted-foreground">Stok produk akan diperbarui secara permanen.</p>
              </div>
            </div>
            <p className="text-sm text-foreground mb-6">
              Apakah Anda yakin ingin menerapkan stok opname <strong>{sesi.no_sesi}</strong>?
              Selisih stok akan dicatat di riwayat AVCO.
            </p>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setConfirmOpen(false)}
                disabled={loading}
                className="rounded-full"
              >
                Batal
              </Button>
              <Button
                type="button"
                onClick={handleApply}
                disabled={loading}
                className="rounded-full px-5 bg-primary hover:bg-primary/90 text-primary-foreground"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Check className="w-4 h-4 mr-2" />
                )}
                Ya, Terapkan
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  COMPLETED STATE                                                     */
/* ------------------------------------------------------------------ */

function CompletedState({ onReset }: { onReset: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-6">
      <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mb-4">
        <Check className="w-8 h-8 text-emerald-600" />
      </div>
      <h2 className="text-xl font-light tracking-tight text-foreground mb-1">
        Stok Opname Selesai
      </h2>
      <p className="text-sm text-muted-foreground mb-6 text-center">
        Stok produk telah diperbarui dan tercatat di riwayat AVCO.
      </p>
      <Button
        type="button"
        onClick={onReset}
        className="rounded-full px-6 h-10 bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm"
      >
        Mulai Sesi Baru
      </Button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  MAIN CLIENT COMPONENT                                               */
/* ------------------------------------------------------------------ */

export default function StockOpnameClient({
  products,
  initialSesi,
  initialItems,
}: {
  products: Product[];
  initialSesi?: SesiInfo | null;
  initialItems?: Step2Item[];
}) {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(initialSesi ? 2 : 1);
  const [sesi, setSesi] = useState<SesiInfo | null>(initialSesi || null);
  const [items, setItems] = useState<Step2Item[]>(
    initialItems && initialItems.length > 0 
      ? initialItems 
      : []
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleStart = async (data: StartFormValues) => {
    setLoading(true);
    setError("");
    const res = await createSesiOpname({
      tgl_sesi: data.tgl_sesi,
      keterangan: data.keterangan,
    });
    if (res?.error) {
      setError(res.error);
      setLoading(false);
      return;
    }
    setSesi({
      id: res.id,
      no_sesi: res.no_sesi,
      tgl_sesi: data.tgl_sesi,
      keterangan: data.keterangan || null,
    });
    setItems([
      { id_produk: 0, stok_sistem: 0, stok_sistem_gudang: 0, stok_fisik: 0, stok_fisik_gudang: 0, klasifikasi: "", keterangan: "" },
    ]);
    setStep(2);
    setLoading(false);
  };

  const handleComplete = () => {
    setStep(4);
  };

  const handleReset = () => {
    setStep(1);
    setSesi(null);
    setItems([]);
    setError("");
  };

  return (
    <div className="flex-1 p-4 md:p-8 lg:p-12 w-full flex flex-col gap-4 md:gap-8 mx-auto h-full md:max-h-screen md:overflow-hidden">
      <header className="shrink-0">
        <h1 className="text-4xl font-light tracking-tighter text-foreground">
          Stok Opname
        </h1>
        <p className="text-muted-foreground mt-2">
          Pengecekan fisik stok dengan alur draft → review → apply
        </p>
      </header>

      {error && step === 1 && (
        <div className="shrink-0 flex items-center gap-2 px-6 py-3 bg-destructive/10 text-destructive text-sm border-b border-border rounded-xl">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      <div className="flex-1 flex flex-col min-h-0 bg-background border border-border rounded-[12px] shadow-[0_1px_3px_rgba(0,55,112,0.08)] overflow-hidden">
        {step === 1 && <Step1 onStart={handleStart} loading={loading} />}
        {step === 2 && sesi && (
          <Step2
            sesi={sesi}
            products={products}
            initialItems={items}
            onBack={() => setStep(1)}
            onReview={() => setStep(3)}
            onCancel={() => setStep(1)}
          />
        )}
        {step === 3 && sesi && (
          <Step3
            sesi={sesi}
            items={items}
            products={products}
            onBack={() => setStep(2)}
            onComplete={handleComplete}
          />
        )}
        {step === 4 && <CompletedState onReset={handleReset} />}
      </div>
    </div>
  );
}
