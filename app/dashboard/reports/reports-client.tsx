"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { 
  BarChart3, 
  TrendingUp, 
  ShoppingCart, 
  DollarSign, 
  ArrowUpRight, 
  Download
} from "lucide-react";
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle,
  CardDescription 
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { exportToCSV, exportToPDF } from "@/lib/export-utils";

function formatIDR(n: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
}

function formatNumber(n: number) {
  return new Intl.NumberFormat("id-ID").format(n);
}

interface ReportTransaction {
  id: number;
  tgl_transaksi: string;
  total: number;
  bayar: number;
}

interface ReportDetail {
  id_transaksi: number;
  id_produk: number;
  qty: number;
  jumlah: number;
  profit: number;
  produk: { nama_produk: string } | null;
}

interface ReportProduct {
  stok: number;
  harga_modal: number;
  hitung_stok: boolean;
  stok_minimum: number;
}

interface ReportsClientProps {
  transactions: ReportTransaction[];
  details: ReportDetail[];
  products: ReportProduct[];
}

export default function ReportsClient({ transactions, details, products }: ReportsClientProps) {
  const [dateRange, setDateRange] = useState("30"); // "7", "30", "all"

  const filteredTransactions = useMemo(() => {
    if (dateRange === "all") return transactions;
    const now = new Date();
    const days = parseInt(dateRange);
    const cutoff = new Date(now.setDate(now.getDate() - days));
    return transactions.filter(t => new Date(t.tgl_transaksi) >= cutoff);
  }, [transactions, dateRange]);

  const stats = useMemo(() => {
    const totalRevenue = filteredTransactions.reduce((acc, t) => acc + Number(t.total), 0);
    const orderCount = filteredTransactions.length;
    const avgTicket = orderCount > 0 ? totalRevenue / orderCount : 0;

    // Get detail IDs for filtered transactions
    const transIds = new Set(filteredTransactions.map(t => t.id));
    const filteredDetails = details.filter(d => transIds.has(d.id_transaksi));
    const totalProfit = filteredDetails.reduce((acc, d) => acc + Number(d.profit), 0);

    return {
      totalRevenue,
      orderCount,
      avgTicket,
      totalProfit
    };
  }, [filteredTransactions, details]);

  const topProducts = useMemo(() => {
    const transIds = new Set(filteredTransactions.map(t => t.id));
    const filteredDetails = details.filter(d => transIds.has(d.id_transaksi));

    const productMap = new Map();
    filteredDetails.forEach(d => {
      const existing = productMap.get(d.id_produk) || { 
        name: d.produk?.nama_produk || "Produk Terhapus",
        qty: 0, 
        revenue: 0 
      };
      productMap.set(d.id_produk, {
        ...existing,
        qty: existing.qty + Number(d.qty),
        revenue: existing.revenue + Number(d.jumlah)
      });
    });

    return Array.from(productMap.values())
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);
  }, [filteredTransactions, details]);

  const stockStats = useMemo(() => {
    const totalStockValue = products.reduce((acc, p) => {
      const stock = Number(p.stok || 0);
      return acc + (stock * Number(p.harga_modal));
    }, 0);

    const lowStockItems = products.filter(p => p.hitung_stok && Number(p.stok || 0) <= Number(p.stok_minimum)).length;

    return {
      totalStockValue,
      lowStockItems
    };
  }, [products]);

  const handleExportCSV = () => {
    const headers = ["Produk", "Qty Terjual", "Pendapatan"];
    const data = topProducts.map(p => [
      p.name,
      p.qty,
      p.revenue
    ]);
    exportToCSV("Laporan_Produk_Terlaris", headers, data);
  };

  const handleExportPDF = () => {
    const headers = ["Produk", "Qty Terjual", "Pendapatan"];
    const data = topProducts.map(p => [
      p.name,
      p.qty,
      formatIDR(p.revenue)
    ]);
    exportToPDF("Laporan_Produk_Terlaris", "Laporan Produk Terlaris", headers, data);
  };

  return (
    <div className="flex flex-col gap-8 pb-12">
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        <div className="flex items-center gap-1 sm:gap-2 bg-muted/50 p-1 rounded-lg border border-border w-full sm:w-auto">
          <Button 
            variant={dateRange === "7" ? "secondary" : "ghost"} 
            size="sm" 
            onClick={() => setDateRange("7")}
            className="rounded-md h-8 text-xs font-medium flex-1 sm:flex-none"
          >
            7 Hari
          </Button>
          <Button 
            variant={dateRange === "30" ? "secondary" : "ghost"} 
            size="sm" 
            onClick={() => setDateRange("30")}
            className="rounded-md h-8 text-xs font-medium flex-1 sm:flex-none"
          >
            30 Hari
          </Button>
          <Button 
            variant={dateRange === "all" ? "secondary" : "ghost"} 
            size="sm" 
            onClick={() => setDateRange("all")}
            className="rounded-md h-8 text-xs font-medium flex-1 sm:flex-none"
          >
            Semua
          </Button>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Button variant="outline" size="sm" className="flex-1 sm:flex-none gap-2 h-9 rounded-full border-border" onClick={handleExportCSV}>
            <Download className="w-4 h-4" />
            CSV
          </Button>
          <Button variant="outline" size="sm" className="flex-1 sm:flex-none gap-2 h-9 rounded-full border-border" onClick={handleExportPDF}>
            <Download className="w-4 h-4" />
            PDF
          </Button>
        </div>
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="bg-background border border-border rounded-[12px] shadow-[0_1px_3px_rgba(0,55,112,0.08)] overflow-hidden group">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 group-hover:bg-blue-100 transition-colors">
                <DollarSign className="w-5 h-5" />
              </div>
              <Badge variant="outline" className="text-[10px] font-medium border-emerald-100 text-emerald-600 bg-emerald-50/50">
                +12.5%
              </Badge>
            </div>
            <p className="text-sm font-medium text-muted-foreground">Total Pendapatan</p>
            <h3 className="text-2xl font-semibold tracking-tight mt-1">{formatIDR(stats.totalRevenue)}</h3>
          </CardContent>
        </Card>

        <Card className="bg-background border border-border rounded-[12px] shadow-[0_1px_3px_rgba(0,55,112,0.08)] overflow-hidden group">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600 group-hover:bg-emerald-100 transition-colors">
                <TrendingUp className="w-5 h-5" />
              </div>
              <Badge variant="outline" className="text-[10px] font-medium border-emerald-100 text-emerald-600 bg-emerald-50/50">
                +8.2%
              </Badge>
            </div>
            <p className="text-sm font-medium text-muted-foreground">Total Laba Kotor</p>
            <h3 className="text-2xl font-semibold tracking-tight mt-1">{formatIDR(stats.totalProfit)}</h3>
          </CardContent>
        </Card>

        <Card className="bg-background border border-border rounded-[12px] shadow-[0_1px_3px_rgba(0,55,112,0.08)] overflow-hidden group">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="w-10 h-10 rounded-full bg-amber-50 flex items-center justify-center text-amber-600 group-hover:bg-amber-100 transition-colors">
                <ShoppingCart className="w-5 h-5" />
              </div>
            </div>
            <p className="text-sm font-medium text-muted-foreground">Jumlah Pesanan</p>
            <h3 className="text-2xl font-semibold tracking-tight mt-1">{formatNumber(stats.orderCount)}</h3>
          </CardContent>
        </Card>

        <Card className="bg-background border border-border rounded-[12px] shadow-[0_1px_3px_rgba(0,55,112,0.08)] overflow-hidden group">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="w-10 h-10 rounded-full bg-purple-50 flex items-center justify-center text-purple-600 group-hover:bg-purple-100 transition-colors">
                <ArrowUpRight className="w-5 h-5" />
              </div>
            </div>
            <p className="text-sm font-medium text-muted-foreground">Rata-rata Penjualan</p>
            <h3 className="text-2xl font-semibold tracking-tight mt-1">{formatIDR(stats.avgTicket)}</h3>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Top Products */}
        <Card className="lg:col-span-2 bg-background border border-border rounded-[12px] shadow-[0_1px_3px_rgba(0,55,112,0.08)] overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-xl font-medium">Produk Terlaris</CardTitle>
              <CardDescription>Berdasarkan total pendapatan</CardDescription>
            </div>
            <BarChart3 className="w-5 h-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-6">Produk</TableHead>
                  <TableHead className="text-right">Qty Terjual</TableHead>
                  <TableHead className="text-right pr-6">Pendapatan</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {topProducts.map((p, i) => (
                  <TableRow key={i}>
                    <TableCell className="pl-6">{p.name}</TableCell>
                    <TableCell className="text-right">{formatNumber(p.qty)}</TableCell>
                    <TableCell className="text-right pr-6">{formatIDR(p.revenue)}</TableCell>
                  </TableRow>
                ))}
                {topProducts.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center py-8">
                      Tidak ada data penjualan pada periode ini
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Stock Status */}
        <Card className="bg-background border border-border rounded-[12px] shadow-[0_1px_3px_rgba(0,55,112,0.08)] overflow-hidden">
          <CardHeader>
            <CardTitle className="text-xl font-medium">Status Inventaris</CardTitle>
            <CardDescription>Ringkasan stok saat ini</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex flex-col gap-1">
              <p className="text-sm text-muted-foreground">Total Nilai Stok (Harga Modal)</p>
              <h3 className="text-2xl font-semibold tracking-tight">{formatIDR(stockStats.totalStockValue)}</h3>
            </div>
            
            <div className="pt-4 border-t border-border">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Stok Menipis</span>
                <Badge variant={stockStats.lowStockItems > 0 ? "destructive" : "secondary"}>
                  {stockStats.lowStockItems} Produk
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">Produk dengan stok di bawah batas minimum</p>
            </div>

            <Button asChild variant="outline" className="w-full mt-4 h-10 rounded-full">
              <Link href="/dashboard/inventory">Kelola Inventaris</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
