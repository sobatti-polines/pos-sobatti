"use client";

import { useState, useMemo, useTransition, useDeferredValue } from "react";
import { Plus, Trash2, Edit2, AlertCircle, CalendarDays, Loader2 } from "lucide-react";
import { useTable } from "@/hooks/use-table";
import DataTable, { type Column, type DeleteModalConfig } from "@/components/data-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { saveEventPromo, deleteEventPromo } from "./actions";

function formatIDR(n: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default function EventPromoClient({ initialPromos, products }: { initialPromos: any[], products: any[] }) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [promos, setPromos] = useState(initialPromos);
  const [searchQuery, setSearchQuery] = useState("");
  const deferredSearchQuery = useDeferredValue(searchQuery);

  const [isPending, startTransition] = useTransition();
  const [editingId, setEditingId] = useState<string | 'new' | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [form, setForm] = useState<any>({});
  const [selectedProducts, setSelectedProducts] = useState<number[]>([]);
  const [productSearch, setProductSearch] = useState("");
  
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [deleteTarget, setDeleteTarget] = useState<any>(null);
  const [errorMsg, setErrorMsg] = useState("");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [viewingPromo, setViewingPromo] = useState<any>(null);

  const filteredData = useMemo(() => {
    let result = [...promos];
    if (deferredSearchQuery.trim()) {
      const q = deferredSearchQuery.toLowerCase();
      result = result.filter(
        (p) => p.nama.toLowerCase().includes(q)
      );
    }
    return result;
  }, [promos, deferredSearchQuery]);

  const table = useTable({ data: filteredData, defaultItemsPerPage: 25 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleOpen = (promo?: any) => {
    setErrorMsg("");
    setProductSearch("");
    if (promo) {
      setEditingId(promo.id);
      setForm(promo);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setSelectedProducts(promo.event_promo_produk?.map((p: any) => p.id_produk) || []);
    } else {
      setEditingId("new");
      setForm({
        nama: "", tanggal_mulai: "", tanggal_selesai: "", tipe_diskon: "persen", nilai_diskon: 0, aktif: true
      });
      setSelectedProducts([]);
    }
  };

  const handleSave = () => {
    if (!form.nama?.trim()) {
      setErrorMsg("Nama event wajib diisi");
      return;
    }
    if (!form.tanggal_mulai || !form.tanggal_selesai) {
      setErrorMsg("Periode tanggal wajib diisi");
      return;
    }
    
    setErrorMsg("");
    startTransition(async () => {
      await saveEventPromo(form, editingId === 'new', selectedProducts);
      window.location.reload(); 
    });
  };

  const handleDeleteConfirm = () => {
    if (!deleteTarget) return;
    setErrorMsg("");
    startTransition(async () => {
      await deleteEventPromo(deleteTarget.id);
      window.location.reload();
    });
  };
  
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const columns: Column<any>[] = [
     { key: "nama", header: "Nama Event", sortable: true, className: "pl-6", headerClassName: "pl-6", 
       render: (p) => <span className="font-medium text-[15px]">{p.nama}</span> },
     { key: "status", header: "Status", sortable: true, sortKey: "aktif",
       render: (p) => (
         <Badge variant="secondary" className={`border-none rounded-full px-2.5 py-0.5 text-[11px] uppercase tracking-widest leading-tight ${p.aktif ? 'bg-emerald-100 text-emerald-700' : 'bg-muted text-muted-foreground'}`}>
           {p.aktif ? "Aktif" : "Nonaktif"}
         </Badge>
       )
     },
     { key: "periode", header: "Periode", sortable: true, sortKey: "tanggal_mulai",
       render: (p) => <span className="text-sm text-muted-foreground">{p.tanggal_mulai} s/d {p.tanggal_selesai}</span>
     },
     { key: "diskon", header: "Diskon", sortable: true, sortKey: "nilai_diskon",
       render: (p) => <span className="font-semibold tabular-nums">{p.nilai_diskon}{p.tipe_diskon === 'persen' ? '%' : ' IDR'}</span>
     },
     { key: "produk", header: "Produk Terdaftar",
       render: (p) => <span className="text-sm text-muted-foreground">{p.event_promo_produk?.length || 0} item</span>
     },
     { key: "actions", header: "", className: "pr-6", headerClassName: "w-[100px] pr-6",
       render: (p) => (
         <div className="flex justify-end gap-1">
           <Button 
             variant="ghost" 
             size="icon" 
             aria-label="Edit event" 
             className="h-11 w-11 md:h-8 md:w-8 text-muted-foreground hover:text-foreground" 
             onClick={(e) => {
               e.stopPropagation();
               handleOpen(p);
             }}
           >
             <Edit2 className="h-4 w-4" />
           </Button>
           <Button 
             variant="ghost" 
             size="icon" 
             aria-label="Hapus event" 
             className="h-11 w-11 md:h-8 md:w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10" 
             onClick={(e) => {
               e.stopPropagation();
               setDeleteTarget(p);
             }}
           >
             <Trash2 className="h-4 w-4" />
           </Button>
         </div>
       )
     }
  ];

  const deleteModal: DeleteModalConfig | undefined = deleteTarget ? {
    open: true,
    title: "Hapus Event Promo?",
    itemName: deleteTarget.nama,
    onConfirm: handleDeleteConfirm,
    onCancel: () => setDeleteTarget(null),
    isPending,
    error: errorMsg,
  } : undefined;

  const toggleProduct = (id: number) => {
    setSelectedProducts(prev => 
      prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
    );
  };

  const filteredProducts = useMemo(() => {
    return products.filter(p => 
      p.nama_produk.toLowerCase().includes(productSearch.toLowerCase())
    );
  }, [products, productSearch]);

  const getDiscountedPrice = (price: number, tipe: string, nilai: number) => {
    if (tipe === 'persen') {
      return price - (price * (nilai / 100));
    }
    return price - nilai;
  };

  const viewingProducts = useMemo(() => {
    if (!viewingPromo) return [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return viewingPromo.event_promo_produk?.map((ep: any) => {
      const prod = products.find(p => p.id === ep.id_produk);
      if (!prod) return null;
      const newPrice = getDiscountedPrice(prod.harga_jual_satuan, viewingPromo.tipe_diskon, viewingPromo.nilai_diskon);
      
      const jenisDiskon = viewingPromo.tipe_diskon === 'persen' 
        ? `Persentase (${viewingPromo.nilai_diskon}%)`
        : `Nominal (${formatIDR(viewingPromo.nilai_diskon)})`;

      return {
        ...prod,
        jenisDiskon,
        newPrice
      };
    }).filter(Boolean) || [];
  }, [viewingPromo, products]);

  return (
    <>
      <DataTable
        data={table.paginatedData}
        total={table.total}
        columns={columns}
        rowKey={(p) => p.id}
        search={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder="Cari nama event..."
        sortConfig={table.sortConfig}
        onSort={table.handleSort}
        currentPage={table.currentPage}
        onPageChange={table.setCurrentPage}
        itemsPerPage={table.itemsPerPage}
        onItemsPerPageChange={table.setItemsPerPage}
        editingId={null} // Nonaktifkan inline editing, gunakan modal
        onRowClick={(p) => setViewingPromo(p)}
        actions={[
          {
            label: "Tambah Event",
            icon: <Plus className="w-4 h-4" />,
            kind: "primary",
            onClick: () => handleOpen(),
          },
        ]}
        deleteModal={deleteModal}
        emptyState={{
          icon: CalendarDays,
          title: "Tidak ada event promo",
          description: "Coba gunakan kata kunci pencarian yang lain.",
        }}
      />

      {/* Modal Detail Promo */}
      <Dialog 
        open={viewingPromo !== null} 
        onOpenChange={(open) => {
          if (!open) setViewingPromo(null);
        }}
      >
        <DialogContent className="w-[96vw] sm:max-w-4xl p-0 flex flex-col overflow-hidden rounded-2xl border border-border/80 shadow-2xl bg-background">
          <DialogHeader className="p-6 pb-5 border-b border-border/80 shrink-0 bg-muted/10">
            <DialogTitle className="text-xl font-medium tracking-tight flex items-center gap-3">
              <span className="h-3 w-3 rounded-full bg-primary shrink-0" />
              Detail Promo: {viewingPromo?.nama}
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground mt-1.5">
              Menampilkan {viewingProducts.length} produk yang termasuk dalam event ini beserta harga diskon.
            </DialogDescription>
          </DialogHeader>

          <div className="p-0 overflow-y-auto max-h-[70vh] flex flex-col">
            <table className="w-full text-sm">
              <thead className="bg-muted/30 sticky top-0 z-10">
                <tr className="border-b border-border text-muted-foreground">
                  <th className="font-semibold text-left py-3 px-6 w-1/3">Nama Produk</th>
                  <th className="font-semibold text-left py-3 px-4">Jenis Diskon</th>
                  <th className="font-semibold text-right py-3 px-4">Harga Lama</th>
                  <th className="font-semibold text-right py-3 px-6">Harga Baru</th>
                </tr>
              </thead>
              <tbody>
                {viewingProducts.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="text-center py-8 text-muted-foreground">
                      Tidak ada produk yang terdaftar dalam promo ini.
                    </td>
                  </tr>
                ) : (
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  viewingProducts.map((prod: any) => (
                    <tr key={prod.id} className="border-b border-border/50 hover:bg-muted/10 transition-colors">
                      <td className="py-3 px-6 font-medium">{prod.nama_produk}</td>
                      <td className="py-3 px-4 text-muted-foreground">{prod.jenisDiskon}</td>
                      <td className="py-3 px-4 text-right text-muted-foreground line-through tabular-nums">
                        {formatIDR(prod.harga_jual_satuan)}
                      </td>
                      <td className="py-3 px-6 text-right font-semibold text-primary tabular-nums">
                        {formatIDR(prod.newPrice)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          
          <div className="p-5 border-t border-border/80 bg-muted/10 flex justify-end shrink-0">
            <Button onClick={() => setViewingPromo(null)}>Tutup</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal Form Tambah / Edit */}
      <Dialog 
        open={editingId !== null} 
        onOpenChange={(open) => {
          if (!open) setEditingId(null);
        }}
      >
        <DialogContent className="w-[96vw] sm:max-w-2xl p-0 flex flex-col overflow-hidden rounded-2xl border border-border/80 shadow-2xl bg-background">
          <DialogHeader className="p-6 pb-5 border-b border-border/80 shrink-0 bg-muted/10">
            <DialogTitle className="text-xl font-medium tracking-tight flex items-center gap-3">
              <span className="h-3 w-3 rounded-full bg-primary animate-pulse shrink-0" />
              {editingId === "new" ? "Tambah Event Promo" : "Edit Event Promo"}
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground mt-1.5">
              Atur diskon promo otomatis berdasarkan rentang waktu dan produk tertentu.
            </DialogDescription>
          </DialogHeader>

          <div className="p-6 overflow-y-auto max-h-[70vh] flex flex-col gap-5">
            {errorMsg && (
              <div className="text-sm text-destructive flex items-center gap-2.5 bg-destructive/10 border border-destructive/20 p-3 rounded-xl font-medium">
                <AlertCircle className="w-5 h-5 shrink-0" />
                {errorMsg}
              </div>
            )}
            
            <div className="grid gap-4">
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">Nama Event <span className="text-destructive">*</span></label>
                <Input placeholder="Misal: Diskon Kemerdekaan" value={form.nama || ""} onChange={e => setForm({...form, nama: e.target.value})} className="h-11 bg-background" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">Mulai <span className="text-destructive">*</span></label>
                  <Input type="date" value={form.tanggal_mulai || ""} onChange={e => setForm({...form, tanggal_mulai: e.target.value})} className="h-11 bg-background" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">Selesai <span className="text-destructive">*</span></label>
                  <Input type="date" value={form.tanggal_selesai || ""} onChange={e => setForm({...form, tanggal_selesai: e.target.value})} className="h-11 bg-background" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">Tipe Diskon</label>
                  <Select value={form.tipe_diskon || "persen"} onChange={e => setForm({...form, tipe_diskon: e.target.value as 'persen' | 'nominal'})} className="h-11">
                    <option value="persen">Persentase (%)</option>
                    <option value="nominal">Nominal (Rp)</option>
                  </Select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">Nilai Diskon <span className="text-destructive">*</span></label>
                  <Input type="number" min="0" value={form.nilai_diskon || ""} onChange={e => setForm({...form, nilai_diskon: e.target.value})} className="h-11 bg-background" />
                </div>
              </div>
              <label className="flex items-center gap-3 mt-1 cursor-pointer w-fit">
                <input type="checkbox" checked={form.aktif ?? true} onChange={e => setForm({...form, aktif: e.target.checked})} className="rounded border-input w-5 h-5 text-primary focus:ring-primary accent-primary" />
                <span className="text-sm font-medium">Event Aktif</span>
              </label>
              
              <div className="border border-border/80 rounded-xl mt-2 flex flex-col bg-card overflow-hidden">
                <div className="bg-muted/30 p-3 border-b border-border/60 flex items-center justify-between">
                  <h4 className="font-medium text-sm">Produk Terdaftar ({selectedProducts.length})</h4>
                </div>
                <div className="p-3 bg-background">
                  <Input 
                    placeholder="Cari produk untuk ditambahkan..." 
                    value={productSearch} 
                    onChange={e => setProductSearch(e.target.value)} 
                    className="mb-3 h-9 text-sm"
                  />
                  <div className="max-h-52 overflow-y-auto grid gap-1 pr-2 border rounded-md p-1 bg-muted/10">
                    {filteredProducts.map(prod => (
                      <label key={prod.id} className="flex items-center gap-3 text-sm p-2 hover:bg-background rounded-md cursor-pointer border border-transparent hover:border-border transition-colors">
                        <input 
                          type="checkbox" 
                          checked={selectedProducts.includes(prod.id)}
                          onChange={() => toggleProduct(prod.id)}
                          className="rounded border-input w-4 h-4 accent-primary shrink-0"
                        />
                        <span className="truncate">{prod.nama_produk}</span>
                      </label>
                    ))}
                    {filteredProducts.length === 0 && <p className="text-xs text-muted-foreground p-3 text-center">Tidak ada produk ditemukan.</p>}
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          <div className="p-5 border-t border-border/80 bg-muted/10 flex justify-end gap-3 shrink-0">
            <Button variant="outline" onClick={() => setEditingId(null)} disabled={isPending}>Batal</Button>
            <Button onClick={handleSave} disabled={isPending}>
              {isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              {editingId === 'new' ? 'Tambah Promo' : 'Simpan Perubahan'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
