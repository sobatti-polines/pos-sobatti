import { SupabaseClient } from "@supabase/supabase-js";
import { format, subDays } from "date-fns";
import { fetchAllRows } from "@/lib/supabase/fetch-all";

export async function generateLabaRugi(
  supabase: SupabaseClient,
  startDate: string,
  endDate: string
) {
  // tgl_transaksi is stored in UTC; use WIB (+07:00) day boundaries.
  const start = `${startDate}T00:00:00+07:00`;
  const end = `${endDate}T23:59:59+07:00`;

  // 1. Fetch sales aggregation
  const sales = await fetchAllRows(supabase, (db, from, to) =>
    db
      .from("transaksi_keluar")
      .select("subtotal, diskon_nominal, pajak_nominal, total, total_hpp")
      .gte("tgl_transaksi", start)
      .lte("tgl_transaksi", end)
      .range(from, to)
  ).catch((salesErr) => {
    console.error("Failed to fetch sales for P&L:", salesErr);
    throw new Error("Terjadi kesalahan saat mengambil data penjualan");
  });

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
  const selisihRows = await fetchAllRows(supabase, (db, from, to) =>
    db
      .from("saldo_kas_harian")
      .select("selisih")
      .gte("tanggal", startDate)
      .lte("tanggal", endDate)
      .range(from, to)
  );
  const selisihKasPeriode = (selisihRows || []).reduce(
    (acc, r) => acc + Number(r.selisih || 0),
    0
  );

  // Koreksi stok periode: Σ(barang_masuk AKTIF.total) − Σ(detail_retur.jumlah)
  //                     − (persediaan akhir periode + Σ total_hpp)
  // Identitas perpetual untuk periode tertentu
  const purchases = await fetchAllRows(supabase, (db, from, to) =>
    db
      .from("barang_masuk")
      .select("total")
      .eq("status", "AKTIF")
      .gte("tgl_masuk", startDate)
      .lte("tgl_masuk", endDate)
      .range(from, to)
  );
  const purchaseTotal = (purchases || []).reduce(
    (acc, p) => acc + Number(p.total || 0),
    0
  );

  const returs = await fetchAllRows(supabase, (db, from, to) =>
    db
      .from("retur_pembelian")
      .select("id")
      .gte("tgl_retur", startDate)
      .lte("tgl_retur", endDate)
      .range(from, to)
  );
  const returIds = (returs || []).map((r) => r.id);

  let returDetailTotal = 0;
  if (returIds.length > 0) {
    const returDetails = await fetchAllRows(supabase, (db, from, to) =>
      db
        .from("detail_retur_pembelian")
        .select("jumlah")
        .in("id_retur", returIds)
        .range(from, to)
    );
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
    const pengeluaran = await fetchAllRows(supabase, (db, from, to) =>
      db
        .from("pengeluaran")
        .select("jumlah, kategori_beban(nama)")
        .eq("status", "AKTIF")
        .gte("tanggal", startDate)
        .lte("tanggal", endDate)
        .range(from, to)
    );

    if (pengeluaran && pengeluaran.length > 0) {
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

// Kas Kasir (laci) = Σ penjualan tunai neto (bayar − kembali) kumulatif ≤ date.
// Uang awal (float) tidak dihitung sebagai kas usaha di Neraca — float adalah
// uang kembalian milik owner yang tetap berada di laci (dijelaskan di CaLK).
export async function getKasKasir(supabase: SupabaseClient, dateStr: string) {
  const tunaiId = await getTunaiId(supabase);
  if (tunaiId == null) return 0;

  const end = `${dateStr}T23:59:59+07:00`;
  const sales = await fetchAllRows(supabase, (db, from, to) =>
    db
      .from("transaksi_keluar")
      .select("bayar, kembali")
      .eq("id_metode_bayar", tunaiId)
      .lte("tgl_transaksi", end)
      .range(from, to)
  );

  return (sales || []).reduce(
    (acc, s) => acc + (Number(s.bayar) - Number(s.kembali)),
    0
  );
}

// Kas Admin (operasional owner) = Σ topup + Σ refund retur pembelian
// − Σ pengeluaran Tunai AKTIF (kumulatif ≤ date).
// Saldo berjalan (rollover): penambahan saldo hanya saat admin meminta ke owner.
export async function getKasAdmin(supabase: SupabaseClient, dateStr: string) {
  // MASUK: penambahan saldo (topup) dari owner
  let topupTotal = 0;
  try {
    const topups = await fetchAllRows(supabase, (db, from, to) =>
      db
        .from("kas_admin_topup")
        .select("jumlah")
        .lte("tanggal", dateStr)
        .range(from, to)
    );
    topupTotal = (topups || []).reduce(
      (acc, r) => acc + Number(r.jumlah || 0),
      0
    );
  } catch {
    topupTotal = 0;
  }

  // MASUK: refund retur pembelian (uang kembali ke kas operasional)
  const returs = await fetchAllRows(supabase, (db, from, to) =>
    db
      .from("retur_pembelian")
      .select("total_nilai")
      .lte("tgl_retur", dateStr)
      .range(from, to)
  );
  const returTotal = (returs || []).reduce(
    (acc, r) => acc + Number(r.total_nilai || 0),
    0
  );

  // KELUAR: pengeluaran operasional Tunai AKTIF
  const pengeluaranTotal = await sumPengeluaranTunai(supabase, null, dateStr);

  return topupTotal + returTotal - pengeluaranTotal;
}

export async function getKasBankNonTunai(supabase: SupabaseClient, dateStr: string) {
  // Kas Bank/QRIS = Σ total penjualan non-tunai sampai tanggal laporan
  const tunaiId = await getTunaiId(supabase);
  if (tunaiId == null) return 0;

  const end = `${dateStr}T23:59:59+07:00`;
  const sales = await fetchAllRows(supabase, (db, from, to) =>
    db
      .from("transaksi_keluar")
      .select("total")
      .neq("id_metode_bayar", tunaiId)
      .lte("tgl_transaksi", end)
      .range(from, to)
  );

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
    const data = await fetchAllRows(supabase, (db, from, to) =>
      query.range(from, to)
    );
    return (data || []).reduce((acc, p) => acc + Number(p.jumlah || 0), 0);
  } catch {
    return 0;
  }
}

export async function generateNeraca(supabase: SupabaseClient, date: string) {
  const dateStr = format(new Date(date), "yyyy-MM-dd");
  const end = `${dateStr}T23:59:59+07:00`;

  // ─── 1. Aset ────────────────────────────────────────────────────────────────
  // 1a. Kas Kasir (laci) + Kas Admin (operasional) + Kas Bank (non-tunai)
  const kasKasir = await getKasKasir(supabase, dateStr);
  const kasAdmin = await getKasAdmin(supabase, dateStr);
  const kasBank = await getKasBankNonTunai(supabase, dateStr);
  const totalKas = Number(kasKasir) + Number(kasAdmin) + Number(kasBank);

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

  // Penambahan modal: top-up kas admin dari owner → bagian dari ekuitas
  let penambahanModal = 0;
  try {
    const topups = await fetchAllRows(supabase, (db, from, to) =>
      db
        .from("kas_admin_topup")
        .select("jumlah")
        .lte("tanggal", dateStr)
        .range(from, to)
    );
    penambahanModal = (topups || []).reduce(
      (acc, r) => acc + Number(r.jumlah || 0),
      0
    );
  } catch {
    penambahanModal = 0;
  }

  // Laba ditahan = profit kumulatif + selisih kas (K1-05) + penyesuaian stok (K1-06)
  const allSales = await fetchAllRows(supabase, (db, from, to) =>
    db
      .from("transaksi_keluar")
      .select("total, pajak_nominal, total_hpp")
      .lte("tgl_transaksi", end)
      .range(from, to)
  );

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
  const selisihRows = await fetchAllRows(supabase, (db, from, to) =>
    db
      .from("saldo_kas_harian")
      .select("selisih")
      .lte("tanggal", dateStr)
      .range(from, to)
  );
  const selisihKas = (selisihRows || []).reduce(
    (acc, r) => acc + Number(r.selisih || 0),
    0
  );

  // K1-06: penyesuaian stok = Σ(barang_masuk AKTIF.total) − Σ(detail_retur.jumlah)
  //                     − (persediaan + Σ total_hpp) — identitas perpetual
  const purchases = await fetchAllRows(supabase, (db, from, to) =>
    db
      .from("barang_masuk")
      .select("total")
      .eq("status", "AKTIF")
      .lte("tgl_masuk", dateStr)
      .range(from, to)
  );
  const purchaseTotal = (purchases || []).reduce(
    (acc, p) => acc + Number(p.total || 0),
    0
  );

  const returs = await fetchAllRows(supabase, (db, from, to) =>
    db
      .from("retur_pembelian")
      .select("id")
      .lte("tgl_retur", dateStr)
      .range(from, to)
  );
  const returIds = (returs || []).map((r) => r.id);

  let returDetailTotal = 0;
  if (returIds.length > 0) {
    const returDetails = await fetchAllRows(supabase, (db, from, to) =>
      db
        .from("detail_retur_pembelian")
        .select("jumlah")
        .in("id_retur", returIds)
        .range(from, to)
    );
    returDetailTotal = (returDetails || []).reduce(
      (acc, d) => acc + Number(d.jumlah || 0),
      0
    );
  }

  const penyesuaianStok =
    purchaseTotal - returDetailTotal - (totalInventory + hppTotal);

  const labaDitahan = profit + selisihKas + penyesuaianStok;
  const totalEquity = modalAwal + penambahanModal + labaDitahan;

  const totalAset = totalKas + totalPiutang + totalInventory;
  const totalKewajiban = totalHutang;

  // K1-07: residual untuk garansi balance (hanya display/audit, tidak ubah ekuitas)
  const penyesuaianNeraca = totalAset - (totalKewajiban + totalEquity);

  return {
    tanggal: dateStr,
    aset: {
      kas_tunai: Number(kasKasir),
      kas_admin: Number(kasAdmin),
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
      penambahan_modal: penambahanModal,
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

  // Kas awal = Kas Kasir (laci) + Kas Admin pada akhir hari sebelum periode
  const dayBeforeStart = format(subDays(new Date(startDate), 1), "yyyy-MM-dd");
  const kasKasirAwal = await getKasKasir(supabase, dayBeforeStart);
  const kasAdminAwal = await getKasAdmin(supabase, dayBeforeStart);
  const saldoAwal = kasKasirAwal + kasAdminAwal;

  // ── Penerimaan ──
  const tunaiId = await getTunaiId(supabase);

  let penerimaanPenjualan = 0;
  if (tunaiId != null) {
    const sales = await fetchAllRows(supabase, (db, from, to) =>
      db
        .from("transaksi_keluar")
        .select("bayar, kembali")
        .eq("id_metode_bayar", tunaiId)
        .gte("tgl_transaksi", start)
        .lte("tgl_transaksi", end)
        .range(from, to)
    );
    penerimaanPenjualan = (sales || []).reduce(
      (acc, s) => acc + (Number(s.bayar) - Number(s.kembali)),
      0
    );
  }

  const returRefunds = await fetchAllRows(supabase, (db, from, to) =>
    db
      .from("retur_pembelian")
      .select("total_nilai")
      .gte("tgl_retur", startDate)
      .lte("tgl_retur", endDate)
      .range(from, to)
  );
  const penerimaanRetur = (returRefunds || []).reduce(
    (acc, r) => acc + Number(r.total_nilai || 0),
    0
  );

  // ── Pembayaran ──
  // Pembelian barang TIDAK dipantau kas (dibayar langsung oleh owner di luar kas)
  const pembayaranPembelian = 0;
  const pembayaranPengeluaran = await sumPengeluaranTunai(supabase, startDate, endDate);

  const totalPenerimaan = penerimaanPenjualan + penerimaanRetur;
  const totalPembayaran = pembayaranPembelian + pembayaranPengeluaran;
  const kasBersihOperasi = totalPenerimaan - totalPembayaran;

  // ── Pendanaan: penambahan saldo kas admin dari owner ──
  let topupTotal = 0;
  try {
    const topups = await fetchAllRows(supabase, (db, from, to) =>
      db
        .from("kas_admin_topup")
        .select("jumlah")
        .gte("tanggal", startDate)
        .lte("tanggal", endDate)
        .range(from, to)
    );
    topupTotal = (topups || []).reduce(
      (acc, r) => acc + Number(r.jumlah || 0),
      0
    );
  } catch {
    topupTotal = 0;
  }

  const totalPendanaan = topupTotal;
  const saldoAkhir = saldoAwal + kasBersihOperasi + totalPendanaan;

  // Cross-check dengan kas sistem (Kas Kasir + Kas Admin) di akhir periode
  const kasKasirAkhir = await getKasKasir(supabase, endDate);
  const kasAdminAkhir = await getKasAdmin(supabase, endDate);
  const saldoAkhirSistem = kasKasirAkhir + kasAdminAkhir;
  const selisihArusKas = saldoAkhir - saldoAkhirSistem;

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
      total: totalPendanaan,
      penambahan_kas_admin: topupTotal,
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
