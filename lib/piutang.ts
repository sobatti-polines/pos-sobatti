import { SupabaseClient } from "@supabase/supabase-js";

export interface CreatePiutangParams {
  id_pelanggan: number;
  id_transaksi_keluar?: number;
  tanggal_piutang: string;
  tanggal_jatuh_tempo?: string | null;
  jumlah_awal: number;
  catatan?: string;
}

export async function createPiutang(supabase: SupabaseClient, params: CreatePiutangParams) {
  const { data, error } = await supabase.from("piutang_dagang").insert({
    id_pelanggan: params.id_pelanggan,
    id_transaksi_keluar: params.id_transaksi_keluar || null,
    tanggal_piutang: params.tanggal_piutang,
    tanggal_jatuh_tempo: params.tanggal_jatuh_tempo || null,
    jumlah_awal: params.jumlah_awal,
    jumlah_terbayar: 0,
    status: "belum_lunas",
    catatan: params.catatan || null,
  }).select().single();

  if (error) {
    throw new Error(`Failed to create piutang: ${error.message}`);
  }
  return data;
}

export interface BayarPiutangParams {
  id_piutang: string;
  id_pengguna: number;
  tanggal_bayar: string;
  jumlah_bayar: number;
  metode_bayar: string;
  catatan?: string;
}

export async function bayarPiutang(supabase: SupabaseClient, params: BayarPiutangParams) {
  // 1. Get current piutang
  const { data: piutang, error: piutangErr } = await supabase
    .from("piutang_dagang")
    .select("jumlah_awal, jumlah_terbayar")
    .eq("id", params.id_piutang)
    .single();

  if (piutangErr || !piutang) {
    throw new Error(`Piutang not found: ${params.id_piutang}`);
  }

  // 2. Insert payment
  const { error: bayarErr } = await supabase.from("pembayaran_piutang").insert({
    id_piutang: params.id_piutang,
    tanggal_bayar: params.tanggal_bayar,
    jumlah_bayar: params.jumlah_bayar,
    metode_bayar: params.metode_bayar,
    id_pengguna: params.id_pengguna,
    catatan: params.catatan || null,
  });

  if (bayarErr) {
    throw new Error(`Failed to insert pembayaran: ${bayarErr.message}`);
  }

  // 3. Update piutang_dagang status and jumlah_terbayar
  const newTerbayar = Number(piutang.jumlah_terbayar) + Number(params.jumlah_bayar);
  const newStatus = newTerbayar >= Number(piutang.jumlah_awal) ? "lunas" : "belum_lunas";

  const { error: updateErr } = await supabase
    .from("piutang_dagang")
    .update({
      jumlah_terbayar: newTerbayar,
      status: newStatus,
      updated_at: new Date().toISOString(),
    })
    .eq("id", params.id_piutang);

  if (updateErr) {
    throw new Error(`Failed to update piutang: ${updateErr.message}`);
  }

  return { success: true };
}

export async function getPiutangList(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from("piutang_dagang")
    .select(`
      *,
      pelanggan:id_pelanggan ( id, nama_pelanggan )
    `)
    .order("tanggal_piutang", { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch piutang: ${error.message}`);
  }
  return data;
}
