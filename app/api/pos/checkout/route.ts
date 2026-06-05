import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createClient();

  const {
    items,
    id_pelanggan,
    id_metode_bayar,
    diskon_persen,
    bayar,
  } = await request.json();

  if (!items || items.length === 0) {
    return NextResponse.json({ error: "Cart is empty" }, { status: 400 });
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: pengguna } = await supabase
    .from("pengguna")
    .select("id")
    .eq("username", user.email?.split("@")[0])
    .maybeSingle();

  if (!pengguna) {
    return NextResponse.json(
      { error: "Staff profile not found. Cannot process checkout." },
      { status: 403 }
    );
  }

  const id_kasir = pengguna.id;

  // Fetch tax rate from settings
  const { data: pengaturan } = await supabase
    .from("pengaturan")
    .select("pajak_persen")
    .eq("id", 1)
    .single();

  const pajak_persen = pengaturan?.pajak_persen || 0;

  // Determine if payment method is DP
  const { data: mBayar } = await supabase
    .from("metode_bayar")
    .select("nama")
    .eq("id", id_metode_bayar)
    .single();

  const isDP = mBayar?.nama?.toUpperCase() === "DP";

  // Map cart items to the shape expected by the stored procedure
  const itemsForRpc = items.map((i: {
    id_produk: number;
    qty: number;
    diskon_item?: number;
    tipe_harga?: string;
  }) => ({
    id_produk: i.id_produk,
    qty: i.qty,
    diskon_item: i.diskon_item || 0,
    type_harga_jual: i.tipe_harga ? i.tipe_harga.toUpperCase() : "SATUAN",
  }));

  /**
   * Delegate the entire checkout (no_transaksi generation + insert header +
   * insert details + stock deduction) to a single Postgres function so the
   * operation is fully atomic and race-free.
   */
  const { data, error } = await supabase.rpc("process_checkout", {
    p_items: itemsForRpc,
    p_id_kasir: id_kasir,
    p_id_pelanggan: id_pelanggan || null,
    p_id_metode_bayar: id_metode_bayar,
    p_diskon_persen: diskon_persen || 0,
    p_bayar: bayar ?? 0,
    p_pajak_persen: pajak_persen,
    p_is_dp: isDP,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
