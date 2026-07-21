"use client";

import { useState, useMemo, useTransition, useDeferredValue } from "react";
import { Plus, PackageOpen, X, AlertCircle, Check, Loader2, Edit2, Trash2, Download, Warehouse, Eye, EyeOff } from "lucide-react";
import { useTable } from "@/hooks/use-table";
import DataTable, { type Column, type FilterDef, type DeleteModalConfig } from "@/components/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TableCell, TableRow } from "@/components/ui/table";
import { addProduct, updateProduct, deleteProduct, restockDisplay } from "./actions";
import { exportToCSV, exportToPDF } from "@/lib/export-utils";
import ProductDetailSheet from "@/components/product-detail-sheet";

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
    { key: "barcode", header: "Barcode", sortable: true, className: "xl:pl-6", headerClassName: "xl:pl-6 w-[140px]", mobileLabel: "Barcode", render: (p) => <span className="font-mono text-[14px]">{p.barcode || "-"}</span> },
    { key: "sku", header: "SKU", sortable: true, headerClassName: "w-[130px]", mobileLabel: "SKU", render: (p) => <span className="font-mono text-[14px]">{p.sku || "-"}</span> },
    { key: "nama_produk", header: "Item", sortable: true, mobileLabel: "Item", render: (p) => <p className="text-foreground text-[15px] xl:text-[14px] font-medium xl:font-normal line-clamp-2 xl:line-clamp-1">{p.nama_produk}</p> },
    { key: "kategori", header: "Kategori", sortable: true, sortKey: "kategori.nama", headerClassName: "w-[160px]", mobileLabel: "Kategori", render: (p) => p.kategori?.nama || "-" },
    {
      key: "stock", header: "Status Stok", sortable: true, headerClassName: "w-[140px]", mobileLabel: "Status Stok",
      render: (p) => (
        <div>
          {getStockBadge(p.hitung_stok, p.stock, p.stok_minimum)}
          {p.hitung_stok && <div className="text-[11px] text-muted-foreground mt-0.5">Gudang: {p.stok_gudang} · Min: {p.stok_minimum}</div>}
        </div>
      ),
    },
    { key: "harga_modal", header: "Harga Modal", sortable: true, headerClassName: "text-left w-[140px]", mobileLabel: "Harga Modal", render: (p) => <span className="tabular-nums">{formatIDR(p.harga_modal)}</span> },
    { key: "harga_jual_satuan", header: "Harga Retail", sortable: true, headerClassName: "text-left w-[140px]", mobileLabel: "Harga Retail", render: (p) => <span className="tabular-nums">{formatIDR(p.harga_jual_satuan)}</span> },
    { key: "harga_jual_grosir", header: "Harga Grosir", sortable: true, headerClassName: "text-left w-[140px]", mobileLabel: "Harga Grosir", render: (p) => <span className="tabular-nums">{formatIDR(p.harga_jual_grosir)}</span> },
    { key: "harga_jual_promo", header: "Harga Promo", sortable: true, headerClassName: "text-left w-[140px]", mobileLabel: "Harga Promo", render: (p) => <span className="tabular-nums">{p.harga_jual_promo != null ? formatIDR(p.harga_jual_promo) : "-"}</span> },
  ];

  const avcoColumns: Column<Product>[] = [
    { key: "harga_pokok_avco", header: "HPP (AVCO)", sortable: true, headerClassName: "text-right w-[120px]", mobileLabel: "HPP (AVCO)", render: (p) => <span className="tabular-nums">{formatIDR(p.harga_pokok_avco)}</span> },
    { key: "nilai_persediaan", header: "Total Aset", sortable: true, headerClassName: "text-right w-[120px]", mobileLabel: "Total Aset", render: (p) => <span className="tabular-nums">{formatIDR(p.nilai_persediaan)}</span> },
  ];

  const actionsColumn: Column<Product> = {
    key: "actions", header: "", className: "xl:pr-6", headerClassName: "w-[80px] xl:pr-6", mobileHide: true,
    render: (p) => (
      <div className="flex justify-end gap-2 xl:gap-1 opacity-100 xl:opacity-0 xl:group-hover:opacity-100 transition-opacity">
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

  const renderEditRowContent = () => {
    const ml = (label: string) => (
      <span className="xl:hidden text-xs font-medium text-muted-foreground uppercase tracking-widest mb-1 block">{label}</span>
    );
    return (
      <TableRow className="bg-muted/10 border-b-2 xl:border-b-0 hover:bg-muted/10 flex flex-col xl:table-row p-4 xl:p-0 gap-3 xl:gap-0">
        <TableCell className="xl:pl-6 align-top xl:pt-4 p-0 xl:p-2 block xl:table-cell">
          {ml("Barcode")}
          <Input aria-label="Barcode" placeholder="Barcode" value={editForm.barcode || ""}
            onChange={(e) => setEditForm(prev => ({ ...prev, barcode: e.target.value }))}
            className="h-10 xl:h-8 text-[15px] xl:text-[13px] font-mono" />
        </TableCell>
        <TableCell className="align-top xl:pt-4 p-0 xl:p-2 block xl:table-cell">
          {ml("Nama Produk")}
          <Input autoFocus aria-label="Nama Produk" placeholder="Nama Produk" value={editForm.nama_produk || ""}
            onChange={(e) => setEditForm(prev => ({ ...prev, nama_produk: e.target.value }))}
            className="h-10 xl:h-8 text-[15px] xl:text-[13px]" />
        </TableCell>
        <TableCell className="align-top xl:pt-4 p-0 xl:p-2 block xl:table-cell">
          {ml("Kategori Produk")}
          <select aria-label="Kategori Produk" value={editForm.id_kategori || ""}
            onChange={(e) => setEditForm(prev => ({ ...prev, id_kategori: Number(e.target.value) }))}
            className="w-full h-10 xl:h-8 rounded-md border border-input bg-background px-3 xl:px-2 text-[15px] xl:text-[13px] shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/20">
            <option value="">Pilih</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.nama}</option>)}
          </select>
        </TableCell>
        <TableCell className="align-top xl:pt-4 p-0 xl:p-2 block xl:table-cell">
          {ml("Status Stok")}
          {getStockBadge(editForm.hitung_stok ?? true, null)}
        </TableCell>
        <TableCell className="align-top xl:pt-4 p-0 xl:p-2 block xl:table-cell">
          {ml("Harga Modal")}
          <Input type="number" placeholder="0" value={editForm.harga_modal || ""}
            onChange={(e) => setEditForm(prev => ({ ...prev, harga_modal: Number(e.target.value) }))}
            className="h-10 xl:h-8 text-[15px] xl:text-[13px] tabular-nums" />
        </TableCell>
        <TableCell className="align-top xl:pt-4 p-0 xl:p-2 block xl:table-cell">
          {ml("Harga Retail")}
          <Input type="number" placeholder="0" value={editForm.harga_jual_satuan || ""}
            onChange={(e) => setEditForm(prev => ({ ...prev, harga_jual_satuan: Number(e.target.value) }))}
            className="h-10 xl:h-8 text-[15px] xl:text-[13px] tabular-nums" />
        </TableCell>
        <TableCell className="align-top xl:pt-4 p-0 xl:p-2 block xl:table-cell">
          {ml("Harga Grosir")}
          <Input type="number" placeholder="0" value={editForm.harga_jual_grosir || ""}
            onChange={(e) => setEditForm(prev => ({ ...prev, harga_jual_grosir: Number(e.target.value) }))}
            className="h-10 xl:h-8 text-[15px] xl:text-[13px] tabular-nums" />
        </TableCell>
        <TableCell className="align-top xl:pt-4 p-0 xl:p-2 block xl:table-cell">
          {ml("Harga Promo")}
          <Input type="number" placeholder="0" value={editForm.harga_jual_promo || ""}
            onChange={(e) => setEditForm(prev => ({ ...prev, harga_jual_promo: Number(e.target.value) }))}
            className="h-10 xl:h-8 text-[15px] xl:text-[13px] tabular-nums" />
        </TableCell>
        {showAvcoCols && (
          <>
            <TableCell className="p-0 xl:p-2 block xl:table-cell" />
            <TableCell className="p-0 xl:p-2 block xl:table-cell" />
          </>
        )}
        <TableCell className="xl:pr-6 align-top pt-2 xl:pt-4 text-right p-0 xl:p-2 block xl:table-cell mt-2 xl:mt-0">
          <div className="flex justify-end gap-2 xl:gap-1">
            <Button variant="outline" size="icon" aria-label="Batal Edit" className="h-11 w-11 xl:h-8 xl:w-8 text-muted-foreground hover:text-foreground" onClick={handleCancelInline} disabled={isPending}>
              <X className="h-4 w-4" />
            </Button>
            <Button variant="default" size="icon" aria-label="Simpan Edit" className="h-11 w-11 xl:h-8 xl:w-8" onClick={handleSaveInline} disabled={isPending}>
              {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            </Button>
          </div>
        </TableCell>
      </TableRow>
    );
  };

  const renderEditExpandedRow = () => (
    <TableRow className="bg-muted/10 border-t-0">
      <TableCell colSpan={columns.length} className="py-3 px-6 bg-muted/5 border-b">
        <div className="flex flex-wrap items-center gap-6">
          <div className="flex items-center gap-2">
            <span className="text-[13px] text-muted-foreground">Satuan:</span>
            <select aria-label="Satuan Produk" value={editForm.id_satuan || ""}
              onChange={(e) => setEditForm(prev => ({ ...prev, id_satuan: Number(e.target.value) }))}
              className="h-8 rounded-md border border-input bg-background px-2 text-[13px] shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/20">
              <option value="">Pilih</option>
              {units.map((u) => <option key={u.id} value={u.id}>{u.nama}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[13px] text-muted-foreground">Diskon:</span>
            <Input type="number" value={editForm.diskon || 0}
              onChange={(e) => setEditForm(prev => ({ ...prev, diskon: Number(e.target.value) }))}
              className="h-8 w-24 text-[13px] tabular-nums" />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[13px] text-muted-foreground">Min Stok:</span>
            <Input type="number" min={0} value={editForm.stok_minimum ?? 5}
              onChange={(e) => setEditForm(prev => ({ ...prev, stok_minimum: Number(e.target.value) }))}
              className="h-8 w-20 text-[13px] tabular-nums" />
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" id="hitung_stok" checked={editForm.hitung_stok || false}
              onChange={(e) => setEditForm(prev => ({ ...prev, hitung_stok: e.target.checked }))}
              className="h-4 w-4 rounded-[4px] border border-input text-primary accent-primary" />
            <label htmlFor="hitung_stok" className="text-[13px] font-medium text-foreground cursor-pointer">Lacak Stok</label>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[13px] text-muted-foreground">Base Unit:</span>
            <select value={editForm.base_unit || "pcs"}
              onChange={(e) => setEditForm(prev => ({ ...prev, base_unit: e.target.value }))}
              className="h-8 rounded-md border border-input bg-background px-2 text-[13px] shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/20">
              {units.map((u) => <option key={u.id} value={u.nama}>{u.nama}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[13px] text-muted-foreground">Satuan Beli:</span>
            <select value={editForm.default_purchase_unit || ""}
              onChange={(e) => setEditForm(prev => ({ ...prev, default_purchase_unit: e.target.value }))}
              className="h-8 rounded-md border border-input bg-background px-2 text-[13px] shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/20">
              <option value="">(sama dgn base unit)</option>
              {units.map((u) => <option key={u.id} value={u.nama}>{u.nama}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[13px] text-muted-foreground">Rasio:</span>
            <Input type="number" min={1} value={editForm.conversion_ratio ?? 1}
              onChange={(e) => setEditForm(prev => ({ ...prev, conversion_ratio: Number(e.target.value) }))}
              className="h-8 w-20 text-[13px] tabular-nums" />
          </div>
          {errorMsg && <div className="text-[13px] text-destructive flex items-center gap-1 ml-auto"><AlertCircle className="w-3 h-3" /> {errorMsg}</div>}
        </div>
      </TableCell>
    </TableRow>
  );

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
        editingId={editingId as number | "new" | null}
        renderEditRow={renderEditRowContent}
        renderEditExpanded={renderEditExpandedRow}
        onRowClick={(p) => setSelectedProduct(p)}
        mobileCards
        mobileBreakpoint="xl"
        actions={[
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
            onClick: () => { setEditingId("new"); setEditForm({ hitung_stok: true, diskon: 0, stok_minimum: 5, base_unit: "pcs", default_purchase_unit: "", conversion_ratio: 1 }); setErrorMsg(""); },
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
    </>
  );
}
