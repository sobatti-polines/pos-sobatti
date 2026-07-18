"use client";

import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import {
  useForm,
  useFieldArray,
  useFormContext,
  FormProvider,
} from "react-hook-form";
import { Plus, Trash2, Check, AlertCircle, PackagePlus, Loader2, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { addStockIn } from "./actions";
import { z } from "zod";

/* ------------------------------------------------------------------ */
/*  Zod schemas                                                        */
/* ------------------------------------------------------------------ */

const itemSchema = z.object({
  id_produk: z.number().min(1, "Produk harus dipilih"),
  supplied_qty: z.number().min(0.001, "Jumlah harus lebih dari 0"),
  supplied_unit: z.string().min(1, "Satuan suplai harus diisi"),
  total_cost: z.number().min(1, "Total harga harus lebih dari 0"),
  keterangan: z.string().optional(),
});

const formSchema = z.object({
  id_supplier: z.string().min(1, "Supplier harus dipilih"),
  tgl_masuk: z.string().min(1, "Tanggal harus diisi"),
  paymentType: z.enum(["Tunai", "Kredit"]),
  tanggalJatuhTempo: z.string().optional(),
  items: z.array(itemSchema).min(1, "Minimal 1 item"),
});

type StockInFormValues = z.infer<typeof formSchema>;

/* ------------------------------------------------------------------ */
/*  Inline zodResolver (no @hookform/resolvers dependency)             */
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
  barcode: string | null;
  base_unit: string;
  default_purchase_unit: string | null;
  conversion_ratio: number;
  satuan: { nama: string } | null;
}

interface Supplier {
  id: number;
  nama_supplier: string;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

const inputBase =
  "w-full h-9 rounded-md border border-input bg-background px-3 py-1.5 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/20 focus-visible:border-primary disabled:opacity-50 disabled:cursor-not-allowed";

function formatIDR(n: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
}

/* ------------------------------------------------------------------ */
/*  ProductCombo — search-and-select combobox                          */
/* ------------------------------------------------------------------ */

function ProductCombo({
  index,
  products,
}: {
  index: number;
  products: Product[];
}) {
  const { watch, setValue } = useFormContext<StockInFormValues>();
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

      // Auto-fill supplied_unit from product's default_purchase_unit
      if (product.default_purchase_unit) {
        setValue(`items.${index}.supplied_unit`, product.default_purchase_unit, {
          shouldValidate: true,
        });
      }
    },
    [index, setValue]
  );

  const handleInputChange = (value: string) => {
    setSearchText(value);
    setHighlightIdx(0);
    setOpen(true);
    const isSame = selectedProduct && value === selectedProduct.nama_produk;
    if (!isSame) {
      setValue(`items.${index}.id_produk`, 0, { shouldValidate: false });
      setValue(`items.${index}.supplied_unit`, "", { shouldValidate: false });
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
        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground uppercase tracking-widest">
          {selectedProduct.base_unit || "pcs"}
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

/* ------------------------------------------------------------------ */
/*  UoM Conversion Indicator                                          */
/* ------------------------------------------------------------------ */

function ConversionIndicator({ index, products }: { index: number; products: Product[] }) {
  const { watch } = useFormContext<StockInFormValues>();

  const productId = watch(`items.${index}.id_produk`);
  const suppliedQty = watch(`items.${index}.supplied_qty`) || 0;
  const suppliedUnit = watch(`items.${index}.supplied_unit`) || "";

  const selectedProduct = useMemo(
    () => products.find((p) => p.id === productId),
    [productId, products]
  );

  if (!selectedProduct || !suppliedQty || !suppliedUnit) return null;

  const ratio = selectedProduct.conversion_ratio || 1;
  const baseQty = suppliedQty * ratio;
  const baseUnit = selectedProduct.base_unit || "pcs";
  const unitLabel = suppliedUnit.charAt(0).toUpperCase() + suppliedUnit.slice(1);

  return (
    <div className="text-xs font-light text-foreground/70 tracking-tight mt-1 tabular-nums" style={{ fontFeatureSettings: '"tnum"' }}>
      <Info className="w-3 h-3 inline-block mr-1 text-primary/60 -mt-0.5" />
      {suppliedQty} {unitLabel} &times; {ratio} {baseUnit}/{suppliedUnit} = <strong className="font-medium text-foreground">{baseQty} {baseUnit}</strong>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Form Body (consumes FormProvider context)                     */
/* ------------------------------------------------------------------ */

function FormBody({
  products,
  suppliers,
  satuanOptions,
}: {
  products: Product[];
  suppliers: Supplier[];
  satuanOptions: { id: number; nama: string }[];
}) {
  const {
    register,
    control,
    watch,
    setValue,
    handleSubmit,
    formState: { errors },
  } = useFormContext<StockInFormValues>();

  const { fields, append, remove } = useFieldArray({
    control,
    name: "items",
  });

  const [loading, setLoading] = useState(false);
  const [serverError, setServerError] = useState("");
  const [success, setSuccess] = useState(false);
  const [warning, setWarning] = useState("");

  const paymentType = watch("paymentType");

  const today = new Date().toISOString().slice(0, 10);

  const computedTotal = useMemo(
    () =>
      fields.reduce((sum, _, i) => {
        const cost = watch(`items.${i}.total_cost`) || 0;
        return sum + cost;
      }, 0),
    [fields, watch]
  );

  /* Flatten nested RHF errors into user-facing strings */
  const validationErrors = useMemo(() => {
    const list: string[] = [];
    if (errors.id_supplier?.message) {
      list.push(errors.id_supplier.message as string);
    }
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
          if (item.supplied_qty?.message)
            list.push(`Baris ${idx + 1}: ${item.supplied_qty.message}`);
          if (item.supplied_unit?.message)
            list.push(`Baris ${idx + 1}: ${item.supplied_unit.message}`);
          if (item.total_cost?.message)
            list.push(`Baris ${idx + 1}: ${item.total_cost.message}`);
        }
      }
    }
    return list;
  }, [errors]);

  const onValid = async (data: StockInFormValues) => {
    setLoading(true);
    setServerError("");
    setSuccess(false);
    setWarning("");

    const payload = data.items
      .filter((item) => item.id_produk > 0 && item.supplied_qty > 0 && item.total_cost > 0)
      .map((item) => ({
        id_produk: item.id_produk,
        supplied_qty: item.supplied_qty,
        supplied_unit: item.supplied_unit,
        total_cost: item.total_cost,
        tgl_masuk: data.tgl_masuk,
        id_supplier: Number(data.id_supplier),
        keterangan: item.keterangan || "",
      }));

    if (payload.length === 0) {
      setServerError("Tidak ada data valid untuk disimpan");
      setLoading(false);
      return;
    }

    const res = await addStockIn(
      payload,
      data.paymentType,
      data.paymentType === "Kredit" ? data.tanggalJatuhTempo : null
    );

    if (res?.error) {
      setServerError(res.error);
      setLoading(false);
      return;
    }

    setSuccess(true);
    setLoading(false);

    if ((res as { warning?: string })?.warning) {
      setWarning((res as { warning?: string }).warning!);
    }

    /* Reset form to defaults */
    setValue("id_supplier", "");
    setValue("tgl_masuk", today);
    setValue("paymentType", "Tunai");
    setValue("tanggalJatuhTempo", "");
    setValue("items", [
      { id_produk: 0, supplied_qty: 1, supplied_unit: "", total_cost: 0, keterangan: "" },
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
      {success && !warning && (
        <div className="shrink-0 flex items-center gap-2 px-6 py-4 bg-emerald-50 text-emerald-700 text-sm border-b border-border">
          <Check className="w-4 h-4 shrink-0" />
          Barang masuk berhasil disimpan
        </div>
      )}

      {/* Warning banner (barang masuk OK tapi hutang gagal) */}
      {warning && (
        <div className="shrink-0 flex items-start gap-2 px-6 py-4 bg-amber-50 text-amber-800 text-sm border-b border-border">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{warning}</span>
        </div>
      )}

      {/* Header fields */}
      <div className="shrink-0 flex flex-col md:flex-row md:items-end gap-4 px-6 py-5 border-b border-border bg-transparent">
        <div className="flex flex-col gap-1.5 w-full md:w-auto">
          <label
            htmlFor="id_supplier"
            className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider"
          >
            Supplier
          </label>
          <select
            id="id_supplier"
            {...register("id_supplier")}
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
          <label
            htmlFor="tgl_masuk"
            className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider"
          >
            Tanggal Masuk
          </label>
          <input
            id="tgl_masuk"
            type="date"
            {...register("tgl_masuk")}
            className="h-9 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/20 focus-visible:border-primary"
          />
        </div>

        <div className="flex flex-col gap-1.5 w-full md:w-auto">
          <label
            htmlFor="payment_type"
            className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider"
          >
            Metode Bayar
          </label>
          <select
            id="payment_type"
            {...register("paymentType")}
            className="h-9 w-full md:min-w-[150px] rounded-md border border-input bg-background px-3 py-1.5 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/20 focus-visible:border-primary"
          >
            <option value="Tunai">Tunai</option>
            <option value="Kredit">Kredit / Tempo</option>
          </select>
        </div>

        {paymentType === "Kredit" && (
          <div className="flex flex-col gap-1.5 w-full md:w-auto">
            <label
              htmlFor="tgl_jatuh_tempo"
              className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider"
            >
              Jatuh Tempo
            </label>
            <input
              id="tgl_jatuh_tempo"
              type="date"
              {...register("tanggalJatuhTempo")}
              className="h-9 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/20 focus-visible:border-primary"
            />
          </div>
        )}
      </div>

      {/* Table */}
      <div className="flex-1 overflow-y-auto min-h-0">
        <table className="w-full min-w-[900px]">
          <thead>
            <tr className="border-b border-border/60 bg-muted/80 backdrop-blur-md sticky top-0 z-10">
              <th className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider h-10 w-10 text-center px-2">
                #
              </th>
              <th className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider h-10 text-left px-2">
                Produk
              </th>
              <th className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider h-10 text-left w-[110px] px-2">
                Satuan Suplai
              </th>
              <th className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider h-10 text-left w-[110px] px-2">
                Qty Masuk
              </th>
              <th className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider h-10 text-left w-[140px] px-2">
                Total Harga
              </th>
              <th className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider h-10 text-right w-[120px] px-2">
                Harga/Pcs
              </th>
              <th className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider h-10 text-right w-[110px] px-2">
                Base Qty
              </th>
              <th className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider h-10 text-left w-[160px] px-2">
                Keterangan
              </th>
              <th className="w-10 px-2" />
            </tr>
          </thead>
          <tbody>
            {fields.map((field, index) => {
              const productId = watch(`items.${index}.id_produk`);
              const selectedProduct = products.find((p) => p.id === productId);
              const suppliedQty = watch(`items.${index}.supplied_qty`) || 0;
              const totalCost = watch(`items.${index}.total_cost`) || 0;

              const ratio = selectedProduct?.conversion_ratio || 1;
              const baseQty = suppliedQty * ratio;
              const perPieceCost = baseQty > 0 ? totalCost / baseQty : 0;

              return (
                <tr
                  key={field.id}
                  className="border-b border-border/40 hover:bg-muted/20 transition-colors"
                >
                  <td className="text-center text-sm text-muted-foreground tabular-nums px-2 py-2 align-top pt-5">
                    {index + 1}
                  </td>
                  <td className="px-2 py-2">
                    <ProductCombo index={index} products={products} />
                    <ConversionIndicator index={index} products={products} />
                  </td>
                  <td className="px-2 py-2">
                    <select
                      {...register(`items.${index}.supplied_unit`)}
                      className={inputBase}
                    >
                      <option value="">Pilih</option>
                      {satuanOptions.map((u) => (
                        <option key={u.id} value={u.nama}>{u.nama}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-2 py-2">
                    <Input
                      type="number"
                      min={0}
                      step="any"
                      {...register(`items.${index}.supplied_qty`, {
                        valueAsNumber: true,
                      })}
                      className="h-9 tabular-nums font-medium"
                    />
                  </td>
                  <td className="px-2 py-2">
                    <Input
                      type="number"
                      min={0}
                      step="any"
                      {...register(`items.${index}.total_cost`, {
                        valueAsNumber: true,
                      })}
                      className="h-9 tabular-nums font-medium"
                    />
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums text-sm font-light text-foreground/70 align-top pt-5">
                    {perPieceCost > 0 ? formatIDR(Math.round(perPieceCost)) : "-"}
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums text-sm font-medium text-foreground align-top pt-5">
                    {baseQty > 0 ? `${baseQty} ${selectedProduct?.base_unit || "pcs"}` : "-"}
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
              Tambah item untuk mencatat penerimaan stok
            </p>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="shrink-0 flex items-center justify-between px-6 py-4 border-t border-border bg-background gap-4 flex-wrap">
        <Button
          type="button"
          variant="ghost"
          className="rounded-full px-4 h-9 text-muted-foreground hover:text-foreground"
          onClick={() =>
            append({
              id_produk: 0,
              supplied_qty: 1,
              supplied_unit: "",
              total_cost: 0,
              keterangan: "",
            })
          }
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
              {formatIDR(computedTotal)}
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
              "Simpan Barang Masuk"
            )}
          </Button>
        </div>
      </div>
    </form>
  );
}

/* ------------------------------------------------------------------ */
/*  Page-level Client Component — wraps everything in FormProvider     */
/* ------------------------------------------------------------------ */

export default function StockInClient({
  products,
  suppliers,
  satuanOptions,
}: {
  products: Product[];
  suppliers: Supplier[];
  satuanOptions: { id: number; nama: string }[];
}) {
  const today = new Date().toISOString().slice(0, 10);
  const defaultJatuhTempo = (() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().slice(0, 10);
  })();

  const form = useForm<StockInFormValues>({
    resolver: makeResolver(formSchema) as any,
    mode: "onSubmit",
    defaultValues: {
      id_supplier: "",
      tgl_masuk: today,
      paymentType: "Tunai",
      tanggalJatuhTempo: defaultJatuhTempo,
      items: [{ id_produk: 0, supplied_qty: 1, supplied_unit: "", total_cost: 0, keterangan: "" }],
    },
  });

  return (
    <FormProvider {...form}>
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
          <FormBody products={products} suppliers={suppliers} satuanOptions={satuanOptions} />
        </div>
      </div>
    </FormProvider>
  );
}
