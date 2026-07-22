"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
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
  Menu,
  X,
  Camera,
  UserCheck,
  QrCode,
  LogOut,
  TrendingUp,
  Scale,
  Tag,
  ScanLine,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

const bottomLinks = [
  { href: "/dashboard/settings", label: "Pengaturan", icon: Settings },
  { href: "/dashboard/support", label: "Bantuan", icon: HelpCircle },
];

export function DashboardMobileNav({ role }: { role?: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const [isOpen, setIsOpen] = useState(false);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  };

  // Close the menu when pathname changes
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
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

  const isOwner = role === "OWNER";
  const isStaff = role === "ADMIN" || role === "KASIR" || role === "KARYAWAN";
  const isManagement = role === "OWNER" || role === "ADMIN";
  const isKaryawan = role === "KARYAWAN";

  return (
    <>
      {/* Mobile Header */}
      <header className="md:hidden flex items-center justify-between px-4 py-3 border-b border-border bg-background shrink-0 z-40 sticky top-0 print:hidden">
        <div className="flex items-center">
          <div className="h-8 w-8 rounded-md bg-primary mr-3 flex items-center justify-center">
            <span className="text-primary-foreground font-medium">P</span>
          </div>
          <span className="text-xl font-light tracking-tight text-foreground">PLK POS</span>
        </div>
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={() => setIsOpen(true)}
          aria-label="Buka menu navigasi"
        >
          <Menu className="h-6 w-6" />
        </Button>
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
          <div className="fixed inset-y-0 right-0 w-4/5 max-w-sm bg-background border-l border-border shadow-2xl flex flex-col transform transition-transform duration-300 ease-out sm:w-80">
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
              <nav className="flex flex-col gap-1">
                <Link href="/dashboard" className={linkClass("/dashboard")}>
                  <LayoutGrid className="w-5 h-5" />
                  <span>Ringkasan</span>
                </Link>

                {role === "KASIR" && (
                  <Link href="/pos" className={linkClass("/pos")}>
                    <CircleDollarSign className="w-5 h-5" />
                    <span>Penjualan</span>
                  </Link>
                )}

                {isManagement && (
                  <>
                    <Link href="/dashboard/transactions" className={linkClass("/dashboard/transactions")}>
                      <Receipt className="w-5 h-5" />
                      <span>Riwayat Transaksi</span>
                    </Link>

                    <Link href="/dashboard/customers" className={linkClass("/dashboard/customers")}>
                      <Users className="w-5 h-5" />
                      <span>Pelanggan</span>
                    </Link>

                    <Link href="/dashboard/suppliers" className={linkClass("/dashboard/suppliers")}>
                      <Truck className="w-5 h-5" />
                      <span>Supplier</span>
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
                        </Link>
                        <Link href="/dashboard/inventory/stock-in" className={subLinkClass("/dashboard/inventory/stock-in")}>
                          <PackagePlus className="w-4 h-4" />
                          <span>Barang Masuk</span>
                        </Link>
                        <Link href="/dashboard/inventory/stock-in/history" className={subLinkClass("/dashboard/inventory/stock-in/history")}>
                          <Receipt className="w-4 h-4" />
                          <span>Riwayat Masuk</span>
                        </Link>
                        <Link href="/dashboard/inventory/stock-opname" className={subLinkClass("/dashboard/inventory/stock-opname")}>
                          <ClipboardList className="w-4 h-4" />
                          <span>Stok Opname</span>
                        </Link>
                        <Link href="/dashboard/inventory/stock-opname/history" className={subLinkClass("/dashboard/inventory/stock-opname/history")}>
                          <Receipt className="w-4 h-4" />
                          <span>Riwayat Opname</span>
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
                        </Link>
                        <Link href="/dashboard/laporan/laba-rugi" className={subLinkClass("/dashboard/laporan/laba-rugi")} onClick={() => setIsOpen(false)}>
                          <TrendingUp className="w-4 h-4" />
                          <span>Laba Rugi</span>
                        </Link>
                        <Link href="/dashboard/laporan/neraca" className={subLinkClass("/dashboard/laporan/neraca")} onClick={() => setIsOpen(false)}>
                          <Scale className="w-4 h-4" />
                          <span>Neraca</span>
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
                      </Link>
                      <Link href="/dashboard/attendance/history" className={linkClass("/dashboard/attendance/history")}>
                        <UserCheck className="w-5 h-5" />
                        <span>Riwayat Absen</span>
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
                      </Link>
                      <Link href="/dashboard/attendance/report" className={linkClass("/dashboard/attendance/report")}>
                        <UserCheck className="w-5 h-5" />
                        <span>Laporan Pegawai</span>
                      </Link>
                    </div>
                  </div>
                )}
              </nav>

              <div className="flex flex-col gap-2 mt-8 pt-6 border-t border-border">
                {!isKaryawan && bottomLinks.map(({ href, label, icon: Icon }) => (
                  <Link key={href} href={href} className={linkClass(href)}>
                    <Icon className="w-5 h-5" />
                    <span>{label}</span>
                  </Link>
                ))}
                
                <button 
                  onClick={handleLogout} 
                  className="flex items-center gap-3 px-3 py-3 rounded-md text-destructive hover:bg-destructive/10 transition-colors w-full text-left mt-2"
                >
                  <LogOut className="w-5 h-5" />
                  <span className="font-medium">Keluar</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
