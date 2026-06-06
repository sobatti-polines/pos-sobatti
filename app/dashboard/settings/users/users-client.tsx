"use client";

import { useState, useMemo, useTransition, useEffect, useDeferredValue } from "react";
import { Search, Plus, Trash2, Edit2, CheckCircle2, AlertCircle, ChevronUp, ChevronDown, ChevronLeft, ChevronRight, User as UserIcon, Loader2, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { createUser, updateUser, deleteUser, UserActionState } from "./actions";
import { exportToCSV, exportToPDF } from "@/lib/export-utils";

type User = {
  id: number;
  username: string;
  nama: string | null;
  level: string;
  aktif: boolean;
  created_at: string;
};

// Removed form logic and initial action states

export function UsersClient({ initialUsers }: { initialUsers: User[] }) {
  const [users, setUsers] = useState<User[]>(initialUsers);

  useEffect(() => {
    setUsers(initialUsers);
  }, [initialUsers]);

  const [searchQuery, setSearchQuery] = useState("");
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: "asc" | "desc" } | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);

  const [isPending, startTransition] = useTransition();

  const [editingId, setEditingId] = useState<number | 'new' | null>(null);
  const [editForm, setEditForm] = useState<{
    nama?: string;
    username?: string;
    password?: string;
    level?: string;
    aktif?: boolean;
    old_username?: string;
  }>({});

  const [deleteModal, setDeleteModal] = useState<{ open: boolean; data: User | null }>({
    open: false,
    data: null,
  });
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
        const timestamp = new Date().toISOString();
        const newUser: User = { 
          id: editingId === 'new' ? Date.now() : (editingId as number), 
          nama: editForm.nama || "",
          username: editForm.username || "",
          level: editForm.level || "",
          aktif: editForm.aktif ?? true,
          created_at: timestamp
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

  const processedUsers = useMemo(() => {
    let result = [...users];

    if (deferredSearchQuery.trim()) {
      const q = deferredSearchQuery.toLowerCase();
      result = result.filter(
        (u) =>
          u.username.toLowerCase().includes(q) ||
          u.nama?.toLowerCase().includes(q) ||
          u.level.toLowerCase().includes(q)
      );
    }

    if (sortConfig) {
      result.sort((a, b) => {
        const aVal = (a as unknown as Record<string, unknown>)[sortConfig.key] ?? "";
        const bVal = (b as unknown as Record<string, unknown>)[sortConfig.key] ?? "";
        if (aVal < bVal) return sortConfig.direction === "asc" ? -1 : 1;
        if (aVal > bVal) return sortConfig.direction === "asc" ? 1 : -1;
        return 0;
      });
    }

    return result;
  }, [users, searchQuery, sortConfig]);

  const totalPages = Math.max(1, Math.ceil(processedUsers.length / itemsPerPage));
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return processedUsers.slice(start, start + itemsPerPage);
  }, [processedUsers, currentPage, itemsPerPage]);

  const handleSort = (key: string) => {
    let direction: "asc" | "desc" = "asc";
    if (sortConfig && sortConfig.key === key && sortConfig.direction === "asc") {
      direction = "desc";
    }
    setSortConfig({ key, direction });
    setCurrentPage(1);
  };

  const renderSortIcon = (columnKey: string) => {
    if (sortConfig?.key !== columnKey) return <ChevronDown className="w-3 h-3 opacity-20 ml-1 inline-block" />;
    return sortConfig.direction === "asc"
      ? <ChevronUp className="w-3 h-3 text-foreground ml-1 inline-block" />
      : <ChevronDown className="w-3 h-3 text-foreground ml-1 inline-block" />;
  };

  // Modal references removed

  const handleDelete = async () => {
    if (!deleteModal.data) return;
    setErrorMsg("");
    startTransition(async () => {
      const res = await deleteUser(deleteModal.data!.id, deleteModal.data!.username);
      if (res.error) {
        setErrorMsg(res.error);
      } else {
        setUsers(users.filter((u) => u.id !== deleteModal.data!.id));
        setDeleteModal({ open: false, data: null });
      }
    });
  };

  const roleOptions = ["KASIR", "ADMIN", "OWNER"];

  const handleExportCSV = () => {
    const headers = ["Nama", "Username", "Level", "Status", "Tanggal Dibuat"];
    const data = processedUsers.map(user => [
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
    const data = processedUsers.map(user => [
      user.nama || user.username,
      user.username,
      user.level,
      user.aktif ? "Aktif" : "Nonaktif",
      new Date(user.created_at).toLocaleString()
    ]);
    exportToPDF("Data_Pengguna", "Laporan Data Pengguna", headers, data);
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-background border border-border rounded-[12px] shadow-[0_1px_3px_rgba(0,55,112,0.08)] overflow-hidden relative">
      <div className="shrink-0 flex flex-col items-start md:flex-row md:items-center justify-between p-4 lg:p-6 border-b border-border bg-transparent gap-4">
        <div className="flex-1 flex flex-col md:flex-row items-stretch md:items-center gap-3 w-full">
          <div className="relative w-full md:max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input aria-label="Pencarian" placeholder="Cari pengguna..."
              className="pl-9 rounded-md w-full"
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
              disabled={editingId !== null}
            />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 md:ml-4 shrink-0 w-full md:w-auto">
          <Button
            variant="outline"
            onClick={handleExportCSV}
            className="rounded-full px-4 h-10 gap-2 flex-1 md:flex-none"
          >
            <Download className="w-4 h-4" />
            CSV
          </Button>
          <Button
            variant="outline"
            onClick={handleExportPDF}
            className="rounded-full px-4 h-10 gap-2 flex-1 md:flex-none"
          >
            <Download className="w-4 h-4" />
            PDF
          </Button>
          <Button
            onClick={() => {
              setEditingId('new');
              setEditForm({ level: 'KASIR', aktif: true });
              setCurrentPage(1);
              setErrorMsg("");
            }}
            disabled={editingId !== null}
            className="rounded-full px-6 h-10 bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm font-normal shrink-0 gap-2 w-full md:w-auto"
          >
            <Plus className="w-4 h-4" />
            Pengguna Baru
          </Button>
        </div>
      </div>
      {errorMsg && editingId === 'new' && (
        <div className="px-6 py-3 bg-destructive/10 border-b border-border text-destructive text-sm font-medium flex items-center gap-2">
          <AlertCircle className="w-4 h-4" />
          {errorMsg}
        </div>
      )}

      <div className="flex-1 overflow-y-auto min-h-0 relative">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead onClick={() => handleSort("nama")} className="cursor-pointer select-none hover:text-foreground transition-colors pl-6">
                Nama {renderSortIcon("nama")}
              </TableHead>
              <TableHead onClick={() => handleSort("username")} className="cursor-pointer select-none hover:text-foreground transition-colors">
                Username {renderSortIcon("username")}
              </TableHead>
              <TableHead onClick={() => handleSort("level")} className="cursor-pointer select-none hover:text-foreground transition-colors">
                Level {renderSortIcon("level")}
              </TableHead>
              <TableHead onClick={() => handleSort("aktif")} className="cursor-pointer select-none hover:text-foreground transition-colors">
                Status {renderSortIcon("aktif")}
              </TableHead>
              <TableHead className="w-[100px] pr-6"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {editingId === 'new' && (
              <TableRow className="bg-muted/30">
                <TableCell className="pl-6 align-middle py-4">
                  <Input autoFocus aria-label="Nama" placeholder="Nama..."
                    value={editForm.nama || ""}
                    onChange={(e) => setEditForm(prev => ({ ...prev, nama: e.target.value }))}
                    className="h-8 min-w-[120px]"
                  />
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
                    <Input aria-label="Password" type="password" placeholder="Password..."
                      value={editForm.password || ""}
                      onChange={(e) => setEditForm(prev => ({ ...prev, password: e.target.value }))}
                      className="h-8 min-w-[110px]"
                    />
                  </div>
                </TableCell>
                <TableCell className="align-middle py-4">
                  <div className="flex items-center gap-2 h-8">
                    <input type="checkbox" id="aktif_new" checked={editForm.aktif ?? true} onChange={(e) => setEditForm(prev => ({ ...prev, aktif: e.target.checked }))} className="w-4 h-4 rounded border-input text-primary focus:ring-primary accent-primary" />
                    <Label htmlFor="aktif_new" className="text-sm">Aktif</Label>
                  </div>
                </TableCell>
                <TableCell className="pr-6 align-middle py-4 text-right">
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="icon" aria-label="Batal Edit" className="h-11 w-11 md:h-8 md:w-8 text-muted-foreground hover:text-foreground" onClick={handleCancelInline} disabled={isPending}>
                      <AlertCircle className="h-4 w-4 hidden" /> {/* For padding matching CheckCircle2 import */}
                      <span className="font-bold">X</span>
                    </Button>
                    <Button variant="ghost" size="icon" aria-label="Simpan Edit" className="h-11 w-11 md:h-8 md:w-8 text-primary hover:text-primary hover:bg-primary/10" onClick={handleSaveInline} disabled={isPending}>
                      {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            )}

            {paginatedData.length === 0 && editingId !== 'new' && (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-32 hover:bg-transparent">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <UserIcon className="w-12 h-12 mb-4 opacity-20" />
                    <p className="text-base font-medium text-foreground">Tidak ada pengguna ditemukan</p>
                    <p className="text-sm mt-1">Coba gunakan kata kunci pencarian yang lain.</p>
                  </div>
                </TableCell>
              </TableRow>
            )}

            {paginatedData.map((user) => {
              if (editingId === user.id) {
                return (
                  <TableRow key={user.id} className="bg-muted/10">
                    <TableCell className="pl-6 align-middle py-4 relative">
                      <Input autoFocus aria-label="Nama" placeholder="Nama..."
                        value={editForm.nama || ""}
                        onChange={(e) => setEditForm(prev => ({ ...prev, nama: e.target.value }))}
                        className="h-8 min-w-[120px]"
                      />
                      {errorMsg && (
                        <div className="absolute -bottom-2 left-6 flex items-center gap-1 text-[11px] text-destructive font-medium whitespace-nowrap">
                          <AlertCircle className="w-3 h-3" />
                          {errorMsg}
                        </div>
                      )}
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
                        <Input aria-label="Password Baru (Kosongkan jika tidak diubah)" type="password" placeholder="Password..."
                          value={editForm.password || ""}
                          onChange={(e) => setEditForm(prev => ({ ...prev, password: e.target.value }))}
                          className="h-8 min-w-[110px]"
                        />
                      </div>
                    </TableCell>
                    <TableCell className="align-middle py-4">
                      <div className="flex items-center gap-2 h-8">
                        <input type="checkbox" id={`aktif_${user.id}`} checked={editForm.aktif ?? true} onChange={(e) => setEditForm(prev => ({ ...prev, aktif: e.target.checked }))} className="w-4 h-4 rounded border-input text-primary focus:ring-primary accent-primary" />
                        <Label htmlFor={`aktif_${user.id}`} className="text-sm">Aktif</Label>
                      </div>
                    </TableCell>
                    <TableCell className="pr-6 align-middle py-4 text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" aria-label="Batal Edit" className="h-11 w-11 md:h-8 md:w-8 text-muted-foreground hover:text-foreground" onClick={handleCancelInline} disabled={isPending}>
                          <span className="font-bold">X</span>
                        </Button>
                        <Button variant="ghost" size="icon" aria-label="Simpan Edit" className="h-11 w-11 md:h-8 md:w-8 text-primary hover:text-primary hover:bg-primary/10" onClick={handleSaveInline} disabled={isPending}>
                          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              }

              return (
                <TableRow key={user.id} className="group hover:bg-muted/30 transition-colors">
                  <TableCell className="pl-6 py-4 font-medium">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <UserIcon className="w-4 h-4 text-primary" />
                      </div>
                      {user.nama || user.username}
                    </div>
                  </TableCell>
                  <TableCell className="py-4">{user.username}</TableCell>
                  <TableCell className="py-4">
                    <span className={`px-2.5 py-1 text-xs font-medium rounded-full ${user.level === "OWNER" ? "bg-purple-100 text-purple-700" :
                        user.level === "ADMIN" ? "bg-blue-100 text-blue-700" :
                          "bg-emerald-100 text-emerald-700"
                      }`}>
                      {user.level}
                    </span>
                  </TableCell>
                  <TableCell className="py-4">
                    <span className={`px-2.5 py-1 text-xs font-medium rounded-full ${user.aktif ? "bg-emerald-100 text-emerald-700" : "bg-destructive/10 text-destructive"
                      }`}>
                      {user.aktif ? "Aktif" : "Nonaktif"}
                    </span>
                  </TableCell>
                  <TableCell className="pr-6 py-4 text-right">
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
                      <Button variant="ghost" size="icon" aria-label="Hapus pengguna" className="h-11 w-11 md:h-8 md:w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10" onClick={() => setDeleteModal({ open: true, data: user })}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className="shrink-0 flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 lg:p-6 border-t border-border bg-background">
        <p className="text-[13px] text-muted-foreground tabular-nums">
          Menampilkan{" "}
          <span className="font-medium text-foreground">
            {processedUsers.length === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1}
          </span>{" "}
          hingga{" "}
          <span className="font-medium text-foreground">
            {Math.min(currentPage * itemsPerPage, processedUsers.length)}
          </span>{" "}
          dari{" "}
          <span className="font-medium text-foreground">{processedUsers.length}</span>{" "}
          pengguna
        </p>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-[13px] text-muted-foreground whitespace-nowrap">Baris per halaman</span>
            <select aria-label="Baris per halaman" value={itemsPerPage}
              onChange={(e) => { setItemsPerPage(Number(e.target.value)); setCurrentPage(1); }}
              className="h-8 rounded-md border border-border bg-background px-2 py-1 text-[13px] shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/20 text-foreground"
            >
              {[10, 25, 50, 100].map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </div>

          <span className="text-[13px] text-muted-foreground tabular-nums whitespace-nowrap">
            Halaman{" "}
            <span className="font-medium text-foreground">{currentPage}</span>
            {" "}/{" "}
            <span className="font-medium text-foreground">{totalPages}</span>
          </span>

          <div className="flex items-center gap-1">
            <Button aria-label="Halaman Sebelumnya" variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="h-11 w-11 md:h-8 md:w-8 p-0 rounded-full bg-background disabled:opacity-50"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button aria-label="Halaman Selanjutnya" variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="h-11 w-11 md:h-8 md:w-8 p-0 rounded-full bg-background disabled:opacity-50"
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Delete Confirmation */}
      {deleteModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-overlay/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-background border border-border shadow-[0_8px_24px_rgba(0,55,112,0.08),0_2px_6px_rgba(0,55,112,0.04)] rounded-[12px] w-full max-w-md flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 text-center">
              <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center text-destructive mx-auto mb-4">
                <Trash2 className="w-6 h-6" />
              </div>
              <h2 className="text-[22px] font-light tracking-tight text-foreground mb-2">Hapus Pengguna?</h2>
              <p className="text-sm text-muted-foreground">
                Apakah Anda yakin ingin menghapus pengguna <strong className="text-foreground">{deleteModal.data?.username}</strong>? Tindakan ini tidak dapat dibatalkan.
              </p>
              {errorMsg && (
                <div className="mt-4 p-3 bg-destructive/10 border border-destructive/20 rounded-lg flex items-center gap-2 text-destructive text-sm text-left">
                  <AlertCircle className="w-4 h-4" />
                  {errorMsg}
                </div>
              )}
            </div>
            <div className="shrink-0 px-6 py-5 border-t border-border bg-transparent flex justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                className="rounded-full px-6 bg-background"
                onClick={() => setDeleteModal({ open: false, data: null })}
                disabled={isPending}
              >
                Batal
              </Button>
              <Button
                variant="destructive"
                className="rounded-full px-6 shadow-sm"
                onClick={handleDelete}
                disabled={isPending}
              >
                {isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Hapus Pengguna
              </Button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
