"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import React, { useState, useEffect } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
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
  CalendarDays,
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
  DollarSign,
  ClipboardCheck,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { NavLinkPending } from "@/components/nav-link-pending";
import { UserProfileCard } from "@/components/user-profile-card";
import logoPerusahaan from "@/public/login-logo.jpeg";
import { isAttendanceOnlyRole, isOwnerLike, isStaffRole, isManagementRole, KASIR_ROLE } from "@/lib/roles";

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
  // Umpan balik saat keluar: signOut + redirect butuh waktu di koneksi lambat.
  const [loggingOut, setLoggingOut] = useState(false);

  const isOwner = isOwnerLike(role);
  const isStaff = isStaffRole(role);
  const isManagement = isManagementRole(role);
  const isAttendanceOnly = isAttendanceOnlyRole(role);

  const lowStockItems = useLowStockRealtime();
  const lowStockCount = isManagement ? lowStockItems.length : 0;

  useEffect(() => {
     
    setIsMounted(true);
  }, []);

  const handleLogout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await supabase.auth.signOut();
      router.push("/");
      router.refresh();
    } finally {
      setLoggingOut(false);
    }
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

      {/*
        Link sengaja TIDAK memakai prefetch={true}. Prefetch paksa mengambil
        payload RSC penuh untuk semua link yang terlihat sekaligus, dan itu
        berebut bandwidth dengan halaman yang sedang dibuka — merugikan pada
        koneksi lambat. Prefetch bawaan Next (berbasis intent: hover/masuk
        viewport) sudah cukup cepat dan jauh lebih hemat.
      */}
      <nav className="flex flex-col gap-1 flex-1 overflow-y-auto pr-2 custom-scrollbar">
        {role !== KASIR_ROLE && (
          <Link href="/dashboard" className={linkClass("/dashboard")}>
            <LayoutGrid className="w-5 h-5" />
            <span className="text-sm">Ringkasan</span>
            <NavLinkPending />
          </Link>
        )}

        {role === KASIR_ROLE && (
          <>
            <Link href="/pos" className={linkClass("/pos")}>
              <CircleDollarSign className="w-5 h-5" />
              <span className="text-sm">Penjualan</span>
              <NavLinkPending />
            </Link>
            <Link href="/dashboard/buka-kasir" className={linkClass("/dashboard/buka-kasir")}>
              <Wallet className="w-5 h-5" />
              <span className="text-sm">Buka Kasir</span>
              <NavLinkPending />
            </Link>
            <Link href="/dashboard/tutup-kasir" className={linkClass("/dashboard/tutup-kasir")}>
              <Calculator className="w-5 h-5" />
              <span className="text-sm">Tutup Kasir</span>
              <NavLinkPending />
            </Link>
            <Link href="/dashboard/transactions" className={linkClass("/dashboard/transactions")}>
              <Receipt className="w-5 h-5" />
              <span className="text-sm">Riwayat Transaksi</span>
              <NavLinkPending />
            </Link>
          </>
        )}

        {isManagement && (
          <>
            <Link href="/dashboard/transactions" className={linkClass("/dashboard/transactions")}>
              <Receipt className="w-5 h-5" />
              <span className="text-sm">Riwayat Transaksi</span>
              <NavLinkPending />
            </Link>

            <Link href="/dashboard/customers" className={linkClass("/dashboard/customers")}>
              <Users className="w-5 h-5" />
              <span className="text-sm">Pelanggan</span>
              <NavLinkPending />
            </Link>

            <Link href="/dashboard/suppliers" className={linkClass("/dashboard/suppliers")}>
              <Truck className="w-5 h-5" />
              <span className="text-sm">Supplier</span>
              <NavLinkPending />
            </Link>

            <Link href="/dashboard/po-custom" className={linkClass("/dashboard/po-custom")}>
              <ClipboardList className="w-5 h-5" />
              <span className="text-sm">PO Custom</span>
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
                <Link href="/dashboard/inventory" className={subLinkClass("/dashboard/inventory")}>
                  <PackageOpen className="w-4 h-4" />
                  <span>Produk</span>
                  <NavLinkPending />
                </Link>
                <Link href="/dashboard/inventory/stock-in" className={subLinkClass("/dashboard/inventory/stock-in")}>
                  <PackagePlus className="w-4 h-4" />
                  <span>Barang Masuk</span>
                  <NavLinkPending />
                </Link>
                <Link href="/dashboard/inventory/stock-in/history" className={subLinkClass("/dashboard/inventory/stock-in/history")}>
                  <Receipt className="w-4 h-4" />
                  <span>Riwayat Barang Masuk</span>
                  <NavLinkPending />
                </Link>
                {isOwner && (
                  <Link href="/dashboard/inventory/stock-in/tentukan-harga" className={subLinkClass("/dashboard/inventory/stock-in/tentukan-harga")}>
                    <DollarSign className="w-4 h-4" />
                    <span>Tentukan Harga</span>
                    <NavLinkPending />
                  </Link>
                )}
                <Link href="/dashboard/inventory/stock-in/retur" className={subLinkClass("/dashboard/inventory/stock-in/retur")}>
                  <RotateCcw className="w-4 h-4" />
                  <span>Retur Barang</span>
                  <NavLinkPending />
                </Link>
                <Link href="/dashboard/inventory/stock-in/retur/history" className={subLinkClass("/dashboard/inventory/stock-in/retur/history")}>
                  <Receipt className="w-4 h-4" />
                  <span>Riwayat Retur</span>
                  <NavLinkPending />
                </Link>
                <Link href="/dashboard/inventory/stock-opname" className={subLinkClass("/dashboard/inventory/stock-opname")}>
                  <ClipboardList className="w-4 h-4" />
                  <span>Stok Opname</span>
                  <NavLinkPending />
                </Link>
                <Link href="/dashboard/inventory/stock-opname/history" className={subLinkClass("/dashboard/inventory/stock-opname/history")}>
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
                <Link href="/dashboard/reports" className={subLinkClass("/dashboard/reports")}>
                  <BarChart3 className="w-4 h-4" />
                  <span>Ringkasan</span>
                  <NavLinkPending />
                </Link>
                {isManagement && (
                  <Link href="/dashboard/laporan/analisis-produk" className={subLinkClass("/dashboard/laporan/analisis-produk")}>
                    <BarChart3 className="w-4 h-4" />
                    <span>Analisis Produk</span>
                    <NavLinkPending />
                  </Link>
                )}
                {isOwner && (
                  <>
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
                    <Link href="/dashboard/laporan/pergerakan-harga" className={subLinkClass("/dashboard/laporan/pergerakan-harga")}>
                      <TrendingUp className="w-4 h-4" />
                      <span>Pergerakan Harga</span>
                      <NavLinkPending />
                    </Link>
                  </>
                )}
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
                <Link href="/dashboard/keuangan/kas-admin" className={linkClass("/dashboard/keuangan/kas-admin")}>
                  <Coins className="w-5 h-5" />
                  <span className="text-sm">Kas Admin</span>
                  <NavLinkPending />
                </Link>
                <Link href="/dashboard/laporan-kasir" className={linkClass("/dashboard/laporan-kasir")}>
                  <FileText className="w-5 h-5" />
                  <span className="text-sm">Riwayat Kas Harian</span>
                  <NavLinkPending />
                </Link>
                <Link href="/dashboard/keuangan/pengeluaran" className={linkClass("/dashboard/keuangan/pengeluaran")}>
                  <Wallet className="w-5 h-5" />
                  <span className="text-sm">Pengeluaran</span>
                  <NavLinkPending />
                </Link>
                {isOwner && (
                  <Link href="/dashboard/keuangan/arus-kas" className={linkClass("/dashboard/keuangan/arus-kas")}>
                    <ArrowLeftRight className="w-5 h-5" />
                    <span className="text-sm">Arus Kas</span>
                    <NavLinkPending />
                  </Link>
                )}
              </div>
            </div>

            <div className="mt-4 pt-4 border-t border-border/50">
              <div className="px-3 mb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Tools
              </div>
              <div className="flex flex-col gap-1">
                <Link href="/dashboard/label-generator" className={linkClass("/dashboard/label-generator")}>
                  <Tag className="w-5 h-5" />
                  <span className="text-sm">Pricetag Generator</span>
                  <NavLinkPending />
                </Link>
                <Link href="/dashboard/product-label" className={linkClass("/dashboard/product-label")}>
                  <Printer className="w-5 h-5" />
                  <span className="text-sm">Cetak Label Produk</span>
                  <NavLinkPending />
                </Link>
                <Link href="/dashboard/event-promo" className={linkClass("/dashboard/event-promo")}>
                  <Tag className="w-5 h-5" />
                  <span className="text-sm">Event Promo</span>
                  <NavLinkPending />
                </Link>
                <Link href="/dashboard/log-aktivitas" className={linkClass("/dashboard/log-aktivitas")}>
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
              <Link href="/dashboard/attendance/scan" className={linkClass("/dashboard/attendance/scan")}>
                <Camera className="w-5 h-5" />
                <span className="text-sm">Scan QR Absensi</span>
                <NavLinkPending />
              </Link>
              <Link href="/dashboard/attendance/history" className={linkClass("/dashboard/attendance/history")}>
                <UserCheck className="w-5 h-5" />
                <span className="text-sm">Riwayat Absen</span>
                <NavLinkPending />
              </Link>
              <Link href="/dashboard/jadwal-saya" className={linkClass("/dashboard/jadwal-saya")}>
                <CalendarDays className="w-5 h-5" />
                <span className="text-sm">Jadwal Saya</span>
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
              <Link href="/dashboard/attendance/generate-qr" className={linkClass("/dashboard/attendance/generate-qr")}>
                <QrCode className="w-5 h-5" />
                <span className="text-sm">Generate QR</span>
                <NavLinkPending />
              </Link>
              <Link href="/dashboard/attendance/manual" className={linkClass("/dashboard/attendance/manual")}>
                <ClipboardCheck className="w-5 h-5" />
                <span className="text-sm">Absen Manual</span>
                <NavLinkPending />
              </Link>
              <Link href="/dashboard/attendance/report" className={linkClass("/dashboard/attendance/report")}>
                <UserCheck className="w-5 h-5" />
                <span className="text-sm">Laporan Pegawai</span>
                <NavLinkPending />
              </Link>
              <Link href="/dashboard/jadwal-karyawan" className={linkClass("/dashboard/jadwal-karyawan")}>
                <CalendarDays className="w-5 h-5" />
                <span className="text-sm">Jadwal Karyawan</span>
                <NavLinkPending />
              </Link>
            </div>
          </div>
        )}
      </nav>

      <div className="mt-auto pt-6 border-t border-border">
        {role !== KASIR_ROLE && (
          <UserProfileCard
            userName={userName}
            role={role}
            className="px-3 py-3 mb-4 rounded-xl bg-muted/60 border border-border/60"
          />
        )}

        <div className="flex flex-col gap-2">
          {!isAttendanceOnly && role !== KASIR_ROLE && bottomLinks
            .filter((link) => isOwner || link.href !== "/dashboard/settings/keuangan")
            .map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href} className={linkClass(href)}>
              <Icon className="w-5 h-5" />
              <span className="text-sm">{label}</span>
              <NavLinkPending />
            </Link>
          ))}
          
          <button 
            onClick={handleLogout} 
            disabled={loggingOut}
            className="flex items-center gap-3 px-3 py-2.5 rounded-md text-destructive hover:bg-destructive/10 transition-colors w-full text-left mt-2 disabled:opacity-60"
          >
            {loggingOut ? <Loader2 className="w-5 h-5 animate-spin" /> : <LogOut className="w-5 h-5" />}
            <span className="text-sm font-medium">{loggingOut ? "Keluar..." : "Keluar"}</span>
          </button>
        </div>
      </div>
    </aside>
  );
});
