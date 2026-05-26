import { createClient } from "@/lib/supabase/server";
import TransactionsClient from "./transactions-client";

export default async function TransactionsPage() {
  const supabase = await createClient();

  const [transactionsRes, paymentMethodsRes] = await Promise.all([
    supabase
      .from("transaksi_keluar")
      .select(`
        id,
        no_transaksi,
        tgl_transaksi,
        total,
        bayar,
        kembali,
        pelanggan(nama_pelanggan),
        pengguna!transaksi_keluar_id_kasir_fkey(username, nama),
        metode_bayar(id, nama)
      `)
      .order("tgl_transaksi", { ascending: false }),
    supabase.from("metode_bayar").select("*").order("nama"),
  ]);

  const { data: { user } } = await supabase.auth.getUser();
  const role = user?.user_metadata?.role;

  return (
    <div className="flex-1 p-8 lg:p-12 w-full flex flex-col gap-8 mx-auto h-full max-h-screen overflow-hidden">
      <header className="shrink-0">
        <h1 className="text-4xl font-light tracking-tighter text-foreground">
          Riwayat Transaksi
        </h1>
        <p className="text-muted-foreground mt-2">
          Lihat dan kelola semua transaksi penjualan yang telah dilakukan
        </p>
      </header>

      <TransactionsClient 
        initialTransactions={transactionsRes.data ?? []} 
        paymentMethods={paymentMethodsRes.data ?? []} 
        role={role}
      />
    </div>
  );
}
