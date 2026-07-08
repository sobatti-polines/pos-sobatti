import { SupabaseClient } from "@supabase/supabase-js";

export interface CreateHutangParams {
  id_supplier: number;
  id_barang_masuk?: number;
  tanggal_hutang: string;
  tanggal_jatuh_tempo?: string | null;
  jumlah_awal: number;
  catatan?: string;
}

export async function createHutang(supabase: SupabaseClient, params: CreateHutangParams) {
  const { data, error } = await supabase.from("hutang_dagang").insert({
    id_supplier: params.id_supplier,
    id_barang_masuk: params.id_barang_masuk || null,
    tanggal_hutang: params.tanggal_hutang,
    tanggal_jatuh_tempo: params.tanggal_jatuh_tempo || null,
    jumlah_awal: params.jumlah_awal,
    jumlah_terbayar: 0,
    status: "belum_lunas",
    catatan: params.catatan || null,
  }).select().single();

  if (error) {
    throw new Error(`Failed to create hutang: ${error.message}`);
  }
  return data;
}

export interface BayarHutangParams {
  id_hutang: string;
  id_pengguna: number;
  tanggal_bayar: string;
  jumlah_bayar: number;
  metode_bayar: string;
  bukti_bayar?: string;
  catatan?: string;
}

export async function bayarHutang(supabase: SupabaseClient, params: BayarHutangParams) {
  // 1. Get current hutang
  const { data: hutang, error: hutangErr } = await supabase
    .from("hutang_dagang")
    .select("jumlah_awal, jumlah_terbayar")
    .eq("id", params.id_hutang)
    .single();

  if (hutangErr || !hutang) {
    throw new Error(`Hutang not found: ${params.id_hutang}`);
  }

  // 2. Insert payment
  const { error: bayarErr } = await supabase.from("pembayaran_hutang").insert({
    id_hutang: params.id_hutang,
    tanggal_bayar: params.tanggal_bayar,
    jumlah_bayar: params.jumlah_bayar,
    metode_bayar: params.metode_bayar,
    bukti_bayar: params.bukti_bayar || null,
    id_pengguna: params.id_pengguna,
    catatan: params.catatan || null,
  });

  if (bayarErr) {
    throw new Error(`Failed to insert pembayaran: ${bayarErr.message}`);
  }

  // 3. Update hutang_dagang status and jumlah_terbayar
  const newTerbayar = Number(hutang.jumlah_terbayar) + Number(params.jumlah_bayar);
  const newStatus = newTerbayar >= Number(hutang.jumlah_awal) ? "lunas" : "belum_lunas";

  const { error: updateErr } = await supabase
    .from("hutang_dagang")
    .update({
      jumlah_terbayar: newTerbayar,
      status: newStatus,
      updated_at: new Date().toISOString(),
    })
    .eq("id", params.id_hutang);

  if (updateErr) {
    throw new Error(`Failed to update hutang: ${updateErr.message}`);
  }

  return { success: true };
}

export async function getHutangList(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from("hutang_dagang")
    .select(`
      *,
      supplier:id_supplier ( id, nama_supplier )
    `)
    .order("tanggal_hutang", { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch hutang: ${error.message}`);
  }
  return data;
}
