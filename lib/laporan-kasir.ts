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

  // 2b. Piutang Payments (Tunai)
  const { data: piutangPayments } = await supabase
    .from("pembayaran_piutang")
    .select("jumlah_bayar")
    .eq("metode_bayar", "Tunai")
    .gte("tanggal_bayar", dateStr)
    .lte("tanggal_bayar", dateStr);
  
  const piutangInflow = (piutangPayments || []).reduce((acc, p) => acc + Number(p.jumlah_bayar), 0);

  const totalMasuk = salesInflow + piutangInflow;

  // 3. Calculate Outflow (Total Keluar)
  // 3a. Hutang Payments (Tunai)
  const { data: hutangPayments } = await supabase
    .from("pembayaran_hutang")
    .select("jumlah_bayar")
    .eq("metode_bayar", "Tunai")
    .gte("tanggal_bayar", dateStr)
    .lte("tanggal_bayar", dateStr);

  const hutangOutflow = (hutangPayments || []).reduce((acc, p) => acc + Number(p.jumlah_bayar), 0);

  // 3b. Cash Purchases (Barang Masuk without Hutang)
  const { data: cashPurchases } = await supabase
    .from("barang_masuk")
    .select("id, total")
    .gte("tgl_masuk", dateStr)
    .lte("tgl_masuk", dateStr);
  
  let purchaseOutflow = 0;
  if (cashPurchases && cashPurchases.length > 0) {
    const ids = cashPurchases.map(cp => cp.id);
    const { data: linkedHutang } = await supabase
      .from("hutang_dagang")
      .select("id_barang_masuk")
      .in("id_barang_masuk", ids);
    
    const linkedIds = new Set((linkedHutang || []).map(lh => lh.id_barang_masuk));
    purchaseOutflow = cashPurchases
      .filter(cp => !linkedIds.has(cp.id))
      .reduce((acc, cp) => acc + Number(cp.total), 0);
  }

  const totalKeluar = hutangOutflow + purchaseOutflow;

  const expectedSaldoAkhir = Number(saldoAwal) + totalMasuk - totalKeluar;

  return {
    tanggal: dateStr,
    saldo_awal: saldoAwal,
    total_masuk: totalMasuk,
    total_keluar: totalKeluar,
    saldo_akhir_sistem: expectedSaldoAkhir,
    detail: {
      sales_tunai: salesInflow,
      piutang_tunai: piutangInflow,
      hutang_tunai: hutangOutflow,
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
