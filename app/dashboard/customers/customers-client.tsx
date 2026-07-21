"use client";

import { useState, useMemo, useTransition, useDeferredValue } from "react";
import { Plus, Trash2, Users, X, AlertCircle, Check, Loader2, Edit2, Download } from "lucide-react";
import { useTable } from "@/hooks/use-table";
import DataTable, { type Column, type DeleteModalConfig } from "@/components/data-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  TableCell,
  TableRow,
} from "@/components/ui/table";
import { addCustomer, updateCustomer, deleteCustomer } from "./actions";
import { exportToCSV, exportToPDF } from "@/lib/export-utils";

interface Customer {
  id: number;
  nama_pelanggan: string;
  alamat: string | null;
  no_hp: string | null;
  email: string | null;
  keterangan: string | null;
  created_at: string;
}

export default function CustomersClient({ initialCustomers }: { initialCustomers: Customer[] }) {
  const [searchQuery, setSearchQuery] = useState("");
  const deferredSearchQuery = useDeferredValue(searchQuery);

  const [isPending, startTransition] = useTransition();

  const [editingId, setEditingId] = useState<number | 'new' | null>(null);
  const [editForm, setEditForm] = useState<Partial<Customer>>({});

  const [deleteTarget, setDeleteTarget] = useState<Customer | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  const filteredData = useMemo(() => {
    let result = [...initialCustomers];

    if (deferredSearchQuery.trim()) {
      const q = deferredSearchQuery.toLowerCase();
      result = result.filter(
        (c) =>
          c.nama_pelanggan.toLowerCase().includes(q) ||
          c.no_hp?.toLowerCase().includes(q) ||
          c.email?.toLowerCase().includes(q) ||
          c.alamat?.toLowerCase().includes(q)
      );
    }

    return result;
  }, [initialCustomers, deferredSearchQuery]);

  const table = useTable({ data: filteredData, defaultItemsPerPage: 25 });

  const handleSaveInline = () => {
    if (!editForm.nama_pelanggan?.trim()) {
      setErrorMsg("Nama pelanggan wajib diisi");
      return;
    }
    setErrorMsg("");

    const data = {
      nama_pelanggan: editForm.nama_pelanggan,
      alamat: editForm.alamat || null,
      no_hp: editForm.no_hp || null,
      email: editForm.email || null,
      keterangan: editForm.keterangan || null,
    };

    startTransition(async () => {
      const result = editingId === "new"
        ? await addCustomer(data as Parameters<typeof addCustomer>[0])
        : await updateCustomer(editingId as number, data);

      if (result.error) {
        setErrorMsg(result.error);
      } else {
        setEditingId(null);
        setEditForm({});
      }
    });
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setErrorMsg("");
    startTransition(async () => {
      const result = await deleteCustomer(deleteTarget.id, deleteTarget.nama_pelanggan);
      if (result.error) {
        setErrorMsg(result.error);
      } else {
        setDeleteTarget(null);
      }
    });
  };

  const handleEditClick = (e: React.MouseEvent, customer: Customer) => {
    e.stopPropagation();
    if (customer.nama_pelanggan?.toUpperCase() === "UMUM") return;
    setEditingId(customer.id);
    setEditForm(customer);
    setErrorMsg("");
  };

  const handleCancelInline = () => {
    setEditingId(null);
    setEditForm({});
    setErrorMsg("");
  };

  const handleExportCSV = () => {
    const headers = ["Nama Pelanggan", "No. HP", "Email", "Alamat", "Keterangan"];
    const data = filteredData.map(c => [
      c.nama_pelanggan,
      c.no_hp || "-",
      c.email || "-",
      c.alamat || "-",
      c.keterangan || "-"
    ]);
    exportToCSV("Data_Pelanggan", headers, data);
  };

  const handleExportPDF = () => {
    const headers = ["Nama Pelanggan", "No. HP", "Email", "Alamat", "Keterangan"];
    const data = filteredData.map(c => [
      c.nama_pelanggan,
      c.no_hp || "-",
      c.email || "-",
      c.alamat || "-",
      c.keterangan || "-"
    ]);
    exportToPDF("Data_Pelanggan", "Laporan Data Pelanggan", headers, data);
  };

  const editInput = (field: keyof Customer, placeholder: string, opts?: { tabular?: boolean }) => (
    <Input
      aria-label={placeholder}
      placeholder={placeholder}
      value={String(editForm[field] ?? "")}
      onChange={(e) => setEditForm(prev => ({ ...prev, [field]: e.target.value }))}
      className={`h-8 text-[13px] ${opts?.tabular ? "tabular-nums" : ""}`}
    />
  );

  const columns: Column<Customer>[] = [
    { key: "nama_pelanggan", header: "Nama", sortable: true, className: "pl-6", headerClassName: "pl-6" },
    { key: "no_hp", header: "No. HP", sortable: true, render: (c) => <span className="tabular-nums">{c.no_hp || "-"}</span> },
    { key: "email", header: "Email", sortable: true },
    { key: "alamat", header: "Alamat", sortable: true, render: (c) => <span className="max-w-xs truncate block">{c.alamat || "-"}</span> },
    { key: "keterangan", header: "Keterangan", sortable: true, render: (c) => <span className="max-w-xs truncate block">{c.keterangan || "-"}</span> },
    {
      key: "actions", header: "", className: "pr-6", headerClassName: "w-[100px] pr-6",
      render: (customer) => {
        const isUmum = customer.nama_pelanggan?.toUpperCase() === "UMUM";
        if (isUmum) return null;
        return (
          <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button variant="ghost" size="icon" aria-label="Edit customer" className="h-11 w-11 md:h-8 md:w-8 text-muted-foreground hover:text-foreground" onClick={(e) => handleEditClick(e, customer)} disabled={editingId !== null}>
              <Edit2 className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" aria-label="Hapus customer" className="h-11 w-11 md:h-8 md:w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10" onClick={(e) => { e.stopPropagation(); setDeleteTarget(customer); }} disabled={editingId !== null}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        );
      },
    },
  ];

  const deleteModal: DeleteModalConfig | undefined = deleteTarget ? {
    open: true,
    title: "Hapus Pelanggan?",
    itemName: deleteTarget.nama_pelanggan,
    onConfirm: handleDeleteConfirm,
    onCancel: () => { setDeleteTarget(null); setErrorMsg(""); },
    isPending,
    error: errorMsg,
  } : undefined;

  return (
    <DataTable
      data={table.paginatedData}
      total={table.total}
      columns={columns}
      rowKey={(c) => c.id}
      search={searchQuery}
      onSearchChange={setSearchQuery}
      searchPlaceholder="Cari nama, telp, atau alamat..."
      sortConfig={table.sortConfig}
      onSort={table.handleSort}
      currentPage={table.currentPage}
      onPageChange={table.setCurrentPage}
      itemsPerPage={table.itemsPerPage}
      onItemsPerPageChange={table.setItemsPerPage}
      editingId={editingId as number | "new" | null}
      renderEditRow={(customer) => {
        const isNew = customer === null;
        return (
          <TableRow className="bg-muted/30">
            <TableCell className="pl-6 align-top pt-4">
              <Input autoFocus aria-label="Nama Pelanggan" placeholder="Nama Pelanggan"
                value={editForm.nama_pelanggan || ""}
                onChange={(e) => setEditForm(prev => ({ ...prev, nama_pelanggan: e.target.value }))}
                className="h-8 text-[13px]"
              />
              {errorMsg && <p className="text-[11px] text-destructive mt-1">{errorMsg}</p>}
            </TableCell>
            <TableCell className="align-top pt-4">{editInput("no_hp", "No. HP", { tabular: true })}</TableCell>
            <TableCell className="align-top pt-4">{editInput("email", "Email")}</TableCell>
            <TableCell className="align-top pt-4">{editInput("alamat", "Alamat")}</TableCell>
            <TableCell className="align-top pt-4">{editInput("keterangan", "Keterangan")}</TableCell>
            <TableCell className="pr-6 align-top pt-4 text-right">
              <div className="flex justify-end gap-1">
                <Button variant="ghost" size="icon" aria-label="Batal Edit" className="h-11 w-11 md:h-8 md:w-8 text-muted-foreground hover:text-foreground" onClick={handleCancelInline} disabled={isPending}>
                  <X className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" aria-label="Simpan Edit" className="h-11 w-11 md:h-8 md:w-8 text-primary hover:text-primary hover:bg-primary/10" onClick={handleSaveInline} disabled={isPending}>
                  {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                </Button>
              </div>
            </TableCell>
          </TableRow>
        );
      }}
      actions={[
        { label: "CSV", icon: <Download className="w-4 h-4" />, variant: "outline", onClick: handleExportCSV },
        { label: "PDF", icon: <Download className="w-4 h-4" />, variant: "outline", onClick: handleExportPDF },
        {
          label: "Tambah Pelanggan",
          icon: <Plus className="w-4 h-4" />,
          kind: "primary",
          onClick: () => { setEditingId("new"); setEditForm({}); setErrorMsg(""); },
          disabled: editingId !== null,
        },
      ]}
      errorBanner={errorMsg && editingId && editingId === 'new' ? errorMsg : null}
      deleteModal={deleteModal}
      emptyState={{
        icon: Users,
        title: "Tidak ada data pelanggan ditemukan",
        description: "Coba gunakan kata kunci pencarian atau filter yang lain.",
      }}
    />
  );
}
