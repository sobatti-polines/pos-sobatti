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
  const id_pelanggan = np("id_pelanggan", 0);
  const id_metode_bayar = np("id_metode_bayar", 0);
  const id_kasir = np("id_kasir", 0);
  const search = sp("search", "");
  const page = Math.max(1, np("page", 1));
  const limit = Math.min(200, Math.max(1, np("limit", 50)));
  const sort_by = sp("sort_by", "tgl_transaksi");
  const sort_order = sp("sort_order", "desc") === "asc" ? "asc" : "desc";
  const include_items = sp("include_items", "true") === "true";

  const errors: string[] = [];
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start_date))
    errors.push("start_date tidak valid. Format: YYYY-MM-DD");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(end_date))
    errors.push("end_date tidak valid. Format: YYYY-MM-DD");

  return {
    start_date,
    end_date,
    id_pelanggan,
    id_metode_bayar,
    id_kasir,
    search,
    page,
    limit,
    sort_by,
    sort_order,
    include_items,
    errors,
  };
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

    /* ---------- build base filter ---------- */
    let countQuery = supabase
      .from("transaksi_keluar")
      .select("*", { count: "exact", head: true })
      .gte("tgl_transaksi", startISO)
      .lte("tgl_transaksi", endISO);

    let dataQuery = supabase
      .from("transaksi_keluar")
      .select(`
        id, no_transaksi, tgl_transaksi, subtotal,
        diskon_persen, diskon_nominal,
        pajak_persen, pajak_nominal,
        total, bayar, kembali, dp, sisa,
        total_hpp, laba_kotor,
        kasir:pengguna!id_kasir(id, nama),
        pelanggan(id, nama_pelanggan, no_hp),
        metode_bayar(id, nama)
      `)
      .gte("tgl_transaksi", startISO)
      .lte("tgl_transaksi", endISO);

    if (p.id_pelanggan) {
      countQuery = countQuery.eq("id_pelanggan", p.id_pelanggan);
      dataQuery = dataQuery.eq("id_pelanggan", p.id_pelanggan);
    }
    if (p.id_metode_bayar) {
      countQuery = countQuery.eq("id_metode_bayar", p.id_metode_bayar);
      dataQuery = dataQuery.eq("id_metode_bayar", p.id_metode_bayar);
    }
    if (p.id_kasir) {
      countQuery = countQuery.eq("id_kasir", p.id_kasir);
      dataQuery = dataQuery.eq("id_kasir", p.id_kasir);
    }
    if (p.search) {
      const s = `%${p.search}%`;
      countQuery = countQuery.or(
        `no_transaksi::text.ilike.${s},pelanggan.nama_pelanggan.ilike.${s}`
      );
      dataQuery = dataQuery.or(
        `no_transaksi::text.ilike.${s},pelanggan.nama_pelanggan.ilike.${s}`
      );
    }

    /* ---------- count ---------- */
    const { count, error: countErr } = await countQuery;
    if (countErr) throw countErr;

    /* ---------- meta aggregates ---------- */
    let aggQuery = supabase
      .from("transaksi_keluar")
      .select("total, total_hpp, laba_kotor, diskon_nominal, pajak_nominal")
      .gte("tgl_transaksi", startISO)
      .lte("tgl_transaksi", endISO);

    if (p.id_pelanggan) aggQuery = aggQuery.eq("id_pelanggan", p.id_pelanggan);
    if (p.id_metode_bayar) aggQuery = aggQuery.eq("id_metode_bayar", p.id_metode_bayar);
    if (p.id_kasir) aggQuery = aggQuery.eq("id_kasir", p.id_kasir);

    const { data: agg, error: aggErr } = await aggQuery;
    if (aggErr) throw aggErr;

    const safe = (v: any) => Number(v ?? 0);
    const totalPenjualan = agg!.reduce((s, r) => s + safe(r.total), 0);
    const totalHpp = agg!.reduce((s, r) => s + safe(r.total_hpp), 0);
    const totalLaba = agg!.reduce((s, r) => s + safe(r.laba_kotor), 0);
    const totalDiskon = agg!.reduce((s, r) => s + safe(r.diskon_nominal), 0);
    const totalPajak = agg!.reduce((s, r) => s + safe(r.pajak_nominal), 0);

    /* ---------- paginated data ---------- */
    const from = (p.page - 1) * p.limit;
    const to = from + p.limit - 1;
    const { data: rows, error: dataErr } = await dataQuery
      .order(p.sort_by, { ascending: p.sort_order === "asc" })
      .range(from, to);

    if (dataErr) throw dataErr;

    /* ---------- fetch items (if requested) ---------- */
    const itemsMap: Record<number, any[]> = {};
    if (p.include_items && rows && rows.length > 0) {
      const ids = rows.map((r: any) => r.id);
      const { data: details, error: detErr } = await supabase
        .from("detail_transaksi_keluar")
        .select(`
          id, id_transaksi, id_produk, type_harga_jual,
          harga_modal, harga_jual, diskon_item, qty, jumlah,
          harga_pokok_satuan, total_harga_pokok, profit, kas_masuk,
          produk!id_produk(nama_produk, barcode, kategori!id_kategori(nama))
        `)
        .in("id_transaksi", ids);

      if (detErr) throw detErr;

      for (const d of details ?? []) {
        const tid = d.id_transaksi;
        if (!itemsMap[tid]) itemsMap[tid] = [];
        const prod: any = d.produk ?? {};
        itemsMap[tid].push({
          id: d.id,
          id_produk: d.id_produk,
          nama_produk: prod.nama_produk ?? "",
          barcode: prod.barcode ?? null,
          kategori: (prod.kategori as any)?.nama ?? null,
          type_harga_jual: d.type_harga_jual,
          harga_modal: Number(d.harga_modal ?? 0),
          harga_jual: Number(d.harga_jual ?? 0),
          diskon_item: Number(d.diskon_item ?? 0),
          qty: Number(d.qty ?? 0),
          jumlah: Number(d.jumlah ?? 0),
          harga_pokok_satuan: Number(d.harga_pokok_satuan ?? 0),
          total_harga_pokok: Number(d.total_harga_pokok ?? 0),
          profit: Number(d.profit ?? 0),
        });
      }
    }

    /* ---------- map rows ---------- */
    const data = (rows ?? []).map((r: any) => {
      const pel = r.pelanggan as any;
      const kas = r.kasir as any;
      const mb = r.metode_bayar as any;
      return {
        id: r.id,
        no_transaksi: r.no_transaksi,
        tgl_transaksi: r.tgl_transaksi,
        kasir: kas ? { id: kas.id, nama: kas.nama } : null,
        pelanggan: pel
          ? { id: pel.id, nama: pel.nama_pelanggan, no_hp: pel.no_hp }
          : null,
        metode_bayar: mb ? { id: mb.id, nama: mb.nama } : null,
        subtotal: Number(r.subtotal ?? 0),
        diskon_persen: Number(r.diskon_persen ?? 0),
        diskon_nominal: Number(r.diskon_nominal ?? 0),
        pajak_persen: Number(r.pajak_persen ?? 0),
        pajak_nominal: Number(r.pajak_nominal ?? 0),
        total: Number(r.total ?? 0),
        bayar: Number(r.bayar ?? 0),
        kembali: Number(r.kembali ?? 0),
        total_hpp: Number(r.total_hpp ?? 0),
        laba_kotor: Number(r.laba_kotor ?? 0),
        items: p.include_items ? (itemsMap[r.id] ?? []) : undefined,
        piutang: null,
      };
    });

    const totalPages = Math.max(1, Math.ceil((count ?? 0) / p.limit));

    return NextResponse.json({
      meta: {
        total_transaksi: count ?? 0,
        total_penjualan: totalPenjualan,
        total_hpp: totalHpp,
        total_laba_kotor: totalLaba,
        total_diskon: totalDiskon,
        total_pajak: totalPajak,
        rata_rata_per_transaksi:
          count && count > 0 ? Math.round(totalPenjualan / count) : 0,
        periode: { start: p.start_date, end: p.end_date },
      },
      data,
      pagination: {
        page: p.page,
        limit: p.limit,
        total: count ?? 0,
        total_pages: totalPages,
      },
    });
  } catch (err: any) {
    console.error("GET /api/laporan/penjualan error:", err);
    return NextResponse.json(
      { error: "Terjadi kesalahan saat mengambil data laporan" },
      { status: 500 }
    );
  }
}
