import { fetchLaporanStokOpname } from "./actions";
import LaporanStokOpnameClient from "./page-client";

export const dynamic = "force-dynamic";

export default async function LaporanStokOpnamePage() {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    .toISOString()
    .split("T")[0];
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0)
    .toISOString()
    .split("T")[0];

  let initialData = null;
  try {
    initialData = await fetchLaporanStokOpname({
      start_date: startOfMonth,
      end_date: endOfMonth,
      status: "SELESAI",
    });
  } catch (e) {
    console.error(e);
  }

  return (
    <div className="flex-1 p-4 md:p-8 lg:p-12 w-full flex flex-col gap-4 md:gap-8 mx-auto h-full md:max-h-screen md:overflow-hidden">
      <header className="shrink-0 print:hidden">
        <h1 className="text-4xl font-light tracking-tighter text-foreground">
          Laporan Stok Opname
        </h1>
        <p className="text-muted-foreground mt-2">
          Ringkasan selisih stok, nilai kerugian, dan tren shrinkage.
        </p>
      </header>

      <LaporanStokOpnameClient initialData={initialData} />
    </div>
  );
}
