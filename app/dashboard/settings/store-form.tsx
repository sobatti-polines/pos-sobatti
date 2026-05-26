"use client";

import { useState } from "react";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { updateStoreSettings, StoreSettingsState } from "./store-actions";
import { Save, CheckCircle2, Store, CreditCard, Receipt, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

const initialState: StoreSettingsState = {
  error: undefined,
  success: false,
  message: undefined,
};

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <Button
      type="submit"
      className="px-6 font-normal"
      disabled={pending}
    >
      {pending ? (
        <span className="flex items-center gap-2">
          <span className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
          Menyimpan...
        </span>
      ) : (
        <span className="flex items-center gap-2">
          <Save className="w-4 h-4" />
          Simpan Pengaturan
        </span>
      )}
    </Button>
  );
}

export interface StoreSettings {
  nama_toko: string;
  email: string;
  alamat: string;
  telepon: string;
  metode_diskon: string;
  pajak_persen: number;
  jenis_nota: string;
  metode_cetak: string;
  logo_nota: boolean;
  bank1_nama: string;
  bank1_rekening: string;
  bank1_atas_nama: string;
  bank2_nama: string;
  bank2_rekening: string;
  bank2_atas_nama: string;
  footer_struk_1: string;
  footer_struk_2: string;
  footer_struk_3: string;
  footer_invoice_1: string;
  footer_invoice_2: string;
  footer_invoice_3: string;
  hormat_kami_nama: string;
}

interface StoreFormProps {
  initialData: StoreSettings | null;
}

export function StoreForm({ initialData }: StoreFormProps) {
  const [state, formAction] = useActionState(updateStoreSettings, initialState);
  const [logoNota, setLogoNota] = useState(initialData?.logo_nota ?? false);

  return (
    <form action={formAction} className="space-y-8 pb-20">
      {state?.error && (
        <div className="p-4 bg-destructive/10 text-destructive border border-destructive/20 rounded-lg text-sm">
          {state.error}
        </div>
      )}

      {state?.success && (
        <div className="p-4 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 rounded-lg text-sm flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
          {state.message}
        </div>
      )}

      {/* Store Info */}
      <section className="space-y-4">
        <div className="flex items-center gap-2 pb-2 border-b border-border">
          <Store className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-medium">Informasi Toko</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label htmlFor="nama_toko" className="text-sm font-medium">Nama Toko</label>
            <Input id="nama_toko" name="nama_toko" defaultValue={initialData?.nama_toko} required  />
          </div>
          <div className="space-y-2">
            <label htmlFor="email" className="text-sm font-medium">Email</label>
            <Input id="email" name="email" type="email" defaultValue={initialData?.email}  />
          </div>
          <div className="space-y-2 md:col-span-2">
            <label htmlFor="alamat" className="text-sm font-medium">Alamat</label>
            <Input id="alamat" name="alamat" defaultValue={initialData?.alamat}  />
          </div>
          <div className="space-y-2">
            <label htmlFor="telepon" className="text-sm font-medium">Telepon</label>
            <Input id="telepon" name="telepon" defaultValue={initialData?.telepon}  />
          </div>
        </div>
      </section>

      {/* Transaction Config */}
      <section className="space-y-4">
        <div className="flex items-center gap-2 pb-2 border-b border-border">
          <Receipt className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-medium">Konfigurasi Transaksi</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label htmlFor="metode_diskon" className="text-sm font-medium">Metode Diskon Default</label>
            <Select id="metode_diskon" name="metode_diskon" defaultValue={initialData?.metode_diskon}>
              <option value="Nominal">Nominal</option>
              <option value="Persen">Persen</option>
            </Select>
          </div>
          <div className="space-y-2">
            <label htmlFor="pajak_persen" className="text-sm font-medium">Pajak (%)</label>
            <Input id="pajak_persen" name="pajak_persen" type="number" step="0.01" defaultValue={initialData?.pajak_persen} className="tabular-nums" />
          </div>
          <div className="space-y-2">
            <label htmlFor="jenis_nota" className="text-sm font-medium">Jenis Nota Default</label>
            <Select id="jenis_nota" name="jenis_nota" defaultValue={initialData?.jenis_nota}>
              <option value="Invoice">Invoice</option>
              <option value="Struk">Struk</option>
            </Select>
          </div>
          <div className="space-y-2">
            <label htmlFor="metode_cetak" className="text-sm font-medium">Metode Cetak</label>
            <Select id="metode_cetak" name="metode_cetak" defaultValue={initialData?.metode_cetak}>
              <option value="Preview">Preview (Buka di Tab Baru)</option>
              <option value="Direct">Direct (Langsung Cetak)</option>
            </Select>
          </div>
          <div className="space-y-2 flex items-center gap-2">
            <input type="checkbox"
              id="logo_nota_check"
              checked={logoNota}
              onChange={(e) => setLogoNota(e.target.checked)}
              className="w-4 h-4 rounded border-input text-primary focus:ring-primary accent-primary"
            />
            <input type="hidden" id="logo_nota" name="logo_nota" value={logoNota ? "true" : "false"} />
            <label htmlFor="logo_nota_check" className="text-sm font-medium">Tampilkan Logo di Nota</label>
          </div>
        </div>
      </section>

      {/* Bank Info */}
      <section className="space-y-4">
        <div className="flex items-center gap-2 pb-2 border-b border-border">
          <CreditCard className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-medium">Informasi Bank</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-muted/20 rounded-lg">
          <h3 className="md:col-span-3 font-medium text-sm text-muted-foreground">Bank 1</h3>
          <div className="space-y-2">
            <label htmlFor="bank1_nama" className="text-sm font-medium">Nama Bank</label>
            <Input id="bank1_nama" name="bank1_nama" defaultValue={initialData?.bank1_nama} placeholder="Contoh: BCA"  />
          </div>
          <div className="space-y-2">
            <label htmlFor="bank1_rekening" className="text-sm font-medium">No. Rekening</label>
            <Input id="bank1_rekening" name="bank1_rekening" defaultValue={initialData?.bank1_rekening} className="tabular-nums" />
          </div>
          <div className="space-y-2">
            <label htmlFor="bank1_atas_nama" className="text-sm font-medium">Atas Nama</label>
            <Input id="bank1_atas_nama" name="bank1_atas_nama" defaultValue={initialData?.bank1_atas_nama}  />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-muted/20 rounded-lg">
          <h3 className="md:col-span-3 font-medium text-sm text-muted-foreground">Bank 2</h3>
          <div className="space-y-2">
            <label htmlFor="bank2_nama" className="text-sm font-medium">Nama Bank</label>
            <Input id="bank2_nama" name="bank2_nama" defaultValue={initialData?.bank2_nama} placeholder="Contoh: Mandiri"  />
          </div>
          <div className="space-y-2">
            <label htmlFor="bank2_rekening" className="text-sm font-medium">No. Rekening</label>
            <Input id="bank2_rekening" name="bank2_rekening" defaultValue={initialData?.bank2_rekening} className="tabular-nums" />
          </div>
          <div className="space-y-2">
            <label htmlFor="bank2_atas_nama" className="text-sm font-medium">Atas Nama</label>
            <Input id="bank2_atas_nama" name="bank2_atas_nama" defaultValue={initialData?.bank2_atas_nama}  />
          </div>
        </div>
      </section>

      {/* Footer Config */}
      <section className="space-y-4">
        <div className="flex items-center gap-2 pb-2 border-b border-border">
          <MessageSquare className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-medium">Konfigurasi Footer &amp; Salam</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-3">
            <h3 className="font-medium text-sm text-muted-foreground">Footer Struk</h3>
            <div className="space-y-2">
              <label htmlFor="footer_struk_1" className="sr-only">Footer Struk Baris 1</label>
              <Input id="footer_struk_1" name="footer_struk_1" defaultValue={initialData?.footer_struk_1} placeholder="Baris 1"  />
            </div>
            <div className="space-y-2">
              <label htmlFor="footer_struk_2" className="sr-only">Footer Struk Baris 2</label>
              <Input id="footer_struk_2" name="footer_struk_2" defaultValue={initialData?.footer_struk_2} placeholder="Baris 2"  />
            </div>
            <div className="space-y-2">
              <label htmlFor="footer_struk_3" className="sr-only">Footer Struk Baris 3</label>
              <Input id="footer_struk_3" name="footer_struk_3" defaultValue={initialData?.footer_struk_3} placeholder="Baris 3"  />
            </div>
          </div>
          <div className="space-y-3">
            <h3 className="font-medium text-sm text-muted-foreground">Footer Invoice</h3>
            <div className="space-y-2">
              <label htmlFor="footer_invoice_1" className="sr-only">Footer Invoice Baris 1</label>
              <Input id="footer_invoice_1" name="footer_invoice_1" defaultValue={initialData?.footer_invoice_1} placeholder="Baris 1"  />
            </div>
            <div className="space-y-2">
              <label htmlFor="footer_invoice_2" className="sr-only">Footer Invoice Baris 2</label>
              <Input id="footer_invoice_2" name="footer_invoice_2" defaultValue={initialData?.footer_invoice_2} placeholder="Baris 2"  />
            </div>
            <div className="space-y-2">
              <label htmlFor="footer_invoice_3" className="sr-only">Footer Invoice Baris 3</label>
              <Input id="footer_invoice_3" name="footer_invoice_3" defaultValue={initialData?.footer_invoice_3} placeholder="Baris 3"  />
            </div>
          </div>
          <div className="space-y-2 md:col-span-2">
            <label htmlFor="hormat_kami_nama" className="text-sm font-medium">Nama di Hormat Kami (Invoice)</label>
            <Input id="hormat_kami_nama" name="hormat_kami_nama" defaultValue={initialData?.hormat_kami_nama} placeholder="Nama Pemilik / Manajer"  />
          </div>
        </div>
      </section>

      <div className="flex justify-end pt-4 border-t border-border">
        <SubmitButton />
      </div>
    </form>
  );
}
