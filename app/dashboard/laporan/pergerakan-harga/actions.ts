"use server";

import { createClient } from "@/lib/supabase/server";
import { fetchAllRows } from "@/lib/supabase/fetch-all";
import { isOwnerLike } from "@/lib/roles";

type PriceSource = "trigger" | "backfill_log" | "initial";
type ChangeDirection = "naik" | "turun" | "campuran" | "awal" | "tetap";

export interface ProductOption {
  id: number;
  nama_produk: string;
  sku: string | null;
  barcode: string | null;
}

interface PriceSnapshot {
  id: string;
  id_produk: number;
  effective_from: string;
  source: PriceSource;
  harga_jual_satuan: number;
  harga_jual_grosir: number | null;
  harga_jual_promo: number | null;
  jual_satuan: string | null;
  conversion_ratio: number;
  harga_jual_besar_satuan: number | null;
  harga_jual_besar_grosir: number | null;
  harga_jual_besar_promo: number | null;
}

interface SalesDetail {
  id: number;
  id_transaksi: number;
  id_produk: number;
  type_harga_jual: string | null;
  harga_jual: number;
  qty: number;
  qty_satuan: number | null;
  satuan_jual: string | null;
  jumlah: number;
  profit: number;
  transaksi_keluar: {
    id: number;
    no_transaksi: number;
    tgl_transaksi: string;
    status: string | null;
  } | null;
}

export interface PriceMovementPeriod {
  snapshot_id: string;
  effective_from: string;
  effective_to: string | null;
  source: PriceSource;
  harga_jual_satuan: number;
  harga_jual_grosir: number | null;
  harga_jual_promo: number | null;
  jual_satuan: string | null;
  conversion_ratio: number;
  harga_jual_besar_satuan: number | null;
  harga_jual_besar_grosir: number | null;
  harga_jual_besar_promo: number | null;
  arah_perubahan: ChangeDirection;
  sales: {
    qty_base: number;
    qty_satuan: number;
    omzet: number;
    laba: number;
    transaksi_count: number;
  };
  breakdown: Array<{
    type_harga_jual: string;
    satuan_jual: string | null;
    harga_jual: number;
    qty_base: number;
    qty_satuan: number;
    omzet: number;
    laba: number;
  }>;
  transaksi: Array<{
    id: number;
    no_transaksi: number;
    tgl_transaksi: string;
    qty_base: number;
    qty_satuan: number;
    omzet: number;
  }>;
}

export interface PriceMovementReport {
  product: ProductOption;
  summary: {
    total_perubahan: number;
    total_qty_base: number;
    total_omzet: number;
    total_laba: number;
  };
  periods: PriceMovementPeriod[];
}

function toNumber(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function nullableNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function samePriceSnapshot(a: PriceSnapshot, b: PriceSnapshot): boolean {
  return (
    a.harga_jual_satuan === b.harga_jual_satuan &&
    a.harga_jual_grosir === b.harga_jual_grosir &&
    a.harga_jual_promo === b.harga_jual_promo &&
    a.jual_satuan === b.jual_satuan &&
    a.conversion_ratio === b.conversion_ratio &&
    a.harga_jual_besar_satuan === b.harga_jual_besar_satuan &&
    a.harga_jual_besar_grosir === b.harga_jual_besar_grosir &&
    a.harga_jual_besar_promo === b.harga_jual_besar_promo
  );
}

function normalizeSnapshot(row: Record<string, unknown>): PriceSnapshot {
  return {
    id: String(row.id),
    id_produk: Number(row.id_produk),
    effective_from: String(row.effective_from),
    source: (row.source as PriceSource) ?? "trigger",
    harga_jual_satuan: toNumber(row.harga_jual_satuan),
    harga_jual_grosir: nullableNumber(row.harga_jual_grosir),
    harga_jual_promo: nullableNumber(row.harga_jual_promo),
    jual_satuan: row.jual_satuan ? String(row.jual_satuan) : null,
    conversion_ratio: toNumber(row.conversion_ratio) || 1,
    harga_jual_besar_satuan: nullableNumber(row.harga_jual_besar_satuan),
    harga_jual_besar_grosir: nullableNumber(row.harga_jual_besar_grosir),
    harga_jual_besar_promo: nullableNumber(row.harga_jual_besar_promo),
  };
}

function collapseSnapshots(rows: PriceSnapshot[]): PriceSnapshot[] {
  const sorted = [...rows].sort(
    (a, b) =>
      new Date(a.effective_from).getTime() - new Date(b.effective_from).getTime()
  );
  const collapsed: PriceSnapshot[] = [];
  for (const row of sorted) {
    const prev = collapsed[collapsed.length - 1];
    if (prev && samePriceSnapshot(prev, row)) continue;
    collapsed.push(row);
  }
  return collapsed;
}

function getDirection(current: PriceSnapshot, previous?: PriceSnapshot): ChangeDirection {
  if (!previous) return "awal";
  const pairs: Array<[number | null, number | null]> = [
    [previous.harga_jual_satuan, current.harga_jual_satuan],
    [previous.harga_jual_grosir, current.harga_jual_grosir],
    [previous.harga_jual_promo, current.harga_jual_promo],
    [previous.harga_jual_besar_satuan, current.harga_jual_besar_satuan],
    [previous.harga_jual_besar_grosir, current.harga_jual_besar_grosir],
    [previous.harga_jual_besar_promo, current.harga_jual_besar_promo],
  ];
  let hasUp = false;
  let hasDown = false;
  for (const [oldValue, newValue] of pairs) {
    if (oldValue == null || newValue == null || oldValue === newValue) continue;
    if (newValue > oldValue) hasUp = true;
    if (newValue < oldValue) hasDown = true;
  }
  if (hasUp && hasDown) return "campuran";
  if (hasUp) return "naik";
  if (hasDown) return "turun";
  return "tetap";
}

async function requireOwner() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, error: "Unauthorized" };

  const username = user.email?.split("@")[0];
  const { data: pengguna } = await supabase
    .from("pengguna")
    .select("level")
    .eq("username", username)
    .maybeSingle();

  if (!isOwnerLike(pengguna?.level)) return { supabase, error: "Forbidden" };
  return { supabase, error: null };
}

export async function fetchPergerakanHarga(input: {
  id_produk: number;
  startDate?: string;
  endDate?: string;
}): Promise<{ data?: PriceMovementReport; error?: string }> {
  const { supabase, error: authError } = await requireOwner();
  if (authError) return { error: authError };

  const idProduk = Number(input.id_produk);
  if (!Number.isInteger(idProduk) || idProduk <= 0) {
    return { error: "Produk tidak valid" };
  }

  const { data: product, error: productError } = await supabase
    .from("produk")
    .select("id, nama_produk, sku, barcode")
    .eq("id", idProduk)
    .maybeSingle();

  if (productError || !product) {
    return { error: "Produk tidak ditemukan" };
  }

  const historyRows = await fetchAllRows(supabase, (db, from, to) =>
    db
      .from("riwayat_harga_produk")
      .select("*")
      .eq("id_produk", idProduk)
      .order("effective_from", { ascending: true })
      .range(from, to)
  ).catch((err) => {
    console.error("Failed to fetch price history:", err);
    return null;
  });

  if (!historyRows) {
    return {
      error:
        "Gagal mengambil riwayat harga. Pastikan migration riwayat_harga_produk sudah dijalankan.",
    };
  }

  const snapshots = collapseSnapshots(
    (historyRows as Record<string, unknown>[]).map(normalizeSnapshot)
  );

  if (snapshots.length === 0) {
    return { error: "Produk belum memiliki riwayat harga" };
  }

  const startBoundary = input.startDate
    ? `${input.startDate}T00:00:00+07:00`
    : null;
  const endBoundary = input.endDate
    ? `${input.endDate}T23:59:59+07:00`
    : null;

  const salesRows = await fetchAllRows(supabase, (db, from, to) => {
    let query = db
      .from("detail_transaksi_keluar")
      .select(
        `
          id,
          id_transaksi,
          id_produk,
          type_harga_jual,
          harga_jual,
          qty,
          qty_satuan,
          satuan_jual,
          jumlah,
          profit,
          transaksi_keluar!inner(id, no_transaksi, tgl_transaksi, status)
        `
      )
      .eq("id_produk", idProduk)
      .eq("transaksi_keluar.status", "berhasil")
      .order("id", { ascending: true });
    if (startBoundary) query = query.gte("transaksi_keluar.tgl_transaksi", startBoundary);
    if (endBoundary) query = query.lte("transaksi_keluar.tgl_transaksi", endBoundary);
    return query.range(from, to);
  }).catch((err) => {
    console.error("Failed to fetch product sales for price movement:", err);
    return [];
  });

  const sales = (salesRows as unknown as SalesDetail[]).map((row) => ({
    ...row,
    harga_jual: toNumber(row.harga_jual),
    qty: toNumber(row.qty),
    qty_satuan: row.qty_satuan == null ? null : toNumber(row.qty_satuan),
    jumlah: toNumber(row.jumlah),
    profit: toNumber(row.profit),
  }));

  const periods = snapshots.map((snapshot, index) => {
    const next = snapshots[index + 1];
    const fromTime = new Date(snapshot.effective_from).getTime();
    const toTime = next ? new Date(next.effective_from).getTime() : Infinity;
    const periodSales = sales.filter((row) => {
      const txDate = row.transaksi_keluar?.tgl_transaksi;
      if (!txDate) return false;
      const txTime = new Date(txDate).getTime();
      return txTime >= fromTime && txTime < toTime;
    });

    const breakdownMap = new Map<
      string,
      {
        type_harga_jual: string;
        satuan_jual: string | null;
        harga_jual: number;
        qty_base: number;
        qty_satuan: number;
        omzet: number;
        laba: number;
      }
    >();
    const transaksiMap = new Map<
      number,
      {
        id: number;
        no_transaksi: number;
        tgl_transaksi: string;
        qty_base: number;
        qty_satuan: number;
        omzet: number;
      }
    >();

    for (const row of periodSales) {
      const typeHarga = row.type_harga_jual ?? "SATUAN";
      const satuanJual = row.satuan_jual ?? null;
      const qtySatuan = row.qty_satuan ?? row.qty;
      const key = `${typeHarga}|${satuanJual ?? "BASE"}|${row.harga_jual}`;
      const current = breakdownMap.get(key) ?? {
        type_harga_jual: typeHarga,
        satuan_jual: satuanJual,
        harga_jual: row.harga_jual,
        qty_base: 0,
        qty_satuan: 0,
        omzet: 0,
        laba: 0,
      };
      current.qty_base += row.qty;
      current.qty_satuan += qtySatuan;
      current.omzet += row.jumlah;
      current.laba += row.profit;
      breakdownMap.set(key, current);

      if (row.transaksi_keluar) {
        const tx = transaksiMap.get(row.transaksi_keluar.id) ?? {
          id: row.transaksi_keluar.id,
          no_transaksi: Number(row.transaksi_keluar.no_transaksi),
          tgl_transaksi: row.transaksi_keluar.tgl_transaksi,
          qty_base: 0,
          qty_satuan: 0,
          omzet: 0,
        };
        tx.qty_base += row.qty;
        tx.qty_satuan += qtySatuan;
        tx.omzet += row.jumlah;
        transaksiMap.set(tx.id, tx);
      }
    }

    const breakdown = Array.from(breakdownMap.values()).sort(
      (a, b) => b.omzet - a.omzet
    );
    const transaksi = Array.from(transaksiMap.values()).sort(
      (a, b) =>
        new Date(b.tgl_transaksi).getTime() - new Date(a.tgl_transaksi).getTime()
    );

    return {
      snapshot_id: snapshot.id,
      effective_from: snapshot.effective_from,
      effective_to: next?.effective_from ?? null,
      source: snapshot.source,
      harga_jual_satuan: snapshot.harga_jual_satuan,
      harga_jual_grosir: snapshot.harga_jual_grosir,
      harga_jual_promo: snapshot.harga_jual_promo,
      jual_satuan: snapshot.jual_satuan,
      conversion_ratio: snapshot.conversion_ratio,
      harga_jual_besar_satuan: snapshot.harga_jual_besar_satuan,
      harga_jual_besar_grosir: snapshot.harga_jual_besar_grosir,
      harga_jual_besar_promo: snapshot.harga_jual_besar_promo,
      arah_perubahan: getDirection(snapshot, snapshots[index - 1]),
      sales: {
        qty_base: periodSales.reduce((acc, row) => acc + row.qty, 0),
        qty_satuan: periodSales.reduce(
          (acc, row) => acc + (row.qty_satuan ?? row.qty),
          0
        ),
        omzet: periodSales.reduce((acc, row) => acc + row.jumlah, 0),
        laba: periodSales.reduce((acc, row) => acc + row.profit, 0),
        transaksi_count: transaksi.length,
      },
      breakdown,
      transaksi: transaksi.slice(0, 10),
    } satisfies PriceMovementPeriod;
  });

  const filteredPeriods = periods.filter((period) => {
    const periodStart = new Date(period.effective_from).getTime();
    const periodEnd = period.effective_to
      ? new Date(period.effective_to).getTime()
      : Infinity;
    const filterStart = startBoundary ? new Date(startBoundary).getTime() : -Infinity;
    const filterEnd = endBoundary ? new Date(endBoundary).getTime() : Infinity;
    return periodEnd >= filterStart && periodStart <= filterEnd;
  });

  const summary = filteredPeriods.reduce(
    (acc, period) => {
      acc.total_qty_base += period.sales.qty_base;
      acc.total_omzet += period.sales.omzet;
      acc.total_laba += period.sales.laba;
      if (period.arah_perubahan !== "awal" && period.arah_perubahan !== "tetap") {
        acc.total_perubahan += 1;
      }
      return acc;
    },
    {
      total_perubahan: 0,
      total_qty_base: 0,
      total_omzet: 0,
      total_laba: 0,
    }
  );

  return {
    data: {
      product: {
        id: product.id,
        nama_produk: product.nama_produk,
        sku: product.sku,
        barcode: product.barcode,
      },
      summary,
      periods: filteredPeriods,
    },
  };
}
