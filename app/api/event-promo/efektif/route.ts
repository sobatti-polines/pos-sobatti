import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  
  try {
    const body = await request.json();
    const { id_produk } = body; // Bisa single number atau array of numbers

    if (!id_produk) {
      return NextResponse.json({ error: "id_produk diperlukan" }, { status: 400 });
    }

    const ids = Array.isArray(id_produk) ? id_produk : [id_produk];

    if (ids.length === 0) {
      return NextResponse.json([]);
    }

    // Untuk menghindari hit batas pool koneksi DB, kita jalankan query manual:
    const today = new Date().toLocaleDateString('en-CA');
    const { data: activePromos } = await supabase
      .from('event_promo')
      .select('id, nama, tipe_diskon, nilai_diskon, event_promo_produk!inner(id_produk)')
      .eq('aktif', true)
      .lte('tanggal_mulai', today)
      .gte('tanggal_selesai', today);

    if (!activePromos || activePromos.length === 0) {
      return NextResponse.json([]);
    }

    // Ambil produk yang terdaftar di promo aktif
    const promoIds = activePromos.flatMap((p: any) => p.event_promo_produk.map((ep: any) => ep.id_produk));
    const validIds = ids.filter((id: number) => promoIds.includes(id));

    if (validIds.length === 0) {
      return NextResponse.json([]);
    }

    const { data: products } = await supabase
      .from('produk')
      .select('id, harga_jual_satuan, harga_jual_grosir, harga_jual_promo, harga_jual_besar_satuan, harga_jual_besar_grosir, harga_jual_besar_promo')
      .in('id', validIds);

    if (!products) {
      return NextResponse.json([]);
    }

    const results = products.map((prod: any) => {
      // Cari promo yang berlaku untuk produk ini (ambil promo pertama jika ada overlap)
      const promo = activePromos.find((p: any) => p.event_promo_produk.some((ep: any) => ep.id_produk === prod.id));
      if (!promo) return null;

      const calc = (harga: number | null) => {
        if (!harga) return harga;
        if (promo.tipe_diskon === 'persen') {
          return Math.max(0, harga - (harga * promo.nilai_diskon / 100));
        }
        return Math.max(0, harga - promo.nilai_diskon);
      };

      return {
        id_produk: prod.id,
        harga_jual_satuan: calc(prod.harga_jual_satuan),
        harga_jual_grosir: calc(prod.harga_jual_grosir),
        harga_jual_promo: calc(prod.harga_jual_promo),
        harga_jual_besar_satuan: calc(prod.harga_jual_besar_satuan),
        harga_jual_besar_grosir: calc(prod.harga_jual_besar_grosir),
        harga_jual_besar_promo: calc(prod.harga_jual_besar_promo),
        id_event_promo: promo.id,
        nama_event: promo.nama
      };
    }).filter(Boolean);

    return NextResponse.json(results);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
