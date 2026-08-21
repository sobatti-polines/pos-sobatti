"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import React, { useState, useEffect } from "react";
import { AlertTriangle } from "lucide-react";
import { useLowStockRealtime } from "@/hooks/use-low-stock-realtime";
import { 
  LayoutGrid, 
  CircleDollarSign, 
  Package, 
  PackageOpen,
  PackagePlus,
  BarChart3, 
  Settings, 
  HelpCircle,
  Receipt,
  ClipboardList,
  Users,
  Truck,
  QrCode,
  UserCheck,
  Camera,
  LogOut,
  Calculator,
  FileText,
  TrendingUp,
  Scale,
  Landmark,
  Tag,
  Printer,
  History,
  RotateCcw,
  Wallet,
  ArrowLeftRight,
  Coins,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { NavLinkPending } from "@/components/nav-link-pending";
import { UserProfileCard } from "@/components/user-profile-card";
import logoPerusahaan from "@/public/login-logo.jpeg";

const bottomLinks = [
  { href: "/dashboard/settings", label: "Pengaturan", icon: Settings },
  { href: "/dashboard/settings/keuangan", label: "Keuangan", icon: Landmark },
  { href: "/dashboard/support", label: "Bantuan", icon: HelpCircle },
];

export const DashboardSidebar = React.memo(function DashboardSidebar({ role, userName }: { role?: string; userName?: string | null }) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  const [isMounted, setIsMounted] = useState(false);

  const isOwner = role === "OWNER";
  const isStaff = role === "ADMIN" || role === "KASIR" || role === "KARYAWAN";
  const isManagement = role === "OWNER" || role === "ADMIN";

  const lowStockItems = useLowStockRealtime();
  const lowStockCount = isManagement ? lowStockItems.length : 0;

  useEffect(() => {
     
    setIsMounted(true);
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  };

  if (!isMounted) return <aside className="w-64 shrink-0 border-r border-border bg-background hidden md:flex flex-col py-6 px-4" />;

  const isInventoryActive = pathname.startsWith("/dashboard/inventory");
  const isLaporanActive = pathname.startsWith("/dashboard/reports") || pathname.startsWith("/dashboard/laporan/");

  const linkClass = (href: string) => {
    let active = false;
    if (href === "/dashboard") {
      active = pathname === "/dashboard";
    } else if (href === "/dashboard/settings") {
      active = pathname.startsWith("/dashboard/settings") && !pathname.startsWith("/dashboard/settings/keuangan");
    } else {
      active = pathname.startsWith(href);
    }
    return active
      ? "flex items-center gap-3 px-3 py-2.5 rounded-md bg-primary/10 text-primary font-medium transition-colors"
      : "flex items-center gap-3 px-3 py-2.5 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors";
  };

  const subLinkClass = (href: string) => {
    const active = pathname === href;
    return active
      ? "flex items-center gap-3 px-3 py-2 rounded-md bg-primary/10 text-primary font-medium transition-colors text-sm"
      : "flex items-center gap-3 px-3 py-2 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors text-sm";
  };

  return (
    <aside className="w-64 shrink-0 border-r border-border bg-background hidden md:flex flex-col py-6 px-4 print:hidden">
      <div className="mb-10 flex items-center px-2">
        <Image
          src={logoPerusahaan}
          alt="Logo Perusahaan"
          width={36}
          height={36}
          className="h-9 w-auto object-contain mr-3 rounded-md"
        />
        <span className="text-xl font-light tracking-tight text-foreground">PLK POS</span>
      </div>

      <nav className="flex flex-col gap-1 flex-1 overflow-y-auto pr-2 custom-scrollbar">
        {role !== "KASIR" && (
          <Link href="/dashboard" className={linkClass("/dashboard")} prefetch={true}>
            <LayoutGrid className="w-5 h-5" />
            <span className="text-sm">Ringkasan</span>
            <NavLinkPending />
          </Link>
        )}

        {role === "KASIR" && (
          <>
            <Link href="/pos" className={linkClass("/pos")} prefetch={true}>
              <CircleDollarSign className="w-5 h-5" />
              <span className="text-sm">Penjualan</span>
              <NavLinkPending />
            </Link>
            <Link href="/dashboard/buka-kasir" className={linkClass("/dashboard/buka-kasir")} prefetch={true}>
              <Wallet className="w-5 h-5" />
              <span className="text-sm">Buka Kasir</span>
              <NavLinkPending />
            </Link>
            <Link href="/dashboard/tutup-kasir" className={linkClass("/dashboard/tutup-kasir")} prefetch={true}>
              <Calculator className="w-5 h-5" />
              <span className="text-sm">Tutup Kasir</span>
              <NavLinkPending />
            </Link>
            <Link href="/dashboard/transactions" className={linkClass("/dashboard/transactions")} prefetch={true}>
              <Receipt className="w-5 h-5" />
              <span className="text-sm">Riwayat Transaksi</span>
              <NavLinkPending />
            </Link>
          </>
        )}

        {isManagement && (
          <>
            <Link href="/dashboard/transactions" className={linkClass("/dashboard/transactions")} prefetch={true}>
              <Receipt className="w-5 h-5" />
              <span className="text-sm">Riwayat Transaksi</span>
              <NavLinkPending />
            </Link>

            <Link href="/dashboard/customers" className={linkClass("/dashboard/customers")} prefetch={true}>
              <Users className="w-5 h-5" />
              <span className="text-sm">Pelanggan</span>
              <NavLinkPending />
            </Link>

            <Link href="/dashboard/suppliers" className={linkClass("/dashboard/suppliers")} prefetch={true}>
              <Truck className="w-5 h-5" />
              <span className="text-sm">Supplier</span>
              <NavLinkPending />
            </Link>

            <div>
              <div
                className={`flex items-center gap-3 px-3 py-2.5 rounded-md transition-colors text-sm ${
                  isInventoryActive
                    ? "text-primary font-medium"
                    : "text-muted-foreground"
                }`}
              >
                <Package className="w-5 h-5" />
                <span className="text-sm flex-1 text-left">Inventaris</span>
                {lowStockCount > 0 && (
                  <span className="flex items-center gap-1 text-xs font-medium text-warning">
                    <AlertTriangle className="w-3 h-3" />
                    {lowStockCount}
                  </span>
                )}
              </div>

              <div className="ml-2 mt-1 flex flex-col gap-0.5 pl-6 border-l border-border/50">
                <Link href="/dashboard/inventory" className={subLinkClass("/dashboard/inventory")} prefetch={true}>
                  <PackageOpen className="w-4 h-4" />
                  <span>Produk</span>
                  <NavLinkPending />
                </Link>
                <Link href="/dashboard/inventory/stock-in" className={subLinkClass("/dashboard/inventory/stock-in")} prefetch={true}>
                  <PackagePlus className="w-4 h-4" />
                  <span>Barang Masuk</span>
                  <NavLinkPending />
                </Link>
                <Link href="/dashboard/inventory/stock-in/history" className={subLinkClass("/dashboard/inventory/stock-in/history")} prefetch={true}>
                  <Receipt className="w-4 h-4" />
                  <span>Riwayat Barang Masuk</span>
                  <NavLinkPending />
                </Link>
                <Link href="/dashboard/inventory/stock-in/retur" className={subLinkClass("/dashboard/inventory/stock-in/retur")} prefetch={true}>
                  <RotateCcw className="w-4 h-4" />
                  <span>Retur Barang</span>
                  <NavLinkPending />
                </Link>
                <Link href="/dashboard/inventory/stock-in/retur/history" className={subLinkClass("/dashboard/inventory/stock-in/retur/history")} prefetch={true}>
                  <Receipt className="w-4 h-4" />
                  <span>Riwayat Retur</span>
                  <NavLinkPending />
                </Link>
                <Link href="/dashboard/inventory/stock-opname" className={subLinkClass("/dashboard/inventory/stock-opname")} prefetch={true}>
                  <ClipboardList className="w-4 h-4" />
                  <span>Stok Opname</span>
                  <NavLinkPending />
                </Link>
                <Link href="/dashboard/inventory/stock-opname/history" className={subLinkClass("/dashboard/inventory/stock-opname/history")} prefetch={true}>
                  <Receipt className="w-4 h-4" />
                  <span>Riwayat Opname</span>
                  <NavLinkPending />
                </Link>
              </div>
            </div>

            <div>
              <div
                className={`flex items-center gap-3 px-3 py-2.5 rounded-md transition-colors text-sm ${
                  isLaporanActive
                    ? "text-primary font-medium"
                    : "text-muted-foreground"
                }`}
              >
                <BarChart3 className="w-5 h-5" />
                <span className="text-sm flex-1 text-left">Laporan</span>
              </div>

              <div className="ml-2 mt-1 flex flex-col gap-0.5 pl-6 border-l border-border/50">
                <Link href="/dashboard/reports" className={subLinkClass("/dashboard/reports")} prefetch={true}>
                  <BarChart3 className="w-4 h-4" />
                  <span>Ringkasan</span>
                  <NavLinkPending />
                </Link>
                <Link href="/dashboard/laporan/laba-rugi" className={subLinkClass("/dashboard/laporan/laba-rugi")}>
                  <TrendingUp className="w-4 h-4" />
                  <span>Laba Rugi</span>
                  <NavLinkPending />
                </Link>
                <Link href="/dashboard/laporan/neraca" className={subLinkClass("/dashboard/laporan/neraca")}>
                  <Scale className="w-4 h-4" />
                  <span>Neraca</span>
                  <NavLinkPending />
                </Link>
                <Link href="/dashboard/laporan/stok-opname" className={subLinkClass("/dashboard/laporan/stok-opname")}>
                  <ClipboardList className="w-4 h-4" />
                  <span>Stok Opname</span>
                  <NavLinkPending />
                </Link>
                <Link href="/dashboard/laporan/kas" className={subLinkClass("/dashboard/laporan/kas")}>
                  <Coins className="w-4 h-4" />
                  <span>Laporan Kas</span>
                  <NavLinkPending />
                </Link>
              </div>
            </div>

            <div className="mt-4 pt-4 border-t border-border/50">
              <div className="px-3 mb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Kasir & Keuangan
              </div>
              <div className="flex flex-col gap-1">
                <Link href="/dashboard/keuangan/kas-admin" className={linkClass("/dashboard/keuangan/kas-admin")} prefetch={true}>
                  <Coins className="w-5 h-5" />
                  <span className="text-sm">Kas Admin</span>
                  <NavLinkPending />
                </Link>
                <Link href="/dashboard/laporan-kasir" className={linkClass("/dashboard/laporan-kasir")}>
                  <FileText className="w-5 h-5" />
                  <span className="text-sm">Riwayat Kas Harian</span>
                  <NavLinkPending />
                </Link>
                <Link href="/dashboard/keuangan/pengeluaran" className={linkClass("/dashboard/keuangan/pengeluaran")} prefetch={true}>
                  <Wallet className="w-5 h-5" />
                  <span className="text-sm">Pengeluaran</span>
                  <NavLinkPending />
                </Link>
                <Link href="/dashboard/keuangan/arus-kas" className={linkClass("/dashboard/keuangan/arus-kas")}>
                  <ArrowLeftRight className="w-5 h-5" />
                  <span className="text-sm">Arus Kas</span>
                  <NavLinkPending />
                </Link>
              </div>
            </div>

            <div className="mt-4 pt-4 border-t border-border/50">
              <div className="px-3 mb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Tools
              </div>
              <div className="flex flex-col gap-1">
                <Link href="/dashboard/label-generator" className={linkClass("/dashboard/label-generator")} prefetch={true}>
                  <Tag className="w-5 h-5" />
                  <span className="text-sm">Pricetag Generator</span>
                  <NavLinkPending />
                </Link>
                <Link href="/dashboard/product-label" className={linkClass("/dashboard/product-label")} prefetch={true}>
                  <Printer className="w-5 h-5" />
                  <span className="text-sm">Cetak Label Produk</span>
                  <NavLinkPending />
                </Link>
                <Link href="/dashboard/event-promo" className={linkClass("/dashboard/event-promo")} prefetch={true}>
                  <Tag className="w-5 h-5" />
                  <span className="text-sm">Event Promo</span>
                  <NavLinkPending />
                </Link>
                <Link href="/dashboard/log-aktivitas" className={linkClass("/dashboard/log-aktivitas")} prefetch={true}>
                  <History className="w-5 h-5" />
                  <span className="text-sm">Log Aktivitas</span>
                  <NavLinkPending />
                </Link>
              </div>
            </div>
          </>
        )}

        {/* Attendance section for Staff (ADMIN/KASIR) */}
        {isStaff && (
          <div className="mt-4 pt-4 border-t border-border/50">
            <div className="px-3 mb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Absensi Saya
            </div>
            <div className="flex flex-col gap-1">
              <Link href="/dashboard/attendance/scan" className={linkClass("/dashboard/attendance/scan")} prefetch={true}>
                <Camera className="w-5 h-5" />
                <span className="text-sm">Scan QR Absensi</span>
                <NavLinkPending />
              </Link>
              <Link href="/dashboard/attendance/history" className={linkClass("/dashboard/attendance/history")} prefetch={true}>
                <UserCheck className="w-5 h-5" />
                <span className="text-sm">Riwayat Absen</span>
                <NavLinkPending />
              </Link>
            </div>
          </div>
        )}

        {/* Admin/Owner section for OWNER */}
        {isOwner && (
          <div className="mt-4 pt-4 border-t border-border/50">
            <div className="px-3 mb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Manajemen Absensi
            </div>
            <div className="flex flex-col gap-1">
              <Link href="/dashboard/attendance/generate-qr" className={linkClass("/dashboard/attendance/generate-qr")} prefetch={true}>
                <QrCode className="w-5 h-5" />
                <span className="text-sm">Generate QR</span>
                <NavLinkPending />
              </Link>
              <Link href="/dashboard/attendance/report" className={linkClass("/dashboard/attendance/report")} prefetch={true}>
                <UserCheck className="w-5 h-5" />
                <span className="text-sm">Laporan Pegawai</span>
                <NavLinkPending />
              </Link>
            </div>
          </div>
        )}
      </nav>

      <div className="mt-auto pt-6 border-t border-border">
        {role !== "KASIR" && (
          <UserProfileCard
            userName={userName}
            role={role}
            className="px-3 py-3 mb-4 rounded-xl bg-muted/60 border border-border/60"
          />
        )}

        <div className="flex flex-col gap-2">
          {role !== "KASIR" && role !== "KARYAWAN" && bottomLinks.map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href} className={linkClass(href)} prefetch={true}>
              <Icon className="w-5 h-5" />
              <span className="text-sm">{label}</span>
              <NavLinkPending />
            </Link>
          ))}
          
          <button 
            onClick={handleLogout} 
            className="flex items-center gap-3 px-3 py-2.5 rounded-md text-destructive hover:bg-destructive/10 transition-colors w-full text-left mt-2"
          >
            <LogOut className="w-5 h-5" />
            <span className="text-sm font-medium">Keluar</span>
          </button>
        </div>
      </div>
    </aside>
  );
});
