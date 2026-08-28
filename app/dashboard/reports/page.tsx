import { createClient } from "@/lib/supabase/server";
import { fetchAllRows } from "@/lib/supabase/fetch-all";
import ReportsClient from "./reports-client";
import { isOwnerLike } from "@/lib/roles";
import { redirect } from "next/navigation";

export default async function ReportsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/");

  // fetchAllRows: PostgREST memotong di 1000 baris per request — tanpa ini
  // laporan salah jika transaksi/detail/produk melebihi 1000 baris.
  const [transactions, details, products] = await Promise.all([
    fetchAllRows(supabase, (db, from, to) =>
      db.from("transaksi_keluar").select("*").eq("status", "berhasil").order("tgl_transaksi", { ascending: false }).range(from, to)
    ).catch((e) => {
      console.error("Error fetching transactions:", e);
      return [];
    }),
    fetchAllRows(supabase, (db, from, to) =>
      db.from("detail_transaksi_keluar").select("*, produk(nama_produk)").order("id", { ascending: false }).range(from, to)
    ).catch((e) => {
      console.error("Error fetching details:", e);
      return [];
    }),
    fetchAllRows(supabase, (db, from, to) =>
      db.from("produk").select("*").order("nama_produk").range(from, to)
    ).catch((e) => {
      console.error("Error fetching products:", e);
      return [];
    })
  ]);

  if (transactions.length === 0 && details.length === 0 && products.length === 0) {
    console.error("Error fetching reports data: semua query mengembalikan kosong");
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
        transactions={transactions} 
        details={details}
        products={products}
        isOwner={isOwnerLike(user.user_metadata?.role)}
      />
    </div>
  );
}
