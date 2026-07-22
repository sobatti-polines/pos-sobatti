/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

async function checkAuth(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { data: pengguna } = await supabase
    .from("pengguna")
    .select("level")
    .eq("username", user.email?.split("@")[0])
    .single();
  if (
    !pengguna ||
    (pengguna.level !== "ADMIN" && pengguna.level !== "OWNER")
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return null;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function parseParams(req: NextRequest) {
  const sp = (key: string, fallback: string): string =>
    req.nextUrl.searchParams.get(key) ?? fallback;

  const today = new Date().toISOString().slice(0, 10);
  const start_date = sp("start_date", today);
  const end_date = sp("end_date", today);
  const group_by = sp("group_by", "hari");

  const allowedGroups = ["hari", "kasir", "metode_bayar", "pelanggan"];
  const errors: string[] = [];
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start_date))
    errors.push("start_date tidak valid");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(end_date))
    errors.push("end_date tidak valid");
  if (!allowedGroups.includes(group_by))
    errors.push(`group_by harus salah satu: ${allowedGroups.join(", ")}`);

  return { start_date, end_date, group_by, errors };
}

/* ------------------------------------------------------------------ */
/*  GET                                                                */
/* ------------------------------------------------------------------ */

export async function GET(req: NextRequest) {
  try {
    const authErr = await checkAuth(req);
    if (authErr) return authErr;

    const p = parseParams(req);
    if (p.errors.length) {
      return NextResponse.json({ error: p.errors.join("; ") }, { status: 400 });
    }

    const supabase = await createAdminClient();
    const startISO = `${p.start_date}T00:00:00+07:00`;
    const endISO = `${p.end_date}T23:59:59+07:00`;

    const { data: rows, error } = await supabase
      .from("transaksi_keluar")
      .select(`
        id, tgl_transaksi, total, total_hpp, laba_kotor, diskon_nominal, pajak_nominal,
        id_kasir, kasir:pengguna!id_kasir(nama),
        id_pelanggan, pelanggan(id, nama_pelanggan),
        id_metode_bayar, metode_bayar(nama)
      `)
      .gte("tgl_transaksi", startISO)
      .lte("tgl_transaksi", endISO);

    if (error) throw error;

    const safe = (v: any) => Number(v ?? 0);
    const groups: Record<string, any> = {};
    const groupKey = (r: any): string => {
      switch (p.group_by) {
        case "hari":
          return (r.tgl_transaksi ?? "").slice(0, 10);
        case "kasir":
          return `k_${r.id_kasir}`;
        case "metode_bayar":
          return `mb_${r.id_metode_bayar}`;
        case "pelanggan":
          return `p_${r.id_pelanggan ?? 0}`;
        default:
          return "";
      }
    };

    for (const r of rows ?? []) {
      const key = groupKey(r);
      if (!groups[key]) {
        const base: any = {
          total_transaksi: 0,
          total_penjualan: 0,
          total_laba: 0,
          total_hpp: 0,
          total_diskon: 0,
          total_pajak: 0,
          total_item_terjual: 0,
        };
        switch (p.group_by) {
          case "hari":
            base.tanggal = (r.tgl_transaksi ?? "").slice(0, 10);
            break;
          case "kasir":
            base.id_kasir = r.id_kasir;
            base.nama_kasir = (r.kasir as any)?.nama ?? "";
            break;
          case "metode_bayar":
            base.id_metode_bayar = r.id_metode_bayar;
            base.metode_bayar = (r.metode_bayar as any)?.nama ?? "";
            break;
          case "pelanggan":
            base.id_pelanggan = r.id_pelanggan;
            base.nama_pelanggan = (r.pelanggan as any)?.nama_pelanggan ?? "";
            break;
        }
        groups[key] = base;
      }
      const g = groups[key];
      g.total_transaksi++;
      g.total_penjualan += safe(r.total);
      g.total_laba += safe(r.laba_kotor);
      g.total_hpp += safe(r.total_hpp);
      g.total_diskon += safe(r.diskon_nominal);
      g.total_pajak += safe(r.pajak_nominal);
    }

    const data = Object.values(groups);

    return NextResponse.json({
      meta: {
        periode: { start: p.start_date, end: p.end_date },
        total_penjualan: data.reduce((s, g: any) => s + g.total_penjualan, 0),
        total_transaksi: data.reduce((s, g: any) => s + g.total_transaksi, 0),
        group_by: p.group_by,
      },
      data,
    });
  } catch (err: any) {
    console.error("GET /api/laporan/penjualan/rekap error:", err);
    return NextResponse.json(
      { error: "Terjadi kesalahan saat mengambil rekap penjualan" },
      { status: 500 }
    );
  }
}
