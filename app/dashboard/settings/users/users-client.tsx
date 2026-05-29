"use client";

import { useState, useMemo, useTransition, useActionState, useEffect, useDeferredValue } from "react";
import { useFormStatus } from "react-dom";
import { Search, Plus, Trash2, Edit2, CheckCircle2, AlertCircle, ChevronUp, ChevronDown, ChevronLeft, ChevronRight, User as UserIcon, Loader2 } from "lucide-react";
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

type User = {
  id: number;
  username: string;
  nama: string | null;
  level: string;
  aktif: boolean;
  created_at: string;
};

const initialState: UserActionState = { success: false };

function SubmitButton({ isEditing }: { isEditing: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="rounded-full px-6 h-10 w-full sm:w-auto bg-primary hover:bg-primary/90 text-primary-foreground font-normal shadow-sm">
      {pending ? "Menyimpan..." : isEditing ? "Simpan Perubahan" : "Tambah Pengguna"}
    </Button>
  );
}

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

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  
  const [deleteModal, setDeleteModal] = useState<{ open: boolean; data: User | null }>({
    open: false,
    data: null,
  });
  const [errorMsg, setErrorMsg] = useState("");

  const [createState, createAction] = useActionState(createUser, initialState);
  const [updateState, updateAction] = useActionState(updateUser, initialState);
  
  const state = editingUser ? updateState : createState;

  // Close modal when action is successful
  useEffect(() => {
    if (state.success && isModalOpen) {
      handleCloseModal();
    }
  }, [state.success]);

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

  const handleOpenModal = (user: User | null = null) => {
    setEditingUser(user);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingUser(null);
  };

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

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-background border border-border rounded-[12px] shadow-[0_1px_3px_rgba(0,55,112,0.08)] overflow-hidden relative">
      <div className="shrink-0 flex items-center justify-between p-4 lg:p-6 border-b border-border bg-transparent gap-4">
        <div className="flex-1 flex flex-wrap items-center gap-3">
          <div className="relative w-full max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input aria-label="Pencarian" placeholder="Cari pengguna..."
              className="pl-9 rounded-md"
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
            />
          </div>
        </div>
        <Button 
          onClick={() => handleOpenModal()} 
          className="rounded-full px-6 h-10 bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm ml-4 font-normal shrink-0 gap-2"
        >
          <Plus className="w-4 h-4" />
          Pengguna Baru
        </Button>
      </div>

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
            {paginatedData.map((user) => (
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
                  <span className={`px-2.5 py-1 text-xs font-medium rounded-full ${
                    user.level === "OWNER" ? "bg-purple-100 text-purple-700" :
                    user.level === "ADMIN" ? "bg-blue-100 text-blue-700" :
                    "bg-emerald-100 text-emerald-700"
                  }`}>
                    {user.level}
                  </span>
                </TableCell>
                <TableCell className="py-4">
                  <span className={`px-2.5 py-1 text-xs font-medium rounded-full ${
                    user.aktif ? "bg-emerald-100 text-emerald-700" : "bg-destructive/10 text-destructive"
                  }`}>
                    {user.aktif ? "Aktif" : "Nonaktif"}
                  </span>
                </TableCell>
                <TableCell className="pr-6 py-4 text-right">
                  <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button variant="ghost" size="icon" aria-label="Edit pengguna" className="h-11 w-11 md:h-8 md:w-8 text-muted-foreground hover:text-foreground" onClick={() => handleOpenModal(user)}>
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" aria-label="Hapus pengguna" className="h-11 w-11 md:h-8 md:w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10" onClick={() => setDeleteModal({ open: true, data: user })}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}

            {paginatedData.length === 0 && (
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
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className="shrink-0 flex items-center justify-between gap-4 px-4 lg:px-6 py-3 border-t border-border bg-background">
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

      {/* Modal Form */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-background border border-border shadow-xl rounded-[12px] p-6 w-full max-w-md animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
            <h2 className="text-xl font-medium mb-4">
              {editingUser ? "Edit Pengguna" : "Tambah Pengguna Baru"}
            </h2>
            
            {state?.error && (
              <div className="mb-4 p-3 bg-destructive/10 text-destructive text-sm rounded-md border border-destructive/20">
                {state.error}
              </div>
            )}
            {state?.success && (
              <div className="mb-4 p-3 bg-emerald-50 text-emerald-600 text-sm rounded-md border border-emerald-200 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" />
                {state.message}
              </div>
            )}

            <form action={editingUser ? updateAction : createAction} className="space-y-4">
              {editingUser && (
                <>
                  <input type="hidden" name="id" value={editingUser.id} />
                  <input type="hidden" name="old_username" value={editingUser.username} />
                </>
              )}
              
              <div className="space-y-2">
                <Label htmlFor="nama">Nama Lengkap</Label>
                <Input id="nama" name="nama" defaultValue={editingUser?.nama || ""} required />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <Input id="username" name="username" defaultValue={editingUser?.username} required />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">
                  {editingUser ? "Password Baru (Kosongkan jika tidak diubah)" : "Password"}
                </Label>
                <Input id="password" name="password" type="password" required={!editingUser} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="level">Level Akses</Label>
                <Select id="level" name="level" defaultValue={editingUser?.level || "KASIR"}>
                  {roleOptions.map(role => (
                    <option key={role} value={role}>{role}</option>
                  ))}
                </Select>
              </div>

              <div className="flex items-center gap-2 py-2">
                <input 
                  type="checkbox" 
                  id="aktif_check" 
                  defaultChecked={editingUser ? editingUser.aktif : true}
                  className="w-4 h-4 rounded border-input text-primary focus:ring-primary accent-primary"
                  onChange={(e) => {
                    const hiddenInput = document.getElementById("aktif_hidden") as HTMLInputElement;
                    if (hiddenInput) hiddenInput.value = e.target.checked ? "true" : "false";
                  }}
                />
                <input 
                  type="hidden" 
                  id="aktif_hidden" 
                  name="aktif" 
                  defaultValue={editingUser ? (editingUser.aktif ? "true" : "false") : "true"} 
                />
                <Label htmlFor="aktif_check">Akun Aktif</Label>
              </div>

              <div className="flex justify-end gap-3 pt-4 mt-6 border-t border-border">
                <Button type="button" variant="outline" className="rounded-full px-6" onClick={handleCloseModal}>
                  Batal
                </Button>
                <SubmitButton isEditing={!!editingUser} />
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
