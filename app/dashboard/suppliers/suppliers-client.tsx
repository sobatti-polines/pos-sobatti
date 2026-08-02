"use client";

import { useState, useMemo, useTransition, useDeferredValue } from "react";
import { Plus, Trash2, Truck, X, AlertCircle, Check, Loader2, Edit2, Upload } from "lucide-react";
import { useTable } from "@/hooks/use-table";
import DataTable, { type Column, type DeleteModalConfig } from "@/components/data-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  TableCell,
  TableRow,
} from "@/components/ui/table";
import { addSupplier, updateSupplier, deleteSupplier, importSuppliers } from "./actions";
import { exportToCSV, exportToPDF } from "@/lib/export-utils";
import ImportCSVModal from "@/components/import-csv-modal";
import { ExportDropdown } from "@/components/export-dropdown";

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
  const [isImportOpen, setIsImportOpen] = useState(false);

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

  const editInput = (field: keyof Supplier, placeholder: string, opts?: { tabular?: boolean }) => (
    <Input
      aria-label={placeholder}
      placeholder={placeholder}
      value={String(editForm[field] ?? "")}
      onChange={(e) => setEditForm(prev => ({ ...prev, [field]: e.target.value }))}
      className={`h-8 text-[13px] ${opts?.tabular ? "tabular-nums" : ""}`}
    />
  );

  const columns: Column<Supplier>[] = [
    { key: "nama_supplier", header: "Nama Supplier", sortable: true, className: "pl-6", headerClassName: "pl-6" },
    { key: "telepon", header: "Telepon", sortable: true, render: (s) => <span className="tabular-nums">{s.telepon || "-"}</span> },
    { key: "email", header: "Email", sortable: true },
    { key: "alamat", header: "Alamat", sortable: true, render: (s) => <span className="max-w-xs truncate block">{s.alamat || "-"}</span> },
    { key: "keterangan", header: "Keterangan", sortable: true, render: (s) => <span className="max-w-xs truncate block">{s.keterangan || "-"}</span> },
    {
      key: "actions", header: "", className: "pr-6", headerClassName: "w-[100px] pr-6",
      render: (supplier) => (
        <div className="flex justify-end gap-1">
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
    <>
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
      renderEditRow={() => {
        return (
          <TableRow className="bg-muted/30">
            <TableCell className="pl-6 align-top pt-4">
              <Input autoFocus aria-label="Nama Supplier" placeholder="Nama Supplier"
                value={editForm.nama_supplier || ""}
                onChange={(e) => setEditForm(prev => ({ ...prev, nama_supplier: e.target.value }))}
                className="h-8 text-[13px]"
              />
              {errorMsg && <p className="text-[11px] text-destructive mt-1">{errorMsg}</p>}
            </TableCell>
            <TableCell className="align-top pt-4">{editInput("telepon", "Telepon", { tabular: true })}</TableCell>
            <TableCell className="align-top pt-4">{editInput("email", "Email")}</TableCell>
            <TableCell className="align-top pt-4">{editInput("alamat", "Alamat")}</TableCell>
            <TableCell className="align-top pt-4">{editInput("keterangan", "Keterangan")}</TableCell>
            <TableCell className="pr-6 align-top pt-4 text-right">
              <div className="flex justify-end gap-1">
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
      }}
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
    <ImportCSVModal
      open={isImportOpen}
      onOpenChange={setIsImportOpen}
      title="Import Data Supplier"
      description="Unggah file CSV dengan kolom Nama Supplier, Alamat, No. Telepon, Email, dan Keterangan."
      templateFilename="Template_Import_Supplier"
      templateHeaders={["Nama Supplier", "Alamat", "No. Telepon", "Email", "Keterangan"]}
      sampleRows={[
        ["PT Semen Nusantara", "Jl. Industri No. 45, Gresik", "0318901234", "sales@semennusantara.co.id", "Pemasok Semen Utama"],
        ["CV Bina Kayu", "Jl. Raya Kayu No. 8, Jepara", "081987654321", "info@binakayu.com", "Pemasok Kayu & Triplek"],
      ]}
      validateRow={(row) => {
        const name = row["Nama Supplier"] || row["nama_supplier"] || "";
        if (!name.trim()) {
          return "Nama Supplier wajib diisi";
        }
        return null;
      }}
      onImport={importSuppliers}
    />
  </>
  );
}
