import { SupabaseClient } from "@supabase/supabase-js";
import { format } from "date-fns";
import { getDailyCashSummary } from "./laporan-kasir";

export async function generateLabaRugi(
  supabase: SupabaseClient,
  startDate: string,
  endDate: string
) {
  // tgl_transaksi is stored in UTC; use WIB (+07:00) day boundaries.
  const start = `${startDate}T00:00:00+07:00`;
  const end = `${endDate}T23:59:59+07:00`;

  // 1. Fetch sales aggregation
  const { data: sales, error: salesErr } = await supabase
    .from("transaksi_keluar")
    .select("subtotal, diskon_nominal, pajak_nominal, total, total_hpp")
    .gte("tgl_transaksi", start)
    .lte("tgl_transaksi", end)
    .limit(100000);

  if (salesErr) {
    console.error("Failed to fetch sales for P&L:", salesErr);
    throw new Error("Terjadi kesalahan saat mengambil data penjualan");
  }

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

  // ─── K1-08: Penyesuaian (Selisih Kas + Koreksi/Stok) ───────────────────────

  // Selisih kas periode: Σ saldo_kas_harian.selisih pada tanggal dalam rentang
  // Catatan: selisih kas tercatat per hari (tutup kasir), jadi filter per tanggal
  const { data: selisihRows } = await supabase
    .from("saldo_kas_harian")
    .select("selisih")
    .gte("tanggal", startDate)
    .lte("tanggal", endDate)
    .limit(100000);
  const selisihKasPeriode = (selisihRows || []).reduce(
    (acc, r) => acc + Number(r.selisih || 0),
    0
  );

  // Koreksi stok periode: Σ(barang_masuk AKTIF.total) − Σ(detail_retur.jumlah)
  //                     − (persediaan akhir periode + Σ total_hpp)
  // Identitas perpetual untuk periode tertentu
  const { data: purchases } = await supabase
    .from("barang_masuk")
    .select("total")
    .eq("status", "AKTIF")
    .gte("tgl_masuk", startDate)
    .lte("tgl_masuk", endDate)
    .limit(100000);
  const purchaseTotal = (purchases || []).reduce(
    (acc, p) => acc + Number(p.total || 0),
    0
  );

  const { data: returs } = await supabase
    .from("retur_pembelian")
    .select("id")
    .gte("tgl_retur", startDate)
    .lte("tgl_retur", endDate)
    .limit(100000);
  const returIds = (returs || []).map((r) => r.id);

  let returDetailTotal = 0;
  if (returIds.length > 0) {
    const { data: returDetails } = await supabase
      .from("detail_retur_pembelian")
      .select("jumlah")
      .in("id_retur", returIds)
      .limit(100000);
    returDetailTotal = (returDetails || []).reduce(
      (acc, d) => acc + Number(d.jumlah || 0),
      0
    );
  }

  // Persediaan akhir periode (gunakan tanggal akhir)
  const { data: inventoryValues } = await supabase
    .rpc("get_inventory_value_at_date", { p_date: endDate });
  const persediaanAkhir = Number(inventoryValues || 0);

  // Koreksi stok = Pembelian Bersih − (Persediaan + HPP)
  const koreksiStok = purchaseTotal - returDetailTotal - (persediaanAkhir + summary.total_hpp);

  // ─── K1-09: Beban Operasional Dinamis ──────────────────────────────────────
  // Baca dari tabel `pengeluaran` (Fase B). Jika tabel tidak ada/kosong, return [] + 0
  let bebanPerKategori: Array<{ nama: string; jumlah: number }> = [];
  let totalBebanOperasional = 0;

  try {
    const { data: pengeluaran, error: pengeluaranErr } = await supabase
      .from("pengeluaran")
      .select("jumlah, kategori_beban(nama)")
      .eq("status", "AKTIF")
      .gte("tanggal", startDate)
      .lte("tanggal", endDate)
      .limit(100000);

    if (!pengeluaranErr && pengeluaran && pengeluaran.length > 0) {
      // Group by kategori
      const kategoriMap = new Map<string, number>();
      for (const p of pengeluaran) {
        const kategoriRaw = Array.isArray(p.kategori_beban)
          ? (p.kategori_beban[0] as { nama?: string } | undefined)
          : (p.kategori_beban as unknown as { nama?: string } | null);
        const nama = kategoriRaw?.nama || "Lain-lain";
        const jumlah = Number(p.jumlah || 0);
        kategoriMap.set(nama, (kategoriMap.get(nama) || 0) + jumlah);
      }
      bebanPerKategori = Array.from(kategoriMap.entries())
        .map(([nama, jumlah]) => ({
          nama,
          jumlah,
        }))
        .sort((a, b) => a.nama.localeCompare(b.nama));
      totalBebanOperasional = bebanPerKategori.reduce((acc, b) => acc + b.jumlah, 0);
    }
  } catch {
    // Tabel `pengeluaran` belum ada (Fase B belum dijalankan) — safe fallback
    bebanPerKategori = [];
    totalBebanOperasional = 0;
  }

  // Laba bersih = laba_kotor − beban_operasional + penyesuaian
  const laba_bersih =
    laba_kotor - totalBebanOperasional + selisihKasPeriode + koreksiStok;

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
      beban: bebanPerKategori,
    },
    penyesuaian: {
      selisih_kas: selisihKasPeriode,
      koreksi_stok: koreksiStok,
    },
    hasil: {
      laba_kotor: laba_kotor,
      beban_operasional: totalBebanOperasional,
      laba_bersih: laba_bersih,
    },
  };
}

// ─── Helper agregasi Kas (K1-03) ─────────────────────────────────────────────

async function getTunaiId(supabase: SupabaseClient) {
  const { data } = await supabase
    .from("metode_bayar")
    .select("id")
    .eq("nama", "Tunai")
    .maybeSingle();
  return data?.id ?? null;
}

async function getKasTunai(supabase: SupabaseClient, dateStr: string) {
  // 1. Prefer saldo_kas_harian snapshot (uang_aktual if confirmed, else saldo_akhir)
  const { data: kasSnap } = await supabase
    .from("saldo_kas_harian")
    .select("saldo_akhir, uang_aktual, dikonfirmasi")
    .lte("tanggal", dateStr)
    .order("tanggal", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (kasSnap) {
    if (kasSnap.dikonfirmasi && kasSnap.uang_aktual != null) {
      return Number(kasSnap.uang_aktual);
    }
    return Number(kasSnap.saldo_akhir || 0);
  }

  // 2. No snapshot → cumulative restatement since tanggal_mulai (never stale)
  const { data: config } = await supabase
    .from("pengaturan_keuangan")
    .select("modal_awal, tanggal_mulai")
    .maybeSingle();

  const modalAwal = Number(config?.modal_awal || 0);
  const tanggalMulai = config?.tanggal_mulai
    ? format(new Date(config.tanggal_mulai), "yyyy-MM-dd")
    : null;

  const end = `${dateStr}T23:59:59+07:00`;

  let totalKas = modalAwal;

  // Tunai masuk: Σ (bayar - kembali) untuk penjualan tunai
  const tunaiId = await getTunaiId(supabase);
  if (tunaiId != null) {
    const salesQuery = supabase
      .from("transaksi_keluar")
      .select("bayar, kembali")
      .eq("id_metode_bayar", tunaiId)
      .lte("tgl_transaksi", end);
    if (tanggalMulai) salesQuery.gte("tgl_transaksi", `${tanggalMulai}T00:00:00+07:00`);
    const { data: sales } = await salesQuery.limit(100000);

    totalKas += (sales || []).reduce(
      (acc, s) => acc + (Number(s.bayar) - Number(s.kembali)),
      0
    );
  }

  // Keluar tunai: Σ barang_masuk AKTIF (asumsi pembayaran tunai)
  const purchaseQuery = supabase
    .from("barang_masuk")
    .select("total")
    .eq("status", "AKTIF")
    .lte("tgl_masuk", dateStr);
  if (tanggalMulai) purchaseQuery.gte("tgl_masuk", tanggalMulai);
  const { data: purchases } = await purchaseQuery.limit(100000);

  totalKas -= (purchases || []).reduce((acc, p) => acc + Number(p.total || 0), 0);

  // Keluar tunai: pengeluaran operasional metode Tunai (K2-07)
  totalKas -= await sumPengeluaranTunai(supabase, tanggalMulai, dateStr);

  // Masuk tunai: refund retur pembelian (konsisten dgn getDailyCashSummary K1-01)
  const returQuery = supabase
    .from("retur_pembelian")
    .select("total_nilai")
    .lte("tgl_retur", dateStr);
  if (tanggalMulai) returQuery.gte("tgl_retur", tanggalMulai);
  const { data: returRefunds } = await returQuery.limit(100000);
  const returRefundTotal = (returRefunds || []).reduce(
    (acc, r) => acc + Number(r.total_nilai || 0),
    0
  );
  totalKas += returRefundTotal;

  return totalKas;
}

async function getKasBankNonTunai(supabase: SupabaseClient, dateStr: string) {
  // Kas Bank/QRIS = Σ total penjualan non-tunai sampai tanggal laporan
  const tunaiId = await getTunaiId(supabase);
  if (tunaiId == null) return 0;

  const end = `${dateStr}T23:59:59+07:00`;
  const { data: sales } = await supabase
    .from("transaksi_keluar")
    .select("total")
    .neq("id_metode_bayar", tunaiId)
    .lte("tgl_transaksi", end)
    .limit(100000);

  return (sales || []).reduce((acc, s) => acc + Number(s.total || 0), 0);
}

// Helper agregasi pengeluaran operasional metode Tunai (dipakai di K2-07 & K2-08).
// Dibungkus try/catch agar aman bila tabel `pengeluaran` belum ada (Fase B belum dijalankan).
async function sumPengeluaranTunai(
  supabase: SupabaseClient,
  startDate: string | null,
  endDate: string
) {
  try {
    const query = supabase
      .from("pengeluaran")
      .select("jumlah")
      .eq("status", "AKTIF")
      .eq("metode_bayar", "Tunai")
      .lte("tanggal", endDate);
    if (startDate) query.gte("tanggal", startDate);
    const { data } = await query.limit(100000);
    return (data || []).reduce((acc, p) => acc + Number(p.jumlah || 0), 0);
  } catch {
    return 0;
  }
}

export async function generateNeraca(supabase: SupabaseClient, date: string) {
  const dateStr = format(new Date(date), "yyyy-MM-dd");
  const end = `${dateStr}T23:59:59+07:00`;

  // ─── 1. Aset ────────────────────────────────────────────────────────────────
  // 1a. Kas Tunai (laci) + Kas Bank (non-tunai) — K1-03 / K1-04
  const kasTunai = await getKasTunai(supabase, dateStr);
  const kasBank = await getKasBankNonTunai(supabase, dateStr);
  const totalKas = Number(kasTunai) + Number(kasBank);

  // 1b. Piutang Dagang — fitur dihapus, 0
  const totalPiutang = 0;

  // 1c. Persediaan Barang
  const { data: inventoryValues } = await supabase
    .rpc("get_inventory_value_at_date", { p_date: dateStr });
  const totalInventory = Number(inventoryValues || 0);

  // ─── 2. Kewajiban ───────────────────────────────────────────────────────────
  // 2a. Hutang Dagang — fitur dihapus, 0
  const totalHutang = 0;

  // ─── 3. Ekuitas ─────────────────────────────────────────────────────────────
  const { data: config } = await supabase
    .from("pengaturan_keuangan")
    .select("*")
    .maybeSingle();
  const modalAwal = Number(config?.modal_awal || 0);

  // Laba ditahan = profit kumulatif + selisih kas (K1-05) + penyesuaian stok (K1-06)
  const { data: allSales } = await supabase
    .from("transaksi_keluar")
    .select("total, pajak_nominal, total_hpp")
    .lte("tgl_transaksi", end)
    .limit(100000);

  const { profit, hppTotal } = (allSales || []).reduce(
    (acc, s) => {
      const netRev = Number(s.total || 0) - Number(s.pajak_nominal || 0);
      acc.profit += netRev - Number(s.total_hpp || 0);
      acc.hppTotal += Number(s.total_hpp || 0);
      return acc;
    },
    { profit: 0, hppTotal: 0 }
  );

  // K1-05: Σ selisih kas (null → 0) sampai tanggal laporan
  const { data: selisihRows } = await supabase
    .from("saldo_kas_harian")
    .select("selisih")
    .lte("tanggal", dateStr)
    .limit(100000);
  const selisihKas = (selisihRows || []).reduce(
    (acc, r) => acc + Number(r.selisih || 0),
    0
  );

  // K1-06: penyesuaian stok = Σ(barang_masuk AKTIF.total) − Σ(detail_retur.jumlah)
  //                     − (persediaan + Σ total_hpp) — identitas perpetual
  const { data: purchases } = await supabase
    .from("barang_masuk")
    .select("total")
    .eq("status", "AKTIF")
    .lte("tgl_masuk", dateStr)
    .limit(100000);
  const purchaseTotal = (purchases || []).reduce(
    (acc, p) => acc + Number(p.total || 0),
    0
  );

  const { data: returs } = await supabase
    .from("retur_pembelian")
    .select("id")
    .lte("tgl_retur", dateStr)
    .limit(100000);
  const returIds = (returs || []).map((r) => r.id);

  let returDetailTotal = 0;
  if (returIds.length > 0) {
    const { data: returDetails } = await supabase
      .from("detail_retur_pembelian")
      .select("jumlah")
      .in("id_retur", returIds)
      .limit(100000);
    returDetailTotal = (returDetails || []).reduce(
      (acc, d) => acc + Number(d.jumlah || 0),
      0
    );
  }

  const penyesuaianStok =
    purchaseTotal - returDetailTotal - (totalInventory + hppTotal);

  const labaDitahan = profit + selisihKas + penyesuaianStok;
  const totalEquity = modalAwal + labaDitahan;

  const totalAset = totalKas + totalPiutang + totalInventory;
  const totalKewajiban = totalHutang;

  // K1-07: residual untuk garansi balance (hanya display/audit, tidak ubah ekuitas)
  const penyesuaianNeraca = totalAset - (totalKewajiban + totalEquity);

  return {
    tanggal: dateStr,
    aset: {
      kas_tunai: Number(kasTunai),
      kas_bank: Number(kasBank),
      kas: totalKas,
      piutang: totalPiutang,
      persediaan: totalInventory,
      total_aset: totalAset,
    },
    kewajiban: {
      hutang: totalHutang,
      total_kewajiban: totalKewajiban,
    },
    ekuitas: {
      modal_awal: modalAwal,
      laba_ditahan: labaDitahan,
      selisih_kas: selisihKas,
      penyesuaian_stok: penyesuaianStok,
      total_ekuitas: totalEquity,
    },
    penyesuaian_neraca: penyesuaianNeraca,
  };
}

// ─── K2-08: Laporan Arus Kas ─────────────────────────────────────────────────

export async function generateArusKas(
  supabase: SupabaseClient,
  startDate: string,
  endDate: string
) {
  const start = `${startDate}T00:00:00+07:00`;
  const end = `${endDate}T23:59:59+07:00`;

  // Kas awal (laci): saldo awal pada hari pertama periode (dari tutup kasir/kumulatif)
  const kasAwalSummary = await getDailyCashSummary(supabase, startDate);
  const saldoAwal = Number(kasAwalSummary.saldo_awal || 0);

  // ── Penerimaan ──
  const tunaiId = await getTunaiId(supabase);

  let penerimaanPenjualan = 0;
  if (tunaiId != null) {
    const { data: sales } = await supabase
      .from("transaksi_keluar")
      .select("bayar, kembali")
      .eq("id_metode_bayar", tunaiId)
      .gte("tgl_transaksi", start)
      .lte("tgl_transaksi", end)
      .limit(100000);
    penerimaanPenjualan = (sales || []).reduce(
      (acc, s) => acc + (Number(s.bayar) - Number(s.kembali)),
      0
    );
  }

  const { data: returRefunds } = await supabase
    .from("retur_pembelian")
    .select("total_nilai")
    .gte("tgl_retur", startDate)
    .lte("tgl_retur", endDate)
    .limit(100000);
  const penerimaanRetur = (returRefunds || []).reduce(
    (acc, r) => acc + Number(r.total_nilai || 0),
    0
  );

  // ── Pembayaran ──
  const { data: purchases } = await supabase
    .from("barang_masuk")
    .select("total")
    .eq("status", "AKTIF")
    .gte("tgl_masuk", startDate)
    .lte("tgl_masuk", endDate)
    .limit(100000);
  const pembayaranPembelian = (purchases || []).reduce(
    (acc, p) => acc + Number(p.total || 0),
    0
  );

  const pembayaranPengeluaran = await sumPengeluaranTunai(supabase, startDate, endDate);

  const totalPenerimaan = penerimaanPenjualan + penerimaanRetur;
  const totalPembayaran = pembayaranPembelian + pembayaranPengeluaran;
  const kasBersihOperasi = totalPenerimaan - totalPembayaran;

  const saldoAkhir = saldoAwal + kasBersihOperasi;

  // Cross-check dengan sistem tutup kasir di akhir periode (untuk verifikasi konsistensi)
  let saldoAkhirSistem: number | null = null;
  try {
    const kasAkhirSummary = await getDailyCashSummary(supabase, endDate);
    saldoAkhirSistem = Number(kasAkhirSummary.saldo_akhir_sistem || 0);
  } catch {
    saldoAkhirSistem = null;
  }

  const selisihArusKas =
    saldoAkhirSistem != null ? saldoAkhir - saldoAkhirSistem : null;

  return {
    periode: {
      start: startDate,
      end: endDate,
    },
    kas_awal: {
      saldo_awal: saldoAwal,
    },
    arus_operasi: {
      penerimaan_penjualan_tunai: penerimaanPenjualan,
      penerimaan_retur: penerimaanRetur,
      total_penerimaan: totalPenerimaan,
      pembayaran_pembelian: pembayaranPembelian,
      pembayaran_pengeluaran: pembayaranPengeluaran,
      total_pembayaran: totalPembayaran,
      kas_bersih_operasi: kasBersihOperasi,
    },
    arus_investasi: {
      total: 0,
    },
    arus_pendanaan: {
      total: 0,
    },
    kas_akhir: {
      saldo_akhir: saldoAkhir,
    },
    konsistensi: {
      saldo_akhir_sistem: saldoAkhirSistem,
      selisih_arus_kas: selisihArusKas,
    },
  };
}
