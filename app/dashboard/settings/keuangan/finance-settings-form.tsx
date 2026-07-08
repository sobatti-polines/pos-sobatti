"use client";

import { useState } from "react";
import { Save, Check, AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { saveFinanceSettings } from "./actions";

export default function FinanceSettingsForm({ initialData }: { initialData: any }) {
  const [modalAwal, setModalAwal] = useState(initialData?.modal_awal || 0);
  const [tanggalMulai, setTanggalMulai] = useState(initialData?.tanggal_mulai || new Date().toISOString().slice(0, 10));
  const [namaPemilik, setNamaPemilik] = useState(initialData?.nama_pemilik || "");
  const [npwp, setNpwp] = useState(initialData?.npwp || "");
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess(false);

    const res = await saveFinanceSettings({
      modal_awal: Number(modalAwal),
      tanggal_mulai: tanggalMulai,
      nama_pemilik: namaPemilik,
      npwp: npwp,
    });

    if (res?.error) {
      setError(res.error);
    } else {
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    }
    setLoading(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="modal_awal">Modal Awal (Saldo Awal Kas)</Label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">Rp</span>
            <Input 
              id="modal_awal" 
              type="number" 
              value={modalAwal} 
              onChange={(e) => setModalAwal(Number(e.target.value))} 
              className="pl-10"
              required
            />
          </div>
          <p className="text-[10px] text-muted-foreground italic">Saldo kas saat pertama kali menggunakan sistem ini.</p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="tanggal_mulai">Tanggal Mulai Usaha / Sistem</Label>
          <Input 
            id="tanggal_mulai" 
            type="date" 
            value={tanggalMulai} 
            onChange={(e) => setTanggalMulai(e.target.value)} 
            required
          />
        </div>

        <div className="pt-4 border-t border-border">
          <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-4">Informasi Identitas (Opsional)</h4>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="nama_pemilik">Nama Pemilik</Label>
              <Input 
                id="nama_pemilik" 
                value={namaPemilik} 
                onChange={(e) => setNamaPemilik(e.target.value)} 
                placeholder="Contoh: Budi Santoso"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="npwp">NPWP</Label>
              <Input 
                id="npwp" 
                value={npwp} 
                onChange={(e) => setNpwp(e.target.value)} 
                placeholder="00.000.000.0-000.000"
              />
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 bg-destructive/10 text-destructive text-sm rounded-md">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {success && (
        <div className="flex items-center gap-2 p-3 bg-emerald-50 text-emerald-700 text-sm rounded-md">
          <Check className="w-4 h-4 shrink-0" />
          Pengaturan berhasil disimpan
        </div>
      )}

      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
        Simpan Pengaturan
      </Button>
    </form>
  );
}
