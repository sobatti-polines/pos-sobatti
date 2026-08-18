"use server";

import { createClient } from "@/lib/supabase/server";
import { fetchAllRows } from "@/lib/supabase/fetch-all";

/* ------------------------------------------------------------------ */
/*  Types                                                               */
/* ------------------------------------------------------------------ */

export interface SesiOpnameRow {
  id: string;
  no_sesi: string;
  tgl_sesi: string;
  status: string;
  total_item: number;
  total_selisih: number;
  total_nilai: number;
  keterangan: string | null;
  operator: string;
}

export interface LaporanStokOpnameData {
  sesiList: SesiOpnameRow[];
  summary: {
    totalSesi: number;
    totalItem: number;
    totalSelisih: number;
    totalDefisit: number;
    totalSurplus: number;
    shrinkageRate: number;
  };
  bulanan: Array<{
    bulan: string;
    sesi: number;
    item: number;
    selisih: number;
    defisit: number;
    surplus: number;
    shrinkage: number;
  }>;
}

/* ------------------------------------------------------------------ */
/*  Fetch laporan stok opname                                           */
/* ------------------------------------------------------------------ */

export async function fetchLaporanStokOpname(filters: {
  start_date?: string;
  end_date?: string;
  status?: string;
}): Promise<LaporanStokOpnameData> {
  const supabase = await createClient();

  let query = supabase
    .from("sesi_stok_opname")
    .select(`
      id,
      no_sesi,
      tgl_sesi,
      status,
      total_item,
      total_selisih,
      total_nilai,
      keterangan,
      pengguna(nama, username),
      stok_opname(
        id,
        selisih,
        klasifikasi,
        harga_pokok_snap
      )
    `)
    .order("tgl_sesi", { ascending: false });

  if (filters.start_date) {
    query = query.gte("tgl_sesi", filters.start_date);
  }
  if (filters.end_date) {
    query = query.lte("tgl_sesi", filters.end_date);
  }
  if (filters.status) {
    query = query.eq("status", filters.status);
  } else {
    // Default: only SELESAI
    query = query.eq("status", "SELESAI");
  }

  const rawSesi = await fetchAllRows(supabase, (db, from, to) =>
    query.range(from, to)
  ).catch((error) => {
    console.error("Fetch laporan stok opname error:", error);
    return null;
  });

  if (rawSesi == null) {
    return {
      sesiList: [],
      summary: { totalSesi: 0, totalItem: 0, totalSelisih: 0, totalDefisit: 0, totalSurplus: 0, shrinkageRate: 0 },
      bulanan: [],
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sesiList: SesiOpnameRow[] = (rawSesi ?? []).map((s: any) => ({
    id: s.id,
    no_sesi: s.no_sesi,
    tgl_sesi: s.tgl_sesi,
    status: s.status,
    total_item: s.total_item ?? 0,
    total_selisih: s.total_selisih ?? 0,
    total_nilai: s.total_nilai ?? 0,
    keterangan: s.keterangan,
    operator: s.pengguna?.nama || s.pengguna?.username || "-",
  }));

  // Compute summary
  const totalSesi = sesiList.length;
  const totalItem = sesiList.reduce((s, r) => s + r.total_item, 0);
  const totalSelisih = sesiList.reduce((s, r) => s + r.total_selisih, 0);

  // Defisit & Surplus from stok_opname items
  let totalDefisit = 0;
  let totalSurplus = 0;

  for (const s of (rawSesi ?? [])) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const items = (s as any).stok_opname ?? [];
    for (const item of items) {
      const nilai = (item.selisih ?? 0) * (item.harga_pokok_snap ?? 0);
      if (nilai < 0) totalDefisit += nilai;
      else if (nilai > 0) totalSurplus += nilai;
    }
  }

  // Shrinkage rate: defisit / (defisit + surplus) if both > 0
  const shrinkageRate =
    totalDefisit < 0 && totalSurplus >= 0
      ? Math.abs(totalDefisit) / (Math.abs(totalDefisit) + totalSurplus) * 100
      : 0;

  // Group by month
  const bulananMap: Record<
    string,
    { bulan: string; sesi: number; item: number; selisih: number; defisit: number; surplus: number; shrinkage: number }
  > = {};

  for (const s of sesiList) {
    const bulan = s.tgl_sesi.slice(0, 7); // YYYY-MM
    if (!bulananMap[bulan]) {
      bulananMap[bulan] = { bulan, sesi: 0, item: 0, selisih: 0, defisit: 0, surplus: 0, shrinkage: 0 };
    }
    bulananMap[bulan].sesi++;
    bulananMap[bulan].item += s.total_item;
    bulananMap[bulan].selisih += s.total_selisih;
    bulananMap[bulan].defisit += Math.min(s.total_nilai, 0);
    bulananMap[bulan].surplus += Math.max(s.total_nilai, 0);
  }

  // Compute shrinkage per month
  for (const b of Object.values(bulananMap)) {
    b.shrinkage =
      b.defisit < 0 && b.surplus >= 0
        ? Math.abs(b.defisit) / (Math.abs(b.defisit) + b.surplus) * 100
        : 0;
  }

  const bulanan = Object.values(bulananMap).sort((a, b) => b.bulan.localeCompare(a.bulan));

  return {
    sesiList,
    summary: { totalSesi, totalItem, totalSelisih, totalDefisit, totalSurplus, shrinkageRate },
    bulanan,
  };
}
