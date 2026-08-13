import Link from "next/link";

function formatIDR(n: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
}

export function DashboardFinanceSummary({
  labaBersih,
  bebanOperasional,
}: {
  labaBersih: number;
  bebanOperasional: number;
}) {
  return (
    <section>
      <h3 className="text-sm font-medium text-muted-foreground mb-4 md:mb-6 uppercase tracking-widest">
        Ringkasan Keuangan Bulan Ini
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6 lg:gap-8">
        <div className="rounded-xl bg-emerald-50/40 border border-emerald-100 p-6">
          <p className="text-[11px] font-medium uppercase tracking-widest text-emerald-700">
            Laba (Rugi) Bersih
          </p>
          <p className="mt-2 text-3xl font-light tracking-tight tabular-nums text-emerald-800">
            {formatIDR(labaBersih)}
          </p>
          <Link
            href="/dashboard/laporan/laba-rugi"
            className="inline-block mt-3 text-xs font-medium text-primary hover:underline"
          >
            Lihat Laba Rugi →
          </Link>
        </div>
        <div className="rounded-xl bg-rose-50/40 border border-rose-100 p-6">
          <p className="text-[11px] font-medium uppercase tracking-widest text-rose-700">
            Beban Operasional
          </p>
          <p className="mt-2 text-3xl font-light tracking-tight tabular-nums text-rose-800">
            {formatIDR(bebanOperasional)}
          </p>
          <Link
            href="/dashboard/keuangan/pengeluaran"
            className="inline-block mt-3 text-xs font-medium text-primary hover:underline"
          >
            Lihat Pengeluaran →
          </Link>
        </div>
      </div>
    </section>
  );
}