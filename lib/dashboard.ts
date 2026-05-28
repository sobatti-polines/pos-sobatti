import { createClient } from "@/lib/supabase/server";

export interface DashboardData {
  todayRevenue: number;
  yesterdayRevenue: number;
  revenueChangePercent: number;
  todayOrders: number;
  avgTicket: number;
  productsLow: number;
  recentTransactions: TransactionRow[];
  lowStockItems: LowStockItem[];
  sparklineData: number[];
}

export interface TransactionRow {
  no_transaksi: string;
  customer: string | null;
  time: string;
  items: number;
  total: number;
  status: string;
}

export interface LowStockItem {
  id: number;
  nama_produk: string;
  stock: number;
}

export async function getDashboardData(): Promise<DashboardData> {
  const supabase = await createClient();

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);

  const yesterdayStart = new Date(todayStart);
  yesterdayStart.setDate(yesterdayStart.getDate() - 1);
  const yesterdayEnd = new Date(todayEnd);
  yesterdayEnd.setDate(yesterdayEnd.getDate() - 1);

  const fmt = (d: Date) => d.toISOString();

  const [
    todayRevenueRes,
    yesterdayRevenueRes,
    todayOrdersRes,
    transactionsRes,
    allProductsRes,
    recentDaysRes,
  ] = await Promise.all([
    supabase
      .from("transaksi_keluar")
      .select("total")
      .gte("tgl_transaksi", fmt(todayStart))
      .lte("tgl_transaksi", fmt(todayEnd)),
    supabase
      .from("transaksi_keluar")
      .select("total")
      .gte("tgl_transaksi", fmt(yesterdayStart))
      .lte("tgl_transaksi", fmt(yesterdayEnd)),
    supabase
      .from("transaksi_keluar")
      .select("id", { count: "exact", head: true })
      .gte("tgl_transaksi", fmt(todayStart))
      .lte("tgl_transaksi", fmt(todayEnd)),
    supabase
      .from("transaksi_keluar")
      .select(`
        id, no_transaksi, tgl_transaksi, total, bayar,
        pelanggan(nama_pelanggan),
        pengguna!transaksi_keluar_id_kasir_fkey(username)
      `)
      .order("tgl_transaksi", { ascending: false })
      .limit(5),
    supabase
      .from("produk")
      .select("id, nama_produk, hitung_stok, stok"),
    supabase
      .from("transaksi_keluar")
      .select("tgl_transaksi, total")
      .gte("tgl_transaksi", fmt(new Date(todayStart.getTime() - 13 * 86400000)))
      .lte("tgl_transaksi", fmt(todayEnd))
      .order("tgl_transaksi", { ascending: true }),
  ]);

  const todayRevenue =
    todayRevenueRes.data?.reduce((s, r) => s + Number(r.total), 0) ?? 0;
  const yesterdayRevenue =
    yesterdayRevenueRes.data?.reduce((s, r) => s + Number(r.total), 0) ?? 0;
  const todayOrders = todayOrdersRes.count ?? 0;
  const avgTicket = todayOrders > 0 ? todayRevenue / todayOrders : 0;
  const revenueChangePercent =
    yesterdayRevenue > 0
      ? ((todayRevenue - yesterdayRevenue) / yesterdayRevenue) * 100
      : todayRevenue > 0
        ? 100
        : 0;

  const lowStockItems: LowStockItem[] = [];
  for (const p of allProductsRes.data ?? []) {
    if (!p.hitung_stok) continue;
    const stok = p.stok ?? 0;
    if (stok >= 0 && stok <= 20) {
      lowStockItems.push({ id: p.id, nama_produk: p.nama_produk, stock: stok });
    }
  }
  lowStockItems.sort((a, b) => a.stock - b.stock);

  const productsLow = lowStockItems.length;

  const transactionIds = (transactionsRes.data ?? []).map((t) => t.id);
  const itemCountMap = new Map<number, number>();
  if (transactionIds.length > 0) {
    const detailRes = await supabase
      .from("detail_transaksi_keluar")
      .select("id_transaksi, qty")
      .in("id_transaksi", transactionIds);
    for (const row of detailRes.data ?? []) {
      itemCountMap.set(row.id_transaksi, (itemCountMap.get(row.id_transaksi) ?? 0) + row.qty);
    }
  }

  const recentTransactions: TransactionRow[] = (transactionsRes.data as unknown as Array<{
    id: number;
    no_transaksi: string;
    tgl_transaksi: string;
    total: number;
    bayar: number;
    pelanggan: { nama_pelanggan: string } | null;
    pengguna: { username: string } | null;
  }> ?? []).map(
    (t) => ({
      no_transaksi: `#${t.no_transaksi}`,
      customer: t.pelanggan?.nama_pelanggan ?? null,
      time: new Date(t.tgl_transaksi).toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      }),
      items: itemCountMap.get(t.id) ?? 0,
      total: Number(t.total),
      status:
        t.bayar >= t.total
          ? "Selesai"
          : t.bayar > 0
            ? "Sebagian"
            : "Tertunda",
    })
  );

  const dayTotals = new Map<string, number>();
  for (const row of recentDaysRes.data ?? []) {
    const day = new Date(row.tgl_transaksi).toISOString().slice(0, 10);
    dayTotals.set(day, (dayTotals.get(day) ?? 0) + Number(row.total));
  }
  const sparklineData = Array.from(dayTotals.values());

  return {
    todayRevenue,
    yesterdayRevenue,
    revenueChangePercent: Math.round(revenueChangePercent * 100) / 100,
    todayOrders,
    avgTicket: Math.round(avgTicket * 100) / 100,
    productsLow,
    recentTransactions,
    lowStockItems,
    sparklineData,
  };
}
