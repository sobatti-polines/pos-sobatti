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

  const id_kasir = pengguna?.id ?? 2;

  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");

  const datePrefix = `${year}${month}`;

  const { data: lastTx } = await supabase
    .from("transaksi_keluar")
    .select("no_transaksi")
    .like("no_transaksi", `${datePrefix}%`)
    .order("no_transaksi", { ascending: false })
    .limit(1)
    .maybeSingle();

  const lastNumber = lastTx ? Number(String(lastTx.no_transaksi).slice(-4)) : 0;
  const no_transaksi = Number(`${datePrefix}${String(lastNumber + 1).padStart(4, "0")}`);

  const productIds = items.map((i: { id_produk: number }) => i.id_produk);
  const { data: products } = await supabase
    .from("produk")
    .select("id, harga_modal, harga_jual_satuan, harga_jual_grosir, hitung_stok, stok")
    .in("id", productIds);

  const productMap = new Map((products ?? []).map((p: Record<string, unknown>) => [p.id, p as { id: number; harga_modal: number; harga_jual_satuan: number; harga_jual_grosir: number; hitung_stok: boolean; stok: number }]));

  let subtotal = 0;
  const details: Array<{
    id_produk: number;
    type_harga_jual: string;
    harga_modal: number;
    harga_jual: number;
    diskon_item: number;
    qty: number;
    jumlah: number;
    kas_masuk: number;
    profit: number;
  }> = [];

  for (const item of items) {
    const prod = productMap.get(item.id_produk);
    if (!prod) continue;

    const diskon_item = item.diskon_item || 0;
    const type_harga = item.qty >= 10 ? "GROSIR" : "SATUAN";
    const harga_jual =
      type_harga === "GROSIR" ? prod.harga_jual_grosir : prod.harga_jual_satuan;
    
    // Update: jumlah = (harga - diskon_item) * qty
    const jumlah = (harga_jual - diskon_item) * item.qty;
    
    // Update: profit = (harga_jual - harga_modal) * qty - diskon_item * qty
    const profit = (harga_jual - prod.harga_modal) * item.qty - (diskon_item * item.qty);

    subtotal += jumlah;

    details.push({
      id_produk: item.id_produk,
      type_harga_jual: type_harga,
      harga_modal: prod.harga_modal,
      harga_jual,
      diskon_item,
      qty: item.qty,
      jumlah,
      kas_masuk: jumlah,
      profit,
    });
  }

  const diskon_nominal = diskon_persen > 0
    ? Math.round(subtotal * (diskon_persen / 100))
    : 0;

  const total_tagihan = subtotal - diskon_nominal;
  const jumlah_bayar = bayar ?? total_tagihan;
  const kembali = Math.max(0, jumlah_bayar - total_tagihan);

  // Check if payment method is "DP"
  const { data: mBayar } = await supabase
    .from("metode_bayar")
    .select("nama")
    .eq("id", id_metode_bayar)
    .single();
  
  const isDP = mBayar?.nama?.toUpperCase() === "DP";
  const dp_amount = isDP ? jumlah_bayar : 0;
  const sisa_amount = jumlah_bayar < total_tagihan ? total_tagihan - jumlah_bayar : 0;

  const { data: transaction, error: txError } = await supabase
    .from("transaksi_keluar")
    .insert({
      no_transaksi,
      tgl_transaksi: now.toISOString(),
      id_kasir,
      id_pelanggan: id_pelanggan || null,
      id_metode_bayar,
      subtotal,
      diskon_persen: diskon_persen || 0,
      diskon_nominal,
      pajak_persen: 0,
      pajak_nominal: 0,
      total: total_tagihan,
      bayar: jumlah_bayar,
      kembali,
      dp: dp_amount,
      sisa: sisa_amount,
    })
    .select("id")
    .single();

  if (txError) {
    return NextResponse.json({ error: txError.message }, { status: 500 });
  }

  const detailsWithTx = details.map((d) => ({
    ...d,
    id_transaksi: transaction.id,
  }));

  const { error: dtError } = await supabase
    .from("detail_transaksi_keluar")
    .insert(detailsWithTx);

  if (dtError) {
    return NextResponse.json({ error: dtError.message }, { status: 500 });
  }

  // Deduct stock for items where hitung_stok = true
  for (const item of items) {
    const prod = productMap.get(item.id_produk);
    if (prod?.hitung_stok && typeof prod.stok === 'number') {
      await supabase
        .from("produk")
        .update({ stok: prod.stok - item.qty })
        .eq("id", item.id_produk);
    }
  }

  return NextResponse.json({
    success: true,
    no_transaksi,
    total: total_tagihan,
    kembali,
  });
}
