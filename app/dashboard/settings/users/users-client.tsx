"use client";

import { useState, useMemo, useTransition, useEffect, useDeferredValue } from "react";
import { Plus, Trash2, Edit2, User as UserIcon, Loader2, Download, X } from "lucide-react";
import { useTable } from "@/hooks/use-table";
import DataTable, { type Column, type DeleteModalConfig } from "@/components/data-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import {
  TableCell,
  TableRow,
} from "@/components/ui/table";
import { createUser, updateUser, deleteUser } from "./actions";
import { exportToCSV, exportToPDF } from "@/lib/export-utils";

type User = {
  id: number;
  username: string;
  nama: string | null;
  level: string;
  aktif: boolean;
  created_at: string;
};

export function UsersClient({ initialUsers }: { initialUsers: User[] }) {
  const [users, setUsers] = useState<User[]>(initialUsers);

  useEffect(() => { setUsers(initialUsers); }, [initialUsers]);

  const [searchQuery, setSearchQuery] = useState("");
  const deferredSearchQuery = useDeferredValue(searchQuery);

  const [isPending, startTransition] = useTransition();

  const [editingId, setEditingId] = useState<number | 'new' | null>(null);
  const [editForm, setEditForm] = useState<{
    nama?: string; username?: string; password?: string; level?: string; aktif?: boolean; old_username?: string;
  }>({});

  const [deleteTarget, setDeleteTarget] = useState<User | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  const handleSaveInline = () => {
    if (!editForm.username?.trim() || !editForm.level || (editingId === 'new' && !editForm.password?.trim())) {
      setErrorMsg("Semua kolom (username, password, level) wajib diisi");
      return;
    }
    setErrorMsg("");
    startTransition(async () => {
      const formData = new FormData();
      formData.append("nama", editForm.nama || "");
      formData.append("username", editForm.username || "");
      formData.append("level", editForm.level || "");
      formData.append("aktif", editForm.aktif ? "true" : "false");
      if (editForm.password) formData.append("password", editForm.password);

      let res;
      if (editingId === 'new') {
        res = await createUser({ success: false }, formData);
      } else {
        formData.append("id", String(editingId));
        formData.append("old_username", editForm.old_username || "");
        res = await updateUser({ success: false }, formData);
      }

      if (res.error) {
        setErrorMsg(res.error);
      } else {
        const newUser: User = {
          id: editingId === 'new' ? Date.now() : (editingId as number),
          nama: editForm.nama || "",
          username: editForm.username || "",
          level: editForm.level || "",
          aktif: editForm.aktif ?? true,
          created_at: new Date().toISOString()
        };
        setUsers(prev => editingId === 'new' ? [...prev, newUser] : prev.map(u => u.id === editingId ? { ...u, ...newUser, created_at: u.created_at } : u));
        setEditingId(null);
        setEditForm({});
      }
    });
  };

  const handleCancelInline = () => {
    setEditingId(null);
    setEditForm({});
    setErrorMsg("");
  };

  const filteredData = useMemo(() => {
    let result = [...users];
    if (deferredSearchQuery.trim()) {
      const q = deferredSearchQuery.toLowerCase();
      result = result.filter((u) =>
        u.username.toLowerCase().includes(q) ||
        u.nama?.toLowerCase().includes(q) ||
        u.level.toLowerCase().includes(q)
      );
    }
    return result;
  }, [users, deferredSearchQuery]);

  const table = useTable({ data: filteredData, defaultItemsPerPage: 25 });

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setErrorMsg("");
    startTransition(async () => {
      const res = await deleteUser(deleteTarget.id, deleteTarget.username);
      if (res.error) {
        setErrorMsg(res.error);
      } else {
        setUsers(users.filter((u) => u.id !== deleteTarget.id));
        setDeleteTarget(null);
      }
    });
  };

  const roleOptions = ["KARYAWAN", "KASIR", "ADMIN", "OWNER"];

  const handleExportCSV = () => {
    const headers = ["Nama", "Username", "Level", "Status", "Tanggal Dibuat"];
    const data = filteredData.map(user => [
      user.nama || user.username,
      user.username,
      user.level,
      user.aktif ? "Aktif" : "Nonaktif",
      new Date(user.created_at).toLocaleString()
    ]);
    exportToCSV("Data_Pengguna", headers, data);
  };

  const handleExportPDF = () => {
    const headers = ["Nama", "Username", "Level", "Status", "Tanggal Dibuat"];
    const data = filteredData.map(user => [
      user.nama || user.username,
      user.username,
      user.level,
      user.aktif ? "Aktif" : "Nonaktif",
      new Date(user.created_at).toLocaleString()
    ]);
    exportToPDF("Data_Pengguna", "Laporan Data Pengguna", headers, data);
  };

  const columns: Column<User>[] = [
    {
      key: "nama", header: "Nama", sortable: true, className: "pl-6", headerClassName: "pl-6",
      render: (u) => (
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <UserIcon className="w-4 h-4 text-primary" />
          </div>
          {u.nama || u.username}
        </div>
      ),
    },
    { key: "username", header: "Username", sortable: true },
    {
      key: "level", header: "Level", sortable: true,
      render: (u) => (
        <span className={`px-2.5 py-1 text-xs font-medium rounded-full ${
          u.level === "OWNER" ? "bg-purple-100 text-purple-700" :
          u.level === "ADMIN" ? "bg-blue-100 text-blue-700" :
          u.level === "KARYAWAN" ? "bg-slate-100 text-slate-700" :
          "bg-emerald-100 text-emerald-700"
        }`}>
          {u.level}
        </span>
      ),
    },
    {
      key: "aktif", header: "Status", sortable: true,
      render: (u) => (
        <span className={`px-2.5 py-1 text-xs font-medium rounded-full ${u.aktif ? "bg-emerald-100 text-emerald-700" : "bg-destructive/10 text-destructive"}`}>
          {u.aktif ? "Aktif" : "Nonaktif"}
        </span>
      ),
    },
    {
      key: "actions", header: "", className: "pr-6", headerClassName: "w-[100px] pr-6",
      render: (user) => (
        <div className="flex justify-end gap-1">
          <Button variant="ghost" size="icon" aria-label="Edit pengguna" className="h-11 w-11 md:h-8 md:w-8 text-muted-foreground hover:text-foreground"
            onClick={() => {
              setEditingId(user.id);
              setEditForm({
                nama: user.nama || "",
                username: user.username,
                old_username: user.username,
                level: user.level,
                aktif: user.aktif,
                password: ""
              });
              setErrorMsg("");
            }}
          >
            <Edit2 className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" aria-label="Hapus pengguna" className="h-11 w-11 md:h-8 md:w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10" onClick={() => setDeleteTarget(user)}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ];

  const deleteModal: DeleteModalConfig | undefined = deleteTarget ? {
    open: true,
    title: "Hapus Pengguna?",
    itemName: deleteTarget.username,
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
      rowKey={(u) => u.id}
      search={searchQuery}
      onSearchChange={(v) => { setSearchQuery(v); }}
      searchPlaceholder="Cari pengguna..."
      sortConfig={table.sortConfig}
      onSort={table.handleSort}
      currentPage={table.currentPage}
      onPageChange={table.setCurrentPage}
      itemsPerPage={table.itemsPerPage}
      onItemsPerPageChange={table.setItemsPerPage}
      editingId={editingId as number | "new" | null}
      renderEditRow={(user) => {
        const isNew = user === null;
        return (
          <TableRow className="bg-muted/30">
            <TableCell className="pl-6 align-middle py-4 relative">
              <Input autoFocus aria-label="Nama" placeholder="Nama..."
                value={editForm.nama || ""}
                onChange={(e) => setEditForm(prev => ({ ...prev, nama: e.target.value }))}
                className="h-8 min-w-[120px]"
              />
              {errorMsg && <p className="text-[11px] text-destructive mt-1">{errorMsg}</p>}
            </TableCell>
            <TableCell className="align-middle py-4">
              <Input aria-label="Username" placeholder="Username"
                value={editForm.username || ""}
                onChange={(e) => setEditForm(prev => ({ ...prev, username: e.target.value }))}
                className="h-8 min-w-[120px]"
              />
            </TableCell>
            <TableCell className="align-middle py-4">
              <div className="flex items-center gap-2">
                <Select aria-label="Level" value={editForm.level || "KASIR"} onChange={(e) => setEditForm(prev => ({ ...prev, level: e.target.value }))} className="h-8 min-w-[100px] text-xs">
                  {roleOptions.map(role => (
                    <option key={role} value={role}>{role}</option>
                  ))}
                </Select>
                <Input aria-label={isNew ? "Password" : "Password Baru (Kosongkan jika tidak diubah)"} type="password" placeholder="Password..."
                  value={editForm.password || ""}
                  onChange={(e) => setEditForm(prev => ({ ...prev, password: e.target.value }))}
                  className="h-8 min-w-[110px]"
                />
              </div>
            </TableCell>
            <TableCell className="align-middle py-4">
              <div className="flex items-center gap-2 h-8">
                <input type="checkbox" id={isNew ? "aktif_new" : `aktif_${user?.id}`} checked={editForm.aktif ?? true}
                  onChange={(e) => setEditForm(prev => ({ ...prev, aktif: e.target.checked }))}
                  className="w-4 h-4 rounded border-input text-primary focus:ring-primary accent-primary"
                />
                <Label htmlFor={isNew ? "aktif_new" : `aktif_${user?.id}`} className="text-sm">Aktif</Label>
              </div>
            </TableCell>
            <TableCell className="pr-6 align-middle py-4 text-right">
              <div className="flex justify-end gap-1">
                <Button variant="ghost" size="icon" aria-label="Batal Edit" className="h-11 w-11 md:h-8 md:w-8 text-muted-foreground hover:text-foreground" onClick={handleCancelInline} disabled={isPending}>
                  <X className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" aria-label="Simpan Edit" className="h-11 w-11 md:h-8 md:w-8 text-primary hover:text-primary hover:bg-primary/10" onClick={handleSaveInline} disabled={isPending}>
                  {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <span className="font-bold">✓</span>}
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
          label: "Pengguna Baru",
          icon: <Plus className="w-4 h-4" />,
          kind: "primary",
          onClick: () => { setEditingId("new"); setEditForm({ level: 'KASIR', aktif: true }); setErrorMsg(""); },
          disabled: editingId !== null,
        },
      ]}
      errorBanner={errorMsg && editingId === 'new' ? errorMsg : null}
      deleteModal={deleteModal}
      emptyState={{
        icon: UserIcon,
        title: "Tidak ada pengguna ditemukan",
        description: "Coba gunakan kata kunci pencarian yang lain.",
      }}
    />
  );
}
