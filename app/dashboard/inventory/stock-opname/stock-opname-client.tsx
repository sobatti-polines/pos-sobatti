"use client";

import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import {
  useForm,
  useFieldArray,
  useFormContext,
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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { saveBulkStockOpname } from "./actions";
import { z } from "zod";
import ImportCSVModal from "@/components/import-csv-modal";

/* ------------------------------------------------------------------ */
/*  Zod schemas                                                        */
/* ------------------------------------------------------------------ */

const itemSchema = z.object({
  id_produk: z.number().min(1, "Produk harus dipilih"),
  stok_fisik: z.number().min(0, "Stok fisik tidak boleh negatif"),
  keterangan: z.string().optional(),
});

const formSchema = z.object({
  tgl_opname: z.string().min(1, "Tanggal harus diisi"),
  items: z.array(itemSchema).min(1, "Minimal 1 item"),
});

type OpnameFormValues = z.infer<typeof formSchema>;

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
  barcode: string | null;
  sku?: string | null;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

const inputBase =
  "w-full h-9 rounded-md border border-input bg-background px-3 py-1.5 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/20 focus-visible:border-primary disabled:opacity-50 disabled:cursor-not-allowed";

/* ------------------------------------------------------------------ */
/*  ProductCombo — search-and-select combobox                          */
/* ------------------------------------------------------------------ */

function ProductCombo({
  index,
  products,
  onProductSelect,
}: {
  index: number;
  products: Product[];
  onProductSelect?: (product: Product) => void;
}) {
  const { watch, setValue } = useFormContext<OpnameFormValues>();
  const [searchText, setSearchText] = useState("");
  const [open, setOpen] = useState(false);
  const [highlightIdx, setHighlightIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const productId = watch(`items.${index}.id_produk`);
  const selectedProduct = useMemo(
    () => products.find((p) => p.id === productId),
    [productId, products]
  );

  useEffect(() => {
    if (selectedProduct) {
      setSearchText(selectedProduct.nama_produk);
    }
  }, [productId]);

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
      setValue(`items.${index}.id_produk`, product.id, {
        shouldValidate: true,
      });
      setSearchText(product.nama_produk);
      setOpen(false);
      onProductSelect?.(product);
    },
    [index, setValue, onProductSelect]
  );

  const handleInputChange = (value: string) => {
    setSearchText(value);
    setHighlightIdx(0);
    setOpen(true);
    const isSame = selectedProduct && value === selectedProduct.nama_produk;
    if (!isSame) {
      setValue(`items.${index}.id_produk`, 0, { shouldValidate: false });
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const rawValue = inputRef.current?.value;
      if (rawValue) {
        const exactMatch = products.find((p) => p.barcode === rawValue);
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
      {selectedProduct && (
        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">
          ID: {selectedProduct.id}
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
              <span className="text-[11px] text-muted-foreground tabular-nums shrink-0">
                Stok: {p.stok ?? 0}
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
/*  Main Form Body (consumes FormProvider context)                     */
/* ------------------------------------------------------------------ */

function FormBody({ products }: { products: Product[] }) {
  const {
    register,
    control,
    watch,
    setValue,
    handleSubmit,
    formState: { errors },
  } = useFormContext<OpnameFormValues>();

  const { fields, append, remove } = useFieldArray({
    control,
    name: "items",
  });

  const [loading, setLoading] = useState(false);
  const [serverError, setServerError] = useState("");
  const [success, setSuccess] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);

  const handleImportOpnameCSV = async (rows: Record<string, string>[]) => {
    let addedCount = 0;
    for (const r of rows) {
      const code = (r["SKU / Barcode"] || r["Barcode"] || r["SKU"] || r["Nama Produk"] || "").trim().toLowerCase();
      const stokFisikNum = parseFloat(r["Stok Fisik"] || r["stok_fisik"] || "0");
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
        append({
          id_produk: matched.id,
          stok_fisik: isNaN(stokFisikNum) ? 0 : stokFisikNum,
          keterangan: ket,
        });
        addedCount++;
      }
    }

    if (addedCount === 0) {
      return { error: "Tidak ada produk yang cocok dengan SKU / Barcode dalam file CSV" };
    }

    return { success: true, count: addedCount, message: `Berhasil menambahkan ${addedCount} baris stok opname dari CSV.` };
  };

  const today = new Date().toISOString().slice(0, 10);

  /* Flatten nested RHF errors into user-facing strings */
  const validationErrors = useMemo(() => {
    const list: string[] = [];
    if (errors.items) {
      const itemsErr = errors.items as any;
      if (typeof itemsErr === "object") {
        for (const key of Object.keys(itemsErr)) {
          const item = itemsErr[key];
          if (!item || typeof item !== "object") continue;
          const idx = Number(key);
          if (isNaN(idx)) continue;
          if (item.id_produk?.message)
            list.push(`Baris ${idx + 1}: ${item.id_produk.message}`);
          if (item.stok_fisik?.message)
            list.push(`Baris ${idx + 1}: ${item.stok_fisik.message}`);
        }
      }
    }
    return list;
  }, [errors]);

  const getStokSistem = useCallback(
    (index: number) => {
      const productId = watch(`items.${index}.id_produk`);
      const product = products.find((p) => p.id === productId);
      return product?.stok ?? 0;
    },
    [watch, products]
  );

  const getSelisih = useCallback(
    (index: number) => {
      const productId = watch(`items.${index}.id_produk`);
      const stokFisik = watch(`items.${index}.stok_fisik`) || 0;
      if (!productId) return null;
      const product = products.find((p) => p.id === productId);
      if (!product) return null;
      return stokFisik - (product.stok ?? 0);
    },
    [watch, products]
  );

  const onValid = async (data: OpnameFormValues) => {
    setLoading(true);
    setServerError("");
    setSuccess(false);

    const res = await saveBulkStockOpname(data);

    if (res?.error) {
      setServerError(res.error);
      setLoading(false);
      return;
    }

    setSuccess(true);
    setLoading(false);

    setValue("tgl_opname", today);
    setValue("items", [
      { id_produk: 0, stok_fisik: 0, keterangan: "" },
    ]);

    setTimeout(() => setSuccess(false), 4000);
  };

  return (
    <form
      onSubmit={handleSubmit(onValid)}
      className="flex-1 flex flex-col min-h-0"
    >
      {/* Server error banner */}
      {serverError && (
        <div className="shrink-0 flex items-center gap-2 px-6 py-4 bg-destructive/10 text-destructive text-sm border-b border-border">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {serverError}
        </div>
      )}

      {/* Validation error banner */}
      {validationErrors.length > 0 && (
        <div className="shrink-0 flex items-center gap-2 px-6 py-4 bg-destructive/10 text-destructive text-sm border-b border-border">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <ul className="list-disc list-inside">
            {validationErrors.map((msg, i) => (
              <li key={i}>{msg}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Success banner */}
      {success && (
        <div className="shrink-0 flex items-center gap-2 px-6 py-4 bg-emerald-50 text-emerald-700 text-sm border-b border-border">
          <Check className="w-4 h-4 shrink-0" />
          Stok opname berhasil disimpan
        </div>
      )}

      {/* Header fields */}
      <div className="shrink-0 flex flex-col md:flex-row md:items-end gap-4 px-6 py-5 border-b border-border bg-transparent">
        <div className="flex flex-col gap-1.5 w-full md:w-auto">
          <label
            htmlFor="tgl_opname"
            className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider"
          >
            Tanggal Opname
          </label>
          <input
            id="tgl_opname"
            type="date"
            {...register("tgl_opname")}
            className="h-9 w-full md:min-w-[200px] rounded-md border border-input bg-background px-3 py-1.5 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/20 focus-visible:border-primary"
          />
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-y-auto min-h-0">
        <table className="w-full min-w-[700px]">
          <thead>
            <tr className="border-b border-border/60 bg-muted/80 backdrop-blur-md sticky top-0 z-10">
              <th className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider h-10 w-10 text-center px-2">
                #
              </th>
              <th className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider h-10 text-left px-2">
                Produk
              </th>
              <th className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider h-10 text-center w-[110px] px-2">
                Stok Sistem
              </th>
              <th className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider h-10 text-center w-[110px] px-2">
                Stok Fisik
              </th>
              <th className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider h-10 text-center w-[100px] px-2">
                Selisih
              </th>
              <th className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider h-10 text-left w-[160px] px-2">
                Keterangan
              </th>
              <th className="w-10 px-2" />
            </tr>
          </thead>
          <tbody>
            {fields.map((field, index) => {
              const stokSistem = getStokSistem(index);
              const selisih = getSelisih(index);
              const stokFisik = watch(`items.${index}.stok_fisik`) || 0;

              return (
                <tr
                  key={field.id}
                  className="border-b border-border/40 hover:bg-muted/20 transition-colors"
                >
                  <td className="text-center text-sm text-muted-foreground tabular-nums px-2 py-2 align-top pt-5">
                    {index + 1}
                  </td>
                  <td className="px-2 py-2">
                    <ProductCombo
                      index={index}
                      products={products}
                    />
                  </td>
                  <td className="px-2 py-2 text-center align-top pt-5">
                    <span className="tabular-nums font-medium text-foreground">
                      {stokSistem}
                    </span>
                  </td>
                  <td className="px-2 py-2">
                    <input
                      type="number"
                      min={0}
                      step="any"
                      {...register(`items.${index}.stok_fisik`, {
                        valueAsNumber: true,
                      })}
                      placeholder="0"
                      className={
                        inputBase +
                        " tabular-nums font-medium text-center"
                      }
                    />
                  </td>
                  <td className="px-2 py-2 text-center align-top pt-5">
                    <span
                      className={`tabular-nums font-semibold px-2 py-0.5 rounded-full text-[12px] ${
                        selisih === null
                          ? "text-muted-foreground"
                          : selisih > 0
                          ? "bg-emerald-50 text-emerald-600"
                          : selisih < 0
                          ? "bg-destructive/10 text-destructive"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {selisih === null
                        ? "-"
                        : selisih > 0
                        ? `+${selisih}`
                        : selisih}
                    </span>
                  </td>
                  <td className="px-2 py-2">
                    <input
                      {...register(`items.${index}.keterangan`)}
                      placeholder="Catatan opsional"
                      className={inputBase}
                    />
                  </td>
                  <td className="px-2 py-2 text-center align-top pt-5">
                    <button
                      type="button"
                      onClick={() => remove(index)}
                      disabled={fields.length === 1}
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

        {fields.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
            <PackagePlus className="w-12 h-12 mb-4 opacity-20" />
            <p className="text-base font-medium text-foreground">
              Belum ada item
            </p>
            <p className="text-sm mt-1">
              Tambah item untuk mencatat stok opname
            </p>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="shrink-0 flex items-center justify-between px-6 py-4 border-t border-border bg-background gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            className="rounded-full px-4 h-9 text-muted-foreground hover:text-foreground"
            onClick={() =>
              append({
                id_produk: 0,
                stok_fisik: 0,
                keterangan: "",
              })
            }
          >
            <Plus className="w-4 h-4 mr-1.5" />
            Tambah Baris
          </Button>
          <Button
            type="button"
            variant="outline"
            className="rounded-full px-4 h-9 text-xs gap-1.5"
            onClick={() => setIsImportOpen(true)}
          >
            <Upload className="w-3.5 h-3.5" />
            Import CSV
          </Button>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-[11px] text-muted-foreground uppercase tracking-wider">
              Total Item
            </p>
            <p className="text-lg font-light tabular-nums text-foreground">
              {fields.length}
            </p>
          </div>
          <Button
            type="submit"
            disabled={fields.length === 0 || loading}
            className="rounded-full px-6 h-10 bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Menyimpan...
              </>
            ) : (
              "Simpan Stok Opname"
            )}
          </Button>
        </div>
      </div>

      <ImportCSVModal
        open={isImportOpen}
        onOpenChange={setIsImportOpen}
        title="Import Hasil Stok Opname dari CSV"
        description="Unggah file CSV berisi hasil penghitungan fisik lapangan (SKU / Barcode, Stok Fisik, Keterangan)."
        templateFilename="Template_Import_Stok_Opname"
        templateHeaders={["SKU / Barcode", "Stok Fisik", "Keterangan"]}
        sampleRows={[
          ["SMN-GRS-50", "48", "2 zak rusak / bocor"],
          ["PKU-KY-03", "18", "Hitungan fisik gudang"],
        ]}
        validateRow={(row) => {
          const code = (row["SKU / Barcode"] || row["Barcode"] || row["SKU"] || row["Nama Produk"] || "").trim();
          if (!code) {
            return "SKU / Barcode wajib diisi";
          }
          return null;
        }}
        onImport={handleImportOpnameCSV}
      />
    </form>
  );
}

/* ------------------------------------------------------------------ */
/*  Page-level Client Component — wraps everything in FormProvider     */
/* ------------------------------------------------------------------ */

export default function StockOpnameClient({
  products,
}: {
  products: Product[];
}) {
  const today = new Date().toISOString().slice(0, 10);

  const form = useForm<OpnameFormValues>({
    resolver: makeResolver(formSchema) as any,
    mode: "onSubmit",
    defaultValues: {
      tgl_opname: today,
      items: [{ id_produk: 0, stok_fisik: 0, keterangan: "" }],
    },
  });

  return (
    <FormProvider {...form}>
      <div className="flex-1 p-4 md:p-8 lg:p-12 w-full flex flex-col gap-4 md:gap-8 mx-auto h-full md:max-h-screen md:overflow-hidden">
        <header className="shrink-0">
          <h1 className="text-4xl font-light tracking-tighter text-foreground">
            Stok Opname
          </h1>
          <p className="text-muted-foreground mt-2">
            Catat pengecekan fisik stok dan hitung selisih dengan sistem
          </p>
        </header>

        <div className="flex-1 flex flex-col min-h-0 bg-background border border-border rounded-[12px] shadow-[0_1px_3px_rgba(0,55,112,0.08)] overflow-hidden">
          <FormBody products={products} />
        </div>
      </div>
    </FormProvider>
  );
}
