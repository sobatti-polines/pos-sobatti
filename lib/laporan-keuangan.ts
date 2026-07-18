import { SupabaseClient } from "@supabase/supabase-js";
import { startOfDay, endOfDay, format } from "date-fns";

export async function generateLabaRugi(
  supabase: SupabaseClient,
  startDate: string,
  endDate: string
) {
  const start = startOfDay(new Date(startDate)).toISOString();
  const end = endOfDay(new Date(endDate)).toISOString();

  // 1. Fetch sales aggregation
  const { data: sales, error: salesErr } = await supabase
    .from("transaksi_keluar")
    .select("subtotal, diskon_nominal, pajak_nominal, total, total_hpp")
    .gte("tgl_transaksi", start)
    .lte("tgl_transaksi", end);

  if (salesErr) throw new Error(`Failed to fetch sales for P&L: ${salesErr.message}`);

  const summary = (sales || []).reduce(
    (acc, s) => {
      acc.penjualan_kotor += Number(s.subtotal || 0);
      acc.diskon_nominal += Number(s.diskon_nominal || 0);
      acc.pajak_nominal += Number(s.pajak_nominal || 0);
      acc.total_penjualan += Number(s.total || 0);
      acc.total_hpp += Number(s.total_hpp || 0);
      return acc;
    },
    {
      penjualan_kotor: 0,
      diskon_nominal: 0,
      pajak_nominal: 0,
      total_penjualan: 0,
      total_hpp: 0,
    }
  );

  // Pendapatan Bersih = Total Penjualan - Pajak
  // (Karena 'total' sudah (subtotal - diskon + pajak))
  const pendapatan_bersih = summary.total_penjualan - summary.pajak_nominal;
  const laba_kotor = pendapatan_bersih - summary.total_hpp;

  return {
    periode: {
      start: startDate,
      end: endDate,
    },
    pendapatan: {
      penjualan_kotor: summary.penjualan_kotor,
      diskon: summary.diskon_nominal,
      pendapatan_bersih: pendapatan_bersih,
    },
    biaya: {
      hpp: summary.total_hpp,
    },
    hasil: {
      laba_kotor: laba_kotor,
      beban_operasional: 0, // Placeholder for future use
      laba_bersih: laba_kotor, // laba_kotor - beban_operasional
    },
  };
}

export async function generateNeraca(supabase: SupabaseClient, date: string) {
  const dateStr = format(new Date(date), "yyyy-MM-dd");

  // 1. Fetch Assets
  // 1a. Kas & Setara Kas (Latest snapshot before or on date)
  const { data: kasSnap } = await supabase
    .from("saldo_kas_harian")
    .select("saldo_akhir")
    .lte("tanggal", dateStr)
    .order("tanggal", { ascending: false })
    .limit(1)
    .maybeSingle();
  
  let totalKas = kasSnap?.saldo_akhir || 0;
  // If no snapshot, use modal_awal as fallback
  if (!kasSnap) {
    const { data: config } = await supabase.from("pengaturan_keuangan").select("modal_awal").single();
    if (config) totalKas = config.modal_awal;
  }

  // 1b. Piutang Dagang — feature removed, set to 0
  const totalPiutang = 0;

  // 1c. Persediaan Barang (Value from riwayat_avco latest snapshots per product)
  // This is a bit complex in SQL, so we'll approximate using current value 
  // or fetch latest record per product from riwayat_avco
  const { data: inventoryValues } = await supabase
    .rpc("get_inventory_value_at_date", { p_date: dateStr });
  
  const totalInventory = Number(inventoryValues || 0);

  // 2. Fetch Liabilities
  // 2a. Hutang Dagang — feature removed, set to 0
  const totalHutang = 0;

  // 3. Fetch Equity
  const { data: config } = await supabase.from("pengaturan_keuangan").select("*").single();
  const modalAwal = Number(config?.modal_awal || 0);

  // Laba Ditahan (Cumulative profit from start until date)
  const { data: allSales } = await supabase
    .from("transaksi_keluar")
    .select("total, pajak_nominal, total_hpp")
    .lte("tgl_transaksi", endOfDay(new Date(date)).toISOString());

  const labaDitahan = (allSales || []).reduce((acc, s) => {
    const netRev = Number(s.total) - Number(s.pajak_nominal);
    return acc + (netRev - Number(s.total_hpp));
  }, 0);

  const totalEquity = modalAwal + labaDitahan;

  return {
    tanggal: dateStr,
    aset: {
      kas: totalKas,
      piutang: totalPiutang,
      persediaan: totalInventory,
      total_aset: Number(totalKas) + totalPiutang + totalInventory
    },
    kewajiban: {
      hutang: totalHutang,
      total_kewajiban: totalHutang
    },
    ekuitas: {
      modal_awal: modalAwal,
      laba_ditahan: labaDitahan,
      total_ekuitas: totalEquity
    }
  };
}
