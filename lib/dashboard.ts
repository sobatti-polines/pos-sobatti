import { unstable_cache } from "next/cache";
import { getServerSupabase, getSessionUser } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { generateLabaRugi } from "@/lib/laporan-keuangan";
import { startOfMonth, format } from "date-fns";
import { DEV_ROLE, isDev } from "@/lib/roles";

export interface DashboardData {
  todayRevenue: number;
  yesterdayRevenue: number;
  revenueChangePercent: number;
  todayOrders: number;
  avgTicket: number;
  recentTransactions: TransactionRow[];
  sparklineData: number[];
  recentActivity: ActivityRow[];
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

export interface DashboardFinanceSummaryData {
  labaBersih: number;
  bebanOperasional: number;
}

// ---------------------------------------------------------------------------
// Bentuk baris yang dikembalikan RPC get_dashboard_summary (lihat
// supabase/20261005_perf_dashboard_rpc.sql). Angka dikirim sebagai numeric
// sehingga di-cast via Number() seperti code lama.
// ---------------------------------------------------------------------------
interface RpcTransactionRow {
  no_transaksi: number | string;
  tgl_transaksi: string;
  total: number | string;
  bayar: number | string;
  customer_name: string | null;
  item_count: number | string | null;
}

interface RpcActivityRow {
  id: string;
  aksi: string;
  entitas: string;
  deskripsi: string;
  created_at: string;
  pengguna_nama: string | null;
  pengguna_username: string | null;
}

interface DashboardSummaryRpc {
  today_revenue: number | string;
  yesterday_revenue: number | string;
  today_orders: number;
  sparkline: Array<number | string>;
  recent_transactions: RpcTransactionRow[];
  recent_activity: RpcActivityRow[];
}

/**
 * Ringkasan dashboard via 1 RPC agregasi, di-cache 45 detik.
 *
 * Sebelumnya tiap buka dashboard = 6 query paralel (select total tanpa
 * agregasi + limit 100000 untuk sparkline) dari VPS Bogor ke Supabase Tokyo
 * (~300ms per roundtrip). Sekarang 1 call yang di-cache lintas request.
 *
 * Sengaja memakai supabaseAdmin (tanpa cookies) di dalam unstable_cache:
 * data ringkasan bersifat global (bukan per-user) dan RPC bersifat
 * SECURITY DEFINER, sehingga aman di-cache. Filter DEV vs non-DEV dijadikan
 * argumen cache key (excludeDev) agar OWNER/DEV tetap melihat semua aktivitas.
 */
const getSummaryCached = unstable_cache(
  async (
    todayStr: string,
    excludeDev: boolean
  ): Promise<DashboardSummaryRpc> => {
    const { data, error } = await supabaseAdmin.rpc("get_dashboard_summary", {
      p_today: todayStr,
      p_days: 14,
      p_exclude_dev: excludeDev,
    });
    if (error) throw error;
    return data as unknown as DashboardSummaryRpc;
  },
  ["dashboard-summary-v1"],
  { revalidate: 45 }
);

function formatWaktuRelatif(createdAt: string, now: number): string {
  const ms = now - new Date(createdAt).getTime();
  const detik = Math.floor(ms / 1000);
  const menit = Math.floor(detik / 60);
  const jam = Math.floor(menit / 60);
  const hari = Math.floor(jam / 24);
  if (detik < 60) return "Baru saja";
  if (menit < 60) return `${menit} menit lalu`;
  if (jam < 24) return `${jam} jam lalu`;
  if (hari < 7) return `${hari} hari lalu`;
  return new Date(createdAt).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
  });
}

function truncateDeskripsi(deskripsi: string): string {
  return deskripsi.length > 90 ? deskripsi.slice(0, 87) + "..." : deskripsi;
}

function mapRpcTransactions(rows: RpcTransactionRow[]): TransactionRow[] {
  return (rows ?? []).map((t) => {
    const total = Number(t.total);
    const bayar = Number(t.bayar);
    return {
      no_transaksi: `#${t.no_transaksi}`,
      customer: t.customer_name ?? null,
      time: new Date(t.tgl_transaksi).toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      }),
      items: Number(t.item_count ?? 0),
      total,
      status:
        bayar >= total ? "Selesai" : bayar > 0 ? "Sebagian" : "Tertunda",
    };
  });
}

function mapRpcActivity(rows: RpcActivityRow[], now: number): ActivityRow[] {
  return (rows ?? []).map((a) => ({
    id: a.id,
    waktu: formatWaktuRelatif(a.created_at, now),
    pengguna: a.pengguna_nama || a.pengguna_username || `User #...`,
    aksi: a.aksi,
    entitas: a.entitas,
    deskripsi: truncateDeskripsi(a.deskripsi ?? ""),
  }));
}

export async function getDashboardData(): Promise<DashboardData> {
  const user = await getSessionUser();
  const role = user?.user_metadata?.role;
  const excludeDev = !isDev(role);

  // Batas hari bisnis WIB, konsisten dengan prefix no_transaksi dan
  // /api/laporan/penjualan (+07:00 filters).
  const nowUtc = Date.now();
  const wibOffset = 7 * 60 * 60 * 1000;
  const nowWIB = new Date(nowUtc + wibOffset);
  const todayStr = nowWIB.toISOString().slice(0, 10);

  try {
    const s = await getSummaryCached(todayStr, excludeDev);
    const todayRevenue = Number(s.today_revenue ?? 0);
    const yesterdayRevenue = Number(s.yesterday_revenue ?? 0);
    const todayOrders = Number(s.today_orders ?? 0);
    const avgTicket = todayOrders > 0 ? todayRevenue / todayOrders : 0;
    const revenueChangePercent =
      yesterdayRevenue > 0
        ? ((todayRevenue - yesterdayRevenue) / yesterdayRevenue) * 100
        : todayRevenue > 0
          ? 100
          : 0;

    return {
      todayRevenue,
      yesterdayRevenue,
      revenueChangePercent: Math.round(revenueChangePercent * 100) / 100,
      todayOrders,
      avgTicket: Math.round(avgTicket * 100) / 100,
      recentTransactions: mapRpcTransactions(s.recent_transactions ?? []),
      sparklineData: (s.sparkline ?? []).map((v) => Number(v)),
      recentActivity: mapRpcActivity(s.recent_activity ?? [], nowUtc),
    };
  } catch (e) {
    // Rollback aman: bila RPC belum dimigrasi di environment ini (mis.
    // produksi sebelum migration dijalankan), pakai query lama.
    console.error(
      "get_dashboard_summary RPC gagal, fallback ke query lama:",
      e
    );
    return getDashboardDataLegacy(excludeDev);
  }
}

/**
 * Implementasi lama (6 query paralel + sum di JS). Dipertahankan sebagai
 * fallback selama masa rollout migration RPC ke semua environment.
 */
async function getDashboardDataLegacy(
  excludeDev: boolean
): Promise<DashboardData> {
  const supabase = await getServerSupabase();

  // Use WIB (UTC+7) for business-day boundaries, consistent with
  // no_transaksi prefix and /api/laporan/penjualan (+07:00 filters).
  const nowUtc = Date.now();
  const wibOffset = 7 * 60 * 60 * 1000;
  const nowWIB = new Date(nowUtc + wibOffset);
  const todayStr = nowWIB.toISOString().slice(0, 10);
  const yesterday = new Date(nowWIB);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().slice(0, 10);
  let activityQuery = supabase
    .from("log_aktivitas")
    .select(
      `
      id, aksi, entitas, deskripsi, created_at,
      pengguna!inner(nama, username, level)
    `
    )
    .order("created_at", { ascending: false })
    .limit(10);

  if (excludeDev) {
    activityQuery = activityQuery.neq("pengguna.level", DEV_ROLE);
  }

  const [
    todayRevenueRes,
    yesterdayRevenueRes,
    todayOrdersRes,
    transactionsRes,
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
    // detail_transaksi_keluar ikut di-embed supaya jumlah item per transaksi
    // tidak perlu satu query terpisah yang menambah satu tahap berurutan.
    supabase
      .from("transaksi_keluar")
      .select(
        `
        id, no_transaksi, tgl_transaksi, total, bayar,
        pelanggan(nama_pelanggan),
        pengguna!transaksi_keluar_id_kasir_fkey(username),
        detail_transaksi_keluar(qty)
      `
      )
      .eq("status", "berhasil")
      .order("tgl_transaksi", { ascending: false })
      .limit(5),
    supabase
      .from("transaksi_keluar")
      .select("tgl_transaksi, total")
      .eq("status", "berhasil")
      .gte(
        "tgl_transaksi",
        `${new Date(nowWIB.getTime() - 13 * 86400000).toISOString().slice(0, 10)}T00:00:00`
      )
      .lte("tgl_transaksi", `${todayStr}T23:59:59`)
      .order("tgl_transaksi", { ascending: true })
      .limit(100000),
    activityQuery,
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

  const recentTransactions: TransactionRow[] = (transactionsRes.data as unknown as Array<{
    id: number;
    no_transaksi: string;
    tgl_transaksi: string;
    total: number;
    bayar: number;
    pelanggan: { nama_pelanggan: string } | null;
    pengguna: { username: string } | null;
    detail_transaksi_keluar: Array<{ qty: number | null }> | null;
  }> ?? []).map((t) => ({
    no_transaksi: `#${t.no_transaksi}`,
    customer: t.pelanggan?.nama_pelanggan ?? null,
    time: new Date(t.tgl_transaksi).toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }),
    items: (t.detail_transaksi_keluar ?? []).reduce(
      (sum, d) => sum + Number(d.qty ?? 0),
      0
    ),
    total: Number(t.total),
    status:
      t.bayar >= t.total ? "Selesai" : t.bayar > 0 ? "Sebagian" : "Tertunda",
  }));

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
    return {
      id: a.id,
      waktu: formatWaktuRelatif(a.created_at, now),
      pengguna: a.pengguna?.nama || a.pengguna?.username || `User #...`,
      aksi: a.aksi,
      entitas: a.entitas,
      deskripsi: truncateDeskripsi(a.deskripsi),
    };
  });

  return {
    todayRevenue,
    yesterdayRevenue,
    revenueChangePercent: Math.round(revenueChangePercent * 100) / 100,
    todayOrders,
    avgTicket: Math.round(avgTicket * 100) / 100,
    recentTransactions,
    sparklineData,
    recentActivity,
  };
}

/**
 * Ringkasan keuangan bulan berjalan (K3-04).
 *
 * SENGAJA dipisah dari `getDashboardData()` dan dipanggil dari `<Suspense>`
 * di halaman dashboard. `generateLabaRugi()` adalah rantai query + RPC yang
 * berurutan (penjualan, selisih kas, pembelian, retur, detail retur,
 * persediaan akhir, pengeluaran). Dulu seluruh halaman dashboard menunggu
 * rantai itu selesai hanya untuk menampilkan dua angka; sekarang konten utama
 * (pendapatan, pesanan, stok menipis, transaksi terbaru) dirender lebih dulu
 * dan ringkasan keuangan menyusul.
 *
 * Kegagalan di sini tidak boleh menjatuhkan halaman, jadi error dikembalikan
 * sebagai 0 (perilaku lama juga menelan error di sini).
 */
export async function getDashboardFinanceSummary(): Promise<DashboardFinanceSummaryData> {
  try {
    const supabase = await getServerSupabase();
    const monthStart = format(startOfMonth(new Date()), "yyyy-MM-dd");
    const today = format(new Date(), "yyyy-MM-dd");
    const labaRugi = await generateLabaRugi(supabase, monthStart, today);
    return {
      labaBersih: Number(labaRugi.hasil.laba_bersih || 0),
      bebanOperasional: Number(labaRugi.hasil.beban_operasional || 0),
    };
  } catch (e) {
    console.error("Failed to load month finance summary:", e);
    return { labaBersih: 0, bebanOperasional: 0 };
  }
}
