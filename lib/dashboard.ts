import { createClient } from "@/lib/supabase/server";
import { generateLabaRugi } from "@/lib/laporan-keuangan";
import { fetchAllRows } from "@/lib/supabase/fetch-all";
import { startOfMonth, format } from "date-fns";

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
  recentActivity: ActivityRow[];
  monthLabaBersih: number;
  monthBebanOperasional: number;
}

export interface ActivityRow {
  id: string;
  waktu: string;
  pengguna: string;
  aksi: string;
  entitas: string;
  deskripsi: string;
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
  displayLow: boolean;
  gudangLow: boolean;
}

export async function getDashboardData(): Promise<DashboardData> {
  const supabase = await createClient();

  // Use WIB (UTC+7) for business-day boundaries, consistent with
  // no_transaksi prefix and /api/laporan/penjualan (+07:00 filters).
  const nowUtc = Date.now();
  const wibOffset = 7 * 60 * 60 * 1000;
  const nowWIB = new Date(nowUtc + wibOffset);
  const todayStr = nowWIB.toISOString().slice(0, 10);
  const yesterday = new Date(nowWIB);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().slice(0, 10);

  const [
    todayRevenueRes,
    yesterdayRevenueRes,
    todayOrdersRes,
    transactionsRes,
    allProductsRes,
    recentDaysRes,
    activityRes,
  ] = await Promise.all([
    supabase
      .from("transaksi_keluar")
      .select("total")
      .eq("status", "berhasil")
      .gte("tgl_transaksi", `${todayStr}T00:00:00`)
      .lte("tgl_transaksi", `${todayStr}T23:59:59`),
    supabase
      .from("transaksi_keluar")
      .select("total")
      .eq("status", "berhasil")
      .gte("tgl_transaksi", `${yesterdayStr}T00:00:00`)
      .lte("tgl_transaksi", `${yesterdayStr}T23:59:59`),
    supabase
      .from("transaksi_keluar")
      .select("id", { count: "exact", head: true })
      .eq("status", "berhasil")
      .gte("tgl_transaksi", `${todayStr}T00:00:00`)
      .lte("tgl_transaksi", `${todayStr}T23:59:59`),
    supabase
      .from("transaksi_keluar")
      .select(`
        id, no_transaksi, tgl_transaksi, total, bayar,
        pelanggan(nama_pelanggan)
,
        pengguna!transaksi_keluar_id_kasir_fkey(username)
      `)
      .eq("status", "berhasil")
      .order("tgl_transaksi", { ascending: false })
      .limit(5),
    fetchAllRows(supabase, (db, from, to) =>
      db
        .from("produk")
        .select("id, nama_produk, hitung_stok, stok, stok_gudang, stok_minimum, stok_minimum_gudang")
        .eq("hitung_stok", true)
        .range(from, to)
    ),
    supabase
      .from("transaksi_keluar")
      .select("tgl_transaksi, total")
      .eq("status", "berhasil")
      .gte("tgl_transaksi", `${new Date(nowWIB.getTime() - 13 * 86400000).toISOString().slice(0, 10)}T00:00:00`)
      .lte("tgl_transaksi", `${todayStr}T23:59:59`)
      .order("tgl_transaksi", { ascending: true })
      .limit(100000),
    supabase
      .from("log_aktivitas")
      .select(`
        id, aksi, entitas, deskripsi, created_at,
        pengguna!inner(nama, username)
      `)
      .order("created_at", { ascending: false })
      .limit(10),
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
  for (const p of (allProductsRes ?? []) as Array<{
    id: number;
    nama_produk: string;
    stok: number | null;
    stok_gudang: number | null;
    stok_minimum: number | null;
    stok_minimum_gudang: number | null;
  }>) {
    const stok = p.stok ?? 0;
    const stokGudang = p.stok_gudang ?? 0;
    // Display: stok 0 = "Habis" (badge terpisah), bukan menipis — konsisten dengan perilaku lama.
    const displayLow = stok > 0 && stok <= (p.stok_minimum ?? 5);
    // Gudang: aktif jika ambang diisi (termasuk stok gudang 0).
    const gudangLow =
      p.stok_minimum_gudang != null && stokGudang <= p.stok_minimum_gudang;
    if (!displayLow && !gudangLow) continue;
    lowStockItems.push({
      id: p.id,
      nama_produk: p.nama_produk,
      stock: displayLow ? stok : stokGudang,
      displayLow,
      gudangLow,
    });
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
    const day = new Date(
      new Date(row.tgl_transaksi).getTime() + wibOffset
    ).toISOString().slice(0, 10);
    dayTotals.set(day, (dayTotals.get(day) ?? 0) + Number(row.total));
  }
  const sparklineData = Array.from(dayTotals.values());

  const now = Date.now();
  const recentActivity: ActivityRow[] = (activityRes.data as unknown as Array<{
    id: string;
    aksi: string;
    entitas: string;
    deskripsi: string;
    created_at: string;
    pengguna: { nama: string; username: string } | null;
  }> ?? []).map((a) => {
    const ms = now - new Date(a.created_at).getTime();
    const detik = Math.floor(ms / 1000);
    const menit = Math.floor(detik / 60);
    const jam = Math.floor(menit / 60);
    const hari = Math.floor(jam / 24);
    let waktu: string;
    if (detik < 60) waktu = "Baru saja";
    else if (menit < 60) waktu = `${menit} menit lalu`;
    else if (jam < 24) waktu = `${jam} jam lalu`;
    else if (hari < 7) waktu = `${hari} hari lalu`;
    else waktu = new Date(a.created_at).toLocaleDateString("id-ID", { day: "numeric", month: "short" });

    return {
      id: a.id,
      waktu,
      pengguna: a.pengguna?.nama || a.pengguna?.username || `User #...`,
      aksi: a.aksi,
      entitas: a.entitas,
      deskripsi: a.deskripsi.length > 90 ? a.deskripsi.slice(0, 87) + "..." : a.deskripsi,
    };
  });

  // K3-04: ringkasan keuangan bulan berjalan (Laba Rugi + beban operasional)
  let monthLabaBersih = 0;
  let monthBebanOperasional = 0;
  try {
    const monthStart = format(startOfMonth(new Date()), "yyyy-MM-dd");
    const today = format(new Date(), "yyyy-MM-dd");
    const labaRugi = await generateLabaRugi(supabase, monthStart, today);
    monthLabaBersih = Number(labaRugi.hasil.laba_bersih || 0);
    monthBebanOperasional = Number(labaRugi.hasil.beban_operasional || 0);
  } catch (e) {
    console.error("Failed to load month finance summary:", e);
  }

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
    recentActivity,
    monthLabaBersih,
    monthBebanOperasional,
  };
}
