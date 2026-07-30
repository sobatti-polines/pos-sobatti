import Link from "next/link";
import { History } from "lucide-react";
import type { ActivityRow } from "@/lib/dashboard";

export function DashboardRecentActivity({
  activities,
}: {
  activities: ActivityRow[];
}) {
  return (
    <section>
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-widest">
          Aktivitas Terbaru
        </h3>
        <Link
          href="/dashboard/log-aktivitas"
          className="text-xs font-medium text-primary hover:underline"
        >
          Lihat Semua &rarr;
        </Link>
      </div>

      {activities.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <History className="w-8 h-8 text-muted-foreground/40 mb-3" />
          <p className="text-sm text-muted-foreground">
            Belum ada aktivitas tercatat
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left font-medium text-muted-foreground text-[11px] uppercase tracking-wider pb-3 pr-4 w-[100px]">
                  Waktu
                </th>
                <th className="text-left font-medium text-muted-foreground text-[11px] uppercase tracking-wider pb-3 pr-4 hidden sm:table-cell w-[130px]">
                  Pengguna
                </th>
                <th className="text-center font-medium text-muted-foreground text-[11px] uppercase tracking-wider pb-3 pr-4 w-[80px]">
                  Aksi
                </th>
                <th className="text-left font-medium text-muted-foreground text-[11px] uppercase tracking-wider pb-3 pr-4 hidden md:table-cell w-[90px]">
                  Entitas
                </th>
                <th className="text-left font-medium text-muted-foreground text-[11px] uppercase tracking-wider pb-3">
                  Deskripsi
                </th>
              </tr>
            </thead>
            <tbody>
              {activities.map((a) => (
                <tr key={a.id} className="border-b border-border/50 last:border-0">
                  <td className="py-3 pr-4 text-muted-foreground font-light tabular-nums whitespace-nowrap">
                    {a.waktu}
                  </td>
                  <td className="py-3 pr-4 hidden sm:table-cell text-foreground font-light">
                    {a.pengguna}
                  </td>
                  <td className="py-3 pr-4 text-center">
                    <span
                      className={`tabular-nums font-semibold px-2 py-0.5 rounded-full text-[11px] ${
                        a.aksi === "CREATE"
                          ? "bg-emerald-50 text-emerald-600"
                          : a.aksi === "UPDATE"
                          ? "bg-blue-50 text-blue-600"
                          : "bg-destructive/10 text-destructive"
                      }`}
                    >
                      {a.aksi}
                    </span>
                  </td>
                  <td className="py-3 pr-4 hidden md:table-cell">
                    <span className="text-[11px] font-mono text-muted-foreground bg-muted/60 px-1.5 py-0.5 rounded">
                      {a.entitas}
                    </span>
                  </td>
                  <td className="py-3 text-foreground font-light max-w-[240px] truncate">
                    {a.deskripsi}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
