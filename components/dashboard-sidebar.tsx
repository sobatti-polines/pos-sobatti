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
} from "lucide-react";

const bottomLinks = [
  { href: "/dashboard/settings", label: "Pengaturan", icon: Settings },
  { href: "/dashboard/support", label: "Bantuan", icon: HelpCircle },
];

export function DashboardSidebar({ role }: { role?: string }) {
  const pathname = usePathname();

  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const isInventoryActive = pathname.startsWith("/dashboard/inventory");

  const linkClass = (href: string) => {
    const active = href === "/dashboard"
      ? pathname === "/dashboard"
      : pathname.startsWith(href);
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

  const isOwnerOrAdmin = role === "OWNER" || role === "ADMIN";

  return (
    <aside className="w-64 shrink-0 border-r border-border bg-background hidden md:flex flex-col py-6 px-4">
      <div className="mb-10 flex items-center px-2">
        <div className="h-8 w-8 rounded-md bg-primary mr-3 flex items-center justify-center">
          <span className="text-primary-foreground font-medium">S</span>
        </div>
        <span className="text-xl font-light tracking-tight text-foreground">Sobatti POS</span>
      </div>

      <nav className="flex flex-col gap-1 flex-1">
        <Link href="/dashboard" className={linkClass("/dashboard")}>
          <LayoutGrid className="w-5 h-5" />
          <span className="text-sm">Ringkasan</span>
        </Link>

        {!isOwnerOrAdmin && (
          <Link href="/pos" className={linkClass("/pos")}>
            <CircleDollarSign className="w-5 h-5" />
            <span className="text-sm">Penjualan</span>
          </Link>
        )}

        <Link href="/dashboard/transactions" className={linkClass("/dashboard/transactions")}>
          <Receipt className="w-5 h-5" />
          <span className="text-sm">Riwayat Transaksi</span>
        </Link>

        <Link href="/dashboard/customers" className={linkClass("/dashboard/customers")}>
          <Users className="w-5 h-5" />
          <span className="text-sm">Pelanggan</span>
        </Link>

        <Link href="/dashboard/suppliers" className={linkClass("/dashboard/suppliers")}>
          <Truck className="w-5 h-5" />
          <span className="text-sm">Supplier</span>
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
          </div>

          <div className="ml-2 mt-1 flex flex-col gap-0.5 pl-6 border-l border-border/50">
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
              <span>Riwayat Barang Masuk</span>
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

        <Link href="/dashboard/reports" className={linkClass("/dashboard/reports")}>
          <BarChart3 className="w-5 h-5" />
          <span className="text-sm">Laporan</span>
        </Link>
      </nav>

      <div className="flex flex-col gap-2 mt-auto pt-6 border-t border-border">
        {bottomLinks.map(({ href, label, icon: Icon }) => (
          <Link key={href} href={href} className={linkClass(href)}>
            <Icon className="w-5 h-5" />
            <span className="text-sm">{label}</span>
          </Link>
        ))}
      </div>
    </aside>
  );
}
