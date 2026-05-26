import { createClient } from "@/lib/supabase/server";
import ReportsClient from "./reports-client";
import { redirect } from "next/navigation";

export default async function ReportsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/");

  // Fetch all data needed for reports
  const [transactionsRes, detailsRes, productsRes] = await Promise.all([
    supabase
      .from("transaksi_keluar")
      .select("*")
      .order("tgl_transaksi", { ascending: false }),
    supabase
      .from("detail_transaksi_keluar")
      .select("*, produk(nama_produk)")
      .order("id", { ascending: false }),
    supabase
      .from("produk")
      .select("*")
      .order("nama_produk")
  ]);

  if (transactionsRes.error || detailsRes.error || productsRes.error) {
    console.error("Error fetching reports data:", {
      transactions: transactionsRes.error,
      details: detailsRes.error,
      products: productsRes.error,
    });
  }

  return (
    <div className="flex-1 p-8 lg:p-12 w-full flex flex-col gap-8 mx-auto h-full overflow-y-auto">
      <header className="shrink-0">
        <h1 className="text-4xl font-light tracking-tighter text-foreground">
          Laporan
        </h1>
        <p className="text-muted-foreground mt-2">
          Analisis performa penjualan, laba, dan status stok
        </p>
      </header>

      <ReportsClient 
        transactions={transactionsRes.data ?? []} 
        details={detailsRes.data ?? []}
        products={productsRes.data ?? []}
      />
    </div>
  );
}
