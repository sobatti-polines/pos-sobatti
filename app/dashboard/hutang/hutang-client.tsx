"use client";

import { useState } from "react";
import { format } from "date-fns";
import { CreditCard, AlertCircle, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { processBayarHutang } from "./actions";

interface HutangData {
  id: string;
  id_supplier: number;
  tanggal_hutang: string;
  tanggal_jatuh_tempo: string | null;
  jumlah_awal: number;
  jumlah_terbayar: number;
  sisa_hutang: number;
  status: string;
  catatan: string | null;
  supplier: { nama_supplier: string } | { nama_supplier: string }[] | null;
}

function formatIDR(n: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
}

export default function HutangClient({ 
  data, 
  metodeBayar 
}: { 
  data: HutangData[];
  metodeBayar: string[];
}) {
  const [selectedHutang, setSelectedHutang] = useState<HutangData | null>(null);
  const [bayarAmount, setBayarAmount] = useState<number | "">("");
  const [metode, setMetode] = useState(metodeBayar[0] || "Tunai");
  const [tglBayar, setTglBayar] = useState(new Date().toISOString().slice(0, 10));
  const [catatan, setCatatan] = useState("");
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleBayar = async () => {
    if (!selectedHutang) return;
    if (!bayarAmount || bayarAmount <= 0) {
      setError("Jumlah bayar tidak valid");
      return;
    }
    if (bayarAmount > selectedHutang.sisa_hutang) {
      setError("Jumlah bayar melebihi sisa hutang");
      return;
    }

    setLoading(true);
    setError("");

    const res = await processBayarHutang({
      id_hutang: selectedHutang.id,
      tanggal_bayar: tglBayar,
      jumlah_bayar: Number(bayarAmount),
      metode_bayar: metode,
      catatan,
    });

    if (res?.error) {
      setError(res.error);
      setLoading(false);
      return;
    }

    setSuccess("Pembayaran berhasil dicatat");
    setLoading(false);
    setTimeout(() => {
      setSuccess("");
      setSelectedHutang(null);
      setBayarAmount("");
      setCatatan("");
    }, 2000);
  };

  return (
    <>
      <div className="flex-1 flex flex-col min-h-0 bg-background border border-border rounded-[12px] shadow-[0_1px_3px_rgba(0,55,112,0.08)] overflow-hidden relative">
        <div className="flex-1 overflow-y-auto min-h-0 relative">
          <Table>
            <TableHeader className="hidden md:table-header-group">
              <TableRow>
                <TableHead className="md:pl-6 text-left">Supplier</TableHead>
                <TableHead className="text-left">Tgl Hutang</TableHead>
                <TableHead className="text-left">Jatuh Tempo</TableHead>
                <TableHead className="text-right">Jumlah</TableHead>
                <TableHead className="text-right">Terbayar</TableHead>
                <TableHead className="text-right">Sisa</TableHead>
                <TableHead className="text-center">Status</TableHead>
                <TableHead className="md:pr-6 text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Belum ada data hutang</TableCell>
                </TableRow>
              ) : (
                data.map(h => {
                  const supplierName = Array.isArray(h.supplier) ? h.supplier[0]?.nama_supplier : h.supplier?.nama_supplier;
                  return (
                    <TableRow key={h.id} className="group hover:bg-muted/30 transition-colors flex flex-col md:table-row p-4 md:p-0 border-b">
                      <TableCell className="md:pl-6 py-2 md:py-4 block md:table-cell">
                        <span className="md:hidden text-xs font-medium text-muted-foreground uppercase tracking-widest mb-1 block">Supplier</span>
                        <span className="font-medium text-[15px] md:text-[14px]">{supplierName || '-'}</span>
                      </TableCell>
                      <TableCell className="py-2 md:py-4 block md:table-cell tabular-nums">
                        <span className="md:hidden text-xs font-medium text-muted-foreground uppercase tracking-widest mb-1 block">Tgl Hutang</span>
                        {format(new Date(h.tanggal_hutang), 'dd MMM yyyy')}
                      </TableCell>
                      <TableCell className="py-2 md:py-4 block md:table-cell tabular-nums">
                        <span className="md:hidden text-xs font-medium text-muted-foreground uppercase tracking-widest mb-1 block">Jatuh Tempo</span>
                        {h.tanggal_jatuh_tempo ? format(new Date(h.tanggal_jatuh_tempo), 'dd MMM yyyy') : '-'}
                      </TableCell>
                      <TableCell className="md:text-right py-2 md:py-4 tabular-nums block md:table-cell">
                        <span className="md:hidden text-xs font-medium text-muted-foreground uppercase tracking-widest mb-1 block">Jumlah</span>
                        {formatIDR(h.jumlah_awal)}
                      </TableCell>
                      <TableCell className="md:text-right py-2 md:py-4 tabular-nums text-emerald-600 block md:table-cell">
                        <span className="md:hidden text-xs font-medium text-muted-foreground uppercase tracking-widest mb-1 block">Terbayar</span>
                        {formatIDR(h.jumlah_terbayar)}
                      </TableCell>
                      <TableCell className="md:text-right py-2 md:py-4 tabular-nums font-semibold text-rose-600 block md:table-cell">
                        <span className="md:hidden text-xs font-medium text-muted-foreground uppercase tracking-widest mb-1 block">Sisa</span>
                        {formatIDR(h.sisa_hutang)}
                      </TableCell>
                      <TableCell className="md:text-center py-2 md:py-4 block md:table-cell">
                        <span className="md:hidden text-xs font-medium text-muted-foreground uppercase tracking-widest mb-1 block">Status</span>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] uppercase font-semibold tracking-wider ${
                          h.status === 'lunas' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
                        }`}>
                          {h.status === 'lunas' ? 'Lunas' : 'Belum Lunas'}
                        </span>
                      </TableCell>
                      <TableCell className="md:pr-6 py-3 md:py-4 text-right block md:table-cell mt-2 md:mt-0 border-t md:border-t-0 border-border/50">
                        {h.status !== 'lunas' && (
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="h-9 px-4 text-xs bg-background md:h-8 md:px-3"
                            onClick={() => {
                              setSelectedHutang(h);
                              setBayarAmount(h.sisa_hutang);
                              setError("");
                              setSuccess("");
                            }}
                          >
                            <CreditCard className="w-4 h-4 mr-2 md:w-3.5 md:h-3.5 md:mr-1.5" />
                            Bayar
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {selectedHutang && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
          <div className="bg-background border border-border shadow-xl rounded-xl w-full max-w-md overflow-hidden flex flex-col max-h-full">
            <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-muted/30">
              <h2 className="font-semibold text-lg">Bayar Hutang</h2>
              <button 
                onClick={() => setSelectedHutang(null)}
                className="text-muted-foreground hover:text-foreground p-1 rounded-md"
              >
                &times;
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4">
              {error && (
                <div className="flex items-center gap-2 px-4 py-3 bg-destructive/10 text-destructive text-sm rounded-md">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  {error}
                </div>
              )}
              {success && (
                <div className="flex items-center gap-2 px-4 py-3 bg-emerald-50 text-emerald-700 text-sm rounded-md">
                  <Check className="w-4 h-4 shrink-0" />
                  {success}
                </div>
              )}

              <div className="grid grid-cols-2 gap-4 bg-muted/30 p-4 rounded-lg">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">Sisa Hutang</p>
                  <p className="font-semibold text-lg tabular-nums text-rose-600">{formatIDR(selectedHutang.sisa_hutang)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">Jatuh Tempo</p>
                  <p className="font-medium">
                    {selectedHutang.tanggal_jatuh_tempo ? format(new Date(selectedHutang.tanggal_jatuh_tempo), 'dd MMM yyyy') : '-'}
                  </p>
                </div>
              </div>

              <div className="space-y-4 pt-2">
                <div className="space-y-2">
                  <Label htmlFor="tgl_bayar">Tanggal Pembayaran</Label>
                  <Input 
                    id="tgl_bayar" 
                    type="date" 
                    value={tglBayar} 
                    onChange={e => setTglBayar(e.target.value)} 
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="metode">Metode Bayar</Label>
                  <select 
                    id="metode"
                    value={metode}
                    onChange={e => setMetode(e.target.value)}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  >
                    {metodeBayar.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="jumlah">Jumlah Bayar</Label>
                  <Input 
                    id="jumlah" 
                    type="number" 
                    value={bayarAmount} 
                    onChange={e => setBayarAmount(Number(e.target.value))} 
                    max={selectedHutang.sisa_hutang}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="catatan">Catatan</Label>
                  <Input 
                    id="catatan" 
                    value={catatan} 
                    onChange={e => setCatatan(e.target.value)} 
                    placeholder="Opsional"
                  />
                </div>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-border bg-muted/30 flex justify-end gap-3">
              <Button variant="ghost" onClick={() => setSelectedHutang(null)} disabled={loading}>
                Batal
              </Button>
              <Button onClick={handleBayar} disabled={loading || !bayarAmount}>
                {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CreditCard className="w-4 h-4 mr-2" />}
                Proses Pembayaran
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
