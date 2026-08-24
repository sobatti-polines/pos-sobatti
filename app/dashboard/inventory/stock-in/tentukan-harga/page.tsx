import { createClient } from "@/lib/supabase/server";
import TentukanHargaClient from "./tentukan-harga-client";
import type { PendingStockInItem } from "./types";

export default async function TentukanHargaPage() {
  const supabase = await createClient();

  // Check auth and role
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return (
      <div className="flex-1 p-4 md:p-8 lg:p-12 w-full flex flex-col gap-4 md:gap-8 mx-auto h-full md:max-h-screen md:overflow-hidden">
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
          <p className="text-base font-medium text-foreground">
            Unauthorized
          </p>
          <p className="text-sm mt-1">
            Silakan login terlebih dahulu
          </p>
        </div>
      </div>
    );
  }

  const role = user.user_metadata?.role;
  if (role !== "OWNER") {
    return (
      <div className="flex-1 p-4 md:p-8 lg:p-12 w-full flex flex-col gap-4 md:gap-8 mx-auto h-full md:max-h-screen md:overflow-hidden">
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
          <p className="text-base font-medium text-foreground">
            Akses Ditolak
          </p>
          <p className="text-sm mt-1">
            Hanya owner yang dapat mengakses halaman ini
          </p>
        </div>
      </div>
    );
  }

  // Fetch pending stock-in items
  // Coba dulu dengan kolom harga_ditentukan, fallback ke filter lama jika kolom belum ada
  let pendingItems = null;
  let fetchError = null;

  const selectFields = `
      id,
      tgl_masuk,
      no_surat,
      supplied_unit,
      supplied_qty,
      applied_conversion_ratio,
      base_qty_added,
      total_cost,
      harga_beli,
      keterangan,
      id_supplier,
      id_produk,
      supplier(id, nama_supplier),
      produk(
        id,
        nama_produk,
        sku,
        barcode,
        conversion_ratio,
        stok_gudang,
        harga_pokok_avco,
        satuan(nama)
      )
    `;

  // Try 1: with harga_ditentukan column (new migration)
  const result1 = await supabase
    .from("barang_masuk")
    .select(selectFields)
    .eq("status", "AKTIF")
    .eq("harga_ditentukan", false)
    .order("tgl_masuk", { ascending: false })
    .order("id", { ascending: false });

  if (result1.error) {
    // Try 2: fallback — kolom harga_ditentukan belum ada, pakai filter lama
    const result2 = await supabase
      .from("barang_masuk")
      .select(selectFields)
      .eq("status", "AKTIF")
      .or("total_cost.eq.0,harga_beli.eq.0")
      .order("tgl_masuk", { ascending: false })
      .order("id", { ascending: false });

    pendingItems = result2.data;
    fetchError = result2.error;
  } else {
    pendingItems = result1.data;
  }

  if (fetchError) {
    console.error("Failed to fetch pending stock-in:", fetchError);
    return (
      <div className="flex-1 p-4 md:p-8 lg:p-12 w-full flex flex-col gap-4 md:gap-8 mx-auto h-full md:max-h-screen md:overflow-hidden">
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
          <p className="text-base font-medium text-foreground">
            Gagal memuat data
          </p>
          <p className="text-sm mt-1">
            {fetchError.message}
          </p>
        </div>
      </div>
    );
  }

  // Format data
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const items: PendingStockInItem[] = (pendingItems ?? []).map((item: any) => ({
    id: item.id,
    tgl_masuk: item.tgl_masuk,
    no_surat: item.no_surat,
    supplied_unit: item.supplied_unit,
    supplied_qty: item.supplied_qty,
    applied_conversion_ratio: item.applied_conversion_ratio,
    base_qty_added: item.base_qty_added,
    total_cost: item.total_cost,
    harga_beli: item.harga_beli,
    keterangan: item.keterangan,
    supplier: Array.isArray(item.supplier) ? item.supplier[0] ?? null : item.supplier ?? null,
    produk: Array.isArray(item.produk) ? item.produk[0] ?? null : item.produk ?? null,
  }));

  return <TentukanHargaClient initialItems={items} />;
}
