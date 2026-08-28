"use server";

import { getTodayWIB } from "@/lib/utils";
import { createClient } from "@/lib/supabase/server";
import { fetchAllRows } from "@/lib/supabase/fetch-all";
import {
  getKasAdmin,
  getKasBankNonTunai,
  getKasKasir,
} from "@/lib/laporan-keuangan";
import { isAdminOrOwnerLike } from "@/lib/roles";

export type KasKasirRow = {
  tanggal: string;
  uang_awal: number | null;
  saldo_awal: number;
  total_masuk: number;
  total_keluar: number;
  penambahan: number;
  saldo_akhir: number;
  uang_aktual: number | null;
  selisih: number | null;
  dikonfirmasi: boolean;
  kasir: string | null;
};

export type KasAdminRow = {
  id: string;
  tanggal: string;
  jenis: "MASUK" | "KELUAR";
  keterangan: string;
  sumber: "topup" | "retur" | "pengeluaran";
  jumlah: number;
  saldo_setelah: number;
  oleh: string | null;
};

export type LaporanKasData = {
  periode: { start: string; end: string };
  saldo_akhir_periode: { kas_kasir: number; kas_admin: number; kas_bank: number };
  ringkasan: {
    kasir_penambahan: number;
    kasir_selisih: number;
    kas_admin_masuk: number;
    kas_admin_keluar: number;
  };
  kasir_harian: KasKasirRow[];
  kas_admin_mutasi: KasAdminRow[];
};

async function requireAdminOwner() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase: null, error: "Unauthorized" };

  const role = user.user_metadata?.role;
  if (!isAdminOrOwnerLike(role)) {
    return { supabase: null, error: "Forbidden — laporan kas hanya untuk admin/owner" };
  }
  return { supabase, error: null };
}

export async function getLaporanKas(input?: {
  tanggal_awal?: string;
  tanggal_akhir?: string;
}) {
  const { supabase, error: authErr } = await requireAdminOwner();
  if (authErr || !supabase) return { error: authErr || "Unauthorized" };

  const today = getTodayWIB();
  const startDate = input?.tanggal_awal || "1970-01-01";
  const endDate = input?.tanggal_akhir || today;

  // ── 1. Kas Kasir — riwayat harian ──
  let kasirQuery = supabase
    .from("saldo_kas_harian")
    .select(
      "tanggal, uang_awal, saldo_awal, total_masuk, total_keluar, saldo_akhir, uang_aktual, selisih, dikonfirmasi, pengguna:id_pengguna ( nama, username )"
    )
    .lte("tanggal", endDate)
    .order("tanggal", { ascending: false });
  if (startDate !== "1970-01-01") {
    kasirQuery = kasirQuery.gte("tanggal", startDate);
  }
  const kasirRows = await fetchAllRows(supabase, (db, from, to) =>
    kasirQuery.range(from, to)
  );

  const getNama = (rel: unknown): string | null => {
    if (Array.isArray(rel)) {
      const first = rel[0] as { nama?: string; username?: string } | undefined;
      return first?.nama || first?.username || null;
    }
    const obj = rel as { nama?: string; username?: string } | null;
    return obj?.nama || obj?.username || null;
  };

  const kasirHarian: KasKasirRow[] = (kasirRows ?? []).map((r) => {
    const uangAwal = r.uang_awal != null ? Number(r.uang_awal) : Number(r.saldo_awal || 0);
    const saldoAkhir = Number(r.saldo_akhir || 0);
    return {
      tanggal: r.tanggal,
      uang_awal: r.uang_awal != null ? Number(r.uang_awal) : null,
      saldo_awal: Number(r.saldo_awal || 0),
      total_masuk: Number(r.total_masuk || 0),
      total_keluar: Number(r.total_keluar || 0),
      penambahan: saldoAkhir - uangAwal,
      saldo_akhir: saldoAkhir,
      uang_aktual: r.uang_aktual != null ? Number(r.uang_aktual) : null,
      selisih: r.selisih != null ? Number(r.selisih) : null,
      dikonfirmasi: Boolean(r.dikonfirmasi),
      kasir: getNama(r.pengguna),
    };
  });

  // ── 2. Kas Admin — mutasi + saldo berjalan ──
  const [topups, returs, pengeluaran] = await Promise.all([
    fetchAllRows(supabase, (db, from, to) =>
      db
        .from("kas_admin_topup")
        .select("id, tanggal, jumlah, keterangan, pengguna(nama, username)")
        .order("tanggal", { ascending: true })
        .range(from, to)
    ),
    fetchAllRows(supabase, (db, from, to) =>
      db
        .from("retur_pembelian")
        .select("id, no_retur, tgl_retur, total_nilai")
        .order("tgl_retur", { ascending: true })
        .range(from, to)
    ),
    fetchAllRows(supabase, (db, from, to) =>
      db
        .from("pengeluaran")
        .select(
          "id, tanggal, nama_pengeluaran, jumlah, keterangan, kategori_beban(nama), pengguna!pengeluaran_id_pengguna_fkey(nama, username)"
        )
        .eq("status", "AKTIF")
        .eq("metode_bayar", "Tunai")
        .order("tanggal", { ascending: true })
        .range(from, to)
    ),
  ]);

  const rawMutasi: Array<{
    id: string;
    tanggal: string;
    jenis: "MASUK" | "KELUAR";
    keterangan: string;
    sumber: KasAdminRow["sumber"];
    jumlah: number;
    oleh: string | null;
  }> = [];

  for (const t of topups ?? []) {
    rawMutasi.push({
      id: `topup-${t.id}`,
      tanggal: t.tanggal,
      jenis: "MASUK",
      keterangan: t.keterangan || "Penambahan saldo dari owner",
      sumber: "topup",
      jumlah: Number(t.jumlah || 0),
      oleh: getNama(t.pengguna),
    });
  }
  for (const r of returs ?? []) {
    rawMutasi.push({
      id: `retur-${r.id}`,
      tanggal: r.tgl_retur,
      jenis: "MASUK",
      keterangan: `Refund retur pembelian (${r.no_retur})`,
      sumber: "retur",
      jumlah: Number(r.total_nilai || 0),
      oleh: null,
    });
  }
  for (const p of pengeluaran ?? []) {
    const kategori = Array.isArray(p.kategori_beban)
      ? (p.kategori_beban[0] as { nama?: string } | undefined)?.nama
      : (p.kategori_beban as unknown as { nama?: string } | null)?.nama;
    rawMutasi.push({
      id: `pengeluaran-${p.id}`,
      tanggal: p.tanggal,
      jenis: "KELUAR",
      keterangan: `Pengeluaran: ${p.nama_pengeluaran}${kategori ? ` (${kategori})` : ""}`,
      sumber: "pengeluaran",
      jumlah: Number(p.jumlah || 0),
      oleh: getNama(p.pengguna),
    });
  }

  rawMutasi.sort((a, b) => (a.tanggal === b.tanggal ? 0 : a.tanggal < b.tanggal ? -1 : 1));

  // Saldo berjalan (kumulatif seluruh waktu) lalu filter periode
  let running = 0;
  const allWithBalance = rawMutasi.map((m) => {
    running += m.jenis === "MASUK" ? m.jumlah : -m.jumlah;
    return { ...m, saldo_setelah: running };
  });

  const kasAdminMutasi = allWithBalance
    .filter((m) => m.tanggal >= startDate && m.tanggal <= endDate)
    .reverse();

  // ── 3. Saldo akhir periode (getKasKasir/getKasAdmin/getKasBankNonTunai) ──
  const [kasKasir, kasAdmin, kasBank] = await Promise.all([
    getKasKasir(supabase, endDate),
    getKasAdmin(supabase, endDate),
    getKasBankNonTunai(supabase, endDate),
  ]);

  const ringkasan = {
    kasir_penambahan: kasirHarian.reduce((acc, r) => acc + r.penambahan, 0),
    kasir_selisih: kasirHarian.reduce((acc, r) => acc + (r.selisih ?? 0), 0),
    kas_admin_masuk: kasAdminMutasi
      .filter((m) => m.jenis === "MASUK")
      .reduce((acc, m) => acc + m.jumlah, 0),
    kas_admin_keluar: kasAdminMutasi
      .filter((m) => m.jenis === "KELUAR")
      .reduce((acc, m) => acc + m.jumlah, 0),
  };

  return {
    data: {
      periode: { start: startDate, end: endDate },
      saldo_akhir_periode: {
        kas_kasir: kasKasir,
        kas_admin: kasAdmin,
        kas_bank: kasBank,
      },
      ringkasan,
      kasir_harian: kasirHarian,
      kas_admin_mutasi: kasAdminMutasi,
    } satisfies LaporanKasData,
  };
}
