"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import React, { useState, useEffect } from "react";
import logoPerusahaan from "@/public/login-logo.jpeg";
import { 
  Loader2,
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
  Menu,
  X,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  Camera,
  CalendarDays,
  UserCheck,
  QrCode,
  LogOut,
  TrendingUp,
  Scale,
  Tag,
  ScanLine,
  History,
  Calculator,
  FileText,
  Landmark,
  Printer,
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
import { Button } from "@/components/ui/button";
import { isAttendanceOnlyRole, isManagementRole, isOwnerLike, isStaffRole, KASIR_ROLE } from "@/lib/roles";

const bottomLinks = [
  { href: "/dashboard/settings", label: "Pengaturan", icon: Settings },
  { href: "/dashboard/settings/keuangan", label: "Keuangan", icon: Landmark },
  { href: "/dashboard/support", label: "Bantuan", icon: HelpCircle },
];

export const DashboardMobileNav = React.memo(function DashboardMobileNav({ role, userName }: { role?: string; userName?: string | null }) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const [isOpen, setIsOpen] = useState(false);
  // Umpan balik saat keluar: signOut + redirect butuh waktu di koneksi lambat.
  const [loggingOut, setLoggingOut] = useState(false);

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

  // Close the menu when pathname changes
  useEffect(() => {
     
    setIsOpen(false);
  }, [pathname]);

  // Prevent body scroll when menu is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

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
      ? "flex items-center gap-3 px-3 py-3 rounded-md bg-primary/10 text-primary font-medium transition-colors"
      : "flex items-center gap-3 px-3 py-3 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors";
  };

  const subLinkClass = (href: string) => {
    const active = pathname === href;
    return active
      ? "flex items-center gap-3 px-3 py-2.5 rounded-md bg-primary/10 text-primary font-medium transition-colors text-sm"
      : "flex items-center gap-3 px-3 py-2.5 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors text-sm";
  };

  const isOwner = isOwnerLike(role);
  const isStaff = isStaffRole(role);
  const isManagement = isManagementRole(role);
  const isAttendanceOnly = isAttendanceOnlyRole(role);

  return (
    <>
      {/* Mobile Header */}
      <header className="md:hidden flex items-center justify-between gap-3 px-4 py-3 border-b border-border bg-background shrink-0 z-40 sticky top-0 print:hidden">
        <div className="flex items-center min-w-0">
          <Image
            src={logoPerusahaan}
            alt="Logo Perusahaan"
            width={36}
            height={36}
            className="h-9 w-auto object-contain mr-3 rounded-md shrink-0"
          />
          <span className="text-xl font-light tracking-tight text-foreground truncate">PLK POS</span>
        </div>
        <div className="flex items-center gap-2 min-w-0">
          {role !== KASIR_ROLE && (
            <UserProfileCard
              userName={userName}
              role={role}
              compact
              className="px-2.5 py-1.5 rounded-full bg-muted/60 border border-border/60 max-w-[45vw]"
            />
          )}
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => setIsOpen(true)}
            aria-label="Buka menu navigasi"
            className="shrink-0"
          >
            <Menu className="h-6 w-6" />
          </Button>
        </div>
      </header>

      {/* Mobile Menu Overlay */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-background/80 backdrop-blur-sm" 
            onClick={() => setIsOpen(false)}
            aria-hidden="true"
          />
          
          {/* Menu Panel */}
          <div className="fixed inset-y-0 left-0 w-4/5 max-w-sm bg-background border-r border-border shadow-2xl flex flex-col transform transition-transform duration-300 ease-out sm:w-80">
            <div className="flex items-center justify-between px-4 py-4 border-b border-border">
              <span className="text-lg font-medium tracking-tight">Menu Navigasi</span>
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => setIsOpen(false)}
                aria-label="Tutup menu navigasi"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>

            <div className="flex-1 overflow-y-auto py-6 px-4">
              {role !== KASIR_ROLE && (
                <UserProfileCard
                  userName={userName}
                  role={role}
                  className="px-4 py-3 mb-5 rounded-xl bg-muted/60 border border-border/60"
                />
              )}

              <nav className="flex flex-col gap-1">
                {role !== KASIR_ROLE && (
                  <Link href="/dashboard" className={linkClass("/dashboard")}>
                    <LayoutGrid className="w-5 h-5" />
                    <span>Ringkasan</span>
                    <NavLinkPending />
                  </Link>
                )}

                {role === KASIR_ROLE && (
                  <>
                    <Link href="/pos" className={linkClass("/pos")}>
                      <CircleDollarSign className="w-5 h-5" />
                      <span>Penjualan</span>
                      <NavLinkPending />
                    </Link>
                    <Link href="/dashboard/tutup-kasir" className={linkClass("/dashboard/tutup-kasir")} onClick={() => setIsOpen(false)}>
                      <Calculator className="w-5 h-5" />
                      <span>Kas Kasir</span>
                      <NavLinkPending />
                    </Link>
                    <Link href="/dashboard/transactions" className={linkClass("/dashboard/transactions")} onClick={() => setIsOpen(false)}>
                      <Receipt className="w-5 h-5" />
                      <span>Riwayat Transaksi</span>
                      <NavLinkPending />
                    </Link>
                  </>
                )}

                {isManagement && (
                  <>
                    <Link href="/dashboard/transactions" className={linkClass("/dashboard/transactions")}>
                      <Receipt className="w-5 h-5" />
                      <span>Riwayat Transaksi</span>
                      <NavLinkPending />
                    </Link>

                    <Link href="/dashboard/customers" className={linkClass("/dashboard/customers")}>
                      <Users className="w-5 h-5" />
                      <span>Pelanggan</span>
                      <NavLinkPending />
                    </Link>

                    <Link href="/dashboard/suppliers" className={linkClass("/dashboard/suppliers")}>
                      <Truck className="w-5 h-5" />
                      <span>Supplier</span>
                      <NavLinkPending />
                    </Link>

                    <Link href="/dashboard/po-custom" className={linkClass("/dashboard/po-custom")}>
                      <ClipboardList className="w-5 h-5" />
                      <span>PO Custom</span>
                      <NavLinkPending />
                    </Link>

                    <div>
                      <div
                        className={`flex items-center gap-3 px-3 py-3 rounded-md transition-colors ${
                          isInventoryActive
                            ? "text-primary font-medium"
                            : "text-muted-foreground"
                        }`}
                      >
                        <Package className="w-5 h-5" />
                        <span className="flex-1 text-left">Inventaris</span>
                      </div>

                      <div className="ml-2 mt-1 flex flex-col gap-1 pl-6 border-l border-border/50">
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
                          <span>Riwayat Masuk</span>
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
                        className={`flex items-center gap-3 px-3 py-3 rounded-md transition-colors ${
                          isLaporanActive
                            ? "text-primary font-medium"
                            : "text-muted-foreground"
                        }`}
                      >
                        <BarChart3 className="w-5 h-5" />
                        <span className="flex-1 text-left">Laporan</span>
                      </div>

                      <div className="ml-2 mt-1 flex flex-col gap-1 pl-6 border-l border-border/50">
                        <Link href="/dashboard/reports" className={subLinkClass("/dashboard/reports")} onClick={() => setIsOpen(false)}>
                          <BarChart3 className="w-4 h-4" />
                          <span>Ringkasan</span>
                          <NavLinkPending />
                        </Link>
                        {isManagement && (
                          <Link href="/dashboard/laporan/analisis-produk" className={subLinkClass("/dashboard/laporan/analisis-produk")} onClick={() => setIsOpen(false)}>
                            <BarChart3 className="w-4 h-4" />
                            <span>Analisis Produk</span>
                            <NavLinkPending />
                          </Link>
                        )}
                        <Link href="/dashboard/laporan/laba-rugi" className={subLinkClass("/dashboard/laporan/laba-rugi")} onClick={() => setIsOpen(false)}>
                          <TrendingUp className="w-4 h-4" />
                          <span>Laba Rugi</span>
                          <NavLinkPending />
                        </Link>
                        <Link href="/dashboard/laporan/neraca" className={subLinkClass("/dashboard/laporan/neraca")} onClick={() => setIsOpen(false)}>
                          <Scale className="w-4 h-4" />
                          <span>Neraca</span>
                          <NavLinkPending />
                        </Link>
                        {isOwner && (
                          <Link href="/dashboard/laporan/pergerakan-harga" className={subLinkClass("/dashboard/laporan/pergerakan-harga")} onClick={() => setIsOpen(false)}>
                            <TrendingUp className="w-4 h-4" />
                            <span>Pergerakan Harga</span>
                            <NavLinkPending />
                          </Link>
                        )}
                        <Link href="/dashboard/laporan/stok-opname" className={subLinkClass("/dashboard/laporan/stok-opname")} onClick={() => setIsOpen(false)}>
                          <ClipboardList className="w-4 h-4" />
                          <span>Stok Opname</span>
                          <NavLinkPending />
                        </Link>
                        <Link href="/dashboard/laporan/kas" className={subLinkClass("/dashboard/laporan/kas")} onClick={() => setIsOpen(false)}>
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
                        <Link href="/dashboard/keuangan/kas-admin" className={linkClass("/dashboard/keuangan/kas-admin")} onClick={() => setIsOpen(false)}>
                          <Coins className="w-5 h-5" />
                          <span>Kas Admin</span>
                          <NavLinkPending />
                        </Link>
                        <Link href="/dashboard/laporan-kasir" className={linkClass("/dashboard/laporan-kasir")} onClick={() => setIsOpen(false)}>
                          <FileText className="w-5 h-5" />
                          <span>Riwayat Kas Harian</span>
                          <NavLinkPending />
                        </Link>
                        <Link href="/dashboard/keuangan/pengeluaran" className={linkClass("/dashboard/keuangan/pengeluaran")} onClick={() => setIsOpen(false)}>
                          <Wallet className="w-5 h-5" />
                          <span>Pengeluaran</span>
                          <NavLinkPending />
                        </Link>
                        <Link href="/dashboard/keuangan/arus-kas" className={linkClass("/dashboard/keuangan/arus-kas")} onClick={() => setIsOpen(false)}>
                          <ArrowLeftRight className="w-5 h-5" />
                          <span>Arus Kas</span>
                          <NavLinkPending />
                        </Link>
                      </div>
                    </div>

                    <div className="mt-4 pt-4 border-t border-border/50">
                      <div className="px-3 mb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        Tools
                      </div>
                      <div className="flex flex-col gap-1">
                         <Link href="/dashboard/label-generator" className={linkClass("/dashboard/label-generator")} onClick={() => setIsOpen(false)}>
                          <Tag className="w-5 h-5" />
                          <span>Pricetag Generator</span>
                          <NavLinkPending />
                        </Link>
                        <Link href="/dashboard/product-label" className={linkClass("/dashboard/product-label")} onClick={() => setIsOpen(false)}>
                          <Printer className="w-5 h-5" />
                          <span>Cetak Label Produk</span>
                          <NavLinkPending />
                        </Link>
                        <Link href="/dashboard/event-promo" className={linkClass("/dashboard/event-promo")} onClick={() => setIsOpen(false)}>
                          <Tag className="w-5 h-5" />
                          <span>Event Promo</span>
                          <NavLinkPending />
                        </Link>
                        <Link href="/dashboard/log-aktivitas" className={linkClass("/dashboard/log-aktivitas")} onClick={() => setIsOpen(false)}>
                          <History className="w-5 h-5" />
                          <span>Log Aktivitas</span>
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
                        <ScanLine className="mr-3 h-5 w-5" />
                        Scan Absen
                        <NavLinkPending />
                      </Link>
                      <Link href="/dashboard/attendance/history" className={linkClass("/dashboard/attendance/history")}>
                        <UserCheck className="w-5 h-5" />
                        <span>Riwayat Absen</span>
                        <NavLinkPending />
                      </Link>
                      <Link href="/dashboard/jadwal-saya" className={linkClass("/dashboard/jadwal-saya")}>
                        <CalendarDays className="w-5 h-5" />
                        <span>Jadwal Saya</span>
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
                        <span>Generate QR</span>
                        <NavLinkPending />
                      </Link>
                      <Link href="/dashboard/attendance/manual" className={linkClass("/dashboard/attendance/manual")}>
                        <ClipboardCheck className="w-5 h-5" />
                        <span>Absen Manual</span>
                        <NavLinkPending />
                      </Link>
                      <Link href="/dashboard/attendance/report" className={linkClass("/dashboard/attendance/report")}>
                        <UserCheck className="w-5 h-5" />
                        <span>Laporan Pegawai</span>
                        <NavLinkPending />
                      </Link>
                      <Link href="/dashboard/jadwal-karyawan" className={linkClass("/dashboard/jadwal-karyawan")}>
                        <CalendarDays className="w-5 h-5" />
                        <span>Jadwal Karyawan</span>
                        <NavLinkPending />
                      </Link>
                    </div>
                  </div>
                )}
              </nav>

              <div className="flex flex-col gap-2 mt-8 pt-6 border-t border-border">
                {!isAttendanceOnly && role !== KASIR_ROLE && bottomLinks.map(({ href, label, icon: Icon }) => (
                  <Link key={href} href={href} className={linkClass(href)}>
                    <Icon className="w-5 h-5" />
                    <span>{label}</span>
                    <NavLinkPending />
                  </Link>
                ))}
                
                <button 
                  onClick={handleLogout} 
                  disabled={loggingOut}
                  className="flex items-center gap-3 px-3 py-3 rounded-md text-destructive hover:bg-destructive/10 transition-colors w-full text-left mt-2 disabled:opacity-60"
                >
                  {loggingOut ? <Loader2 className="w-5 h-5 animate-spin" /> : <LogOut className="w-5 h-5" />}
                  <span className="font-medium">{loggingOut ? "Keluar..." : "Keluar"}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
});
