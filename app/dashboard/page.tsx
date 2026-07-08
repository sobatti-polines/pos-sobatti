import { getDashboardData } from "@/lib/dashboard";
import { TrendingUp, TrendingDown, CheckCircle2, Clock, CalendarDays } from "lucide-react";
import { DashboardLowStock } from "@/components/dashboard-low-stock";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LogoutButton } from "@/components/logout-button";
import { AttendanceWidget } from "@/components/attendance-widget";
import { createClient } from "@/lib/supabase/server";
import { getTodayAttendance, getMonthlyAttendanceStats } from "@/lib/attendance";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const attendanceData = await getTodayAttendance();

  const role = user?.user_metadata?.role;
  const isOwner = role === "OWNER";
  const isKaryawan = role === "KARYAWAN";

  if (isKaryawan) {
    const stats = await getMonthlyAttendanceStats();
    const monthName = new Date().toLocaleDateString("id-ID", { month: "long", year: "numeric" });

    return (
      <div className="flex-1 p-8 lg:p-12 w-full flex flex-col gap-8 mx-auto">
        <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <h1 className="text-4xl font-light tracking-tight text-foreground">
              Ringkasan Absensi
            </h1>
            <p className="text-muted-foreground mt-1">Pantau kehadiran Anda</p>
          </div>
        </header>

        <AttendanceWidget initialData={attendanceData} />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="border-none shadow-sm bg-emerald-50/50">
            <CardContent className="p-6 flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-6 h-6 text-emerald-700" />
              </div>
              <div>
                <p className="text-2xl font-light tabular-nums text-emerald-800">{stats?.hadir ?? 0}</p>
                <p className="text-sm text-emerald-600">Hadir</p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-none shadow-sm bg-amber-50/50">
            <CardContent className="p-6 flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
                <Clock className="w-6 h-6 text-amber-700" />
              </div>
              <div>
                <p className="text-2xl font-light tabular-nums text-amber-800">{stats?.telat ?? 0}</p>
                <p className="text-sm text-amber-600">Terlambat</p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-none shadow-sm bg-blue-50/50">
            <CardContent className="p-6 flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                <CalendarDays className="w-6 h-6 text-blue-700" />
              </div>
              <div>
                <p className="text-2xl font-light tabular-nums text-blue-800">{stats?.total ?? 0}</p>
                <p className="text-sm text-blue-600">Total Hari</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <p className="text-sm text-muted-foreground text-center">
          Ringkasan absensi bulan {monthName}
        </p>

        <div className="flex justify-center mt-2">
          <Button asChild variant="outline" className="rounded-full px-6">
            <Link href="/dashboard/attendance/history">
              Lihat Riwayat Lengkap
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  const dashboardData = await getDashboardData();

  return (
    <div className="flex-1 p-8 lg:p-12 w-full flex flex-col gap-8 mx-auto">
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

        <DashboardLowStock />
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
