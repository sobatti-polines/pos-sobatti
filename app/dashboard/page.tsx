import { getDashboardData } from "@/lib/dashboard";
import { TrendingUp, TrendingDown, Package, Coffee, CupSoda, Croissant, Plus, User } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LogoutButton } from "@/components/logout-button";
import { AttendanceWidget } from "@/components/attendance-widget";
import { createClient } from "@/lib/supabase/server";
import { getTodayAttendance } from "@/lib/attendance";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

function formatIDR(n: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
}

const stockIcons: Record<number, { icon: typeof Package; bg: string; color: string }> = {};
function getStockIcon(name: string) {
  const lower = name.toLowerCase();
  if (lower.includes("semen") || lower.includes("mortar"))
    return { icon: Package, bg: "bg-amber-100/50", color: "text-amber-700" };
  if (lower.includes("cat") || lower.includes("plamur"))
    return { icon: CupSoda, bg: "bg-sky-100/50", color: "text-sky-700" };
  if (lower.includes("besi") || lower.includes("baja") || lower.includes("paku"))
    return { icon: Package, bg: "bg-slate-100", color: "text-slate-600" };
  if (lower.includes("kayu") || lower.includes("triplek"))
    return { icon: Package, bg: "bg-amber-100/50", color: "text-amber-800" };
  if (lower.includes("pipa"))
    return { icon: Package, bg: "bg-emerald-100/50", color: "text-emerald-700" };
  if (lower.includes("keramik") || lower.includes("granit"))
    return { icon: Package, bg: "bg-rose-100/50", color: "text-rose-700" };
  if (lower.includes("kabel") || lower.includes("mcb"))
    return { icon: Package, bg: "bg-indigo-100/50", color: "text-indigo-700" };
  if (lower.includes("closet") || lower.includes("shower") || lower.includes("keran"))
    return { icon: Croissant, bg: "bg-blue-100/50", color: "text-blue-700" };
  return { icon: Package, bg: "bg-slate-100", color: "text-slate-600" };
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const dashboardData = await getDashboardData();
  const attendanceData = await getTodayAttendance();

  const role = user?.user_metadata?.role;
  const isOwner = role === "OWNER";

  return (
    <div className="flex-1 p-8 lg:p-12 w-full flex flex-col gap-16 mx-auto">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h1 className="text-4xl font-light tracking-tight text-foreground">
            Ringkasan
          </h1>
        </div>
      </header>

      {!isOwner && <AttendanceWidget initialData={attendanceData} />}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-16">
        <section className="flex flex-col">
          <h3 className="text-sm font-medium text-muted-foreground mb-6 uppercase tracking-widest">Pendapatan Hari Ini</h3>
          <div className="mb-8">
            <h2 className="text-7xl font-light tracking-tight tabular-nums text-foreground mb-4">
              {formatIDR(dashboardData.todayRevenue)}
            </h2>
            <div className="flex items-center text-sm">
              {dashboardData.revenueChangePercent >= 0 ? (
                <>
                  <TrendingUp className="w-4 h-4 text-emerald-600 mr-2" />
                  <span className="text-emerald-600 font-medium tabular-nums">
                    +{dashboardData.revenueChangePercent}%
                  </span>
                </>
              ) : (
                <>
                  <TrendingDown className="w-4 h-4 text-red-600 mr-2" />
                  <span className="text-red-600 font-medium tabular-nums">
                    {dashboardData.revenueChangePercent}%
                  </span>
                </>
              )}
              <span className="text-muted-foreground ml-2">vs. Kemarin</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6 mb-8">
            <div>
              <p className="text-3xl font-light tabular-nums text-foreground">{dashboardData.todayOrders}</p>
              <p className="text-sm text-muted-foreground mt-1">Pesanan</p>
            </div>
            <div>
              <p className="text-3xl font-light tabular-nums text-foreground">{formatIDR(dashboardData.avgTicket)}</p>
              <p className="text-sm text-muted-foreground mt-1">Rata-rata</p>
            </div>
          </div>

          {dashboardData.sparklineData.length > 0 && (
            <div className="h-12 w-full flex items-end gap-1 mt-auto">
              {dashboardData.sparklineData.map((h, i) => (
                <div
                  key={i}
                  className="flex-1 bg-primary/10 rounded-t-sm"
                  style={{ height: `${Math.max(5, (h / Math.max(...dashboardData.sparklineData)) * 100)}%` }}
                />
              ))}
            </div>
          )}
        </section>

        <section className="flex flex-col">
          <div className="flex items-center gap-3 mb-6">
            <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-widest">Stok Menipis</h3>
            <Badge variant="secondary" className="font-normal bg-muted">{dashboardData.productsLow} item</Badge>
          </div>
          <div className="flex flex-col gap-2">
            {dashboardData.lowStockItems.length > 0 ? (
              dashboardData.lowStockItems.slice(0, 5).map((item) => {
                const { icon: Icon, bg, color } = getStockIcon(item.nama_produk);
                return (
                  <StockItem
                    key={item.id}
                    icon={<Icon className={`w-4 h-4 ${color}`} />}
                    bg={bg}
                    name={item.nama_produk}
                    left={item.stock}
                  />
                );
              })
            ) : (
              <p className="text-sm text-muted-foreground py-8 text-center">Semua stok masih aman</p>
            )}
          </div>
        </section>
      </div>

      <section>
        <h3 className="text-sm font-medium text-muted-foreground mb-6 uppercase tracking-widest">Transaksi Terbaru</h3>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[120px] px-0">ID Pesanan</TableHead>
                <TableHead>Pelanggan</TableHead>
                <TableHead>Waktu</TableHead>
                <TableHead>Item</TableHead>
                <TableHead>Total</TableHead>
                <TableHead className="text-right px-0">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="text-sm font-light">
              {dashboardData.recentTransactions.length > 0 ? (
                dashboardData.recentTransactions.map((tx) => (
                  <TransactionRow key={tx.no_transaksi} {...tx} />
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8">
                    Belum ada transaksi hari ini
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </section>
    </div>
  );
}

function StockItem({ icon, bg, name, left }: { icon: React.ReactNode; bg: string; name: string; left: number }) {
  return (
    <div className="flex items-center justify-between px-4 py-3 rounded-md hover:bg-muted/50 transition-colors">
      <div className="flex items-center gap-4">
        <div className={`w-10 h-10 rounded-md flex items-center justify-center ${bg}`}>
          {icon}
        </div>
        <div>
          <p className="text-sm font-medium text-foreground">{name}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{left} tersisa</p>
        </div>
      </div>
      <Link
        href="/dashboard/inventory"
        className="text-xs text-primary hover:underline"
      >
        Stok Ulang
      </Link>
    </div>
  );
}

function TransactionRow({ no_transaksi, customer, time, items, total, status }: {
  no_transaksi: string; customer: string | null; time: string; items: number; total: number; status: string;
}) {
  return (
    <TableRow>
      <TableCell className="px-0">{no_transaksi}</TableCell>
      <TableCell>{customer ?? "Umum"}</TableCell>
      <TableCell>{time}</TableCell>
      <TableCell>{items} item</TableCell>
      <TableCell>{formatIDR(total)}</TableCell>
      <TableCell className="text-right px-0">
        <Badge
          variant="secondary"
          className={`font-normal border-none hover:bg-muted/80 ${
            status === "Selesai"
              ? "bg-emerald-100/50 text-emerald-800"
              : status === "Sebagian"
                ? "bg-amber-100/50 text-amber-800"
                : "bg-muted text-foreground"
          }`}
        >
          {status}
        </Badge>
      </TableCell>
    </TableRow>
  );
}
