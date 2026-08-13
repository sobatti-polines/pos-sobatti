import { SupabaseClient } from "@supabase/supabase-js";
import { format, subDays } from "date-fns";

export async function getDailyCashSummary(supabase: SupabaseClient, date: string) {
  const d = new Date(date);
  const dateStr = format(d, "yyyy-MM-dd");

  // tgl_transaksi is stored in UTC; use WIB (+07:00) day boundaries so
  // 00:00–06:59 WIB sales are counted on the correct business day.
  const start = `${dateStr}T00:00:00+07:00`;
  const end = `${dateStr}T23:59:59+07:00`;

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

  // 2b. Retur Pembelian Refund (asumsi refund tunai — uang dikembalikan supplier)
  const { data: returRefunds } = await supabase
    .from("retur_pembelian")
    .select("total_nilai")
    .eq("tgl_retur", dateStr);

  const returRefund = (returRefunds || []).reduce((acc, r) => acc + Number(r.total_nilai || 0), 0);

  const totalMasuk = salesInflow + returRefund;

  // 3. Calculate Outflow (Total Keluar)
  // All purchases are cash now (hutang feature removed)
  const { data: cashPurchases } = await supabase
    .from("barang_masuk")
    .select("total")
    .eq("status", "AKTIF")
    .gte("tgl_masuk", dateStr)
    .lte("tgl_masuk", dateStr);
  
  const purchaseOutflow = (cashPurchases || []).reduce((acc, cp) => acc + Number(cp.total), 0);

  // K2-06: Pengeluaran operasional tunai sebagai outflow.
  // Gunakan try/catch agar aman bila tabel `pengeluaran` belum dijalankan (Fase B).
  let pengeluaranOutflow = 0;
  try {
    const { data: operasional } = await supabase
      .from("pengeluaran")
      .select("jumlah")
      .eq("status", "AKTIF")
      .eq("metode_bayar", "Tunai")
      .gte("tanggal", dateStr)
      .lte("tanggal", dateStr);

    pengeluaranOutflow = (operasional || []).reduce(
      (acc, p) => acc + Number(p.jumlah || 0),
      0
    );
  } catch {
    pengeluaranOutflow = 0;
  }

  const totalKeluar = purchaseOutflow + pengeluaranOutflow;

  const expectedSaldoAkhir = Number(saldoAwal) + totalMasuk - totalKeluar;

  return {
    tanggal: dateStr,
    saldo_awal: saldoAwal,
    total_masuk: totalMasuk,
    total_keluar: totalKeluar,
    saldo_akhir_sistem: expectedSaldoAkhir,
    detail: {
      sales_tunai: salesInflow,
      penerimaan_retur: returRefund,
      piutang_tunai: 0,
      hutang_tunai: 0,
      pembelian_tunai: purchaseOutflow,
      pengeluaran_operasional: pengeluaranOutflow,
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

  if (error) {
    console.error("Failed to confirm tutup kasir:", error);
    throw new Error("Gagal mengonfirmasi tutup kasir");
  }
  return data;
}
