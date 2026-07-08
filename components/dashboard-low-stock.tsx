"use client";

import { Package, CupSoda, Croissant } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { useLowStockRealtime } from "@/hooks/use-low-stock-realtime";

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

export function DashboardLowStock() {
  const lowStockItems = useLowStockRealtime();

  return (
    <section className="flex flex-col">
      <div className="flex items-center gap-3 mb-6">
        <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-widest">Stok Menipis</h3>
        <Badge variant="secondary" className="font-normal bg-muted">{lowStockItems.length} item</Badge>
      </div>
      <div className="flex flex-col gap-2">
        {lowStockItems.length > 0 ? (
          lowStockItems.slice(0, 5).map((item) => {
            const { icon: Icon, bg, color } = getStockIcon(item.nama_produk);
            return (
              <div
                key={item.id}
                className="flex items-center justify-between px-4 py-3 rounded-md hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-md flex items-center justify-center ${bg}`}>
                    <Icon className={`w-4 h-4 ${color}`} />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">{item.nama_produk}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{item.stok} tersisa</p>
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
          })
        ) : (
          <p className="text-sm text-muted-foreground py-8 text-center">Semua stok masih aman</p>
        )}
      </div>
    </section>
  );
}
