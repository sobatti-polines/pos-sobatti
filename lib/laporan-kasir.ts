import { SupabaseClient } from "@supabase/supabase-js";
import { format, subDays } from "date-fns";
import { fetchAllRows } from "@/lib/supabase/fetch-all";

// ============================================================================
// KAS KASIR (laci) — model dua kas
// ----------------------------------------------------------------------------
// Laci kasir berisi: uang_awal (float, input kasir saat Buka Sesi) + hasil
// penjualan tunai. Pembelian & pengeluaran operasional TIDAK keluar dari laci
// (pembelian tidak dipantau kas; pengeluaran operasional dari Kas Admin).
//
// Alur harian:
//   1. Buka Sesi  → openKasirSession(tanggal, uang_awal) → saldo_kas_harian
//                   (uang_awal terisi, dikonfirmasi = false)
//   2. Tutup Kasir → getDailyCashSummary (hitung penjualan tunai) lalu
//                    confirmTutupKasir (input uang_aktual, hitung selisih,
//                    dikonfirmasi = true)
//
// Laporan: penambahan hari ini = total_masuk = saldo_akhir − uang_awal.
// ============================================================================

export async function getDailyCashSummary(supabase: SupabaseClient, date: string) {
  const d = new Date(date);
  const dateStr = format(d, "yyyy-MM-dd");

  // tgl_transaksi is stored in UTC; use WIB (+07:00) day boundaries so
  // 00:00–06:59 WIB sales are counted on the correct business day.
  const start = `${dateStr}T00:00:00+07:00`;
  const end = `${dateStr}T23:59:59+07:00`;

  // 0. Sesi kas kasir hari ini (saldo_kas_harian row)
  const { data: todayRow } = await supabase
    .from("saldo_kas_harian")
    .select("uang_awal, saldo_awal, dikonfirmasi")
    .eq("tanggal", dateStr)
    .maybeSingle();

  const uangAwal: number | null =
    todayRow?.uang_awal != null ? Number(todayRow.uang_awal) : null;
  // Sesi dianggap "dibuka" jika baris saldo_kas_harian untuk tanggal tsb ada
  // (data lama tanpa uang_awal tetap terhitung sebagai sesi yang pernah dibuka).
  const sudahDibuka = Boolean(todayRow);
  const sudahDitutup = Boolean(todayRow?.dikonfirmasi);

  // 1. Saldo Awal = uang_awal sesi. Jika belum buka sesi → saldo akhir kemarin
  //    (kompatibilitas data lama) → fallback modal_awal.
  let saldoAwal = uangAwal ?? 0;
  if (uangAwal == null) {
    const yesterdayStr = format(subDays(d, 1), "yyyy-MM-dd");
    const { data: yesterdayKas } = await supabase
      .from("saldo_kas_harian")
      .select("saldo_akhir")
      .eq("tanggal", yesterdayStr)
      .single();

    saldoAwal = yesterdayKas?.saldo_akhir || 0;

    if (!yesterdayKas) {
      const { data: config } = await supabase.from("pengaturan_keuangan").select("modal_awal").single();
      if (config) saldoAwal = config.modal_awal;
    }
  }

  // 2. Total Masuk = penjualan tunai neto (yang dibayar customer: bayar − kembali)
  const { data: tunaiMethod } = await supabase.from("metode_bayar").select("id").eq("nama", "Tunai").single();
  const tunaiId = tunaiMethod?.id;

  const sales = await fetchAllRows(supabase, (db, from, to) =>
    db
      .from("transaksi_keluar")
      .select("total, bayar, kembali")
      .eq("id_metode_bayar", tunaiId)
      .gte("tgl_transaksi", start)
      .lte("tgl_transaksi", end)
      .range(from, to)
  );

  const salesInflow = (sales || []).reduce((acc, s) => {
    return acc + (Number(s.bayar) - Number(s.kembali));
  }, 0);

  // 3. Total Keluar = 0 — laci hanya berisi float + penjualan tunai.
  //    Pembelian barang tidak dipantau kas; pengeluaran operasional dari Kas Admin.
  const totalKeluar = 0;

  const totalMasuk = salesInflow;
  const expectedSaldoAkhir = Number(saldoAwal) + totalMasuk - totalKeluar;
  // Penambahan hari ini = hasil penjualan tunai neto (saldo akhir − uang_awal)
  const penambahan = totalMasuk;

  return {
    tanggal: dateStr,
    uang_awal: uangAwal,
    saldo_awal: saldoAwal,
    total_masuk: totalMasuk,
    total_keluar: totalKeluar,
    penambahan: penambahan,
    saldo_akhir_sistem: expectedSaldoAkhir,
    sesi: { sudah_dibuka: sudahDibuka, sudah_ditutup: sudahDitutup },
    detail: {
      sales_tunai: salesInflow,
      penerimaan_retur: 0,           // refund retur masuk ke Kas Admin, bukan laci
      piutang_tunai: 0,
      hutang_tunai: 0,
      pembelian_tunai: 0,            // pembelian tidak dipantau dari laci
      pengeluaran_operasional: 0,    // pengeluaran operasional dari Kas Admin
    }
  };
}

/** Buka Sesi Kas Kasir: simpan uang_awal (float) untuk tanggal tsb. */
export async function openKasirSession(
  supabase: SupabaseClient,
  params: { tanggal: string; uang_awal: number; id_pengguna: number }
) {
  const uangAwal = Number(params.uang_awal);
  if (!(uangAwal > 0)) {
    throw new Error("Uang awal harus lebih dari 0");
  }

  // Sesi yang sudah dibuka TIDAK bisa dibuka lagi (sekali input, terkunci).
  // Baik sesi masih berjalan (belum ditutup) maupun sudah ditutup.
  const { data: existing } = await supabase
    .from("saldo_kas_harian")
    .select("dikonfirmasi")
    .eq("tanggal", params.tanggal)
    .maybeSingle();

  if (existing) {
    throw new Error(
      "Anda sudah memasukkan uang kas hari ini — sesi tidak bisa dibuka ulang"
    );
  }

  const { data, error } = await supabase
    .from("saldo_kas_harian")
    .upsert({
      tanggal: params.tanggal,
      uang_awal: uangAwal,
      saldo_awal: uangAwal,
      total_masuk: 0,
      total_keluar: 0,
      dikonfirmasi: false,
      id_pengguna: params.id_pengguna,
    }, { onConflict: "tanggal" })
    .select()
    .single();

  if (error) {
    console.error("Failed to open kasir session:", error);
    throw new Error("Gagal membuka sesi kasir");
  }
  return data;
}

export async function confirmTutupKasir(
  supabase: SupabaseClient,
  params: {
    tanggal: string;
    uang_awal: number | null;
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
      uang_awal: params.uang_awal,
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
