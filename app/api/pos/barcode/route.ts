import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { POS_PRODUCT_COLUMNS } from "@/lib/pos-data";
import { ilikeContainsValue, ilikeValue } from "@/lib/postgrest-filter";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code")?.trim();

  if (!code) {
    return NextResponse.json({ error: "code required" }, { status: 400 });
  }

  const supabase = await createClient();

  // Bentuk objek produk disamakan dengan jalur POS lain (lib/pos-data.ts) agar
  // produk hasil scan barcode punya field yang sama dengan produk dari katalog.
  const fields = POS_PRODUCT_COLUMNS;

  // Pattern ILIKE untuk filter kolom LANGSUNG (bukan di dalam or=()):
  // wildcard `%`/`_` di-escape agar literal, dan nilai TIDAK dikutip ganda —
  // kutip ganda pada filter kolom langsung justru ikut dicari sebagai teks
  // sehingga lookup barcode selalu kosong (lihat lib/postgrest-filter.ts).
  const pattern = ilikeValue(code);

  // POS_PRODUCT_COLUMNS bertipe string sehingga client Supabase tidak bisa
  // menginferensi tipe barisnya. Kolom yang diakses langsung di route
  // dideklarasikan eksplisit; kolom lainnya mengalir apa adanya ke respons.
  type BarcodeRow = {
    id: number;
    barcode: string | null;
    stok: number | null;
    stok_gudang: number | null;
  };

  const findProduct = async () => {
    // Coba kecocokan barcode persis dulu (input scanner).
    //
    // .limit(2) PENTING: bila satu barcode terdaftar di lebih dari satu produk
    // (pernah terjadi lewat import massal CSV), tanpa limit query mengembalikan
    // beberapa baris dan .maybeSingle() melempar error PGRST116
    // ("multiple (or no) rows returned") → data null → scan gagal diam-diam
    // dengan pesan "Produk tidak ditemukan". Dengan limit(2) kita selalu tahu:
    // 1 baris = unik; 2 baris = duplikat.
    const { data: barcodeMatches, error: barcodeError } = await supabase
      .from("produk")
      .select(fields)
      .ilike("barcode", pattern)
      .limit(2);

    if (barcodeError) {
      console.error("Lookup barcode gagal:", barcodeError);
    }
    const matches = (barcodeMatches ?? []) as unknown as BarcodeRow[];
    if (matches.length > 0) {
      // Jika ada duplikat, pilih deterministik: stok terbanyak, lalu id
      // terkecil — supaya hasil scan tidak berubah-ubah antar pemindaian.
      // Sumber masalah sesungguhnya tetap data duplikat dan harus dibersihkan
      // di database (lihat SQL verifikasi di laporan analisa bug).
      const sorted = [...matches].sort((a, b) => {
        const stokA = Number(a.stok ?? 0) + Number(a.stok_gudang ?? 0);
        const stokB = Number(b.stok ?? 0) + Number(b.stok_gudang ?? 0);
        if (stokB !== stokA) return stokB - stokA;
        return Number(a.id) - Number(b.id);
      });
      return { product: sorted[0], duplicated: matches.length > 1 };
    }

    // Fallback numeric-ID: SENGAJA dibatasi untuk produk TANPA barcode saja.
    //
    // Dulu fallback ini dijalankan untuk semua kode digit, sehingga scanner
    // yang salah baca / barcode EAN tak terdaftar bisa cocok dengan `id`
    // produk lain yang kebetulan sama angkanya — produk SALAH masuk keranjang.
    // Sekarang hanya dijalankan bila kolom barcode-nya memang kosong (cek di
    // JS, bukan filter or= PostgREST, supaya tidak ada risiko parsing lagi).
    const numericId = /^\d+$/.test(code) ? Number(code) : null;
    if (numericId !== null) {
      const { data } = await supabase
        .from("produk")
        .select(fields)
        .eq("id", numericId)
        .maybeSingle();

      const row = data as unknown as BarcodeRow | null;
      if (row && (row.barcode == null || row.barcode === "")) {
        return { product: row, duplicated: false };
      }
    }

    // Fallback terakhir: cari berdasarkan nama produk secara SEBAGIAN.
    // `ilikeContainsValue` menambahkan wildcard %...% tanpa kutip ganda, sesuai
    // aturan filter kolom langsung (lihat lib/postgrest-filter.ts).
    const { data } = await supabase
      .from("produk")
      .select(fields)
      .ilike("nama_produk", ilikeContainsValue(code))
      .limit(1)
      .maybeSingle();

    if (data) return { product: data as unknown as BarcodeRow, duplicated: false };

    return null;
  };

  const result = await findProduct();
  if (!result) return NextResponse.json({ product: null }, { status: 404 });

  // `duplicated` diberikan ke klien untuk peringatan: scan tetap berhasil
  // (produk pilihan deterministik), tapi owner perlu tahu datanya ganda.
  return NextResponse.json({ product: result.product, duplicated: result.duplicated });
}
