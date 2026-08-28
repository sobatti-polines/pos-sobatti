import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { fetchAllRows } from "@/lib/supabase/fetch-all";
import PoCustomClient, {
  type CustomerOption,
  type PaymentMethodOption,
  type PoCustomRecord,
  type ProductOption,
} from "./po-custom-client";
import { isAdminOrOwnerLike } from "@/lib/roles";

export default async function PoCustomPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/");

  const { data: pengguna } = await supabase
    .from("pengguna")
    .select("level")
    .eq("username", user.email?.split("@")[0])
    .single();

  if (!isAdminOrOwnerLike(pengguna?.level)) {
    redirect("/dashboard");
  }

  const [poData, customers, products, paymentMethods] = await Promise.all([
    fetchAllRows<PoCustomRecord>(supabase, (db, from, to) =>
      db
        .from("po_custom")
        .select(
          `
          *,
          pelanggan(id, nama_pelanggan, no_hp),
          produk(id, nama_produk, sku),
          transaksi_keluar(id, no_transaksi, tgl_transaksi, total),
          po_custom_pembayaran(
            id,
            tanggal_bayar,
            jumlah_bayar,
            jenis_pembayaran,
            keterangan,
            metode_bayar(id, nama)
          )
        `
        )
        .order("tanggal_po", { ascending: false })
        .order("created_at", { ascending: false })
        .range(from, to)
    ).catch((err) => {
      console.error("Failed to fetch PO custom:", err);
      return [];
    }),
    fetchAllRows<CustomerOption>(supabase, (db, from, to) =>
      db
        .from("pelanggan")
        .select("id, nama_pelanggan, no_hp")
        .order("nama_pelanggan", { ascending: true })
        .range(from, to)
    ).catch(() => []),
    fetchAllRows<ProductOption>(supabase, (db, from, to) =>
      db
        .from("produk")
        .select("id, nama_produk, sku")
        .order("nama_produk", { ascending: true })
        .range(from, to)
    ).catch(() => []),
    fetchAllRows<PaymentMethodOption>(supabase, (db, from, to) =>
      db
        .from("metode_bayar")
        .select("id, nama")
        .order("id", { ascending: true })
        .range(from, to)
    ).catch(() => []),
  ]);

  return (
    <div className="flex-1 p-4 md:p-8 lg:p-12 w-full flex flex-col gap-4 md:gap-8 mx-auto h-full md:max-h-screen md:overflow-hidden">
      <header className="shrink-0">
        <h1 className="text-3xl md:text-4xl font-light tracking-tighter text-foreground">
          PO Custom
        </h1>
        <p className="text-muted-foreground mt-2">
          Catat pesanan custom pelanggan, DP, sisa pembayaran, dan status pengerjaan.
        </p>
      </header>

      <PoCustomClient
        initialRecords={poData}
        customers={customers}
        products={products}
        paymentMethods={paymentMethods}
      />
    </div>
  );
}
