"use client";

import { useState, useMemo, useTransition, useDeferredValue, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Plus, PackageOpen, PackagePlus, X, AlertCircle, Check, Loader2, Edit2, Trash2, ArrowUp, ArrowDown, Eye, EyeOff, Upload, ChevronsUpDown, Search } from "lucide-react";
import { useTable } from "@/hooks/use-table";
import DataTable, { type Column, type FilterDef, type DeleteModalConfig } from "@/components/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { TableCell, TableRow } from "@/components/ui/table";
import { addProduct, updateProduct, deleteProduct, deleteProducts, forceDeleteProduct, restockDisplay, moveToWarehouse, importProducts, isiStokPaket } from "./actions";
import { exportToCSV, exportToPDF } from "@/lib/export-utils";
import ProductDetailSheet from "@/components/product-detail-sheet";
import { Highlight } from "@/components/highlight";
import ImportCSVModal from "@/components/import-csv-modal";
import { ExportDropdown } from "@/components/export-dropdown";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

function formatIDR(n: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
}

function formatDate(dateStr: string) {
  if (!dateStr) return "-";
  const d = new Date(dateStr);
  const pad = (n: number) => String(n).padStart(2, '0');
  const dd = pad(d.getDate());
  const mm = pad(d.getMonth() + 1);
  const yy = String(d.getFullYear()).slice(-2);
  const hh = pad(d.getHours());
  const min = pad(d.getMinutes());
  return `${dd}/${mm}/${yy} ${hh}:${min}`;
}

// ── Combobox pencarian produk master ────────────────────────────────────────
function MasterCombobox({
  products,
  value,
  onChange,
}: {
  products: { id: number; nama_produk: string; sku: string | null }[];
  value: number | null;
  onChange: (id: number, master: { id: number; nama_produk: string; sku: string | null }) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlighted, setHighlighted] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);

  const selected = useMemo(
    () => products.find((p) => p.id === value) ?? null,
    [products, value]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return products;
    return products.filter(
      (p) =>
        p.nama_produk.toLowerCase().includes(q) ||
        (p.sku ?? "").toLowerCase().includes(q)
    );
  }, [products, query]);

  useEffect(() => {
    if (!open) return;
    const onClickOutside = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onClickOutside);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClickOutside);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => {
          setOpen((v) => !v);
          setQuery("");
          setHighlighted(0);
        }}
        className={`w-full h-11 rounded-md border border-input bg-background px-3.5 text-sm shadow-2xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 flex items-center justify-between gap-2 ${
          open ? "ring-2 ring-primary/20 border-primary" : ""
        }`}
      >
        <span className={`truncate ${selected ? "text-foreground" : "text-muted-foreground"}`}>
          {selected ? (
            <>
              <span className="font-medium">{selected.nama_produk}</span>
              <span className="text-muted-foreground ml-2 text-xs">
                ({selected.sku || "Tanpa SKU"})
              </span>
            </>
          ) : (
            "Cari & pilih produk master…"
          )}
        </span>
        <ChevronsUpDown className="w-4 h-4 shrink-0 text-muted-foreground" />
      </button>

      {open && (
        <div className="absolute z-50 mt-1.5 w-full rounded-xl border border-border bg-background shadow-lg shadow-black/5 overflow-hidden">
          <div className="p-2 border-b border-border/60 flex items-center gap-2">
            <Search className="w-4 h-4 text-muted-foreground shrink-0" />
            <input
              autoFocus
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setHighlighted(0);
              }}
              placeholder="Ketik nama atau SKU master…"
              className="w-full bg-transparent outline-none text-sm placeholder:text-muted-foreground"
            />
          </div>
          <ul className="max-h-56 overflow-y-auto py-1">
            {filtered.length === 0 && (
              <li className="px-3.5 py-2.5 text-sm text-muted-foreground">
                Tidak ada produk master yang cocok
              </li>
            )}
            {filtered.map((p, i) => (
              <li key={p.id}>
                <button
                  type="button"
                  onMouseEnter={() => setHighlighted(i)}
                  onClick={() => {
                    onChange(p.id, p);
                    setOpen(false);
                  }}
                  className={`w-full text-left px-3.5 py-2.5 text-sm flex items-center justify-between gap-2 transition-colors ${
                    i === highlighted ? "bg-primary/10" : ""
                  } ${value === p.id ? "text-primary font-medium" : "text-foreground"}`}
                >
                  <span className="truncate">{p.nama_produk}</span>
                  <span className="shrink-0 text-[11px] text-muted-foreground uppercase tracking-wider">
                    {p.sku || "Tanpa SKU"}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

interface Product {
  id: number;
  sku: string | null;
  nama_produk: string;
  id_kategori: number;
  id_satuan: number;
  id_merk: number | null;
  hitung_stok: boolean;
  barcode: string | null;
  harga_modal: number;
  harga_jual_satuan: number;
  harga_jual_grosir: number;
  harga_jual_promo: number | null;
  diskon: number;
  stock: number | null;
  stok_gudang: number;
  stok_minimum: number;
  stok_minimum_gudang: number | null;
  harga_pokok_avco: number;
  nilai_persediaan: number;
  default_purchase_unit: string | null;
  conversion_ratio: number;
  jual_satuan: string | null;
  harga_jual_besar_satuan: number | null;
  harga_jual_besar_grosir: number | null;
  harga_jual_besar_promo: number | null;
  id_produk_master: number | null;
  qty_per_unit: number | null;
  isi_satuan: string | null;
  jenis_isi_paket: string | null;
  master: { stok: number | null; stok_gudang: number | null; hitung_stok: boolean | null; nama_produk: string | null; harga_pokok_avco: number | null; harga_modal: number | null } | null;
  kategori: { nama: string } | null;
  satuan: { nama: string } | null;
  id_lokasi_area: number | null;
  lokasi_area: { nama: string } | null;
  created_at: string;
  updated_at: string;
}

export default function InventoryClient({
  initialProducts,
  categories,
  units,
  lokasiAreas,
  merks,
}: {
  initialProducts: Product[];
  categories: { id: number; nama: string }[];
  units: { id: number; nama: string }[];
  lokasiAreas: { id: number; nama: string }[];
  merks: { id: number; nama: string }[];
}) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const deferredSearchQuery = useDeferredValue(searchQuery);

  const hl = (text: string) => (
    <Highlight text={text} query={deferredSearchQuery} />
  );
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [merkFilter, setMerkFilter] = useState("all");
  const [lokasiFilter, setLokasiFilter] = useState("all");
  const [stockFilter, setStockFilter] = useState("all");
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const [editingId, setEditingId] = useState<number | 'new' | null>(null);
  const [editForm, setEditForm] = useState<Partial<Product>>({});
  const [isPaket, setIsPaket] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkDeleteIds, setBulkDeleteIds] = useState<number[] | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  const [displayModal, setDisplayModal] = useState<{ open: boolean; product: Product | null; qty: string; error: string }>({
    open: false, product: null, qty: "1", error: "",
  });

  const [gudangModal, setGudangModal] = useState<{ open: boolean; product: Product | null; qty: string; error: string }>({
    open: false, product: null, qty: "1", error: "",
  });

  const [fillPaketModal, setFillPaketModal] = useState<{ open: boolean; product: Product | null; qty: string; totalBerat: string; error: string }>({
    open: false, product: null, qty: "1", totalBerat: "", error: "",
  });

  const [showAvcoCols, setShowAvcoCols] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  const filteredData = useMemo(() => {
    let result = [...initialProducts];

    if (deferredSearchQuery.trim()) {
      const q = deferredSearchQuery.toLowerCase();
      result = result.filter(
        (p) =>
          p.nama_produk.toLowerCase().includes(q) ||
          p.barcode?.toLowerCase().includes(q) ||
          p.sku?.toLowerCase().includes(q) ||
          p.kategori?.nama.toLowerCase().includes(q) ||
          p.lokasi_area?.nama.toLowerCase().includes(q) ||
          merks.find((m) => m.id === p.id_merk)?.nama.toLowerCase().includes(q)
      );
    }

    if (categoryFilter !== "all") {
      result = result.filter((p) => p.id_kategori.toString() === categoryFilter);
    }

    if (merkFilter !== "all") {
      if (merkFilter === "none") {
        result = result.filter((p) => !p.id_merk);
      } else {
        result = result.filter((p) => p.id_merk?.toString() === merkFilter);
      }
    }

    if (lokasiFilter !== "all") {
      result = result.filter((p) => {
        if (lokasiFilter === "none") return !p.id_lokasi_area;
        return p.id_lokasi_area?.toString() === lokasiFilter;
      });
    }

    if (stockFilter !== "all") {
      result = result.filter((p) => {
        const isPaket = Boolean(p.id_produk_master);
        if (stockFilter === "untracked") return !p.hitung_stok;
        if (!p.hitung_stok) return false;
        const display = p.stock ?? 0;
        const gudang = p.stok_gudang ?? 0;
        const displayLow = display > 0 && display <= p.stok_minimum;
        const gudangLow = p.stok_minimum_gudang != null && gudang <= p.stok_minimum_gudang;
        if (stockFilter === "out") return display <= 0;
        if (stockFilter === "low") return displayLow || gudangLow;
        if (stockFilter === "in") return !displayLow && !gudangLow && display > 0;
        return true;
      });
    }

    return result;
  }, [initialProducts, deferredSearchQuery, categoryFilter, merkFilter, lokasiFilter, stockFilter, merks]);

  const table = useTable({ data: filteredData, defaultItemsPerPage: 25 });

  const handleSaveInline = () => {
    if (!editForm.nama_produk?.trim()) { setErrorMsg("Nama produk wajib diisi"); return; }
    if (!editForm.id_kategori) { setErrorMsg("Kategori wajib dipilih"); return; }
    if (!editForm.id_satuan) { setErrorMsg("Satuan wajib dipilih"); return; }

    const isPaketMode = isPaket;
    if (isPaketMode) {
      if (!editForm.id_produk_master) {
        setErrorMsg("Produk master wajib dipilih untuk produk paket");
        return;
      }
      if (!editForm.qty_per_unit || editForm.qty_per_unit <= 0) {
        setErrorMsg("Jumlah per satuan (qty per unit) wajib diisi dan lebih dari 0 untuk produk paket");
        return;
      }
    }
    setErrorMsg("");

    const data = {
      nama_produk: editForm.nama_produk, id_kategori: Number(editForm.id_kategori),
      id_satuan: Number(editForm.id_satuan), id_merk: editForm.id_merk ?? null, hitung_stok: editForm.hitung_stok ?? true,
      id_lokasi_area: editForm.id_lokasi_area ? Number(editForm.id_lokasi_area) : null,
      jenis_isi_paket: isPaketMode ? (editForm.jenis_isi_paket || 'FIXED_RATIO') : null,
      isi_satuan: isPaketMode ? (editForm.isi_satuan || null) : null,
      sku: editForm.sku || null,
      barcode: editForm.barcode || null, harga_modal: Number(editForm.harga_modal || 0),
      harga_jual_satuan: Number(editForm.harga_jual_satuan || 0),
      harga_jual_grosir: Number(editForm.harga_jual_grosir || 0),
      harga_jual_promo: editForm.harga_jual_promo ? Number(editForm.harga_jual_promo) : null,
      diskon: Number(editForm.diskon || 0), stok_minimum: Number(editForm.stok_minimum ?? 5),
      stok_minimum_gudang: editForm.stok_minimum_gudang ?? null,
      default_purchase_unit: editForm.default_purchase_unit || null,
      conversion_ratio: Number(editForm.conversion_ratio ?? 1),
      jual_satuan: isPaketMode ? null : (editForm.jual_satuan || null),
      // Harga jual besar tidak dikirim — dihitung otomatis server-side (harga kecil × rasio)
      id_produk_master: isPaketMode ? Number(editForm.id_produk_master) : null,
      qty_per_unit: isPaketMode ? Number(editForm.qty_per_unit) : null,
    };

    startTransition(async () => {
      const res = editingId === "new" ? await addProduct(data) : await updateProduct(editingId as number, data);
      if (res?.error) {
        setErrorMsg(res.error);
      } else {
        setEditingId(null); setEditForm({}); setIsPaket(false);
        // Muat ulang data dari server agar produk baru langsung muncul di tabel
        router.refresh();
        // Langsung tampilkan produk yang baru dibuat (jangan biarkan pengguna
        // menebak-nebak — penyebab pengguna menekan Simpan berkali-kali → duplikat)
        if (editingId === "new" && data.nama_produk) {
          setSearchQuery(data.nama_produk);
          setCategoryFilter("all");
          setMerkFilter("all");
          setLokasiFilter("all");
          setStockFilter("all");
          table.setCurrentPage(1);
        }
      }
    });
  };

  const handleCancelInline = () => { setEditingId(null); setEditForm({}); setIsPaket(false); setErrorMsg(""); };

  
  const handleForceDelete = async () => {
    if (!deleteTarget?.id) return;
    const id = deleteTarget.id;
    setErrorMsg("");
    startTransition(async () => {
      const res = await forceDeleteProduct(id);
      if (res?.error) { 
        setErrorMsg(res.error); 
      } else {
        setDeleteTarget(null);
        setSelectedIds((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
        router.refresh();
      }
    });
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget?.id) return;
    const id = deleteTarget.id;
    setErrorMsg("");
    startTransition(async () => {
      const res = await deleteProduct(id);
      if (res?.error) { setErrorMsg(res.error); } else {
        setDeleteTarget(null);
        setSelectedIds((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
        router.refresh();
      }
    });
  };

  const handleBulkDeleteConfirm = async () => {
    if (!bulkDeleteIds || bulkDeleteIds.length === 0) return;
    setErrorMsg("");
    startTransition(async () => {
      const res = await deleteProducts(bulkDeleteIds);
      if (res?.error) { setErrorMsg(res.error); } else {
        setBulkDeleteIds(null);
        setSelectedIds(new Set());
        table.setCurrentPage(1);
        router.refresh();
      }
    });
  };

  const handleMoveToDisplay = async () => {
    if (!displayModal.product) return;
    const qty = parseInt(displayModal.qty, 10);
    if (isNaN(qty) || qty <= 0) { setDisplayModal(prev => ({ ...prev, error: "Jumlah harus lebih dari 0" })); return; }
    if (qty > displayModal.product.stok_gudang) { setDisplayModal(prev => ({ ...prev, error: `Stok gudang tidak mencukupi. Tersedia: ${displayModal.product!.stok_gudang}` })); return; }
    setDisplayModal(prev => ({ ...prev, error: "" }));
    startTransition(async () => {
      const res = await restockDisplay(displayModal.product!.id, qty);
      if (res?.error) { setDisplayModal(prev => ({ ...prev, error: res.error })); } else { setDisplayModal({ open: false, product: null, qty: "1", error: "" }); router.refresh(); }
    });
  };

  const handleMoveToGudang = async () => {
    if (!gudangModal.product) return;
    const qty = parseInt(gudangModal.qty, 10);
    if (isNaN(qty) || qty <= 0) { setGudangModal(prev => ({ ...prev, error: "Jumlah harus lebih dari 0" })); return; }
    if (qty > (gudangModal.product.stock ?? 0)) { setGudangModal(prev => ({ ...prev, error: `Stok display tidak mencukupi. Tersedia: ${gudangModal.product!.stock ?? 0}` })); return; }
    setGudangModal(prev => ({ ...prev, error: "" }));
    startTransition(async () => {
      const res = await moveToWarehouse(gudangModal.product!.id, qty);
      if (res?.error) { setGudangModal(prev => ({ ...prev, error: res.error })); } else { setGudangModal({ open: false, product: null, qty: "1", error: "" }); router.refresh(); }
    });
  };

  const handleFillPaket = async () => {
    if (!fillPaketModal.product) return;
    const qty = parseInt(fillPaketModal.qty, 10);
    if (isNaN(qty) || qty <= 0) { setFillPaketModal(prev => ({ ...prev, error: "Jumlah harus lebih dari 0" })); return; }
    const product = fillPaketModal.product;
    const isActualWeight = product.jenis_isi_paket === 'ACTUAL_WEIGHT';

    if (isActualWeight) {
      const totalBerat = parseFloat(fillPaketModal.totalBerat);
      if (isNaN(totalBerat) || totalBerat <= 0) { setFillPaketModal(prev => ({ ...prev, error: "Total berat harus lebih dari 0" })); return; }
      const masterStock = product.master ? (product.master.stok ?? 0) + (product.master.stok_gudang ?? 0) : 0;
      if (totalBerat > masterStock) {
        setFillPaketModal(prev => ({ ...prev, error: `Stok master tidak mencukupi. Total berat ${totalBerat} satuan, tapi master hanya punya ${masterStock} satuan` }));
        return;
      }
      setFillPaketModal(prev => ({ ...prev, error: "" }));
      startTransition(async () => {
        const res = await isiStokPaket(product.id, qty, totalBerat);
        if (res?.error) { setFillPaketModal(prev => ({ ...prev, error: res.error })); } else { setFillPaketModal({ open: false, product: null, qty: "1", totalBerat: "", error: "" }); router.refresh(); }
      });
    } else {
      const qtyPerUnit = product.qty_per_unit ?? 1;
      const masterStock = product.master ? (product.master.stok ?? 0) + (product.master.stok_gudang ?? 0) : 0;
      if (qty * qtyPerUnit > masterStock) {
        setFillPaketModal(prev => ({ ...prev, error: `Stok master tidak mencukupi. ${qty} paket × ${qtyPerUnit} satuan = ${qty * qtyPerUnit}, tapi master hanya punya ${masterStock} satuan` }));
        return;
      }
      setFillPaketModal(prev => ({ ...prev, error: "" }));
      startTransition(async () => {
        const res = await isiStokPaket(product.id, qty);
        if (res?.error) { setFillPaketModal(prev => ({ ...prev, error: res.error })); } else { setFillPaketModal({ open: false, product: null, qty: "1", totalBerat: "", error: "" }); router.refresh(); }
      });
    }
  };

  const handleEditClick = (e: React.MouseEvent, product: Product) => {
    e.stopPropagation();
    setEditingId(product.id);
    setIsPaket(Boolean(product.id_produk_master));
    setEditForm({ ...product, hitung_stok: product.hitung_stok ?? true });
    setErrorMsg("");
  };



  const bigPriceOf = (p: Product): number | null => {
    if (!p.jual_satuan || !(Number(p.conversion_ratio) > 0)) return null;
    if (p.harga_jual_besar_satuan != null && p.harga_jual_besar_satuan > 0) return p.harga_jual_besar_satuan;
    return Math.round(Number(p.harga_jual_satuan || 0) * Number(p.conversion_ratio || 1));
  };

  const handleExportCSV = () => {
    // Header SAMA dengan template import produk (ImportCSVModal) agar file export
    // bisa langsung dipakai untuk import ulang (round-trip). Kolom yang dihitung
    // sistem (HPP/Total Aset/Harga Besar) diletakkan di akhir & diabaikan saat import.
    const headers = [
      "Nama Produk",
      "SKU / Kode Produk",
      "Barcode",
      "Kategori",
      "Satuan Dasar",
      "Merk / Brand",
      "Lokasi / Rak",
      "Hitung Stok (ya/tidak)",
      "Harga Modal / Beli",
      "Harga Jual Eceran",
      "Harga Jual Grosir",
      "Harga Jual Promo",
      "Diskon per Item (Rp)",
      "Stok di Rak / Display",
      "Stok di Gudang",
      "Stok Minimum",
      "Stok Minimum Gudang",
      "Satuan Beli dari Supplier",
      "Isi per Satuan Beli",
      "Satuan Jual Besar",
      "Produk Master (ID)",
      "Qty Isi per Paket",
      "Jenis Isi Paket",
      "Satuan Isi Paket",
      "HPP (AVCO)",
      "Total Aset",
      "Harga Besar",
    ];
    const data = filteredData.map(p => [
      p.nama_produk,
      p.sku || "",
      p.barcode || "",
      p.kategori?.nama || "",
      p.satuan?.nama || "",
      merks.find((m) => m.id === p.id_merk)?.nama || "",
      p.lokasi_area?.nama || "",
      p.hitung_stok ? "ya" : "tidak",
      p.harga_modal ?? 0,
      p.harga_jual_satuan ?? 0,
      p.harga_jual_grosir ?? 0,
      p.harga_jual_promo ?? "",
      p.diskon ?? 0,
      p.stock ?? 0,
      p.stok_gudang ?? 0,
      p.stok_minimum ?? 5,
      p.stok_minimum_gudang ?? "",
      p.default_purchase_unit ?? "",
      p.conversion_ratio ?? 1,
      p.jual_satuan ?? "",
      p.id_produk_master ?? "",
      p.qty_per_unit ?? "",
      p.jenis_isi_paket ?? "",
      p.isi_satuan ?? "",
      p.harga_pokok_avco ?? 0,
      p.nilai_persediaan ?? 0,
      bigPriceOf(p) ?? "",
    ]);
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    const filename = `plk-produk-${pad(now.getDate())}-${pad(now.getMonth() + 1)}-${String(now.getFullYear()).slice(-2)}(${pad(now.getHours())}-${pad(now.getMinutes())})`;
    exportToCSV(filename, headers, data);
  };

  const handleExportPDF = () => {
    const headers = ["SKU", "Barcode", "Item", "Kategori", "Lokasi", "Stok Display", "Stok Gudang", "Harga Modal", "HPP (AVCO)", "Total Aset", "Harga Retail", "Harga Grosir", "Harga Promo", "Harga Besar"];
    const data = filteredData.map(p => [
      p.sku || "-", p.barcode || "-", p.nama_produk, p.kategori?.nama || "-",
      p.lokasi_area?.nama || "-",
      p.hitung_stok ? String(p.stock || 0) : "Tidak dilacak", p.hitung_stok ? String(p.stok_gudang) : "-",
      formatIDR(p.harga_modal), formatIDR(p.harga_pokok_avco), formatIDR(p.nilai_persediaan),
      formatIDR(p.harga_jual_satuan), formatIDR(p.harga_jual_grosir), p.harga_jual_promo ? formatIDR(p.harga_jual_promo) : "-",
      bigPriceOf(p) != null ? formatIDR(bigPriceOf(p)!) : "-"
    ]);
    
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    const filename = `plk-produk-${pad(now.getDate())}-${pad(now.getMonth() + 1)}-${String(now.getFullYear()).slice(-2)}(${pad(now.getHours())}-${pad(now.getMinutes())})`;
    exportToPDF(filename, "Laporan Data Inventaris", headers, data);
  };

  const baseColumns: Column<Product>[] = [
    { key: "nama_produk", header: "Item", sortable: true, className: "xl:pl-6 sticky left-[88px] z-10 bg-background border-r border-border/50", headerClassName: "xl:pl-6 sticky left-[88px] z-40 bg-background border-r border-border/50 min-w-[250px]", render: (p) => (
      <div className="flex items-center gap-2">
        <p className="text-foreground text-[15px] xl:text-[14px] font-medium xl:font-normal line-clamp-2 xl:line-clamp-1">{hl(p.nama_produk)}</p>
        {(p as any).nama_event_promo && (
          <Badge variant="secondary" className="shrink-0 bg-red-100 text-red-600 border-red-200 rounded-full px-2 py-0.5 text-[10px] uppercase tracking-widest leading-tight">
            {(p as any).nama_event_promo}
          </Badge>
        )}
        {p.id_produk_master && (
          <Badge variant="secondary" className="shrink-0 bg-primary/10 text-primary font-medium border-none rounded-full px-2 py-0.5 text-[10px] uppercase tracking-widest leading-tight">
            Paket
          </Badge>
        )}
      </div>
    ) },
    { key: "sku", header: "SKU", sortable: true, headerClassName: "w-[130px]", render: (p) => <span className="font-mono text-[14px]">{hl(p.sku || "-")}</span> },
    { key: "barcode", header: "Barcode", sortable: true, headerClassName: "w-[140px]", render: (p) => <span className="font-mono text-[14px]">{hl(p.barcode || "-")}</span> },
    { key: "kategori", header: "Kategori", sortable: true, sortKey: "kategori.nama", headerClassName: "w-[160px]", render: (p) => hl(p.kategori?.nama || "-") },
    { key: "satuan", header: "Satuan", sortable: true, sortKey: "satuan.nama", headerClassName: "w-[110px]", render: (p) => hl(p.satuan?.nama || "-") },
    {
      key: "default_purchase_unit", header: "Satuan Beli", sortable: true, headerClassName: "w-[130px]",
      render: (p) => {
        if (!p.default_purchase_unit) return <span className="text-muted-foreground">-</span>;
        const ratio = Number(p.conversion_ratio) || 1;
        return (
          <div className="flex flex-col">
            <span>{hl(p.default_purchase_unit)}</span>
            <span className="text-[11px] text-muted-foreground">1 = {ratio} {p.satuan?.nama || ""}</span>
          </div>
        );
      },
    },
    { key: "conversion_ratio", header: "Rasio", sortable: true, headerClassName: "w-[90px]", render: (p) => <span className="tabular-nums">{Number(p.conversion_ratio) || "-"}</span> },
    { key: "merk", header: "Merk", sortable: true, sortKey: "id_merk", headerClassName: "w-[120px]", render: (p) => { const m = merks.find((mk) => mk.id === p.id_merk); return hl(m?.nama || "-"); } },
    { key: "lokasi_area", header: "Lokasi", sortable: true, sortKey: "lokasi_area.nama", className: "text-muted-foreground", headerClassName: "w-[130px]", render: (p) => hl(p.lokasi_area?.nama || "-") },
    {
      key: "stock", header: "Status Stok", sortable: true, headerClassName: "w-[180px]",
      render: (p) => {
        const isPaket = Boolean(p.id_produk_master);
        if (!p.hitung_stok) {
            return <Badge variant="outline" className="text-muted-foreground border-border/50 font-normal rounded-full px-2 py-0.5 text-[10px] uppercase tracking-widest leading-tight">Tidak dilacak</Badge>;
        }

        const display = p.stock ?? 0;
        const gudang = p.stok_gudang ?? 0;
        const minDisplay = p.stok_minimum ?? 0;
        const minGudang = p.stok_minimum_gudang;

        const displayLow = display <= minDisplay && display > 0;
        const displayOut = display <= 0;
        
        const gudangLow = minGudang != null && gudang <= minGudang && gudang > 0;
        const gudangOut = gudang <= 0;

        return (
          <div className="flex flex-col gap-1.5 w-full min-w-[150px]">
            <div className={`flex items-center justify-between gap-3 text-[12px] px-2 py-1 rounded-md border ${displayOut ? 'bg-destructive/10 border-destructive/20' : displayLow ? 'bg-warning/10 border-warning/20' : 'bg-muted/30 border-border/50'}`}>
               <div className="flex items-center gap-1.5">
                 <span className="text-muted-foreground font-medium">Display</span>
                 <span className={`font-semibold ${displayOut ? 'text-destructive' : displayLow ? 'text-warning' : 'text-primary'}`}>
                   {display}
                 </span>
               </div>
               <span className="text-[10px] text-muted-foreground/80 font-medium">Min: {minDisplay}</span>
            </div>

            <div className={`flex items-center justify-between gap-3 text-[12px] px-2 py-1 rounded-md border ${gudangOut && minGudang != null ? 'bg-destructive/10 border-destructive/20' : gudangLow ? 'bg-warning/10 border-warning/20' : 'bg-muted/30 border-border/50'}`}>
               <div className="flex items-center gap-1.5">
                 <span className="text-muted-foreground font-medium">Gudang</span>
                 <span className={`font-semibold ${gudangOut && minGudang != null ? 'text-destructive' : gudangLow ? 'text-warning' : 'text-foreground'}`}>
                   {gudang}
                 </span>
               </div>
               <span className="text-[10px] text-muted-foreground/80 font-medium">
                 Min: {minGudang != null ? minGudang : '-'}
               </span>
            </div>

            {isPaket && (
              <div className="text-[10px] text-muted-foreground leading-tight px-1 mt-0.5">
                <span className="font-medium text-foreground/70">Paket:</span> {p.qty_per_unit ?? 1}{p.isi_satuan ? ` ${p.isi_satuan}` : ""} = 1 {p.satuan?.nama ?? "paket"}
                <br/>
                Dari: {p.master?.nama_produk || "-"}
              </div>
            )}
          </div>
        );
      },
    },
    { key: "harga_modal", header: "Harga Modal", sortable: true, headerClassName: "text-left w-[140px]", render: (p) => <span className="tabular-nums">{formatIDR(p.harga_modal)}</span> },
    { key: "harga_jual_satuan", header: "Harga Retail", sortable: true, headerClassName: "text-left w-[140px]", render: (p) => (
      <div className="flex flex-col">
        {(p as any).nama_event_promo && (
          <span className="text-[10px] text-muted-foreground line-through tabular-nums -mb-1">
            {formatIDR((p as any).harga_asli_satuan ?? p.harga_jual_satuan)}
          </span>
        )}
        <span className="tabular-nums">{formatIDR(p.harga_jual_satuan)}</span>
      </div>
    )},
    { key: "harga_jual_grosir", header: "Harga Grosir", sortable: true, headerClassName: "text-left w-[140px]", render: (p) => <span className="tabular-nums">{formatIDR(p.harga_jual_grosir)}</span> },
    { key: "harga_jual_promo", header: "Harga Promo", sortable: true, headerClassName: "text-left w-[140px]", render: (p) => <span className="tabular-nums">{p.harga_jual_promo != null ? formatIDR(p.harga_jual_promo) : "-"}</span> },
    {
      key: "harga_jual_besar_satuan", header: "Harga Besar", sortable: true, headerClassName: "text-left w-[150px]",
      render: (p) => {
        const big = bigPriceOf(p);
        if (big == null || !p.jual_satuan) return <span className="text-muted-foreground">-</span>;
        return (
          <div className="flex flex-col">
            <span className="tabular-nums font-medium">{formatIDR(big)}</span>
            <span className="text-[11px] text-muted-foreground">/{p.jual_satuan}</span>
          </div>
        );
      },
    },
    { key: "created_at", header: "Dibuat Pada", sortable: true, headerClassName: "w-[140px]", render: (p) => <span className="text-[13px] text-muted-foreground">{formatDate(p.created_at)}</span> },
    { key: "updated_at", header: "Diperbarui Pada", sortable: true, headerClassName: "w-[140px]", render: (p) => <span className="text-[13px] text-muted-foreground">{formatDate(p.updated_at)}</span> },
  ];

  const avcoColumns: Column<Product>[] = [
    { key: "harga_pokok_avco", header: "HPP (AVCO)", sortable: true, align: "right", headerClassName: "w-[120px]", render: (p) => <span className="tabular-nums">{formatIDR(p.harga_pokok_avco)}</span> },
    { key: "nilai_persediaan", header: "Total Aset", sortable: true, align: "right", headerClassName: "w-[120px]", render: (p) => <span className="tabular-nums">{formatIDR(p.nilai_persediaan)}</span> },
  ];

  const actionsColumn: Column<Product> = {
    key: "actions", header: "", className: "xl:pr-6", headerClassName: "w-[80px] xl:pr-6", mobileHide: true,
    render: (p) => (
      <div className="flex justify-end gap-2 xl:gap-1">
        {p.id_produk_master !== null && (
          <Button variant="outline" size="icon" aria-label="Isi Stok Paket" title="Isi Stok Paket" className="h-11 w-11 xl:h-8 xl:w-8 xl:border-transparent xl:bg-transparent text-muted-foreground hover:text-primary hover:bg-primary/10" onClick={(e) => { e.stopPropagation(); setFillPaketModal({ open: true, product: p, qty: "1", totalBerat: "", error: "" }); }} disabled={editingId !== null}>
            <PackagePlus className="h-4 w-4" />
          </Button>
        )}
        {p.hitung_stok && p.stok_gudang > 0 && (
          <Button variant="outline" size="icon" aria-label="Pindah ke Display" title="Pindah ke Display" className="h-11 w-11 xl:h-8 xl:w-8 xl:border-transparent xl:bg-transparent text-muted-foreground hover:text-primary hover:bg-primary/10" onClick={(e) => { e.stopPropagation(); setDisplayModal({ open: true, product: p, qty: "1", error: "" }); }} disabled={editingId !== null}>
            <ArrowUp className="h-4 w-4" />
          </Button>
        )}
        {p.hitung_stok && (p.stock ?? 0) > 0 && (
          <Button variant="outline" size="icon" aria-label="Pindah ke Gudang" title="Pindah ke Gudang" className="h-11 w-11 xl:h-8 xl:w-8 xl:border-transparent xl:bg-transparent text-muted-foreground hover:text-amber-600 hover:bg-amber-50" onClick={(e) => { e.stopPropagation(); setGudangModal({ open: true, product: p, qty: "1", error: "" }); }} disabled={editingId !== null}>
            <ArrowDown className="h-4 w-4" />
          </Button>
        )}
        <Button variant="outline" size="icon" aria-label="Edit" className="h-11 w-11 xl:h-8 xl:w-8 xl:border-transparent xl:bg-transparent text-muted-foreground hover:text-foreground" onClick={(e) => handleEditClick(e, p)} disabled={editingId !== null}>
          <Edit2 className="h-4 w-4" />
        </Button>
        <Button variant="outline" size="icon" aria-label="Hapus" className="h-11 w-11 xl:h-8 xl:w-8 xl:border-transparent xl:bg-transparent text-muted-foreground hover:text-destructive hover:bg-destructive/10" onClick={(e) => { e.stopPropagation(); setDeleteTarget(p); }} disabled={editingId !== null}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    ),
  };

  const columns = showAvcoCols
    ? [...baseColumns, ...avcoColumns, actionsColumn]
    : [...baseColumns, actionsColumn];

  // Nama satuan inventory untuk label ambang batas stok (mis. "(Pcs)", "(Meter)")
  const satuanNama = units.find((u) => u.id === editForm.id_satuan)?.nama || "";

  const filters: FilterDef[] = [
    { type: "select", label: "Kategori", value: categoryFilter, onChange: setCategoryFilter, options: categories.map((c) => ({ value: String(c.id), label: c.nama })) },
    { type: "select", label: "Merk", value: merkFilter, onChange: setMerkFilter, options: [{ value: "none", label: "Tanpa Merk" }, ...merks.map((m) => ({ value: String(m.id), label: m.nama }))] },
    { type: "select", label: "Lokasi", value: lokasiFilter, onChange: setLokasiFilter, options: [{ value: "none", label: "Tanpa Lokasi" }, ...lokasiAreas.map((l) => ({ value: String(l.id), label: l.nama }))] },
    {
      type: "select", label: "Stok", value: stockFilter, onChange: setStockFilter,
      options: [
        { value: "all", label: "Semua Stok" },
        { value: "in", label: "Tersedia" },
        { value: "low", label: "Hampir Habis" },
        { value: "out", label: "Habis" },
        { value: "untracked", label: "Tidak dilacak" },
      ],
    },
  ];
  const deleteModal: DeleteModalConfig | undefined = bulkDeleteIds
    ? {
        open: true,
        title: "Hapus Produk Terpilih?",
        itemName: `${bulkDeleteIds.length} produk`,
        confirmLabel: "Hapus Semua",
        onConfirm: handleBulkDeleteConfirm,
        onCancel: () => { setBulkDeleteIds(null); setErrorMsg(""); },
        isPending, error: errorMsg,
      }
    : deleteTarget ? {
        open: true, title: "Hapus Produk?", itemName: deleteTarget.nama_produk,
        onConfirm: handleDeleteConfirm,
        onCancel: () => { setDeleteTarget(null); setErrorMsg(""); },
        isPending, error: errorMsg,
        secondaryAction: errorMsg && errorMsg.includes("riwayat") ? {
          label: "Hapus Paksa & Riwayat",
          onClick: handleForceDelete
        } : undefined
      }
    : undefined;

  return (
    <>
      <DataTable
        data={table.paginatedData}
        total={table.total}
        columns={columns}
        rowKey={(p) => p.id}
        search={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder="Cari produk atau barcode..."
        sortConfig={table.sortConfig}
        onSort={table.handleSort}
        currentPage={table.currentPage}
        onPageChange={table.setCurrentPage}
        itemsPerPage={table.itemsPerPage}
        onItemsPerPageChange={table.setItemsPerPage}
        filters={filters}
        freezeCheckbox={true}
        freezeRowNumber={true}
        editingId={null}
        onRowClick={(p) => setSelectedProduct(p)}
        actions={[
          { label: "Import CSV", icon: <Upload className="w-4 h-4" />, variant: "outline", onClick: () => setIsImportOpen(true) },
          {
            label: "Export",
            customRender: () => (
              <ExportDropdown
                onExportCSV={handleExportCSV}
                onExportPDF={handleExportPDF}
                className="flex-1 md:flex-none"
              />
            ),
          },
          ...(selectedIds.size > 0
            ? [
                {
                  label: `Hapus ${selectedIds.size} item`,
                  icon: <Trash2 className="w-4 h-4" />,
                  variant: "destructive" as const,
                  onClick: () => { setBulkDeleteIds([...selectedIds]); setErrorMsg(""); },
                  disabled: isPending || editingId !== null,
                },
              ]
            : []),
          {
            label: showAvcoCols ? "Sembunyikan HPP" : "Tampilkan HPP",
            icon: showAvcoCols ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />,
            variant: "outline",
            onClick: () => setShowAvcoCols((v) => !v),
          },
          {
            label: "Tambah Produk", icon: <Plus className="w-4 h-4" />, kind: "primary",
            onClick: () => { setEditingId("new"); setIsPaket(false); setEditForm({ hitung_stok: true, diskon: 0, stok_minimum: 5, stok_minimum_gudang: null, default_purchase_unit: "", conversion_ratio: 1, id_satuan: 0 }); setErrorMsg(""); },
            disabled: editingId !== null,
          },
        ]}
        errorBanner={errorMsg && editingId === 'new' ? errorMsg : null}
        selectedKeys={selectedIds}
        onSelectionChange={setSelectedIds}
        // Checkbox "Pilih semua" memilih SEMUA produk terfilter (lintas halaman),
        // bukan hanya 25/50/100 baris di halaman aktif.
        allRowKeys={filteredData.map((p) => p.id)}
        deleteModal={deleteModal}
        emptyState={{
          icon: PackageOpen,
          title: "Tidak ada produk ditemukan",
          description: "Coba gunakan kata kunci pencarian atau filter yang lain.",
        }}
      />

      {/* Product Add / Edit Modal Popup */}
      <Dialog
        open={editingId !== null}
        onOpenChange={(open) => {
          if (!open) handleCancelInline();
        }}
      >
        <DialogContent className="w-[96vw] sm:max-w-5xl md:max-w-6xl xl:max-w-7xl max-h-[92vh] sm:max-h-[88vh] p-0 flex flex-col overflow-hidden rounded-2xl border border-border/80 shadow-2xl bg-background">
          {/* Header */}
          <DialogHeader className="p-6 sm:p-8 pb-5 border-b border-border/80 shrink-0 flex flex-col gap-1.5 pr-14 bg-muted/10">
            <DialogTitle className="text-xl sm:text-2xl font-medium tracking-tight text-foreground flex items-center gap-3">
              <span className="h-3 w-3 rounded-full bg-primary animate-pulse shrink-0" />
              {editingId === "new" ? "Tambah Produk Baru" : "Edit Produk"}
            </DialogTitle>
            <DialogDescription className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
              {editingId === "new"
                ? "Isi formulir di bawah ini untuk menambahkan barang baru ke dalam sistem inventaris toko."
                : "Perbarui rincian produk, klasifikasi kategori, rasio konversi satuan, atau penetapan skema harga."}
            </DialogDescription>
          </DialogHeader>

          {/* Form Body - Scrollable */}
          <div className="p-6 sm:p-8 md:p-10 overflow-y-auto flex-1 flex flex-col gap-6 sm:gap-8 bg-background">
            {errorMsg && (
              <div className="text-sm text-destructive flex items-center gap-2.5 bg-destructive/10 border border-destructive/20 p-4 rounded-xl font-medium">
                <AlertCircle className="w-5 h-5 shrink-0" />
                {errorMsg}
              </div>
            )}

            {/* 0. Jenis Produk: Normal vs Paket/Turunan */}
            <div className="bg-card border border-border/70 rounded-2xl p-6 sm:p-7 shadow-2xs flex flex-col gap-5">
              <div className="flex items-center justify-between border-b border-border/60 pb-3">
                <div>
                  <h4 className="text-base font-semibold text-foreground tracking-wide">Jenis Produk</h4>
                  <p className="text-xs text-muted-foreground mt-0.5">Produk paket menjual kumpulan satuan dari produk master (stok diisi manual)</p>
                </div>
              </div>

<div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  aria-pressed={!isPaket}
                  className={`h-12 rounded-xl border font-medium text-sm transition-colors cursor-pointer ${
                    !isPaket
                      ? "bg-primary text-primary-foreground border-primary shadow-sm"
                      : "bg-background text-muted-foreground border-border hover:bg-muted/40"
                  }`}
                  onClick={() => {
                    setIsPaket(false);
                    setEditForm((prev) => ({
                      ...prev,
                      id_produk_master: null,
                      qty_per_unit: null,
                      hitung_stok: prev.hitung_stok ?? true,
                    }));
                  }}
                >
                  Produk Normal
                </button>
                <button
                  type="button"
                  aria-pressed={isPaket}
                  className={`h-12 rounded-xl border font-medium text-sm transition-colors cursor-pointer ${
                    isPaket
                      ? "bg-primary text-primary-foreground border-primary shadow-sm"
                      : "bg-background text-muted-foreground border-border hover:bg-muted/40"
                  }`}
                  onClick={() => {
                    setIsPaket(true);
                    setEditForm((prev) => ({
                      ...prev,
                      // Pertahankan master terpilih bila sedang edit paket
                      id_produk_master: prev.id_produk_master || null,
                      hitung_stok: true,
                      // Paket tidak punya satuan jual besar / satuan beli sendiri
                      jual_satuan: null,
                      harga_jual_besar_satuan: null,
                      harga_jual_besar_grosir: null,
                      harga_jual_besar_promo: null,
                      default_purchase_unit: null,
                    }));
                  }}
                >
                  Produk Paket
                </button>
              </div>

              {isPaket ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 pt-2">
                  <div className="flex flex-col gap-2">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Produk Master <span className="text-destructive">*</span>
                    </label>
                    <MasterCombobox
                      products={initialProducts.filter((m) => m.id !== editingId && !m.id_produk_master)}
                      value={editForm.id_produk_master ?? null}
                      onChange={(id, master) => {
                        setEditForm((prev) => ({
                          ...prev,
                          id_produk_master: id,
                          // Auto-suggest SKU suffix jika belum diisi
                          sku: prev.sku || (master?.sku ? `${master.sku}-PAKET` : prev.sku),
                        }));
                      }}
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Jenis Isi Paket
                    </label>
                    <select
                      value={editForm.jenis_isi_paket || "FIXED_RATIO"}
                      onChange={(e) => setEditForm((prev) => ({ ...prev, jenis_isi_paket: e.target.value }))}
                      className="h-11 text-sm border border-input bg-background rounded-[6px] px-3 focus:border-primary focus:ring-[3px] focus:ring-primary/20"
                    >
                      <option value="FIXED_RATIO">FIXED RATIO (Jumlah tetap per paket)</option>
                      <option value="ACTUAL_WEIGHT">ACTUAL WEIGHT (Berat per bungkus)</option>
                    </select>
                    <span className="text-xs text-muted-foreground">
                      {editForm.jenis_isi_paket === 'ACTUAL_WEIGHT'
                        ? 'Master dikurangi sesuai berat aktual, harga paket rata-rata'
                        : 'Master dikurangi qty_paket × qty_per_unit (stok tetap)'}
                    </span>
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Jumlah per Paket <span className="text-destructive">*</span>
                    </label>
                    <Input
                      type="number"
                      min={0.01}
                      step="any"
                      placeholder="Contoh: 5"
                      value={editForm.qty_per_unit ?? ""}
                      onChange={(e) => setEditForm((prev) => ({ ...prev, qty_per_unit: Number(e.target.value) }))}
                      className="h-11 tabular-nums text-sm font-medium bg-background px-3"
                    />
                    <span className="text-xs text-muted-foreground">
                      Isi per paket (misal: 5 PCS per bungkus)
                    </span>
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Satuan Isi <span className="text-muted-foreground font-normal">(opsional)</span>
                    </label>
                    <Input
                      type="text"
                      placeholder="PCS, MTR, LBR"
                      value={editForm.isi_satuan ?? ""}
                      onChange={(e) => setEditForm((prev) => ({ ...prev, isi_satuan: e.target.value || null }))}
                      className="h-11 text-sm font-medium bg-background px-3"
                    />
                    <span className="text-xs text-muted-foreground">
                      Satuan isi per paket (contoh: PCS, MTR, LBR). Kosongkan jika tidak diperlukan.
                    </span>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground -mt-2">
                  Produk normal memiliki stok sendiri dan bisa menjadi master dari produk paket.
                </p>
              )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 md:gap-8">
              {/* 1. Identitas Produk (6 columns on lg) */}
              <div className="lg:col-span-6 bg-card border border-border/70 rounded-2xl p-6 sm:p-7 shadow-2xs flex flex-col justify-between gap-6">
                <div className="flex flex-col gap-5">
                  <div className="flex items-center justify-between border-b border-border/60 pb-3">
                    <div>
                      <h4 className="text-base font-semibold text-foreground tracking-wide">Identitas Produk</h4>
                      <p className="text-xs text-muted-foreground mt-0.5">Nama, SKU, dan Barcode barang</p>
                    </div>
                    <span className="text-xs font-medium bg-muted/60 text-muted-foreground px-2.5 py-1 rounded-md">Wajib</span>
                  </div>

                  <div className="flex flex-col gap-2">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Nama Produk <span className="text-destructive">*</span>
                    </label>
                    <Input
                      autoFocus
                      placeholder="Contoh: Semen Tiga Roda 50kg"
                      value={editForm.nama_produk || ""}
                      onChange={(e) => setEditForm((prev) => ({ ...prev, nama_produk: e.target.value }))}
                      className="h-11 text-base focus-visible:ring-2 focus-visible:ring-primary/20 bg-background px-4"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    <div className="flex flex-col gap-2">
                      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">SKU</label>
                      <Input
                        placeholder="Contoh: SMN-TR-50"
                        value={editForm.sku || ""}
                        onChange={(e) => setEditForm((prev) => ({ ...prev, sku: e.target.value }))}
                        className="h-11 font-mono text-sm bg-background px-4"
                      />
                    </div>
                    <div className="flex flex-col gap-2">
                      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Barcode</label>
                      <Input
                        placeholder="Contoh: 8991234567890"
                        value={editForm.barcode || ""}
                        onChange={(e) => setEditForm((prev) => ({ ...prev, barcode: e.target.value }))}
                        className="h-11 font-mono text-sm bg-background px-4"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* 2. Kategori & Satuan Konversi (6 columns on lg) */}
              <div className="lg:col-span-6 bg-card border border-border/70 rounded-2xl p-6 sm:p-7 shadow-2xs flex flex-col justify-between gap-6">
                <div className="flex flex-col gap-5">
                  <div className="flex items-center justify-between border-b border-border/60 pb-3">
                    <div>
                      <h4 className="text-base font-semibold text-foreground tracking-wide">Kategori & Satuan</h4>
                      <p className="text-xs text-muted-foreground mt-0.5">Klasifikasi dan konversi unit pembelian</p>
                    </div>
                    <span className="text-xs font-medium bg-muted/60 text-muted-foreground px-2.5 py-1 rounded-md">Wajib</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    <div className="flex flex-col gap-2">
                      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        Kategori <span className="text-destructive">*</span>
                      </label>
                      <select
                        value={editForm.id_kategori || ""}
                        onChange={(e) => setEditForm((prev) => ({ ...prev, id_kategori: Number(e.target.value) }))}
                        className="w-full h-11 rounded-md border border-input bg-background px-3.5 text-sm shadow-2xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
                      >
                        <option value="">Pilih Kategori</option>
                        {categories.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.nama}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="flex flex-col gap-2">
                      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        Satuan Inventory <span className="text-destructive">*</span>
                      </label>
                      <select
                        value={editForm.id_satuan || ""}
                        onChange={(e) => setEditForm((prev) => ({ ...prev, id_satuan: Number(e.target.value) }))}
                        className="w-full h-11 rounded-md border border-input bg-background px-3.5 text-sm shadow-2xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
                      >
                        <option value="">Pilih Satuan Inventory</option>
                        {units.map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.nama}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Merk
                    </label>
                    <select
                      value={editForm.id_merk || ""}
                      onChange={(e) => setEditForm((prev) => ({ ...prev, id_merk: e.target.value ? Number(e.target.value) : null }))}
                      className="w-full h-11 rounded-md border border-input bg-background px-3.5 text-sm shadow-2xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
                    >
                      <option value="">Pilih Merk (Opsional)</option>
                      {merks.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.nama}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex flex-col gap-2">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Lokasi Area
                    </label>
                    <select
                      value={editForm.id_lokasi_area || ""}
                      onChange={(e) => setEditForm((prev) => ({ ...prev, id_lokasi_area: e.target.value ? Number(e.target.value) : null }))}
                      className="w-full h-11 rounded-md border border-input bg-background px-3.5 text-sm shadow-2xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
                    >
                      <option value="">Pilih Lokasi (Opsional)</option>
                      {lokasiAreas.map((l) => (
                        <option key={l.id} value={l.id}>
                          {l.nama}
                        </option>
                      ))}
                    </select>
                  </div>

                  {!isPaket && (
                  <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-3 border-t border-border/40">
                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider" title="Satuan pembelian">
                          Sat. Beli
                        </label>
                        <select
                          value={editForm.default_purchase_unit || ""}
                          onChange={(e) => setEditForm((prev) => {
                            const unit = e.target.value;
                            // Jika satuan jual besar aktif, ikuti Sat. Beli (Opsi A)
                            const jualSatuan = prev.jual_satuan ? (unit || null) : prev.jual_satuan;
                            return { ...prev, default_purchase_unit: unit, jual_satuan: jualSatuan };
                          })}
                          className="w-full h-11 rounded-md border border-input bg-background px-3 text-xs font-medium shadow-2xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
                        >
                          <option value="">(sama)</option>
                          {units.map((u) => (
                            <option key={u.id} value={u.nama}>
                              {u.nama}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                          Rasio
                        </label>
                        <Input
                          type="number"
                          min={1}
                          value={editForm.conversion_ratio ?? 1}
                          onChange={(e) => setEditForm((prev) => ({ ...prev, conversion_ratio: Number(e.target.value) }))}
                          className="h-11 tabular-nums text-sm font-medium bg-background px-3"
                        />
                      </div>
                    </div>

                    {/* Sell Unit — toggle besar (on = jual_satuan mengikuti default_purchase_unit) */}
                     <div className="flex flex-col gap-1.5">
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex flex-col gap-0.5">
                            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider" title="Satuan jual besar (opsional)">
                              Jual dalam Satuan Besar
                            </label>
                            {editForm.jual_satuan ? (
                              <p className="text-[11px] text-muted-foreground italic pt-0.5">
                                Satuan jual: {editForm.jual_satuan} · 1 {editForm.jual_satuan} = {editForm.conversion_ratio ?? 1} satuan inventory
                              </p>
                            ) : (
                              <p className="text-[11px] text-muted-foreground pt-0.5">
                                Satuan jual besar mengikuti Sat. Beli{editForm.default_purchase_unit ? ` (${editForm.default_purchase_unit})` : " (kosong)"}
                              </p>
                            )}
                          </div>
                          <Switch
                            checked={!!editForm.jual_satuan}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                if (!editForm.default_purchase_unit) {
                                  setErrorMsg("Isi Sat. Beli terlebih dahulu untuk mengaktifkan satuan jual besar");
                                  return;
                                }
                                setEditForm((prev) => ({ ...prev, jual_satuan: prev.default_purchase_unit }));
                              } else {
                                setEditForm((prev) => ({
                                  ...prev,
                                  jual_satuan: null,
                                  harga_jual_besar_satuan: null,
                                  harga_jual_besar_grosir: null,
                                  harga_jual_besar_promo: null,
                                }));
                              }
                            }}
                            aria-label="Jual dalam satuan besar"
                          />
                        </div>
                      </div>

                    {/* Harga Jual Besar — otomatis = harga kecil × rasio (read-only) */}
                    {editForm.jual_satuan && (
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 pt-3 border-t border-border/40">
                        <div className="flex flex-col gap-1.5">
                          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                            Harga {editForm.jual_satuan} (Satuan)
                          </label>
                          <div className="h-11 rounded-md border border-border bg-muted/30 px-3.5 flex items-center text-sm font-semibold tabular-nums text-foreground">
                            {formatIDR(Math.round((editForm.harga_jual_satuan || 0) * (editForm.conversion_ratio || 1)))}
                          </div>
                          <span className="text-[10px] leading-snug text-muted-foreground/80">
                            Otomatis = {formatIDR(editForm.harga_jual_satuan || 0)} × {editForm.conversion_ratio || 1}
                          </span>
                        </div>
                        <div className="flex flex-col gap-1.5">
                          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                            Harga {editForm.jual_satuan} (Grosir)
                          </label>
                          <div className="h-11 rounded-md border border-border bg-muted/30 px-3.5 flex items-center text-sm font-semibold tabular-nums text-foreground">
                            {formatIDR(Math.round((editForm.harga_jual_grosir || 0) * (editForm.conversion_ratio || 1)))}
                          </div>
                          <span className="text-[10px] leading-snug text-muted-foreground/80">
                            Otomatis = {formatIDR(editForm.harga_jual_grosir || 0)} × {editForm.conversion_ratio || 1}
                          </span>
                        </div>
                        <div className="flex flex-col gap-1.5">
                          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                            Harga {editForm.jual_satuan} (Promo)
                          </label>
                          <div className="h-11 rounded-md border border-border bg-muted/30 px-3.5 flex items-center text-sm font-semibold tabular-nums text-foreground">
                            {editForm.harga_jual_promo != null
                              ? formatIDR(Math.round(editForm.harga_jual_promo * (editForm.conversion_ratio || 1)))
                              : "-"}
                          </div>
                          <span className="text-[10px] leading-snug text-muted-foreground/80">
                            Otomatis = Harga Promo × {editForm.conversion_ratio || 1} (isi Harga Promo untuk mengaktifkan)
                          </span>
                        </div>
                      </div>
                    )}
                  </>
                  )}
                </div>
              </div>

              {/* 3. Manajemen Stok (Full width card with 2 columns inside) */}
              
              <div className="lg:col-span-12 bg-card border border-border/70 rounded-2xl p-6 sm:p-7 shadow-2xs flex flex-col gap-5">
                <div className="flex items-center justify-between border-b border-border/60 pb-3">
                  <div>
                    <h4 className="text-base font-semibold text-foreground tracking-wide">Manajemen & Aturan Stok</h4>
                    <p className="text-xs text-muted-foreground mt-0.5">Pengaturan pelacakan kuantitas display & gudang serta peringatan stok menipis</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="p-4 rounded-xl border border-border bg-muted/15 flex items-start gap-4 hover:bg-muted/25 transition-colors">
                    <input
                      type="checkbox"
                      id="modal_hitung_stok"
                      checked={editForm.hitung_stok ?? true}
                      onChange={(e) => setEditForm((prev) => ({ ...prev, hitung_stok: e.target.checked }))}
                      className="mt-1 h-5 w-5 rounded border-input text-primary accent-primary cursor-pointer"
                    />
                    <div className="flex flex-col">
                      <label htmlFor="modal_hitung_stok" className="text-base font-medium text-foreground cursor-pointer">
                        Lacak Stok Produk Ini
                      </label>
                      <p className="text-xs text-muted-foreground leading-relaxed mt-0.5">
                        Apabila diaktifkan, penjualan dan barang masuk akan otomatis mengurangi/menambah kuantitas stok.
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-col gap-4">
                    <div className="flex flex-col gap-2">
                      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        Batas Min Stok Display {satuanNama ? `(${satuanNama})` : ""}
                      </label>
                      <Input
                        type="number"
                        min={0}
                        value={editForm.stok_minimum ?? 5}
                        onChange={(e) => setEditForm((prev) => ({ ...prev, stok_minimum: Number(e.target.value) }))}
                        className="h-11 tabular-nums text-sm font-medium bg-background px-4 w-full"
                      />
                      <span className="text-xs text-muted-foreground">Peringatan jika stok display ≤ jumlah ini.</span>
                    </div>
                    <div className="flex flex-col gap-2">
                      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        Batas Min Stok Gudang {satuanNama ? `(${satuanNama})` : ""}
                      </label>
                      <Input
                        type="number"
                        min={0}
                        placeholder="Kosongkan = nonaktif"
                        value={editForm.stok_minimum_gudang ?? ""}
                        onChange={(e) => setEditForm((prev) => ({ ...prev, stok_minimum_gudang: e.target.value ? Number(e.target.value) : null }))}
                        className="h-11 tabular-nums text-sm font-medium bg-background px-4 w-full"
                      />
                      <span className="text-xs text-muted-foreground">Peringatan jika stok gudang ≤ jumlah ini (termasuk 0). Kosongkan untuk nonaktif.</span>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Info stok paket */}
              {isPaket && (
                <div className="lg:col-span-12 bg-card border border-border/70 rounded-2xl p-6 sm:p-7 shadow-2xs flex flex-col gap-4">
                  <div className="flex items-center justify-between border-b border-border/60 pb-3">
                    <div>
                      <h4 className="text-base font-semibold text-foreground tracking-wide">Stok Paket</h4>
                      <p className="text-xs text-muted-foreground mt-0.5">Stok paket dikelola terpisah dan diisi manual dari stok master</p>
                    </div>
                  </div>
                  <div className="p-4 rounded-xl border border-border bg-muted/15 text-sm text-muted-foreground leading-relaxed">
                    {(editForm.jenis_isi_paket === 'ACTUAL_WEIGHT') ? (
                      <>
                        Mode <span className="font-medium text-foreground">ACTUAL WEIGHT</span> — stok master dikurangi sesuai berat aktual.
                        Harga per paket = (total berat × HPP master) ÷ jumlah bungkus.
                        {editForm.qty_per_unit && editForm.isi_satuan && (
                          <> Setiap paket berisi <span className="font-medium text-foreground">{editForm.qty_per_unit} {editForm.isi_satuan}</span>.</>
                        )}
                      </>
                    ) : (
                      <>
                        Mode <span className="font-medium text-foreground">FIXED RATIO</span> — 1 paket = <span className="font-medium text-foreground">{editForm.qty_per_unit || "-"} {editForm.isi_satuan || "satuan"}</span> produk master.
                        Master dikurangi otomatis sesuai jumlah paket × qty_per_unit.
                      </>
                    )}
                    Gunakan tombol <span className="font-medium text-foreground">Isi Stok Paket</span> (di daftar inventaris) untuk
                    mengonversi stok master menjadi stok paket. Stok paket terlacak sendiri sehingga bisa dijual &amp; dihitung stok opname secara mandiri.
                  </div>
                </div>
              )}

              {/* 4. Penetapan Harga (Full width card with 5 price inputs) */}
              <div className="lg:col-span-12 bg-card border border-border/70 rounded-2xl p-6 sm:p-7 shadow-2xs flex flex-col gap-5">
                <div className="flex items-center justify-between border-b border-border/60 pb-3">
                  <div>
                    <h4 className="text-base font-semibold text-foreground tracking-wide">Penetapan Harga & Diskon (IDR)</h4>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Tier harga (Retail / Grosir / Promo) dipilih kasir saat transaksi. Diskon Item adalah potongan Rp per satuan yang otomatis mengurangi harga berapapun tier-nya.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 lg:gap-6">
                  <div className="flex flex-col gap-2 bg-muted/15 p-4 rounded-xl border border-border/60">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Harga Modal</label>
                    <Input
                      type="number"
                      placeholder="0"
                      value={editForm.harga_modal || ""}
                      onChange={(e) => setEditForm((prev) => ({ ...prev, harga_modal: Number(e.target.value) }))}
                      className="h-11 tabular-nums font-mono text-sm bg-background"
                    />
                    <p className="text-[10px] leading-snug text-muted-foreground/80">Harga beli/pokok — fallback HPP jika AVCO kosong</p>
                  </div>

                  <div className="flex flex-col gap-2 bg-muted/15 p-4 rounded-xl border border-border/60">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Harga Retail (Jual)</label>
                    <Input
                      type="number"
                      placeholder="0"
                      value={editForm.harga_jual_satuan || ""}
                      onChange={(e) => setEditForm((prev) => ({ ...prev, harga_jual_satuan: Number(e.target.value) }))}
                      className="h-11 tabular-nums font-mono text-sm font-semibold text-foreground bg-background"
                    />
                    <p className="text-[10px] leading-snug text-muted-foreground/80">Harga normal — tier default di POS</p>
                  </div>

                  <div className="flex flex-col gap-2 bg-muted/15 p-4 rounded-xl border border-border/60">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Harga Grosir</label>
                    <Input
                      type="number"
                      placeholder="0"
                      value={editForm.harga_jual_grosir || ""}
                      onChange={(e) => setEditForm((prev) => ({ ...prev, harga_jual_grosir: Number(e.target.value) }))}
                      className="h-11 tabular-nums font-mono text-sm bg-background"
                    />
                    <p className="text-[10px] leading-snug text-muted-foreground/80">Harga untuk pembelian jumlah besar</p>
                  </div>

                  <div className="flex flex-col gap-2 bg-muted/15 p-4 rounded-xl border border-border/60">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Harga Promo</label>
                    <Input
                      type="number"
                      placeholder="0"
                      value={editForm.harga_jual_promo || ""}
                      onChange={(e) => setEditForm((prev) => ({ ...prev, harga_jual_promo: Number(e.target.value) }))}
                      className="h-11 tabular-nums font-mono text-sm bg-background"
                    />
                    <p className="text-[10px] leading-snug text-muted-foreground/80">Tier harga promo — dipilih kasir di POS. Kosongkan jika tidak ada</p>
                  </div>

                  <div className="flex flex-col gap-2 bg-primary/5 p-4 rounded-xl border border-primary/25">
                    <label className="text-xs font-semibold text-primary uppercase tracking-wider">Diskon Item</label>
                    <Input
                      type="number"
                      placeholder="0"
                      value={editForm.diskon || 0}
                      onChange={(e) => setEditForm((prev) => ({ ...prev, diskon: Number(e.target.value) }))}
                      className="h-11 tabular-nums font-mono text-sm font-semibold border-primary/30 bg-background text-primary"
                    />
                    <p className="text-[10px] leading-snug text-muted-foreground/80">Potongan Rp tetap per satuan — otomatis dikurangi dari semua tier</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Sticky Footer */}
          <DialogFooter className="p-5 sm:p-6 pt-4 border-t border-border/80 bg-muted/20 shrink-0 flex flex-row items-center justify-between gap-4">
            <p className="text-xs text-muted-foreground hidden sm:block">
              * Pastikan semua informasi wajib (* ) telah terisi sebelum menyimpan produk.
            </p>
            <div className="flex items-center gap-3.5 w-full sm:w-auto justify-end">
              <Button
                variant="outline"
                className="px-4 sm:px-6 h-11 rounded-full bg-background flex-1 sm:flex-none text-sm font-medium"
                onClick={handleCancelInline}
                disabled={isPending}
              >
                Batal
              </Button>
              <Button
                variant="default"
                className="px-4 sm:px-8 h-11 rounded-full shadow-sm flex-1 sm:flex-none text-sm font-medium"
                onClick={handleSaveInline}
                disabled={isPending}
              >
                {isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Check className="h-4 w-4 mr-2" />}
                Simpan Produk
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Isi Stok Paket Modal */}
      {fillPaketModal.open && fillPaketModal.product && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-overlay/40 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-background border border-border shadow-[0_8px_24px_rgba(0,55,112,0.08),0_2px_6px_rgba(0,55,112,0.04)] rounded-[12px] w-full max-w-lg flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary mx-auto mb-4">
                <PackagePlus className="w-6 h-6" />
              </div>
              <h2 className="text-[22px] font-light tracking-tight text-foreground mb-2 text-center">Isi Stok Paket</h2>
              <p className="text-sm text-muted-foreground text-center mb-6">
                Konversi stok <strong className="text-foreground">{fillPaketModal.product.master?.nama_produk || "master"}</strong> menjadi paket <strong className="text-foreground">{fillPaketModal.product.nama_produk}</strong> (1 {fillPaketModal.product.satuan?.nama ?? "paket"} = {fillPaketModal.product.qty_per_unit ?? 1}{fillPaketModal.product.isi_satuan ? ` ${fillPaketModal.product.isi_satuan}` : ""})
                <span className="block mt-1 text-xs text-muted-foreground">Stok paket masuk ke <strong>gudang</strong>. Pindahkan ke display lewat tombol <strong>Pindah ke Display</strong> saat dibutuhkan.</span>
              </p>
              <div className="flex gap-4 mb-6">
                <div className="flex-1 bg-muted/30 rounded-lg p-4 text-center">
                  <p className="text-xs text-muted-foreground mb-1">Stok Master</p>
                  <p className="text-2xl font-semibold tabular-nums">
                    {(fillPaketModal.product.master?.stok ?? 0) + (fillPaketModal.product.master?.stok_gudang ?? 0)}
                  </p>
                </div>
                <div className="flex-1 bg-muted/30 rounded-lg p-4 text-center">
                  <p className="text-xs text-muted-foreground mb-1">Stok Paket — Display</p>
                  <p className="text-2xl font-semibold tabular-nums">{fillPaketModal.product.stock}</p>
                </div>
                <div className="flex-1 bg-muted/30 rounded-lg p-4 text-center">
                  <p className="text-xs text-muted-foreground mb-1">Stok Paket — Gudang</p>
                  <p className="text-2xl font-semibold tabular-nums">{fillPaketModal.product.stok_gudang ?? 0}</p>
                </div>
              </div>
              <label className="text-sm font-medium text-foreground mb-2 block">Jumlah paket diisi</label>
              <Input type="number" min={1} value={fillPaketModal.qty}
                onChange={(e) => setFillPaketModal(prev => ({ ...prev, qty: e.target.value, error: "" }))}
                className="h-12 text-lg text-center tabular-nums" autoFocus />
              {fillPaketModal.product.jenis_isi_paket === 'ACTUAL_WEIGHT' && (
                <>
                  <label className="text-sm font-medium text-foreground mt-4 mb-2 block">
                    Total Berat (satuan master)
                  </label>
                  <Input type="number" min={0.01} step="any" value={fillPaketModal.totalBerat}
                    onChange={(e) => setFillPaketModal(prev => ({ ...prev, totalBerat: e.target.value, error: "" }))}
                    placeholder="Contoh: 10.5"
                    className="h-12 text-lg text-center tabular-nums" />
                  <span className="text-xs text-muted-foreground mt-1 text-center">
                    Harga per paket = (Total Berat × HPP Master) ÷ Jumlah Paket
                  </span>
                </>
              )}
              {fillPaketModal.error && (
                <div className="mt-4 p-3 bg-destructive/10 border border-destructive/20 rounded-lg flex items-center gap-2 text-destructive text-sm">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  {fillPaketModal.error}
                </div>
              )}
            </div>
            <div className="shrink-0 px-6 py-5 border-t border-border bg-transparent flex justify-end gap-3">
              <Button variant="outline" className="rounded-full px-6 bg-background" onClick={() => setFillPaketModal({ open: false, product: null, qty: "1", totalBerat: "", error: "" })} disabled={isPending}>
                Batal
              </Button>
              <Button variant="default" className="rounded-full px-6 shadow-sm" onClick={handleFillPaket} disabled={isPending}>
                {isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Isi Stok Paket
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Pindah ke Display Modal */}
      {displayModal.open && displayModal.product && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-overlay/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-background border border-border shadow-[0_8px_24px_rgba(0,55,112,0.08),0_2px_6px_rgba(0,55,112,0.04)] rounded-[12px] w-full max-w-md flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary mx-auto mb-4">
                <ArrowUp className="w-6 h-6" />
              </div>
              <h2 className="text-[22px] font-light tracking-tight text-foreground mb-2 text-center">Pindah ke Display</h2>
              <p className="text-sm text-muted-foreground text-center mb-6">
                Pindahkan stok dari gudang ke display untuk <strong className="text-foreground">{displayModal.product.nama_produk}</strong>
              </p>
              <div className="flex gap-4 mb-6">
                <div className="flex-1 bg-muted/30 rounded-lg p-4 text-center">
                  <p className="text-xs text-muted-foreground mb-1">Stok Display</p>
                  <p className="text-2xl font-semibold tabular-nums">{displayModal.product.stock}</p>
                </div>
                <div className="flex-1 bg-muted/30 rounded-lg p-4 text-center">
                  <p className="text-xs text-muted-foreground mb-1">Stok Gudang</p>
                  <p className="text-2xl font-semibold tabular-nums">{displayModal.product.stok_gudang}</p>
                </div>
              </div>
              <label className="text-sm font-medium text-foreground mb-2 block">Jumlah pindah</label>
              <Input type="number" min={1} max={displayModal.product.stok_gudang} value={displayModal.qty}
                onChange={(e) => setDisplayModal(prev => ({ ...prev, qty: e.target.value, error: "" }))}
                className="h-12 text-lg text-center tabular-nums" autoFocus />
              {displayModal.error && (
                <div className="mt-4 p-3 bg-destructive/10 border border-destructive/20 rounded-lg flex items-center gap-2 text-destructive text-sm">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  {displayModal.error}
                </div>
              )}
            </div>
            <div className="shrink-0 px-6 py-5 border-t border-border bg-transparent flex justify-end gap-3">
              <Button variant="outline" className="rounded-full px-6 bg-background" onClick={() => setDisplayModal({ open: false, product: null, qty: "1", error: "" })} disabled={isPending}>
                Batal
              </Button>
              <Button variant="default" className="rounded-full px-6 shadow-sm" onClick={handleMoveToDisplay} disabled={isPending}>
                {isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Pindah ke Display
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Pindah ke Gudang Modal */}
      {gudangModal.open && gudangModal.product && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-overlay/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-background border border-border shadow-[0_8px_24px_rgba(0,55,112,0.08),0_2px_6px_rgba(0,55,112,0.04)] rounded-[12px] w-full max-w-md flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6">
              <div className="w-12 h-12 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-600 mx-auto mb-4">
                <ArrowDown className="w-6 h-6" />
              </div>
              <h2 className="text-[22px] font-light tracking-tight text-foreground mb-2 text-center">Pindah ke Gudang</h2>
              <p className="text-sm text-muted-foreground text-center mb-6">
                Pindahkan stok dari display ke gudang untuk <strong className="text-foreground">{gudangModal.product.nama_produk}</strong>
              </p>
              <div className="flex gap-4 mb-6">
                <div className="flex-1 bg-muted/30 rounded-lg p-4 text-center">
                  <p className="text-xs text-muted-foreground mb-1">Stok Display</p>
                  <p className="text-2xl font-semibold tabular-nums">{gudangModal.product.stock}</p>
                </div>
                <div className="flex-1 bg-muted/30 rounded-lg p-4 text-center">
                  <p className="text-xs text-muted-foreground mb-1">Stok Gudang</p>
                  <p className="text-2xl font-semibold tabular-nums">{gudangModal.product.stok_gudang}</p>
                </div>
              </div>
              <label className="text-sm font-medium text-foreground mb-2 block">Jumlah pindah</label>
              <Input type="number" min={1} max={gudangModal.product.stock ?? 0} value={gudangModal.qty}
                onChange={(e) => setGudangModal(prev => ({ ...prev, qty: e.target.value, error: "" }))}
                className="h-12 text-lg text-center tabular-nums" autoFocus />
              {gudangModal.error && (
                <div className="mt-4 p-3 bg-destructive/10 border border-destructive/20 rounded-lg flex items-center gap-2 text-destructive text-sm">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  {gudangModal.error}
                </div>
              )}
            </div>
            <div className="shrink-0 px-6 py-5 border-t border-border bg-transparent flex justify-end gap-3">
              <Button variant="outline" className="rounded-full px-6 bg-background" onClick={() => setGudangModal({ open: false, product: null, qty: "1", error: "" })} disabled={isPending}>
                Batal
              </Button>
              <Button variant="default" className="rounded-full px-6 shadow-sm bg-amber-600 hover:bg-amber-700 text-white border-amber-600" onClick={handleMoveToGudang} disabled={isPending}>
                {isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Pindah ke Gudang
              </Button>
            </div>
          </div>
        </div>
      )}

      <ProductDetailSheet
        product={selectedProduct}
        open={selectedProduct !== null}
        onOpenChange={(open) => { if (!open) setSelectedProduct(null); }}
      />

      <ImportCSVModal
        open={isImportOpen}
        onOpenChange={setIsImportOpen}
        title="Import Data Produk / Inventaris"
        description="Unggah file Excel (.xlsx) atau CSV. Produk yang sudah ada (berdasarkan Barcode/SKU/Nama) akan otomatis di-update harganya (stok tetap). Produk baru akan ditambahkan."
        templateFilename="Template_Import_Produk"
        templateHeaders={[
          "Nama Produk",
          "SKU / Kode Produk",
          "Barcode",
          "Kategori",
          "Satuan Dasar",
          "Merk / Brand",
          "Lokasi / Rak",
          "Hitung Stok (ya/tidak)",
          "Harga Modal / Beli",
          "Harga Jual Eceran",
          "Harga Jual Grosir",
          "Harga Jual Promo",
          "Diskon per Item (Rp)",
          "Stok di Rak / Display",
          "Stok di Gudang",
          "Stok Minimum",
          "Stok Minimum Gudang",
          "Satuan Beli dari Supplier",
          "Isi per Satuan Beli",
          "Satuan Jual Besar",
          "Produk Master (ID)",
          "Qty Isi per Paket",
          "Jenis Isi Paket",
          "Satuan Isi Paket",
        ]}
        sampleRows={[
          [
            "Semen Gresik 50kg",
            "SMN-GRS-50",
            "8991234567890",
            "Semen",
            "Zak",
            "Semen Indonesia",
            "Rak A1",
            "ya",
            "62000",
            "68000",
            "65000",
            "",
            "0",
            "50",
            "200",
            "10",
            "",
            "Zak",
            "1",
            "Dus",
            "",
            "",
            "",
            "",
            "",
          ],
          [
            "Paku Kayu 3 inchi",
            "PKU-KY-03",
            "8999876543210",
            "Paku & Baut",
            "Kg",
            "Lokal",
            "Rak B2",
            "ya",
            "15000",
            "20000",
            "18000",
            "",
            "0",
            "20",
            "50",
            "5",
            "",
            "Dus",
            "10",
            "Dus",
            "",
            "",
            "",
            "",
            "",
          ],
        ]}
        templateInstructions={[
          "1. Isi data produk pada sheet \"Data Produk\". Baris contoh boleh dihapus sebelum mengisi data asli.",
          "2. Kolom yang WAJIB diisi: Nama Produk. Kolom lain boleh dikosongkan (memakai nilai default).",
          "3. Kategori, Satuan, Merk, dan Lokasi dibuat otomatis jika belum ada — gunakan nama yang sama persis agar tidak dobel.",
          "4. Harga ditulis angka Rupiah tanpa titik/koma ribuan (contoh: 68000, bukan 68.000).",
          "5. Jika Barcode, SKU, atau Nama Produk sama dengan barang di sistem, sistem akan MELAKUKAN UPDATE pada kolom lainnya.",
          "6. KHUSUS UPDATE: Nilai STOK pada Excel akan DIABAIKAN untuk mencegah tertimpanya stok jika ada barang terjual selama Anda mengedit file.",
          "7. Untuk penjelasan lengkap setiap kolom, lihat tabel \"TABEL PENJELASAN KOLOM\" di bawah.",
          "8. Simpan file sebagai .xlsx lalu unggah melalui tombol \"Import Data\".",
        ]}
        templateColumnGuide={[
          { kolom: "Nama Produk", wajib: true, penjelasan: "Nama barang yang dijual. Satu-satunya kolom wajib.", contoh: "Semen Gresik 50kg" },
          { kolom: "SKU / Kode Produk", penjelasan: "Kode unik produk (disarankan diisi). Boleh kombinasi huruf, angka, dan tanda hubung. Kosongkan jika tidak ada.", contoh: "SMN-GRS-50" },
          { kolom: "Barcode", penjelasan: "Nomor barcode produk. Harus unik — jangan sama dengan produk lain. Kosongkan jika produk tidak punya barcode.", contoh: "8991234567890" },
          { kolom: "Kategori", penjelasan: "Jenis / kelompok produk, misal Semen, Cat, Paku & Baut. Jika belum ada, dibuat otomatis. Gunakan nama yang sama persis agar tidak dobel.", contoh: "Semen" },
          { kolom: "Satuan Dasar", penjelasan: "Satuan terkecil untuk stok dan harga (per 1 item). Contoh: Zak, Kg, Pcs, Meter, Lembar, Dus.", contoh: "Zak" },
          { kolom: "Merk / Brand", penjelasan: "Merek produk (opsional). Dibuat otomatis jika belum ada.", contoh: "Semen Indonesia" },
          { kolom: "Lokasi / Rak", penjelasan: "Letak penyimpanan produk di toko / gudang (opsional). Dibuat otomatis jika belum ada.", contoh: "Rak A1" },
          { kolom: "Hitung Stok (ya/tidak)", penjelasan: "Isi \"ya\" jika stok dihitung otomatis, \"tidak\" untuk produk yang stoknya tidak perlu dihitung (misal jasa). Default: ya.", contoh: "ya" },
          { kolom: "Harga Modal / Beli", penjelasan: "Harga beli / harga pokok per satuan dasar, dalam Rupiah. Dipakai untuk menghitung laba. Angka tanpa titik ribuan.", contoh: "62000" },
          { kolom: "Harga Jual Eceran", penjelasan: "Harga jual normal per satuan dasar — harga yang muncul pertama di kasir (tier default).", contoh: "68000" },
          { kolom: "Harga Jual Grosir", penjelasan: "Harga untuk pembelian jumlah besar per satuan dasar (opsional, boleh sama dengan eceran).", contoh: "65000" },
          { kolom: "Harga Jual Promo", penjelasan: "Harga tier promo per satuan dasar (opsional). Kosongkan jika tidak ada harga promo.", contoh: "60000" },
          { kolom: "Diskon per Item (Rp)", penjelasan: "Potongan harga tetap dalam Rupiah per 1 satuan, otomatis dikurangi dari harga berapapun tier-nya. Isi 0 jika tidak ada.", contoh: "0" },
          { kolom: "Stok di Rak / Display", penjelasan: "Jumlah stok yang tersedia di rak toko (opsional — stok biasanya ditambah lewat menu Barang Masuk).", contoh: "50" },
          { kolom: "Stok di Gudang", penjelasan: "Jumlah stok yang tersimpan di gudang (opsional).", contoh: "200" },
          { kolom: "Stok Minimum", penjelasan: "Batas stok DISPLAY untuk peringatan \"stok menipis\" di dashboard. Dalam satuan dasar. Default: 5.", contoh: "10" },
          { kolom: "Stok Minimum Gudang", penjelasan: "Batas stok GUDANG untuk peringatan \"stok gudang menipis\" (opsional, kosongkan = nonaktif). Dalam satuan dasar, misal 500 = peringatan saat stok gudang 500 atau kurang.", contoh: "500" },
          { kolom: "Satuan Beli dari Supplier", penjelasan: "Satuan saat membeli dari supplier, jika berbeda dari satuan dasar (opsional). Contoh: beli per Dus padahal satuan dasar Kg.", contoh: "Dus" },
          { kolom: "Isi per Satuan Beli", penjelasan: "Berapa satuan dasar dalam 1 satuan beli. Contoh: 1 Dus = 10 Kg, isi \"10\". Default: 1.", contoh: "10" },
          { kolom: "Satuan Jual Besar", penjelasan: "Satuan besar untuk menjual produk (opsional), misal Dus, Roll, Set. Kosongkan jika hanya dijual per satuan dasar. Harga jual besar dihitung OTOMATIS = harga jual kecil × isi per satuan beli.", contoh: "Dus" },
          { kolom: "Produk Master (ID)", penjelasan: "Khusus produk PAKET: isi ID produk induk/master (angka). Kosongkan untuk produk biasa. Lihat ID produk di halaman Inventaris.", contoh: "12" },
          { kolom: "Qty Isi per Paket", penjelasan: "Jumlah isi dalam 1 paket — khusus produk paket (opsional).", contoh: "50" },
          { kolom: "Jenis Isi Paket", penjelasan: "Cara menghitung isi paket: FIXED_RATIO (isi tetap) atau ACTUAL_WEIGHT (dihitung dari berat asli). Khusus produk paket.", contoh: "FIXED_RATIO" },
          { kolom: "Satuan Isi Paket", penjelasan: "Satuan untuk isi paket, misal kg, pcs, lembar (khusus produk paket).", contoh: "kg" },
        ]}
        validateRow={(row) => {
          const name = row["Nama Produk"] || row["nama_produk"] || "";
          if (!name.trim()) {
            return "Nama Produk wajib diisi";
          }
          return null;
        }}
        onImport={importProducts}
      />
    </>
  );
}
