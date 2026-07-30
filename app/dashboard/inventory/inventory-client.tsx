"use client";

import { useState, useMemo, useTransition, useDeferredValue } from "react";
import { Plus, PackageOpen, X, AlertCircle, Check, Loader2, Edit2, Trash2, Download, Warehouse, Eye, EyeOff, Upload } from "lucide-react";
import { useTable } from "@/hooks/use-table";
import DataTable, { type Column, type FilterDef, type DeleteModalConfig } from "@/components/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TableCell, TableRow } from "@/components/ui/table";
import { addProduct, updateProduct, deleteProduct, restockDisplay, importProducts } from "./actions";
import { exportToCSV, exportToPDF } from "@/lib/export-utils";
import ProductDetailSheet from "@/components/product-detail-sheet";
import ImportCSVModal from "@/components/import-csv-modal";
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

interface Product {
  id: number;
  sku: string | null;
  nama_produk: string;
  id_kategori: number;
  id_satuan: number;
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
  harga_pokok_avco: number;
  nilai_persediaan: number;
  base_unit: string;
  default_purchase_unit: string | null;
  conversion_ratio: number;
  kategori: { nama: string } | null;
  satuan: { nama: string } | null;
}

export default function InventoryClient({
  initialProducts,
  categories,
  units
}: {
  initialProducts: Product[];
  categories: { id: number; nama: string }[];
  units: { id: number; nama: string }[];
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [stockFilter, setStockFilter] = useState("all");
  const [isImportOpen, setIsImportOpen] = useState(false);

  const [isPending, startTransition] = useTransition();

  const [editingId, setEditingId] = useState<number | 'new' | null>(null);
  const [editForm, setEditForm] = useState<Partial<Product>>({});

  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  const [restockModal, setRestockModal] = useState<{ open: boolean; product: Product | null; qty: string; error: string }>({
    open: false, product: null, qty: "1", error: "",
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
          p.kategori?.nama.toLowerCase().includes(q)
      );
    }

    if (categoryFilter !== "all") {
      result = result.filter((p) => p.id_kategori.toString() === categoryFilter);
    }

    if (stockFilter !== "all") {
      result = result.filter((p) => {
        if (stockFilter === "untracked") return !p.hitung_stok;
        if (!p.hitung_stok || p.stock === null) return false;
        if (stockFilter === "out") return p.stock <= 0;
        if (stockFilter === "low") return p.stock > 0 && p.stock <= p.stok_minimum;
        if (stockFilter === "in") return p.stock > p.stok_minimum;
        return true;
      });
    }

    return result;
  }, [initialProducts, deferredSearchQuery, categoryFilter, stockFilter]);

  const table = useTable({ data: filteredData, defaultItemsPerPage: 25 });

  const handleSaveInline = () => {
    if (!editForm.nama_produk?.trim()) { setErrorMsg("Nama produk wajib diisi"); return; }
    if (!editForm.id_kategori) { setErrorMsg("Kategori wajib dipilih"); return; }
    if (!editForm.id_satuan) { setErrorMsg("Satuan wajib dipilih"); return; }
    setErrorMsg("");

    const data = {
      nama_produk: editForm.nama_produk, id_kategori: Number(editForm.id_kategori),
      id_satuan: Number(editForm.id_satuan), hitung_stok: Boolean(editForm.hitung_stok),
      sku: editForm.sku || null,
      barcode: editForm.barcode || null, harga_modal: Number(editForm.harga_modal || 0),
      harga_jual_satuan: Number(editForm.harga_jual_satuan || 0),
      harga_jual_grosir: Number(editForm.harga_jual_grosir || 0),
      harga_jual_promo: editForm.harga_jual_promo ? Number(editForm.harga_jual_promo) : null,
      diskon: Number(editForm.diskon || 0), stok_minimum: Number(editForm.stok_minimum ?? 5),
      base_unit: editForm.base_unit || "pcs",
      default_purchase_unit: editForm.default_purchase_unit || null,
      conversion_ratio: Number(editForm.conversion_ratio ?? 1),
    };

    startTransition(async () => {
      const res = editingId === "new" ? await addProduct(data) : await updateProduct(editingId as number, data);
      if (res?.error) { setErrorMsg(res.error); } else { setEditingId(null); setEditForm({}); }
    });
  };

  const handleCancelInline = () => { setEditingId(null); setEditForm({}); setErrorMsg(""); };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget?.id) return;
    setErrorMsg("");
    startTransition(async () => {
      const res = await deleteProduct(deleteTarget.id);
      if (res?.error) { setErrorMsg(res.error); } else { setDeleteTarget(null); }
    });
  };

  const handleRestock = async () => {
    if (!restockModal.product) return;
    const qty = parseInt(restockModal.qty, 10);
    if (isNaN(qty) || qty <= 0) { setRestockModal(prev => ({ ...prev, error: "Jumlah harus lebih dari 0" })); return; }
    if (qty > restockModal.product.stok_gudang) { setRestockModal(prev => ({ ...prev, error: `Stok gudang tidak mencukupi. Tersedia: ${restockModal.product!.stok_gudang}` })); return; }
    setRestockModal(prev => ({ ...prev, error: "" }));
    startTransition(async () => {
      const res = await restockDisplay(restockModal.product!.id, qty);
      if (res?.error) { setRestockModal(prev => ({ ...prev, error: res.error })); } else { setRestockModal({ open: false, product: null, qty: "1", error: "" }); }
    });
  };

  const handleEditClick = (e: React.MouseEvent, product: Product) => {
    e.stopPropagation();
    setEditingId(product.id);
    setEditForm({ ...product, hitung_stok: product.hitung_stok ?? true });
    setErrorMsg("");
  };

  const getStockBadge = (hitung_stok: boolean, stock: number | null, stok_minimum = 5) => {
    if (!hitung_stok) return <Badge variant="outline" className="text-muted-foreground border-border/50 font-normal rounded-full px-2 py-0.5 text-[10px] uppercase tracking-widest leading-tight">Tidak dilacak</Badge>;
    if (stock === null) return null;
    if (stock <= 0) return <Badge variant="secondary" className="bg-destructive/10 text-destructive font-medium border-none rounded-full px-2 py-0.5 text-[10px] uppercase tracking-widest leading-tight">Habis</Badge>;
    if (stock <= stok_minimum) return <Badge variant="secondary" className="bg-warning/10 text-warning font-medium border-none rounded-full px-2 py-0.5 text-[10px] uppercase tracking-widest leading-tight">{stock} Sisa</Badge>;
    return <Badge variant="secondary" className="bg-primary/10 text-primary font-medium border-none rounded-full px-2 py-0.5 text-[10px] uppercase tracking-widest leading-tight">Tersedia ({stock})</Badge>;
  };

  const handleExportCSV = () => {
    const headers = ["SKU", "Barcode", "Item", "Kategori", "Stok Display", "Stok Gudang", "Harga Modal", "HPP (AVCO)", "Total Aset", "Harga Retail", "Harga Grosir", "Harga Promo"];
    const data = filteredData.map(p => [
      p.sku || "-", p.barcode || "-", p.nama_produk, p.kategori?.nama || "-",
      p.hitung_stok ? (p.stock || 0) : "Tidak dilacak", p.hitung_stok ? p.stok_gudang : "-",
      p.harga_modal, p.harga_pokok_avco, p.nilai_persediaan,
      p.harga_jual_satuan, p.harga_jual_grosir, p.harga_jual_promo || "-"
    ]);
    exportToCSV("Data_Inventaris", headers, data);
  };

  const handleExportPDF = () => {
    const headers = ["SKU", "Barcode", "Item", "Kategori", "Stok Display", "Stok Gudang", "Harga Modal", "HPP (AVCO)", "Total Aset", "Harga Retail", "Harga Grosir", "Harga Promo"];
    const data = filteredData.map(p => [
      p.sku || "-", p.barcode || "-", p.nama_produk, p.kategori?.nama || "-",
      p.hitung_stok ? String(p.stock || 0) : "Tidak dilacak", p.hitung_stok ? String(p.stok_gudang) : "-",
      formatIDR(p.harga_modal), formatIDR(p.harga_pokok_avco), formatIDR(p.nilai_persediaan),
      formatIDR(p.harga_jual_satuan), formatIDR(p.harga_jual_grosir), p.harga_jual_promo ? formatIDR(p.harga_jual_promo) : "-"
    ]);
    exportToPDF("Data_Inventaris", "Laporan Data Inventaris", headers, data);
  };

  const baseColumns: Column<Product>[] = [
    { key: "sku", header: "SKU", sortable: true, className: "xl:pl-6", headerClassName: "xl:pl-6 w-[130px]", render: (p) => <span className="font-mono text-[14px]">{p.sku || "-"}</span> },
    { key: "barcode", header: "Barcode", sortable: true, headerClassName: "w-[140px]", render: (p) => <span className="font-mono text-[14px]">{p.barcode || "-"}</span> },
    { key: "nama_produk", header: "Item", sortable: true, render: (p) => <p className="text-foreground text-[15px] xl:text-[14px] font-medium xl:font-normal line-clamp-2 xl:line-clamp-1">{p.nama_produk}</p> },
    { key: "kategori", header: "Kategori", sortable: true, sortKey: "kategori.nama", headerClassName: "w-[160px]", render: (p) => p.kategori?.nama || "-" },
    {
      key: "stock", header: "Status Stok", sortable: true, headerClassName: "w-[140px]",
      render: (p) => (
        <div>
          {getStockBadge(p.hitung_stok, p.stock, p.stok_minimum)}
          {p.hitung_stok && <div className="text-[11px] text-muted-foreground mt-0.5">Gudang: {p.stok_gudang} · Min: {p.stok_minimum}</div>}
        </div>
      ),
    },
    { key: "harga_modal", header: "Harga Modal", sortable: true, headerClassName: "text-left w-[140px]", render: (p) => <span className="tabular-nums">{formatIDR(p.harga_modal)}</span> },
    { key: "harga_jual_satuan", header: "Harga Retail", sortable: true, headerClassName: "text-left w-[140px]", render: (p) => <span className="tabular-nums">{formatIDR(p.harga_jual_satuan)}</span> },
    { key: "harga_jual_grosir", header: "Harga Grosir", sortable: true, headerClassName: "text-left w-[140px]", render: (p) => <span className="tabular-nums">{formatIDR(p.harga_jual_grosir)}</span> },
    { key: "harga_jual_promo", header: "Harga Promo", sortable: true, headerClassName: "text-left w-[140px]", render: (p) => <span className="tabular-nums">{p.harga_jual_promo != null ? formatIDR(p.harga_jual_promo) : "-"}</span> },
  ];

  const avcoColumns: Column<Product>[] = [
    { key: "harga_pokok_avco", header: "HPP (AVCO)", sortable: true, headerClassName: "text-right w-[120px]", render: (p) => <span className="tabular-nums">{formatIDR(p.harga_pokok_avco)}</span> },
    { key: "nilai_persediaan", header: "Total Aset", sortable: true, headerClassName: "text-right w-[120px]", render: (p) => <span className="tabular-nums">{formatIDR(p.nilai_persediaan)}</span> },
  ];

  const actionsColumn: Column<Product> = {
    key: "actions", header: "", className: "xl:pr-6", headerClassName: "w-[80px] xl:pr-6", mobileHide: true,
    render: (p) => (
      <div className="flex justify-end gap-2 xl:gap-1">
        {p.hitung_stok && p.stok_gudang > 0 && (
          <Button variant="outline" size="icon" aria-label="Restok Display" title="Restok Display" className="h-11 w-11 xl:h-8 xl:w-8 xl:border-transparent xl:bg-transparent text-muted-foreground hover:text-primary hover:bg-primary/10" onClick={(e) => { e.stopPropagation(); setRestockModal({ open: true, product: p, qty: "1", error: "" }); }} disabled={editingId !== null}>
            <Warehouse className="h-4 w-4" />
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

  const filters: FilterDef[] = [
    { type: "select", label: "Kategori", value: categoryFilter, onChange: setCategoryFilter, options: categories.map((c) => ({ value: String(c.id), label: c.nama })) },
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
  const deleteModal: DeleteModalConfig | undefined = deleteTarget ? {
    open: true, title: "Hapus Produk?", itemName: deleteTarget.nama_produk,
    onConfirm: handleDeleteConfirm,
    onCancel: () => { setDeleteTarget(null); setErrorMsg(""); },
    isPending, error: errorMsg,
  } : undefined;

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
        editingId={null}
        onRowClick={(p) => setSelectedProduct(p)}
        actions={[
          { label: "Import CSV", icon: <Upload className="w-4 h-4" />, variant: "outline", onClick: () => setIsImportOpen(true) },
          { label: "CSV", icon: <Download className="w-4 h-4" />, variant: "outline", onClick: handleExportCSV },
          { label: "PDF", icon: <Download className="w-4 h-4" />, variant: "outline", onClick: handleExportPDF },
          {
            label: showAvcoCols ? "Sembunyikan HPP" : "Tampilkan HPP",
            icon: showAvcoCols ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />,
            variant: "outline",
            onClick: () => setShowAvcoCols((v) => !v),
          },
          {
            label: "Tambah Produk", icon: <Plus className="w-4 h-4" />, kind: "primary",
            onClick: () => { setEditingId("new"); setEditForm({ hitung_stok: true, diskon: 0, stok_minimum: 5, base_unit: "pcs", default_purchase_unit: "", conversion_ratio: 1, id_satuan: 0 }); setErrorMsg(""); },
            disabled: editingId !== null,
          },
        ]}
        errorBanner={errorMsg && editingId === 'new' ? errorMsg : null}
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
                        Satuan (Base) <span className="text-destructive">*</span>
                      </label>
                      <select
                        value={editForm.id_satuan || ""}
                        onChange={(e) => setEditForm((prev) => ({ ...prev, id_satuan: Number(e.target.value) }))}
                        className="w-full h-11 rounded-md border border-input bg-background px-3.5 text-sm shadow-2xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
                      >
                        <option value="">Pilih Satuan</option>
                        {units.map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.nama}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3.5 pt-3 border-t border-border/40">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider" title="Sama dengan label teks unit base">
                        Base Unit
                      </label>
                      <select
                        value={editForm.base_unit || "pcs"}
                        onChange={(e) => setEditForm((prev) => ({ ...prev, base_unit: e.target.value }))}
                        className="w-full h-11 rounded-md border border-input bg-background px-3 text-xs font-medium shadow-2xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
                      >
                        {units.map((u) => (
                          <option key={u.id} value={u.nama}>
                            {u.nama}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider" title="Satuan pembelian">
                        Sat. Beli
                      </label>
                      <select
                        value={editForm.default_purchase_unit || ""}
                        onChange={(e) => setEditForm((prev) => ({ ...prev, default_purchase_unit: e.target.value }))}
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

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
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

                  <div className="flex flex-col gap-2">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Batas Stok Minimum Peringatan
                    </label>
                    <Input
                      type="number"
                      min={0}
                      value={editForm.stok_minimum ?? 5}
                      onChange={(e) => setEditForm((prev) => ({ ...prev, stok_minimum: Number(e.target.value) }))}
                      className="h-11 tabular-nums text-sm font-medium bg-background px-4 w-full"
                    />
                    <span className="text-xs text-muted-foreground">Sistem akan menampilkan badge peringatan jika stok &le; jumlah ini.</span>
                  </div>
                </div>
              </div>

              {/* 4. Penetapan Harga (Full width card with 5 price inputs) */}
              <div className="lg:col-span-12 bg-card border border-border/70 rounded-2xl p-6 sm:p-7 shadow-2xs flex flex-col gap-5">
                <div className="flex items-center justify-between border-b border-border/60 pb-3">
                  <div>
                    <h4 className="text-base font-semibold text-foreground tracking-wide">Penetapan Harga & Diskon (IDR)</h4>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Kelola harga modal beli, tier penjualan retail, grosir, promo, dan diskon potongan item
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
                className="px-6 h-11 rounded-full bg-background flex-1 sm:flex-none text-sm font-medium"
                onClick={handleCancelInline}
                disabled={isPending}
              >
                Batal
              </Button>
              <Button
                variant="default"
                className="px-8 h-11 rounded-full shadow-sm flex-1 sm:flex-none text-sm font-medium"
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

      {/* Restock Modal */}
      {restockModal.open && restockModal.product && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-overlay/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-background border border-border shadow-[0_8px_24px_rgba(0,55,112,0.08),0_2px_6px_rgba(0,55,112,0.04)] rounded-[12px] w-full max-w-md flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary mx-auto mb-4">
                <Warehouse className="w-6 h-6" />
              </div>
              <h2 className="text-[22px] font-light tracking-tight text-foreground mb-2 text-center">Restok Stok Display</h2>
              <p className="text-sm text-muted-foreground text-center mb-6">
                Pindahkan stok dari gudang ke display untuk <strong className="text-foreground">{restockModal.product.nama_produk}</strong>
              </p>
              <div className="flex gap-4 mb-6">
                <div className="flex-1 bg-muted/30 rounded-lg p-4 text-center">
                  <p className="text-xs text-muted-foreground mb-1">Stok Display</p>
                  <p className="text-2xl font-semibold tabular-nums">{restockModal.product.stock}</p>
                </div>
                <div className="flex-1 bg-muted/30 rounded-lg p-4 text-center">
                  <p className="text-xs text-muted-foreground mb-1">Stok Gudang</p>
                  <p className="text-2xl font-semibold tabular-nums">{restockModal.product.stok_gudang}</p>
                </div>
              </div>
              <label className="text-sm font-medium text-foreground mb-2 block">Jumlah pindah</label>
              <Input type="number" min={1} max={restockModal.product.stok_gudang} value={restockModal.qty}
                onChange={(e) => setRestockModal(prev => ({ ...prev, qty: e.target.value, error: "" }))}
                className="h-12 text-lg text-center tabular-nums" autoFocus />
              {restockModal.error && (
                <div className="mt-4 p-3 bg-destructive/10 border border-destructive/20 rounded-lg flex items-center gap-2 text-destructive text-sm">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  {restockModal.error}
                </div>
              )}
            </div>
            <div className="shrink-0 px-6 py-5 border-t border-border bg-transparent flex justify-end gap-3">
              <Button variant="outline" className="rounded-full px-6 bg-background" onClick={() => setRestockModal({ open: false, product: null, qty: "1", error: "" })} disabled={isPending}>
                Batal
              </Button>
              <Button variant="default" className="rounded-full px-6 shadow-sm" onClick={handleRestock} disabled={isPending}>
                {isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Restok Display
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
        description="Unggah file CSV berisi data produk. Kategori, Satuan, dan Merk baru akan dibuat otomatis jika belum ada."
        templateFilename="Template_Import_Produk"
        templateHeaders={[
          "Nama Produk",
          "SKU",
          "Barcode",
          "Kategori",
          "Satuan",
          "Merk",
          "Hitung Stok",
          "Harga Modal",
          "Harga Jual Satuan",
          "Harga Jual Grosir",
          "Harga Jual Promo",
          "Diskon",
          "Stok Display",
          "Stok Gudang",
          "Stok Minimum",
          "Satuan Dasar",
          "Satuan Beli",
          "Rasio Konversi",
        ]}
        sampleRows={[
          [
            "Semen Gresik 50kg",
            "SMN-GRS-50",
            "8991234567890",
            "Semen",
            "Zak",
            "Semen Indonesia",
            "ya",
            "62000",
            "68000",
            "65000",
            "",
            "0",
            "50",
            "200",
            "10",
            "zak",
            "zak",
            "1",
          ],
          [
            "Paku Kayu 3 inchi",
            "PKU-KY-03",
            "8999876543210",
            "Paku & Baut",
            "Kg",
            "Lokal",
            "ya",
            "15000",
            "20000",
            "18000",,
            "0",
            "20",
            "50",
            "5",
            "kg",
            "dus",
            "10",
          ],
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
