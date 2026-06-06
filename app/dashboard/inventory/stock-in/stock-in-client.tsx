"use client";

import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { Plus, Trash2, Check, AlertCircle, PackagePlus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { addStockIn } from "./actions";

interface Product {
  id: number;
  nama_produk: string;
  barcode: string | null;
  satuan: { nama: string } | null;
}

interface Supplier {
  id: number;
  nama_supplier: string;
}

interface RowState {
  tempId: string;
  selectedProduct: Product | null;
  searchText: string;
  jumlah: number;
  hargaBeli: number;
  keterangan: string;
}

let rowCounter = 0;
function nextRowId() {
  rowCounter += 1;
  return `row-${rowCounter}`;
}

const inputBase = "w-full h-9 rounded-md border border-input bg-background px-3 py-1.5 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/20 focus-visible:border-primary disabled:opacity-50 disabled:cursor-not-allowed";

function formatIDR(n: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
}

function ProductCombo({
  row,
  products,
  onChange,
}: {
  row: RowState;
  products: Product[];
  onChange: (updates: Partial<RowState>) => void;
}) {
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [highlightIdx, setHighlightIdx] = useState(0);

  const filtered = useMemo(() => {
    if (!row.searchText.trim()) return products.slice(0, 50);
    const q = row.searchText.toLowerCase();
    return products.filter(
      (p) =>
        p.nama_produk.toLowerCase().includes(q) ||
        p.barcode?.toLowerCase().includes(q)
    ).slice(0, 80);
  }, [row.searchText, products]);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      if (
        inputRef.current &&
        !inputRef.current.contains(e.target as Node) &&
        listRef.current &&
        !listRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const selectProduct = useCallback(
    (product: Product) => {
      onChange({
        selectedProduct: product,
        searchText: product.nama_produk,
      });
      setOpen(false);
    },
    [onChange]
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      // Handle physical barcode scanner (which types fast and presses Enter)
      // We check raw input value because React state (row.searchText) might be stale
      const rawValue = inputRef.current?.value;
      if (rawValue) {
        const exactMatch = products.find(p => p.barcode === rawValue);
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

  const handleInputChange = (value: string) => {
    onChange({ searchText: value, selectedProduct: null });
    setHighlightIdx(0);
    setOpen(true);
  };

  return (
    <div className="relative min-w-[200px]">
      <input ref={inputRef}
        value={row.searchText}
        onChange={(e) => handleInputChange(e.target.value)}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKeyDown}
        placeholder="Cari produk..."
        className={inputBase + " tabular-nums"}
        autoComplete="off"
      />
      {row.selectedProduct && (
        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground uppercase tracking-widest">
          {row.selectedProduct.satuan?.nama || "-"}
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
              {p.barcode && (
                <span className="text-[11px] text-muted-foreground tabular-nums shrink-0">
                  {p.barcode}
                </span>
              )}
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

export default function StockInClient({
  products,
  suppliers,
}: {
  products: Product[];
  suppliers: Supplier[];
}) {
  const today = new Date().toISOString().slice(0, 10);

  const [rows, setRows] = useState<RowState[]>([
    {
      tempId: nextRowId(),
      selectedProduct: null,
      searchText: "",
      jumlah: 1,
      hargaBeli: 0,
      keterangan: "",
    },
  ]);
  const [idSupplier, setIdSupplier] = useState<number | "">("");
  const [tglMasuk, setTglMasuk] = useState(today);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const updateRow = useCallback(
    (tempId: string, updates: Partial<RowState>) => {
      setRows((prev) =>
        prev.map((r) => (r.tempId === tempId ? { ...r, ...updates } : r))
      );
    },
    []
  );

  const addRow = useCallback(() => {
    setRows((prev) => [
      ...prev,
      {
        tempId: nextRowId(),
        selectedProduct: null,
        searchText: "",
        jumlah: 1,
        hargaBeli: 0,
        keterangan: "",
      },
    ]);
  }, []);

  const removeRow = useCallback((tempId: string) => {
    setRows((prev) => prev.filter((r) => r.tempId !== tempId));
  }, []);

  const validationErrors = useMemo(() => {
    const errs: string[] = [];
    if (!idSupplier) errs.push("Pilih supplier");
    rows.forEach((r, i) => {
      if (!r.selectedProduct) errs.push(`Baris ${i + 1}: pilih produk`);
      if (r.jumlah <= 0) errs.push(`Baris ${i + 1}: jumlah harus > 0`);
      if (r.hargaBeli <= 0) errs.push(`Baris ${i + 1}: harga beli harus > 0`);
    });
    return errs;
  }, [idSupplier, rows]);

  const canSubmit = rows.length > 0 && validationErrors.length === 0 && !loading;

  const handleSubmit = async () => {
    if (!canSubmit || !idSupplier) return;
    setLoading(true);
    setError("");
    setSuccess(false);

    const payload = rows
      .filter((r) => r.selectedProduct && r.jumlah > 0 && r.hargaBeli > 0)
      .map((r) => ({
        id_produk: r.selectedProduct!.id,
        jumlah: r.jumlah,
        harga_beli: r.hargaBeli,
        total: r.jumlah * r.hargaBeli,
        tgl_masuk: tglMasuk,
        id_supplier: idSupplier,
        keterangan: r.keterangan,
      }));

    if (payload.length === 0) {
      setError("Tidak ada data valid untuk disimpan");
      setLoading(false);
      return;
    }

    const res = await addStockIn(payload);

    if (res?.error) {
      setError(res.error);
      setLoading(false);
      return;
    }

    setSuccess(true);
    setRows([
      {
        tempId: nextRowId(),
        selectedProduct: null,
        searchText: "",
        jumlah: 1,
        hargaBeli: 0,
        keterangan: "",
      },
    ]);
    setIdSupplier("");
    setTglMasuk(today);
    setLoading(false);

    setTimeout(() => setSuccess(false), 4000);
  };

  const totalSemua = useMemo(
    () => rows.reduce((s, r) => s + r.jumlah * r.hargaBeli, 0),
    [rows]
  );

  return (
    <div className="flex-1 p-4 md:p-8 lg:p-12 w-full flex flex-col gap-4 md:gap-8 mx-auto h-full md:max-h-screen md:overflow-hidden">
      <header className="shrink-0">
        <h1 className="text-4xl font-light tracking-tighter text-foreground">
          Barang Masuk
        </h1>
        <p className="text-muted-foreground mt-2">
          Catat penerimaan stok baru dari supplier
        </p>
      </header>

      <div className="flex-1 flex flex-col min-h-0 bg-background border border-border rounded-[12px] shadow-[0_1px_3px_rgba(0,55,112,0.08)] overflow-hidden">
        {error && (
          <div className="shrink-0 flex items-center gap-2 px-6 py-4 bg-destructive/10 text-destructive text-sm border-b border-border">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}

        {success && (
          <div className="shrink-0 flex items-center gap-2 px-6 py-4 bg-emerald-50 text-emerald-700 text-sm border-b border-border">
            <Check className="w-4 h-4 shrink-0" />
            Barang masuk berhasil disimpan
          </div>
        )}

        <div className="shrink-0 flex flex-col md:flex-row md:items-end gap-4 px-6 py-5 border-b border-border bg-transparent">
          <div className="flex flex-col gap-1.5 w-full md:w-auto">
            <label htmlFor="id_supplier" className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
              Supplier
            </label>
            <select id="id_supplier" value={idSupplier}
              onChange={(e) => setIdSupplier(Number(e.target.value) || "")}
              className="h-9 w-full md:min-w-[200px] rounded-md border border-input bg-background px-3 py-1.5 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/20 focus-visible:border-primary"
            >
              <option value="">Pilih supplier</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nama_supplier}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5 w-full md:w-auto">
            <label htmlFor="tgl_masuk" className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
              Tanggal Masuk
            </label>
            <input id="tgl_masuk" type="date"
              value={tglMasuk}
              onChange={(e) => setTglMasuk(e.target.value)}
              className="h-9 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/20 focus-visible:border-primary"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto min-h-0">
          <table className="w-full min-w-[800px]">
            <thead>
              <tr className="border-b border-border/60 bg-muted/80 backdrop-blur-md sticky top-0 z-10">
                <th className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider h-10 w-10 text-center px-2">
                  #
                </th>
                <th className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider h-10 text-left px-2">
                  Produk
                </th>
                <th className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider h-10 text-left w-[100px] px-2">
                  Jumlah
                </th>
                <th className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider h-10 text-left w-[140px] px-2">
                  Harga Beli
                </th>
                <th className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider h-10 text-right w-[140px] px-2">
                  Total
                </th>
                <th className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider h-10 text-left w-[160px] px-2">
                  Keterangan
                </th>
                <th className="w-10 px-2" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr
                  key={row.tempId}
                  className="border-b border-border/40 hover:bg-muted/20 transition-colors"
                >
                  <td className="text-center text-sm text-muted-foreground tabular-nums px-2 py-2">
                    {i + 1}
                  </td>
                  <td className="px-2 py-2">
                    <ProductCombo
                      row={row}
                      products={products}
                      onChange={(updates) => updateRow(row.tempId, updates)}
                    />
                  </td>
                  <td className="px-2 py-2">
                    <Input
                      type="number"
                      min={1}
                      value={row.jumlah || ""}
                      onChange={(e) =>
                        updateRow(row.tempId, {
                          jumlah: Math.max(0, Number(e.target.value)),
                        })
                      }
                      className="h-9 tabular-nums font-medium"
                    />
                  </td>
                  <td className="px-2 py-2">
                    <Input
                      type="number"
                      min={0}
                      value={row.hargaBeli || ""}
                      onChange={(e) =>
                        updateRow(row.tempId, {
                          hargaBeli: Math.max(0, Number(e.target.value)),
                        })
                      }
                      className="h-9 tabular-nums font-medium"
                    />
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums text-sm font-medium text-foreground">
                    {formatIDR(row.jumlah * row.hargaBeli)}
                  </td>
                  <td className="px-2 py-2">
                    <input value={row.keterangan}
                      onChange={(e) =>
                        updateRow(row.tempId, { keterangan: e.target.value })
                      }
                      placeholder="Catatan opsional"
                      className={inputBase}
                    />
                  </td>
                  <td className="px-2 py-2 text-center">
                    <button
                      type="button"
                      onClick={() => removeRow(row.tempId)}
                      disabled={rows.length === 1}
                      className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                      title="Hapus baris"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {rows.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
              <PackagePlus className="w-12 h-12 mb-4 opacity-20" />
              <p className="text-base font-medium text-foreground">
                Belum ada item
              </p>
              <p className="text-sm mt-1">
                Tambah item untuk mencatat penerimaan stok
              </p>
            </div>
          )}
        </div>

        <div className="shrink-0 flex items-center justify-between px-6 py-4 border-t border-border bg-background gap-4 flex-wrap">
          <Button
            type="button"
            variant="ghost"
            className="rounded-full px-4 h-9 text-muted-foreground hover:text-foreground"
            onClick={addRow}
          >
            <Plus className="w-4 h-4 mr-1.5" />
            Tambah Baris
          </Button>

          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-[11px] text-muted-foreground uppercase tracking-wider">
                Total Semua
              </p>
              <p className="text-lg font-light tabular-nums text-foreground">
                {formatIDR(totalSemua)}
              </p>
            </div>
            <Button
              type="button"
              onClick={handleSubmit}
              disabled={!canSubmit}
              className="rounded-full px-6 h-10 bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Menyimpan...
                </>
              ) : (
                "Simpan Barang Masuk"
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
