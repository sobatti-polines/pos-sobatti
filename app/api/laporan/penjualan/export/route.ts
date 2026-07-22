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
  const np = (key: string, fallback: number): number => {
    const v = req.nextUrl.searchParams.get(key);
    return v ? Number(v) : fallback;
  };

  const today = new Date().toISOString().slice(0, 10);
  const start_date = sp("start_date", today);
  const end_date = sp("end_date", today);
  const format = sp("format", "csv");
  const id_pelanggan = np("id_pelanggan", 0);
  const id_metode_bayar = np("id_metode_bayar", 0);
  const id_kasir = np("id_kasir", 0);

  const errors: string[] = [];
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start_date))
    errors.push("start_date tidak valid");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(end_date))
    errors.push("end_date tidak valid");
  if (!["csv"].includes(format)) errors.push("format harus csv");

  return { start_date, end_date, format, id_pelanggan, id_metode_bayar, id_kasir, errors };
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

    let q = supabase
      .from("transaksi_keluar")
      .select(`
        no_transaksi, tgl_transaksi, subtotal,
        diskon_persen, diskon_nominal,
        pajak_persen, pajak_nominal,
        total, bayar, kembali,
        total_hpp, laba_kotor,
        kasir:pengguna!id_kasir(nama),
        pelanggan(nama_pelanggan),
        metode_bayar(nama)
      `)
      .gte("tgl_transaksi", startISO)
      .lte("tgl_transaksi", endISO)
      .order("tgl_transaksi", { ascending: false });

    if (p.id_pelanggan) q = q.eq("id_pelanggan", p.id_pelanggan);
    if (p.id_metode_bayar) q = q.eq("id_metode_bayar", p.id_metode_bayar);
    if (p.id_kasir) q = q.eq("id_kasir", p.id_kasir);

    const { data: rows, error } = await q;
    if (error) throw error;

    /* ---------- build CSV ---------- */
    const esc = (v: any) => {
      const s = String(v ?? "");
      return s.includes(",") || s.includes('"') || s.includes("\n")
        ? `"${s.replace(/"/g, '""')}"`
        : s;
    };

    const headerRow = [
      "No Transaksi",
      "Tanggal",
      "Kasir",
      "Pelanggan",
      "Metode Bayar",
      "Subtotal",
      "Diskon %",
      "Diskon",
      "PPN %",
      "PPN",
      "Total",
      "Bayar",
      "Kembali",
      "Total HPP",
      "Laba Kotor",
    ];

    const csvRows = [headerRow.map(esc).join(",")];
    for (const r of rows ?? []) {
      const kas = r.kasir as any;
      const pel = r.pelanggan as any;
      const mb = r.metode_bayar as any;
      csvRows.push(
        [
          r.no_transaksi,
          r.tgl_transaksi,
          kas?.nama ?? "",
          pel?.nama_pelanggan ?? "",
          mb?.nama ?? "",
          r.subtotal,
          r.diskon_persen,
          r.diskon_nominal,
          r.pajak_persen,
          r.pajak_nominal,
          r.total,
          r.bayar,
          r.kembali,
          r.total_hpp,
          r.laba_kotor,
        ]
          .map(esc)
          .join(",")
      );
    }

    const csv = csvRows.join("\n");
    const filename = `penjualan_${p.start_date}_${p.end_date}.csv`;

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (err: any) {
    console.error("GET /api/laporan/penjualan/export error:", err);
    return NextResponse.json(
      { error: "Terjadi kesalahan saat mengekspor data" },
      { status: 500 }
    );
  }
}
