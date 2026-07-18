import { SupabaseClient } from "@supabase/supabase-js";
import { startOfDay, endOfDay, subDays, format } from "date-fns";

export async function getDailyCashSummary(supabase: SupabaseClient, date: string) {
  const d = new Date(date);
  const start = startOfDay(d).toISOString();
  const end = endOfDay(d).toISOString();
  const dateStr = format(d, "yyyy-MM-dd");

  // 1. Get Saldo Awal (Yesterday's Saldo Akhir)
  const yesterdayStr = format(subDays(d, 1), "yyyy-MM-dd");
  const { data: yesterdayKas } = await supabase
    .from("saldo_kas_harian")
    .select("saldo_akhir")
    .eq("tanggal", yesterdayStr)
    .single();

  let saldoAwal = yesterdayKas?.saldo_akhir || 0;

  // If no yesterday record, check if it's the first day in pengaturan_keuangan
  if (!yesterdayKas) {
    const { data: config } = await supabase.from("pengaturan_keuangan").select("modal_awal").single();
    if (config) saldoAwal = config.modal_awal;
  }

  // 2. Calculate Inflow (Total Masuk)
  // 2a. Sales Inflow (Tunai)
  const { data: tunaiMethod } = await supabase.from("metode_bayar").select("id").eq("nama", "Tunai").single();
  const tunaiId = tunaiMethod?.id;

  const { data: sales } = await supabase
    .from("transaksi_keluar")
    .select("total, bayar, kembali")
    .eq("id_metode_bayar", tunaiId)
    .gte("tgl_transaksi", start)
    .lte("tgl_transaksi", end);

  const salesInflow = (sales || []).reduce((acc, s) => {
    // Cash inflow is what customer paid minus change given, but limited to total if paid more
    // Actually bayar - kembali = total if they paid exact or more.
    // If they paid less (Credit), it's handled in Piutang.
    return acc + (Number(s.bayar) - Number(s.kembali));
  }, 0);

  const totalMasuk = salesInflow;

  // 3. Calculate Outflow (Total Keluar)
  // All purchases are cash now (hutang feature removed)
  const { data: cashPurchases } = await supabase
    .from("barang_masuk")
    .select("total")
    .gte("tgl_masuk", dateStr)
    .lte("tgl_masuk", dateStr);
  
  const purchaseOutflow = (cashPurchases || []).reduce((acc, cp) => acc + Number(cp.total), 0);

  const totalKeluar = purchaseOutflow;

  const expectedSaldoAkhir = Number(saldoAwal) + totalMasuk - totalKeluar;

  return {
    tanggal: dateStr,
    saldo_awal: saldoAwal,
    total_masuk: totalMasuk,
    total_keluar: totalKeluar,
    saldo_akhir_sistem: expectedSaldoAkhir,
    detail: {
      sales_tunai: salesInflow,
      piutang_tunai: 0,
      hutang_tunai: 0,
      pembelian_tunai: purchaseOutflow
    }
  };
}

export async function confirmTutupKasir(
  supabase: SupabaseClient, 
  params: {
    tanggal: string;
    saldo_awal: number;
    total_masuk: number;
    total_keluar: number;
    uang_aktual: number;
    id_pengguna: number;
  }
) {
  const saldo_akhir = Number(params.saldo_awal) + Number(params.total_masuk) - Number(params.total_keluar);
  const selisih = Number(params.uang_aktual) - saldo_akhir;

  const { data, error } = await supabase
    .from("saldo_kas_harian")
    .upsert({
      tanggal: params.tanggal,
      saldo_awal: params.saldo_awal,
      total_masuk: params.total_masuk,
      total_keluar: params.total_keluar,
      uang_aktual: params.uang_aktual,
      selisih: selisih,
      id_pengguna: params.id_pengguna,
      dikonfirmasi: true
    }, { onConflict: 'tanggal' })
    .select()
    .single();

  if (error) throw new Error(`Failed to confirm tutup kasir: ${error.message}`);
  return data;
}
