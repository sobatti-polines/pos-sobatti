/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

async function checkAuth() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { data: pengguna } = await supabase
    .from("pengguna")
    .select("level")
    .eq("username", user.email?.split("@")[0])
    .single();
  if (
    !pengguna ||
    (pengguna.level !== "ADMIN" && pengguna.level !== "OWNER")
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return null;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authErr = await checkAuth();
    if (authErr) return authErr;

    const { id } = await params;
    const transaksiId = Number(id);
    if (isNaN(transaksiId) || transaksiId < 1) {
      return NextResponse.json({ error: "ID transaksi tidak valid" }, { status: 400 });
    }

    const supabase = await createAdminClient();

    /* ---------- header ---------- */
    const { data: header, error: hErr } = await supabase
      .from("transaksi_keluar")
      .select(`
        id, no_transaksi, tgl_transaksi, subtotal,
        diskon_persen, diskon_nominal,
        pajak_persen, pajak_nominal,
        total, bayar, kembali, dp, sisa,
        total_hpp, laba_kotor,
        kasir:pengguna!id_kasir(id, nama),
        pelanggan(id, nama_pelanggan, no_hp),
        metode_bayar(id, nama)
      `)
      .eq("id", transaksiId)
      .single();

    if (hErr) {
      if (hErr.code === "PGRST116") {
        return NextResponse.json(
          { error: "Transaksi tidak ditemukan" },
          { status: 404 }
        );
      }
      throw hErr;
    }

    /* ---------- items ---------- */
    const { data: details, error: dErr } = await supabase
      .from("detail_transaksi_keluar")
      .select(`
        id, id_transaksi, id_produk, type_harga_jual,
        harga_modal, harga_jual, diskon_item, qty, jumlah,
        harga_pokok_satuan, total_harga_pokok, profit, kas_masuk,
        produk!id_produk(nama_produk, barcode, kategori!id_kategori(nama))
      `)
      .eq("id_transaksi", transaksiId);

    if (dErr) throw dErr;

    /* ---------- map ---------- */
    const pel = header.pelanggan as any;
    const kas = header.kasir as any;
    const mb = header.metode_bayar as any;

    const items = (details ?? []).map((d: any) => {
      const prod: any = d.produk ?? {};
      return {
        id: d.id,
        id_produk: d.id_produk,
        nama_produk: prod.nama_produk ?? "",
        barcode: prod.barcode ?? null,
        kategori: (prod.kategori as any)?.nama ?? null,
        type_harga_jual: d.type_harga_jual,
        harga_modal: Number(d.harga_modal ?? 0),
        harga_jual: Number(d.harga_jual ?? 0),
        diskon_item: Number(d.diskon_item ?? 0),
        qty: Number(d.qty ?? 0),
        jumlah: Number(d.jumlah ?? 0),
        harga_pokok_satuan: Number(d.harga_pokok_satuan ?? 0),
        total_harga_pokok: Number(d.total_harga_pokok ?? 0),
        profit: Number(d.profit ?? 0),
      };
    });

    const result = {
      id: header.id,
      no_transaksi: header.no_transaksi,
      tgl_transaksi: header.tgl_transaksi,
      kasir: kas ? { id: kas.id, nama: kas.nama } : null,
      pelanggan: pel
        ? { id: pel.id, nama: pel.nama_pelanggan, no_hp: pel.no_hp }
        : null,
      metode_bayar: mb ? { id: mb.id, nama: mb.nama } : null,
      subtotal: Number(header.subtotal ?? 0),
      diskon_persen: Number(header.diskon_persen ?? 0),
      diskon_nominal: Number(header.diskon_nominal ?? 0),
      pajak_persen: Number(header.pajak_persen ?? 0),
      pajak_nominal: Number(header.pajak_nominal ?? 0),
      total: Number(header.total ?? 0),
      bayar: Number(header.bayar ?? 0),
      kembali: Number(header.kembali ?? 0),
      total_hpp: Number(header.total_hpp ?? 0),
      laba_kotor: Number(header.laba_kotor ?? 0),
      items,
      piutang: null,
    };

    return NextResponse.json({ data: result });
  } catch (err: any) {
    console.error(`GET /api/laporan/penjualan/[id] error:`, err);
    return NextResponse.json(
      { error: "Terjadi kesalahan saat mengambil detail transaksi" },
      { status: 500 }
    );
  }
}
