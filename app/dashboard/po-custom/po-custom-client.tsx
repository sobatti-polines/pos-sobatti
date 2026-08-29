"use client";

import {
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import {
  Check,
  ChevronsUpDown,
  ClipboardList,
  Edit2,
  Loader2,
  Plus,
  Printer,
  ReceiptText,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import DataTable, { type Column, type DeleteModalConfig } from "@/components/data-table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Highlight } from "@/components/highlight";
import { useTable } from "@/hooks/use-table";
import {
  addPoCustomPayment,
  deletePoCustom,
  finalizePoCustom,
  savePoCustom,
  type PaymentType,
  type PoCustomStatus,
} from "./actions";

export interface CustomerOption {
  id: number;
  nama_pelanggan: string;
  no_hp: string | null;
}

export interface ProductOption {
  id: number;
  nama_produk: string;
  sku: string | null;
}

export interface PaymentMethodOption {
  id: number;
  nama: string;
}

export interface PoPaymentRecord {
  id: number;
  tanggal_bayar: string;
  jumlah_bayar: number;
  jenis_pembayaran: PaymentType;
  keterangan: string | null;
  metode_bayar: PaymentMethodOption | null;
}

export interface PoCustomRecord {
  id: number;
  no_po: string;
  id_pelanggan: number;
  id_produk: number | null;
  tanggal_po: string;
  nama_pesanan: string;
  spesifikasi: string | null;
  atribut_custom: Record<string, string> | null;
  qty: number;
  harga_total: number;
  target_selesai: string | null;
  status: PoCustomStatus;
  catatan_internal: string | null;
  id_transaksi_keluar: number | null;
  finalized_at: string | null;
  finalized_by: number | null;
  created_at: string;
  pelanggan: CustomerOption | null;
  produk: ProductOption | null;
  po_custom_pembayaran: PoPaymentRecord[];
  transaksi_keluar?: {
    id: number;
    no_transaksi: number;
    tgl_transaksi: string;
    total: number;
  } | null;
}

interface AttributeRow {
  key: string;
  value: string;
}

interface PoFormState {
  id_pelanggan: string;
  id_produk: string;
  tanggal_po: string;
  nama_pesanan: string;
  spesifikasi: string;
  attributes: AttributeRow[];
  qty: string;
  harga_total: string;
  target_selesai: string;
  status: PoCustomStatus;
  catatan_internal: string;
  dp_persen: string;
  id_metode_bayar_dp: string;
}

interface PaymentFormState {
  tanggal_bayar: string;
  jumlah_bayar: string;
  id_metode_bayar: string;
  jenis_pembayaran: PaymentType;
  keterangan: string;
}

interface PoCustomView extends PoCustomRecord {
  total_dibayar: number;
  sisa: number;
}

interface SearchableOption {
  id: number;
  label: string;
  meta?: string | null;
  searchText: string;
}

const STATUS_OPTIONS: Array<{ value: PoCustomStatus; label: string }> = [
  { value: "DRAFT", label: "Draft" },
  { value: "MENUNGGU_DP", label: "Menunggu DP" },
  { value: "DIPROSES", label: "Diproses" },
  { value: "SIAP_KIRIM", label: "Siap Kirim" },
  { value: "SELESAI", label: "Selesai" },
  { value: "BATAL", label: "Batal" },
];

const PAYMENT_TYPE_OPTIONS: Array<{ value: PaymentType; label: string }> = [
  { value: "DP", label: "DP" },
  { value: "TAMBAHAN", label: "Tambahan" },
  { value: "PELUNASAN", label: "Pelunasan" },
];

function todayJakarta() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function formatIDR(value: number | string | null | undefined) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Number(value ?? 0));
}

function formatNumber(value: number | string | null | undefined) {
  return new Intl.NumberFormat("id-ID", { maximumFractionDigits: 2 }).format(
    Number(value ?? 0)
  );
}

function formatDate(value: string | null | undefined) {
  if (!value) return "-";
  return new Date(`${value}T00:00:00`).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function statusLabel(status: PoCustomStatus) {
  return STATUS_OPTIONS.find((item) => item.value === status)?.label ?? status;
}

function statusBadge(status: PoCustomStatus) {
  const cls: Record<PoCustomStatus, string> = {
    DRAFT: "bg-muted text-muted-foreground",
    MENUNGGU_DP: "bg-amber-100 text-amber-700",
    DIPROSES: "bg-blue-100 text-blue-700",
    SIAP_KIRIM: "bg-indigo-100 text-indigo-700",
    SELESAI: "bg-emerald-100 text-emerald-700",
    BATAL: "bg-rose-100 text-rose-700",
  };

  return (
    <Badge className={`border-none rounded-full px-2.5 py-0.5 text-[11px] ${cls[status]}`}>
      {statusLabel(status)}
    </Badge>
  );
}

function normalizePayments(payments: PoPaymentRecord[] | null | undefined) {
  return [...(payments ?? [])].sort((a, b) =>
    String(b.tanggal_bayar).localeCompare(String(a.tanggal_bayar))
  );
}

function attributesToRows(attributes: Record<string, string> | null | undefined): AttributeRow[] {
  const rows = Object.entries(attributes ?? {}).map(([key, value]) => ({
    key,
    value: String(value ?? ""),
  }));
  return rows.length > 0 ? rows : [{ key: "Model", value: "" }, { key: "Ukuran", value: "" }];
}

function rowsToAttributes(rows: AttributeRow[]) {
  return rows.reduce<Record<string, string>>((acc, row) => {
    const key = row.key.trim();
    const value = row.value.trim();
    if (key && value) acc[key] = value;
    return acc;
  }, {});
}

function buildForm(record?: PoCustomRecord | null): PoFormState {
  return {
    id_pelanggan: record?.id_pelanggan ? String(record.id_pelanggan) : "",
    id_produk: record?.id_produk ? String(record.id_produk) : "",
    tanggal_po: record?.tanggal_po ?? todayJakarta(),
    nama_pesanan: record?.nama_pesanan ?? "",
    spesifikasi: record?.spesifikasi ?? "",
    attributes: attributesToRows(record?.atribut_custom),
    qty: String(record?.qty ?? 1),
    harga_total: String(record?.harga_total ?? ""),
    target_selesai: record?.target_selesai ?? "",
    status: record?.status ?? "MENUNGGU_DP",
    catatan_internal: record?.catatan_internal ?? "",
    dp_persen: "",
    id_metode_bayar_dp: "",
  };
}

function buildPaymentForm(): PaymentFormState {
  return {
    tanggal_bayar: todayJakarta(),
    jumlah_bayar: "",
    id_metode_bayar: "",
    jenis_pembayaran: "TAMBAHAN",
    keterangan: "",
  };
}

function SearchableCombobox({
  options,
  value,
  placeholder,
  searchPlaceholder,
  emptyText,
  onChange,
}: {
  options: SearchableOption[];
  value: number | null;
  placeholder: string;
  searchPlaceholder: string;
  emptyText: string;
  onChange: (id: number | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlighted, setHighlighted] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);

  const selected = useMemo(
    () => options.find((option) => option.id === value) ?? null,
    [options, value]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options.slice(0, 60);
    return options
      .filter((option) => option.searchText.toLowerCase().includes(q))
      .slice(0, 60);
  }, [options, query]);

  useEffect(() => {
    if (!open) return;
    const onClickOutside = (event: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
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
          setOpen((current) => !current);
          setQuery("");
          setHighlighted(0);
        }}
        className={`flex h-10 w-full items-center justify-between gap-2 rounded-[6px] border border-input bg-background px-3 text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 ${
          open ? "border-primary ring-2 ring-primary/20" : ""
        }`}
      >
        <span className={`min-w-0 truncate ${selected ? "text-foreground" : "text-muted-foreground"}`}>
          {selected ? (
            <>
              <span className="font-medium">{selected.label}</span>
              {selected.meta && (
                <span className="ml-2 text-xs text-muted-foreground">
                  ({selected.meta})
                </span>
              )}
            </>
          ) : (
            placeholder
          )}
        </span>
        <ChevronsUpDown className="h-4 w-4 shrink-0 text-muted-foreground" />
      </button>

      {open && (
        <div className="absolute z-50 mt-1.5 w-full overflow-hidden rounded-xl border border-border bg-background shadow-lg shadow-black/5">
          <div className="flex items-center gap-2 border-b border-border/60 p-2">
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
            <input
              autoFocus
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setHighlighted(0);
              }}
              placeholder={searchPlaceholder}
              className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>
          <ul className="max-h-56 overflow-y-auto py-1">
            <li>
              <button
                type="button"
                onMouseEnter={() => setHighlighted(-1)}
                onClick={() => {
                  onChange(null);
                  setOpen(false);
                }}
                className={`flex w-full items-center justify-between gap-2 px-3.5 py-2.5 text-left text-sm transition-colors ${
                  highlighted === -1 ? "bg-primary/10" : ""
                } ${value == null ? "font-medium text-primary" : "text-muted-foreground"}`}
              >
                {placeholder}
              </button>
            </li>

            {filtered.length === 0 && (
              <li className="px-3.5 py-2.5 text-sm text-muted-foreground">
                {emptyText}
              </li>
            )}

            {filtered.map((option, index) => (
              <li key={option.id}>
                <button
                  type="button"
                  onMouseEnter={() => setHighlighted(index)}
                  onClick={() => {
                    onChange(option.id);
                    setOpen(false);
                  }}
                  className={`flex w-full items-center justify-between gap-2 px-3.5 py-2.5 text-left text-sm transition-colors ${
                    index === highlighted ? "bg-primary/10" : ""
                  } ${value === option.id ? "font-medium text-primary" : "text-foreground"}`}
                >
                  <span className="min-w-0 truncate">
                    <Highlight text={option.label} query={query} />
                  </span>
                  {option.meta && (
                    <span className="shrink-0 text-[11px] uppercase tracking-wider text-muted-foreground">
                      <Highlight text={option.meta} query={query} />
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export default function PoCustomClient({
  initialRecords,
  customers,
  products,
  paymentMethods,
}: {
  initialRecords: PoCustomRecord[];
  customers: CustomerOption[];
  products: ProductOption[];
  paymentMethods: PaymentMethodOption[];
}) {
  const [records] = useState(initialRecords);
  const [searchQuery, setSearchQuery] = useState("");
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const [statusFilter, setStatusFilter] = useState("all");
  const [editingRecord, setEditingRecord] = useState<PoCustomRecord | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [viewingRecord, setViewingRecord] = useState<PoCustomView | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PoCustomRecord | null>(null);
  const [form, setForm] = useState<PoFormState>(() => buildForm());
  const [paymentForm, setPaymentForm] = useState<PaymentFormState>(() => buildPaymentForm());
  const [finalizePaymentMethodId, setFinalizePaymentMethodId] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [isPending, startTransition] = useTransition();
  const hargaTotal = Number(form.harga_total || 0) || 0;
  const dpPersen = Number(form.dp_persen || 0) || 0;
  const dpAwal = Math.round((hargaTotal * dpPersen) / 100);

  const customerOptions = useMemo<SearchableOption[]>(
    () =>
      customers.map((customer) => ({
        id: customer.id,
        label: customer.nama_pelanggan,
        meta: customer.no_hp,
        searchText: [customer.nama_pelanggan, customer.no_hp]
          .filter(Boolean)
          .join(" "),
      })),
    [customers]
  );

  const productOptions = useMemo<SearchableOption[]>(
    () =>
      products.map((product) => ({
        id: product.id,
        label: product.nama_produk,
        meta: product.sku || "Tanpa SKU",
        searchText: [product.nama_produk, product.sku]
          .filter(Boolean)
          .join(" "),
      })),
    [products]
  );

  const data = useMemo<PoCustomView[]>(() => {
    return records.map((record) => {
      const totalDibayar = (record.po_custom_pembayaran ?? []).reduce(
        (sum, payment) => sum + Number(payment.jumlah_bayar ?? 0),
        0
      );
      return {
        ...record,
        po_custom_pembayaran: normalizePayments(record.po_custom_pembayaran),
        total_dibayar: totalDibayar,
        sisa: Math.max(Number(record.harga_total ?? 0) - totalDibayar, 0),
      };
    });
  }, [records]);

  const filteredData = useMemo(() => {
    let result = [...data];
    if (statusFilter !== "all") {
      result = result.filter((row) => row.status === statusFilter);
    }
    if (deferredSearchQuery.trim()) {
      const q = deferredSearchQuery.toLowerCase();
      result = result.filter((row) => {
        const text = [
          row.no_po,
          row.nama_pesanan,
          row.pelanggan?.nama_pelanggan,
          row.pelanggan?.no_hp,
          row.produk?.nama_produk,
          row.produk?.sku,
          row.transaksi_keluar?.no_transaksi,
          row.spesifikasi,
          ...Object.values(row.atribut_custom ?? {}),
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return text.includes(q);
      });
    }
    return result;
  }, [data, deferredSearchQuery, statusFilter]);

  const table = useTable({ data: filteredData, defaultItemsPerPage: 25 });

  const openNewForm = () => {
    setEditingRecord(null);
    setForm(buildForm());
    setErrorMsg("");
    setIsFormOpen(true);
  };

  const openEditForm = (record: PoCustomRecord) => {
    if (record.id_transaksi_keluar) {
      setErrorMsg("PO custom yang sudah difinalisasi tidak bisa diedit");
      return;
    }
    setEditingRecord(record);
    setForm(buildForm(record));
    setErrorMsg("");
    setIsFormOpen(true);
  };

  const closeForm = () => {
    setIsFormOpen(false);
    setEditingRecord(null);
    setForm(buildForm());
    setErrorMsg("");
  };

  const handleSave = () => {
    setErrorMsg("");
    if (dpPersen < 0 || dpPersen > 100) {
      setErrorMsg("Persentase DP awal harus di antara 0% sampai 100%");
      return;
    }
    startTransition(async () => {
      const result = await savePoCustom(editingRecord?.id ?? null, {
        id_pelanggan: Number(form.id_pelanggan),
        id_produk: form.id_produk ? Number(form.id_produk) : null,
        tanggal_po: form.tanggal_po,
        nama_pesanan: form.nama_pesanan,
        spesifikasi: form.spesifikasi,
        atribut_custom: rowsToAttributes(form.attributes),
        qty: Number(form.qty),
        harga_total: Number(form.harga_total),
        target_selesai: form.target_selesai || null,
        status: form.status,
        catatan_internal: form.catatan_internal,
        dp_awal: dpAwal,
        id_metode_bayar_dp: form.id_metode_bayar_dp
          ? Number(form.id_metode_bayar_dp)
          : null,
      });

      if (result.error) {
        setErrorMsg(result.error);
        return;
      }

      window.location.reload();
    });
  };

  const handleDeleteConfirm = () => {
    if (!deleteTarget) return;
    setErrorMsg("");
    startTransition(async () => {
      const result = await deletePoCustom(deleteTarget.id);
      if (result.error) {
        setErrorMsg(result.error);
        return;
      }
      window.location.reload();
    });
  };

  const handlePaymentSave = (record: PoCustomView) => {
    setErrorMsg("");
    startTransition(async () => {
      const result = await addPoCustomPayment(record.id, {
        tanggal_bayar: paymentForm.tanggal_bayar,
        jumlah_bayar: Number(paymentForm.jumlah_bayar),
        id_metode_bayar: paymentForm.id_metode_bayar
          ? Number(paymentForm.id_metode_bayar)
          : null,
        jenis_pembayaran: paymentForm.jenis_pembayaran,
        keterangan: paymentForm.keterangan,
      });

      if (result.error) {
        setErrorMsg(result.error);
        return;
      }

      window.location.reload();
    });
  };

  const handleFinalize = (record: PoCustomView) => {
    setErrorMsg("");
    startTransition(async () => {
      const result = await finalizePoCustom(record.id, Number(finalizePaymentMethodId));

      if (result.error) {
        setErrorMsg(result.error);
        return;
      }

      window.location.reload();
    });
  };

  const handleQuickStatus = (record: PoCustomView, status: PoCustomStatus) => {
    setErrorMsg("");
    startTransition(async () => {
      const result = await savePoCustom(record.id, {
        id_pelanggan: record.id_pelanggan,
        id_produk: record.id_produk,
        tanggal_po: record.tanggal_po,
        nama_pesanan: record.nama_pesanan,
        spesifikasi: record.spesifikasi,
        atribut_custom: record.atribut_custom ?? {},
        qty: Number(record.qty),
        harga_total: Number(record.harga_total),
        target_selesai: record.target_selesai,
        status,
        catatan_internal: record.catatan_internal,
      });

      if (result.error) {
        setErrorMsg(result.error);
        return;
      }

      window.location.reload();
    });
  };

  const updateAttribute = (index: number, patch: Partial<AttributeRow>) => {
    setForm((prev) => ({
      ...prev,
      attributes: prev.attributes.map((row, i) =>
        i === index ? { ...row, ...patch } : row
      ),
    }));
  };

  const columns: Column<PoCustomView>[] = [
    {
      key: "no_po",
      header: "No PO",
      sortable: true,
      className: "pl-6",
      headerClassName: "pl-6",
      render: (row) => (
        <div className="grid gap-1">
          <p className="font-medium text-foreground">{row.no_po}</p>
          <p className="text-xs text-muted-foreground">{formatDate(row.tanggal_po)}</p>
          {row.id_transaksi_keluar && (
            <span className="inline-flex w-fit items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
              Masuk laporan
            </span>
          )}
        </div>
      ),
    },
    {
      key: "pelanggan",
      header: "Pelanggan",
      sortable: true,
      sortKey: "pelanggan.nama_pelanggan",
      render: (row) => (
        <div>
          <p className="font-medium text-foreground">{row.pelanggan?.nama_pelanggan ?? "-"}</p>
          <p className="text-xs text-muted-foreground tabular-nums">{row.pelanggan?.no_hp ?? "-"}</p>
        </div>
      ),
    },
    {
      key: "pesanan",
      header: "Pesanan",
      sortable: true,
      sortKey: "nama_pesanan",
      render: (row) => (
        <div className="max-w-[260px]">
          <p className="truncate font-medium text-foreground">{row.nama_pesanan}</p>
          <p className="truncate text-xs text-muted-foreground">
            {row.produk?.nama_produk ?? "Tanpa produk inventaris"}
          </p>
        </div>
      ),
    },
    {
      key: "harga_total",
      header: "Total",
      sortable: true,
      align: "right",
      render: (row) => (
        <span className="tabular-nums font-medium">{formatIDR(row.harga_total)}</span>
      ),
    },
    {
      key: "sisa",
      header: "Sisa",
      sortable: true,
      align: "right",
      render: (row) => (
        <div className="text-right tabular-nums">
          <p className="font-medium">{formatIDR(row.sisa)}</p>
          <p className="text-xs text-muted-foreground">Bayar {formatIDR(row.total_dibayar)}</p>
        </div>
      ),
    },
    {
      key: "target_selesai",
      header: "Target",
      sortable: true,
      render: (row) => (
        <span className="text-sm text-muted-foreground">{formatDate(row.target_selesai)}</span>
      ),
    },
    {
      key: "status",
      header: "Status",
      sortable: true,
      render: (row) => statusBadge(row.status),
    },
    {
      key: "actions",
      header: "",
      className: "pr-6",
      headerClassName: "w-[96px] pr-6",
      render: (row) => (
        <div className="flex justify-end gap-1">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Edit PO Custom"
            className="h-11 w-11 md:h-8 md:w-8 text-muted-foreground hover:text-foreground"
            disabled={Boolean(row.id_transaksi_keluar)}
            onClick={(event) => {
              event.stopPropagation();
              openEditForm(row);
            }}
          >
            <Edit2 className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Cetak PO Custom"
            className="h-11 w-11 md:h-8 md:w-8 text-muted-foreground hover:text-primary"
            onClick={(event) => {
              event.stopPropagation();
              window.open(`/dashboard/po-custom/${row.id}/print`, "_blank", "noopener,noreferrer");
            }}
          >
            <Printer className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Hapus PO Custom"
            className="h-11 w-11 md:h-8 md:w-8 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
            disabled={Boolean(row.id_transaksi_keluar)}
            onClick={(event) => {
              event.stopPropagation();
              setDeleteTarget(row);
            }}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ];

  const deleteModal: DeleteModalConfig | undefined = deleteTarget
    ? {
        open: true,
        title: "Hapus PO Custom?",
        itemName: deleteTarget.no_po,
        onConfirm: handleDeleteConfirm,
        onCancel: () => {
          setDeleteTarget(null);
          setErrorMsg("");
        },
        isPending,
        error: errorMsg,
      }
    : undefined;

  return (
    <>
      <DataTable
        data={table.paginatedData}
        total={table.total}
        columns={columns}
        rowKey={(row) => row.id}
        search={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder="Cari no PO, pelanggan, produk, atau spesifikasi..."
        sortConfig={table.sortConfig}
        onSort={table.handleSort}
        currentPage={table.currentPage}
        onPageChange={table.setCurrentPage}
        itemsPerPage={table.itemsPerPage}
        onItemsPerPageChange={table.setItemsPerPage}
        onRowClick={(row) => {
          setViewingRecord(row);
          setPaymentForm(buildPaymentForm());
          setFinalizePaymentMethodId(
            String(row.po_custom_pembayaran[0]?.metode_bayar?.id ?? "")
          );
          setErrorMsg("");
        }}
        filters={[
          {
            type: "select",
            label: "Status",
            value: statusFilter,
            onChange: setStatusFilter,
            placeholder: "Semua Status",
            options: STATUS_OPTIONS.map((status) => ({
              value: status.value,
              label: status.label,
            })),
          },
        ]}
        actions={[
          {
            label: "Buat PO Custom",
            icon: <Plus className="w-4 h-4" />,
            kind: "primary",
            onClick: openNewForm,
          },
        ]}
        deleteModal={deleteModal}
        emptyState={{
          icon: ClipboardList,
          title: "Belum ada PO Custom",
          description: "Buat PO custom pertama untuk mencatat DP, sisa pembayaran, dan status pengerjaan.",
        }}
        mobileCards
      />

      <Dialog open={isFormOpen} onOpenChange={(open) => (open ? setIsFormOpen(true) : closeForm())}>
        <DialogContent className="max-h-[90vh] max-w-5xl overflow-y-auto p-0">
          <DialogHeader className="border-b border-border px-5 py-4">
            <DialogTitle>
              {editingRecord ? "Edit PO Custom" : "Buat PO Custom"}
            </DialogTitle>
            <DialogDescription>
              Catat pesanan custom pelanggan dengan produk inventaris, spesifikasi, total harga, dan DP.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-5 px-5 py-4">
            {errorMsg && (
              <div className="rounded-[8px] border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                {errorMsg}
              </div>
            )}

            <div className="grid gap-4 md:grid-cols-2">
              <label className="grid gap-1.5">
                <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  Pelanggan
                </span>
                <SearchableCombobox
                  options={customerOptions}
                  value={form.id_pelanggan ? Number(form.id_pelanggan) : null}
                  placeholder="Pilih pelanggan"
                  searchPlaceholder="Ketik nama atau no. HP pelanggan..."
                  emptyText="Tidak ada pelanggan yang cocok"
                  onChange={(id) =>
                    setForm((prev) => ({
                      ...prev,
                      id_pelanggan: id ? String(id) : "",
                    }))
                  }
                />
              </label>

              <label className="grid gap-1.5">
                <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  Produk Inventaris
                </span>
                <SearchableCombobox
                  options={productOptions}
                  value={form.id_produk ? Number(form.id_produk) : null}
                  placeholder="Opsional, pilih produk custom"
                  searchPlaceholder="Ketik nama produk atau SKU..."
                  emptyText="Tidak ada produk yang cocok"
                  onChange={(id) =>
                    setForm((prev) => ({
                      ...prev,
                      id_produk: id ? String(id) : "",
                    }))
                  }
                />
              </label>
            </div>

            <div className="grid gap-4 md:grid-cols-[1fr_150px_180px]">
              <label className="grid gap-1.5">
                <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  Nama Pesanan
                </span>
                <Input
                  value={form.nama_pesanan}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, nama_pesanan: event.target.value }))
                  }
                  placeholder="Contoh: Pintu custom rumah Pak Budi"
                />
              </label>

              <label className="grid gap-1.5">
                <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  Qty
                </span>
                <Input
                  type="number"
                  min="0"
                  step="0.001"
                  value={form.qty}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, qty: event.target.value }))
                  }
                />
              </label>

              <label className="grid gap-1.5">
                <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  Tanggal PO
                </span>
                <Input
                  type="date"
                  value={form.tanggal_po}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, tanggal_po: event.target.value }))
                  }
                />
              </label>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <label className="grid gap-1.5">
                <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  Harga Total
                </span>
                <Input
                  type="number"
                  min="0"
                  value={form.harga_total}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, harga_total: event.target.value }))
                  }
                  placeholder="0"
                />
              </label>

              <label className="grid gap-1.5">
                <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  Target Selesai
                </span>
                <Input
                  type="date"
                  value={form.target_selesai}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, target_selesai: event.target.value }))
                  }
                />
              </label>

              <label className="grid gap-1.5">
                <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  Status
                </span>
                <Select
                  value={form.status}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      status: event.target.value as PoCustomStatus,
                    }))
                  }
                >
                  {STATUS_OPTIONS.map((status) => (
                    <option key={status.value} value={status.value}>
                      {status.label}
                    </option>
                  ))}
                </Select>
              </label>
            </div>

            {!editingRecord && (
              <div className="grid gap-4 rounded-[12px] border border-border p-4 md:grid-cols-2">
                <label className="grid gap-1.5">
                  <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                    DP Awal (%)
                  </span>
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    value={form.dp_persen ?? ""}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, dp_persen: event.target.value }))
                    }
                    placeholder="Contoh: 20"
                  />
                  <span className="text-xs text-muted-foreground tabular-nums">
                    Nominal DP: {formatIDR(dpAwal)}
                  </span>
                </label>

                <label className="grid gap-1.5">
                  <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                    Metode Bayar DP
                  </span>
                  <Select
                    value={form.id_metode_bayar_dp}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        id_metode_bayar_dp: event.target.value,
                      }))
                    }
                    disabled={!dpAwal}
                  >
                    <option value="">Pilih metode bayar</option>
                    {paymentMethods.map((method) => (
                      <option key={method.id} value={method.id}>
                        {method.nama}
                      </option>
                    ))}
                  </Select>
                  <span className="text-xs text-muted-foreground">
                    {dpAwal ? "Dicatat sebagai pembayaran DP awal" : "Aktif setelah DP diisi"}
                  </span>
                </label>
              </div>
            )}

            <div className="grid gap-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-medium text-foreground">Spesifikasi Custom</p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="rounded-full"
                  onClick={() =>
                    setForm((prev) => ({
                      ...prev,
                      attributes: [...prev.attributes, { key: "", value: "" }],
                    }))
                  }
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Tambah Baris
                </Button>
              </div>

              <div className="grid gap-2">
                {form.attributes.map((row, index) => (
                  <div key={index} className="grid gap-2 md:grid-cols-[180px_1fr_auto]">
                    <Input
                      value={row.key}
                      onChange={(event) => updateAttribute(index, { key: event.target.value })}
                      placeholder="Label, contoh: Ukuran"
                    />
                    <Input
                      value={row.value}
                      onChange={(event) => updateAttribute(index, { value: event.target.value })}
                      placeholder="Isi, contoh: 80 x 210 cm"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label="Hapus baris spesifikasi"
                      onClick={() =>
                        setForm((prev) => ({
                          ...prev,
                          attributes:
                            prev.attributes.length === 1
                              ? [{ key: "", value: "" }]
                              : prev.attributes.filter((_, i) => i !== index),
                        }))
                      }
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            <label className="grid gap-1.5">
              <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                Spesifikasi Tambahan
              </span>
              <textarea
                value={form.spesifikasi}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, spesifikasi: event.target.value }))
                }
                rows={3}
                className="min-h-24 rounded-[6px] border border-input bg-background px-3 py-2 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20"
                placeholder="Catatan detail yang tidak masuk ke baris spesifikasi"
              />
            </label>

            <label className="grid gap-1.5">
              <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                Catatan Internal
              </span>
              <textarea
                value={form.catatan_internal}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, catatan_internal: event.target.value }))
                }
                rows={2}
                className="min-h-20 rounded-[6px] border border-input bg-background px-3 py-2 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20"
                placeholder="Catatan untuk owner/admin"
              />
            </label>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeForm} disabled={isPending}>
              Batal
            </Button>
            <Button onClick={handleSave} disabled={isPending}>
              {isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Check className="mr-2 h-4 w-4" />
              )}
              Simpan PO
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(viewingRecord)}
        onOpenChange={(open) => {
          if (!open) {
            setViewingRecord(null);
            setPaymentForm(buildPaymentForm());
            setFinalizePaymentMethodId("");
            setErrorMsg("");
          }
        }}
      >
        {viewingRecord && (
          <DialogContent className="max-h-[90vh] max-w-5xl overflow-y-auto p-0">
            <DialogHeader className="border-b border-border px-5 py-4">
              <DialogTitle>{viewingRecord.no_po}</DialogTitle>
              <DialogDescription>
                {viewingRecord.pelanggan?.nama_pelanggan ?? "-"} - {viewingRecord.nama_pesanan}
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-5 px-5 py-4">
              {errorMsg && (
                <div className="rounded-[8px] border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                  {errorMsg}
                </div>
              )}

              <div className="grid gap-3 md:grid-cols-4">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Total
                  </p>
                  <p className="mt-1 text-lg font-light tabular-nums">
                    {formatIDR(viewingRecord.harga_total)}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Dibayar
                  </p>
                  <p className="mt-1 text-lg font-light tabular-nums">
                    {formatIDR(viewingRecord.total_dibayar)}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Sisa
                  </p>
                  <p className="mt-1 text-lg font-light tabular-nums">
                    {formatIDR(viewingRecord.sisa)}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Status
                  </p>
                  <div className="mt-1">{statusBadge(viewingRecord.status)}</div>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-[1fr_240px]">
                <div className="rounded-[12px] border border-border p-4">
                  <p className="mb-3 text-sm font-medium text-foreground">Spesifikasi</p>
                  <div className="grid gap-2 text-sm">
                    <div className="flex justify-between gap-4">
                      <span className="text-muted-foreground">Produk</span>
                      <span className="text-right">{viewingRecord.produk?.nama_produk ?? "-"}</span>
                    </div>
                    <div className="flex justify-between gap-4">
                      <span className="text-muted-foreground">Qty</span>
                      <span className="tabular-nums">{formatNumber(viewingRecord.qty)}</span>
                    </div>
                    {Object.entries(viewingRecord.atribut_custom ?? {}).map(([key, value]) => (
                      <div key={key} className="flex justify-between gap-4">
                        <span className="text-muted-foreground">{key}</span>
                        <span className="text-right">{value}</span>
                      </div>
                    ))}
                  </div>
                  {viewingRecord.spesifikasi && (
                    <p className="mt-4 whitespace-pre-line text-sm text-muted-foreground">
                      {viewingRecord.spesifikasi}
                    </p>
                  )}
                </div>

                <div className="rounded-[12px] border border-border p-4">
                  <p className="mb-3 text-sm font-medium text-foreground">Update Status</p>
                  <div className="grid gap-2">
                    {STATUS_OPTIONS.map((status) => (
                      <Button
                        key={status.value}
                        type="button"
                        variant={viewingRecord.status === status.value ? "default" : "outline"}
                        className="justify-start rounded-full"
                        disabled={
                          isPending ||
                          viewingRecord.status === status.value ||
                          Boolean(viewingRecord.id_transaksi_keluar)
                        }
                        onClick={() => handleQuickStatus(viewingRecord, status.value)}
                      >
                        {status.label}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="rounded-[12px] border border-border p-4">
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="text-sm font-medium text-foreground">Finalisasi ke Transaksi</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Setelah difinalisasi, PO masuk ke transaksi penjualan, omset, laporan penjualan, dan laba rugi.
                    </p>
                  </div>

                  {viewingRecord.id_transaksi_keluar ? (
                    <div className="rounded-[10px] bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                      <div className="flex items-center gap-2 font-medium">
                        <ReceiptText className="h-4 w-4" />
                        Sudah Masuk Laporan
                      </div>
                      <p className="mt-1 text-xs">
                        Transaksi #{viewingRecord.transaksi_keluar?.no_transaksi ?? viewingRecord.id_transaksi_keluar}
                      </p>
                    </div>
                  ) : (
                    <div className="grid w-full gap-2 md:w-[320px]">
                      <Select
                        value={finalizePaymentMethodId}
                        onChange={(event) => setFinalizePaymentMethodId(event.target.value)}
                      >
                        <option value="">Pilih metode bayar transaksi</option>
                        {paymentMethods.map((method) => (
                          <option key={method.id} value={method.id}>
                            {method.nama}
                          </option>
                        ))}
                      </Select>
                      <Button
                        type="button"
                        onClick={() => handleFinalize(viewingRecord)}
                        disabled={
                          isPending ||
                          !finalizePaymentMethodId ||
                          !viewingRecord.id_produk ||
                          viewingRecord.sisa > 0 ||
                          viewingRecord.status === "BATAL"
                        }
                      >
                        {isPending ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <ReceiptText className="mr-2 h-4 w-4" />
                        )}
                        Finalisasi ke Transaksi
                      </Button>
                      <p className="text-xs text-muted-foreground">
                        Syarat: produk inventaris dipilih, PO lunas, dan status tidak batal.
                      </p>
                    </div>
                  )}
                </div>
              </div>

              <div className="rounded-[12px] border border-border p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <p className="text-sm font-medium text-foreground">Pembayaran</p>
                  <p className="text-xs text-muted-foreground">
                    Sisa {formatIDR(viewingRecord.sisa)}
                  </p>
                </div>

                <div className="grid gap-3 md:grid-cols-[150px_1fr_180px_150px]">
                  <Input
                    type="date"
                    value={paymentForm.tanggal_bayar}
                    disabled={Boolean(viewingRecord.id_transaksi_keluar)}
                    onChange={(event) =>
                      setPaymentForm((prev) => ({
                        ...prev,
                        tanggal_bayar: event.target.value,
                      }))
                    }
                  />
                  <Input
                    type="number"
                    min="0"
                    value={paymentForm.jumlah_bayar}
                    disabled={Boolean(viewingRecord.id_transaksi_keluar)}
                    onChange={(event) =>
                      setPaymentForm((prev) => ({
                        ...prev,
                        jumlah_bayar: event.target.value,
                      }))
                    }
                    placeholder="Jumlah bayar"
                  />
                  <Select
                    value={paymentForm.id_metode_bayar}
                    disabled={Boolean(viewingRecord.id_transaksi_keluar)}
                    onChange={(event) =>
                      setPaymentForm((prev) => ({
                        ...prev,
                        id_metode_bayar: event.target.value,
                      }))
                    }
                  >
                    <option value="">Metode bayar</option>
                    {paymentMethods.map((method) => (
                      <option key={method.id} value={method.id}>
                        {method.nama}
                      </option>
                    ))}
                  </Select>
                  <Select
                    value={paymentForm.jenis_pembayaran}
                    disabled={Boolean(viewingRecord.id_transaksi_keluar)}
                    onChange={(event) =>
                      setPaymentForm((prev) => ({
                        ...prev,
                        jenis_pembayaran: event.target.value as PaymentType,
                      }))
                    }
                  >
                    {PAYMENT_TYPE_OPTIONS.map((type) => (
                      <option key={type.value} value={type.value}>
                        {type.label}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="mt-3 grid gap-3 md:grid-cols-[1fr_auto]">
                  <Input
                    value={paymentForm.keterangan}
                    disabled={Boolean(viewingRecord.id_transaksi_keluar)}
                    onChange={(event) =>
                      setPaymentForm((prev) => ({
                        ...prev,
                        keterangan: event.target.value,
                      }))
                    }
                    placeholder="Keterangan pembayaran"
                  />
                  <Button
                    type="button"
                    onClick={() => handlePaymentSave(viewingRecord)}
                    disabled={isPending || viewingRecord.sisa <= 0 || Boolean(viewingRecord.id_transaksi_keluar)}
                  >
                    {isPending ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Plus className="mr-2 h-4 w-4" />
                    )}
                    Catat Bayar
                  </Button>
                </div>

                <div className="mt-4 divide-y divide-border">
                  {viewingRecord.po_custom_pembayaran.length > 0 ? (
                    viewingRecord.po_custom_pembayaran.map((payment) => (
                      <div
                        key={payment.id}
                        className="grid gap-1 py-3 text-sm md:grid-cols-[140px_1fr_150px]"
                      >
                        <span className="text-muted-foreground">
                          {formatDate(payment.tanggal_bayar)}
                        </span>
                        <span>
                          {payment.jenis_pembayaran} - {payment.metode_bayar?.nama ?? "-"}
                          {payment.keterangan ? ` - ${payment.keterangan}` : ""}
                        </span>
                        <span className="text-right tabular-nums font-medium">
                          {formatIDR(payment.jumlah_bayar)}
                        </span>
                      </div>
                    ))
                  ) : (
                    <div className="py-6 text-center text-sm text-muted-foreground">
                      Belum ada pembayaran.
                    </div>
                  )}
                </div>
              </div>

              {viewingRecord.catatan_internal && (
                <div className="rounded-[12px] border border-border p-4">
                  <p className="mb-2 text-sm font-medium text-foreground">Catatan Internal</p>
                  <p className="whitespace-pre-line text-sm text-muted-foreground">
                    {viewingRecord.catatan_internal}
                  </p>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setViewingRecord(null);
                  setErrorMsg("");
                }}
              >
                Tutup
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  window.open(
                    `/dashboard/po-custom/${viewingRecord.id}/print`,
                    "_blank",
                    "noopener,noreferrer"
                  );
                }}
              >
                <Printer className="mr-2 h-4 w-4" />
                Cetak PO
              </Button>
              <Button
                disabled={Boolean(viewingRecord.id_transaksi_keluar)}
                onClick={() => {
                  openEditForm(viewingRecord);
                  setViewingRecord(null);
                }}
              >
                <Edit2 className="mr-2 h-4 w-4" />
                Edit PO
              </Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>
    </>
  );
}
