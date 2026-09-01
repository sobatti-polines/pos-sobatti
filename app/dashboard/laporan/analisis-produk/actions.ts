"use server";

import { createClient } from "@/lib/supabase/server";
import { fetchAllRows } from "@/lib/supabase/fetch-all";
import { isAdminOrOwnerLike } from "@/lib/roles";

export type UnitTotal = { satuan: string; qty: number };
export type ProductSalesRow = {
  id_produk: number;
  nama_produk: string;
  sku: string | null;
  barcode: string | null;
  qty_per_satuan: UnitTotal[];
  frekuensi_transaksi: number;
  omzet_item: number;
  pendapatan_neto: number;
};

export type ProductSalesReport = {
  rows: ProductSalesRow[];
  summary: { produk_terjual: number; omzet_item: number; pendapatan_neto: number };
};

export type ProductSalesHistory = {
  product: Pick<ProductSalesRow, "id_produk" | "nama_produk" | "sku" | "barcode">;
  qty_per_satuan: UnitTotal[];
  omzet_item: number;
  pendapatan_neto: number;
  transactions: Array<{
    id: number;
    no_transaksi: number;
    tgl_transaksi: string;
    qty_per_satuan: UnitTotal[];
    omzet_item: number;
    pendapatan_neto: number;
  }>;
};

type DateFilter = { startDate: string; endDate: string };
type ProductRelation = { nama_produk?: string; sku?: string | null; barcode?: string | null; satuan?: { nama?: string } | null } | null;
type SalesDetail = {
  id_produk: number;
  qty: number | string;
  qty_satuan: number | string | null;
  satuan_jual: string | null;
  jumlah: number | string;
  produk: ProductRelation;
  transaksi_keluar: {
    id: number;
    no_transaksi: number;
    tgl_transaksi: string;
    subtotal: number | string;
    total: number | string;
    pajak_nominal: number | string;
  } | null;
};

const number = (value: unknown) => Number(value ?? 0) || 0;

function validateDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
    ? value
    : null;
}

function boundaries(input: DateFilter) {
  const start = validateDate(input.startDate);
  const end = validateDate(input.endDate);
  if (!start || !end) return { error: "Rentang tanggal tidak valid." };
  if (start > end) return { error: "Tanggal awal tidak boleh melebihi tanggal akhir." };
  return { start: `${start}T00:00:00+07:00`, end: `${end}T23:59:59.999+07:00` };
}

async function requireManagement() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { supabase, error: "Sesi Anda telah berakhir. Silakan masuk kembali." };

  const username = user.email?.split("@")[0];
  const { data: pengguna } = await supabase.from("pengguna").select("level").eq("username", username).maybeSingle();
  if (!isAdminOrOwnerLike(pengguna?.level)) return { supabase, error: "Anda tidak memiliki akses ke analisis produk." };
  return { supabase, error: null };
}

function unitLabel(row: SalesDetail) {
  return row.satuan_jual?.trim() || row.produk?.satuan?.nama || "Satuan dasar";
}

function addUnit(target: Map<string, number>, label: string, qty: number) {
  target.set(label, (target.get(label) ?? 0) + qty);
}

function units(map: Map<string, number>): UnitTotal[] {
  return Array.from(map, ([satuan, qty]) => ({ satuan, qty })).sort((a, b) => a.satuan.localeCompare(b.satuan, "id"));
}

function netRevenue(row: SalesDetail) {
  const header = row.transaksi_keluar;
  if (!header) return 0;
  const subtotal = number(header.subtotal);
  if (subtotal <= 0) return 0;
  return number(row.jumlah) * ((number(header.total) - number(header.pajak_nominal)) / subtotal);
}

async function loadSales(supabase: Awaited<ReturnType<typeof createClient>>, filter: DateFilter, productId?: number) {
  const range = boundaries(filter);
  if ("error" in range) return range;

  const rows = await fetchAllRows<SalesDetail>(supabase, (db, from, to) => {
    let query = db
      .from("detail_transaksi_keluar")
      .select(`id_produk, qty, qty_satuan, satuan_jual, jumlah, produk(nama_produk, sku, barcode, satuan(nama)), transaksi_keluar!inner(id, no_transaksi, tgl_transaksi, subtotal, total, pajak_nominal, status)`)
      .eq("transaksi_keluar.status", "berhasil")
      .gte("transaksi_keluar.tgl_transaksi", range.start)
      .lte("transaksi_keluar.tgl_transaksi", range.end)
      .order("id", { ascending: false });
    if (productId) query = query.eq("id_produk", productId);
    return query.range(from, to);
  });
  return { rows };
}

export async function fetchAnalisisProduk(filter: DateFilter): Promise<{ data?: ProductSalesReport; error?: string }> {
  const { supabase, error } = await requireManagement();
  if (error) return { error };
  try {
    const result = await loadSales(supabase, filter);
    if (!("rows" in result)) return result;
    const grouped = new Map<number, ProductSalesRow & { unitMap: Map<string, number>; transaksi: Set<number> }>();
    for (const row of result.rows) {
      const existing = grouped.get(row.id_produk) ?? {
        id_produk: row.id_produk,
        nama_produk: row.produk?.nama_produk ?? `Produk #${row.id_produk}`,
        sku: row.produk?.sku ?? null,
        barcode: row.produk?.barcode ?? null,
        qty_per_satuan: [], frekuensi_transaksi: 0, omzet_item: 0, pendapatan_neto: 0,
        unitMap: new Map(), transaksi: new Set(),
      };
      addUnit(existing.unitMap, unitLabel(row), number(row.qty_satuan ?? row.qty));
      if (row.transaksi_keluar) existing.transaksi.add(row.transaksi_keluar.id);
      existing.omzet_item += number(row.jumlah);
      existing.pendapatan_neto += netRevenue(row);
      grouped.set(row.id_produk, existing);
    }
    const rows = Array.from(grouped.values()).map(({ unitMap, transaksi, ...row }) => ({ ...row, qty_per_satuan: units(unitMap), frekuensi_transaksi: transaksi.size }));
    return { data: { rows, summary: { produk_terjual: rows.length, omzet_item: rows.reduce((sum, row) => sum + row.omzet_item, 0), pendapatan_neto: rows.reduce((sum, row) => sum + row.pendapatan_neto, 0) } } };
  } catch (cause) {
    console.error("Gagal memuat analisis produk:", cause);
    return { error: "Gagal memuat analisis produk. Coba lagi." };
  }
}

export async function fetchRiwayatPenjualanProduk(input: DateFilter & { id_produk: number }): Promise<{ data?: ProductSalesHistory; error?: string }> {
  const { supabase, error } = await requireManagement();
  if (error) return { error };
  if (!Number.isInteger(input.id_produk) || input.id_produk <= 0) return { error: "Produk tidak valid." };
  try {
    const result = await loadSales(supabase, input, input.id_produk);
    if (!("rows" in result)) return result;
    const first = result.rows[0];
    if (!first) return { error: "Tidak ada penjualan produk pada periode ini." };
    const unitMap = new Map<string, number>();
    const transactionMap = new Map<number, ProductSalesHistory["transactions"][number] & { unitMap: Map<string, number> }>();
    let omzet_item = 0;
    let pendapatan_neto = 0;
    for (const row of result.rows) {
      const header = row.transaksi_keluar;
      if (!header) continue;
      const qty = number(row.qty_satuan ?? row.qty);
      const label = unitLabel(row);
      addUnit(unitMap, label, qty);
      const transaction = transactionMap.get(header.id) ?? { id: header.id, no_transaksi: number(header.no_transaksi), tgl_transaksi: header.tgl_transaksi, qty_per_satuan: [], omzet_item: 0, pendapatan_neto: 0, unitMap: new Map() };
      addUnit(transaction.unitMap, label, qty);
      transaction.omzet_item += number(row.jumlah);
      transaction.pendapatan_neto += netRevenue(row);
      transactionMap.set(header.id, transaction);
      omzet_item += number(row.jumlah);
      pendapatan_neto += netRevenue(row);
    }
    const transactions = Array.from(transactionMap.values()).map(({ unitMap: itemUnits, ...row }) => ({ ...row, qty_per_satuan: units(itemUnits) })).sort((a, b) => b.tgl_transaksi.localeCompare(a.tgl_transaksi));
    return { data: { product: { id_produk: input.id_produk, nama_produk: first.produk?.nama_produk ?? `Produk #${input.id_produk}`, sku: first.produk?.sku ?? null, barcode: first.produk?.barcode ?? null }, qty_per_satuan: units(unitMap), omzet_item, pendapatan_neto, transactions } };
  } catch (cause) {
    console.error("Gagal memuat riwayat penjualan produk:", cause);
    return { error: "Gagal memuat riwayat penjualan produk. Coba lagi." };
  }
}
