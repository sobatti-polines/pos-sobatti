import { createClient } from "@/lib/supabase/server";
import { fetchAllRows } from "@/lib/supabase/fetch-all";
import TransactionsClient from "./transactions-client";
import type { Transaction } from "./transactions-client";

export default async function TransactionsPage() {
  const supabase = await createClient();

  const [transactions, paymentMethodsRes] = await Promise.all([
    fetchAllRows(supabase, (db, from, to) =>
      db
        .from("transaksi_keluar")
        .select(`
          id,
          no_transaksi,
          tgl_transaksi,
          total,
          bayar,
          status,
          kembali,
          pelanggan(nama_pelanggan),
          pengguna!transaksi_keluar_id_kasir_fkey(username, nama),
          metode_bayar(id, nama)
        `)
        .order("tgl_transaksi", { ascending: false })
        .range(from, to)
    ),
    supabase.from("metode_bayar").select("*").order("nama"),
  ]);

  const { data: { user } } = await supabase.auth.getUser();
  const role = user?.user_metadata?.role;
  const userName = user?.user_metadata?.nama || user?.email?.split("@")[0] || "-";

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const txData = (transactions ?? []) as any[] as Transaction[];

  return (
    <div className="flex-1 p-4 md:p-8 lg:p-12 w-full flex flex-col gap-4 md:gap-8 mx-auto h-full md:max-h-screen md:overflow-hidden">
      <header className="shrink-0">
        <h1 className="text-3xl md:text-4xl font-light tracking-tighter text-foreground">
          Riwayat Transaksi
        </h1>
        <p className="text-muted-foreground mt-2">
          Lihat dan kelola semua transaksi penjualan yang telah dilakukan
        </p>
      </header>

      <TransactionsClient 
        initialTransactions={txData} 
        paymentMethods={paymentMethodsRes.data ?? []} 
        role={role}
        userName={userName}
      />
    </div>
  );
}
