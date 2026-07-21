"use client";

import { useState, useMemo, useTransition, useDeferredValue } from "react";
import { Plus, Trash2, Truck, X, AlertCircle, Check, Loader2, Edit2, Download } from "lucide-react";
import { useTable } from "@/hooks/use-table";
import DataTable, { type Column, type DeleteModalConfig } from "@/components/data-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  TableCell,
  TableRow,
} from "@/components/ui/table";
import { addSupplier, updateSupplier, deleteSupplier } from "./actions";
import { exportToCSV, exportToPDF } from "@/lib/export-utils";

interface Supplier {
  id: number;
  nama_supplier: string;
  alamat: string | null;
  telepon: string | null;
  email: string | null;
  keterangan: string | null;
  created_at: string;
}

export default function SuppliersClient({ initialSuppliers }: { initialSuppliers: Supplier[] }) {
  const [searchQuery, setSearchQuery] = useState("");
  const deferredSearchQuery = useDeferredValue(searchQuery);

  const [isPending, startTransition] = useTransition();

  const [editingId, setEditingId] = useState<number | 'new' | null>(null);
  const [editForm, setEditForm] = useState<Partial<Supplier>>({});

  const [deleteTarget, setDeleteTarget] = useState<Supplier | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  const filteredData = useMemo(() => {
    let result = [...initialSuppliers];

    if (deferredSearchQuery.trim()) {
      const q = deferredSearchQuery.toLowerCase();
      result = result.filter(
        (s) =>
          s.nama_supplier.toLowerCase().includes(q) ||
          s.telepon?.toLowerCase().includes(q) ||
          s.email?.toLowerCase().includes(q) ||
          s.alamat?.toLowerCase().includes(q)
      );
    }

    return result;
  }, [initialSuppliers, deferredSearchQuery]);

  const table = useTable({ data: filteredData, defaultItemsPerPage: 25 });

  const handleSaveInline = () => {
    if (!editForm.nama_supplier?.trim()) {
      setErrorMsg("Nama supplier wajib diisi");
      return;
    }
    setErrorMsg("");

    const data = {
      nama_supplier: editForm.nama_supplier ?? "",
      alamat: editForm.alamat || null,
      telepon: editForm.telepon || null,
      email: editForm.email || null,
      keterangan: editForm.keterangan || null,
    };

    startTransition(async () => {
      const result = editingId === "new"
        ? await addSupplier(data)
        : await updateSupplier(editingId as number, data);

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
      const result = await deleteSupplier(deleteTarget.id);
      if (result.error) {
        setErrorMsg(result.error);
      } else {
        setDeleteTarget(null);
      }
    });
  };

  const handleEditClick = (e: React.MouseEvent, supplier: Supplier) => {
    e.stopPropagation();
    setEditingId(supplier.id);
    setEditForm(supplier);
    setErrorMsg("");
  };

  const handleCancelInline = () => {
    setEditingId(null);
    setEditForm({});
    setErrorMsg("");
  };

  const handleExportCSV = () => {
    const headers = ["Nama Supplier", "Telepon", "Email", "Alamat", "Keterangan"];
    const data = filteredData.map(s => [
      s.nama_supplier,
      s.telepon || "-",
      s.email || "-",
      s.alamat || "-",
      s.keterangan || "-"
    ]);
    exportToCSV("Data_Supplier", headers, data);
  };

  const handleExportPDF = () => {
    const headers = ["Nama Supplier", "Telepon", "Email", "Alamat", "Keterangan"];
    const data = filteredData.map(s => [
      s.nama_supplier,
      s.telepon || "-",
      s.email || "-",
      s.alamat || "-",
      s.keterangan || "-"
    ]);
    exportToPDF("Data_Supplier", "Laporan Data Supplier", headers, data);
  };

  const renderEditRowContent = (isNew: boolean) => {
    const mobileLabel = (label: string) => (
      <span className="md:hidden text-xs font-medium text-muted-foreground uppercase tracking-widest mb-1 block">{label}</span>
    );
    return (
      <TableRow className={`bg-muted/30 flex flex-col md:table-row p-3 md:p-0 gap-3 md:gap-0 border-b-2 md:border-b`}>
        <TableCell className="md:pl-6 align-top md:pt-4 p-0 md:p-2 block md:table-cell">
          {mobileLabel("Nama Supplier")}
          <Input autoFocus aria-label="Nama Supplier" placeholder="Nama Supplier"
            value={editForm.nama_supplier || ""}
            onChange={(e) => setEditForm(prev => ({ ...prev, nama_supplier: e.target.value }))}
            className="h-10 md:h-8 text-[15px] md:text-[13px]"
          />
          {errorMsg && <p className="text-[11px] text-destructive mt-1">{errorMsg}</p>}
        </TableCell>
        <TableCell className="align-top md:pt-4 p-0 md:p-2 block md:table-cell">
          {mobileLabel("Telepon")}
          <Input aria-label="Telepon" placeholder="Telepon"
            value={editForm.telepon || ""}
            onChange={(e) => setEditForm(prev => ({ ...prev, telepon: e.target.value }))}
            className="h-10 md:h-8 text-[15px] md:text-[13px] tabular-nums"
          />
        </TableCell>
        <TableCell className="align-top md:pt-4 p-0 md:p-2 block md:table-cell">
          {mobileLabel("Email")}
          <Input aria-label="Email" placeholder="Email"
            value={editForm.email || ""}
            onChange={(e) => setEditForm(prev => ({ ...prev, email: e.target.value }))}
            className="h-10 md:h-8 text-[15px] md:text-[13px]"
          />
        </TableCell>
        <TableCell className="align-top md:pt-4 p-0 md:p-2 block md:table-cell">
          {mobileLabel("Alamat")}
          <Input aria-label="Alamat" placeholder="Alamat"
            value={editForm.alamat || ""}
            onChange={(e) => setEditForm(prev => ({ ...prev, alamat: e.target.value }))}
            className="h-10 md:h-8 text-[15px] md:text-[13px]"
          />
        </TableCell>
        <TableCell className="align-top md:pt-4 p-0 md:p-2 block md:table-cell">
          {mobileLabel("Keterangan")}
          <Input aria-label="Keterangan" placeholder="Keterangan"
            value={editForm.keterangan || ""}
            onChange={(e) => setEditForm(prev => ({ ...prev, keterangan: e.target.value }))}
            className="h-10 md:h-8 text-[15px] md:text-[13px]"
          />
        </TableCell>
        <TableCell className="md:pr-6 align-top pt-2 md:pt-4 text-right p-0 md:p-2 block md:table-cell mt-2 md:mt-0">
          <div className="flex justify-end gap-2 md:gap-1">
            <Button variant="outline" size="icon" aria-label="Batal Edit" className="h-11 w-11 md:h-8 md:w-8 text-muted-foreground hover:text-foreground" onClick={handleCancelInline} disabled={isPending}>
              <X className="h-4 w-4" />
            </Button>
            <Button variant="default" size="icon" aria-label="Simpan Edit" className="h-11 w-11 md:h-8 md:w-8" onClick={handleSaveInline} disabled={isPending}>
              {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            </Button>
          </div>
        </TableCell>
      </TableRow>
    );
  };

  const columns: Column<Supplier>[] = [
    { key: "nama_supplier", header: "Nama Supplier", sortable: true, className: "md:pl-6", headerClassName: "md:pl-6", mobileLabel: "Nama Supplier" },
    { key: "telepon", header: "Telepon", sortable: true, mobileLabel: "Telepon", render: (s) => <span className="tabular-nums">{s.telepon || "-"}</span> },
    { key: "email", header: "Email", sortable: true, mobileLabel: "Email" },
    { key: "alamat", header: "Alamat", sortable: true, mobileLabel: "Alamat", render: (s) => <span className="max-w-xs md:max-w-[200px] xl:max-w-xs truncate block whitespace-normal md:whitespace-nowrap md:truncate">{s.alamat || "-"}</span> },
    { key: "keterangan", header: "Keterangan", sortable: true, mobileLabel: "Keterangan", render: (s) => <span className="max-w-xs md:max-w-[150px] xl:max-w-xs truncate block whitespace-normal md:whitespace-nowrap md:truncate">{s.keterangan || "-"}</span> },
    {
      key: "actions", header: "", className: "md:pr-6", headerClassName: "w-[100px] md:pr-6", mobileHide: true,
      render: (supplier) => (
        <div className="flex justify-end gap-2 md:gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
          <Button variant="outline" size="icon" aria-label="Edit supplier" className="h-11 w-11 md:h-8 md:w-8 md:border-transparent md:bg-transparent text-muted-foreground hover:text-foreground" onClick={(e) => handleEditClick(e, supplier)} disabled={editingId !== null}>
            <Edit2 className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" aria-label="Hapus supplier" className="h-11 w-11 md:h-8 md:w-8 md:border-transparent md:bg-transparent text-muted-foreground hover:text-destructive hover:bg-destructive/10" onClick={(e) => { e.stopPropagation(); setDeleteTarget(supplier); }} disabled={editingId !== null}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ];

  const deleteModal: DeleteModalConfig | undefined = deleteTarget ? {
    open: true,
    title: "Hapus Supplier?",
    itemName: deleteTarget.nama_supplier,
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
      rowKey={(s) => s.id}
      search={searchQuery}
      onSearchChange={setSearchQuery}
      searchPlaceholder="Cari supplier, telepon, atau alamat..."
      sortConfig={table.sortConfig}
      onSort={table.handleSort}
      currentPage={table.currentPage}
      onPageChange={table.setCurrentPage}
      itemsPerPage={table.itemsPerPage}
      onItemsPerPageChange={table.setItemsPerPage}
      editingId={editingId as number | "new" | null}
      renderEditRow={(customer) => renderEditRowContent(customer === null)}
      mobileCards
      mobileBreakpoint="md"
      actions={[
        { label: "CSV", icon: <Download className="w-4 h-4" />, variant: "outline", onClick: handleExportCSV },
        { label: "PDF", icon: <Download className="w-4 h-4" />, variant: "outline", onClick: handleExportPDF },
        {
          label: "Tambah Supplier",
          icon: <Plus className="w-4 h-4" />,
          kind: "primary",
          onClick: () => { setEditingId("new"); setEditForm({}); setErrorMsg(""); },
          disabled: editingId !== null,
        },
      ]}
      errorBanner={errorMsg && editingId === 'new' ? errorMsg : null}
      deleteModal={deleteModal}
      emptyState={{
        icon: Truck,
        title: "Tidak ada data supplier ditemukan",
        description: "Coba gunakan kata kunci pencarian atau filter yang lain.",
      }}
    />
  );
}
