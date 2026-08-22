import { createClient } from "@/lib/supabase/server";
import { fetchAllRows } from "@/lib/supabase/fetch-all";
import StockOpnameClient from "./stock-opname-client";

export default async function StockOpnamePage(props: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const searchParams = await props.searchParams;
  const id_sesi = typeof searchParams.id_sesi === "string" ? searchParams.id_sesi : undefined;

  const supabase = await createClient();

  // fetchAllRows: PostgREST memotong di 1000 baris per request — tanpa ini
  // produk ke-1001+ tidak ikut dihitung stok opname.
  const rawProducts = await fetchAllRows(supabase, (db, from, to) =>
    db.from("produk")
      .select("id, nama_produk, stok, stok_gudang, barcode, hitung_stok, lokasi_area(nama)")
      .eq("hitung_stok", true)
      .is("id_produk_master", null)
      .order("nama_produk")
      .range(from, to)
  ).catch((e) => {
    console.error("Failed to fetch products:", e);
    return [];
  });

  const products = (rawProducts ?? []).map((p) => ({
    ...p,
    lokasi_area: Array.isArray(p.lokasi_area) ? (p.lokasi_area[0] ?? null) : p.lokasi_area,
  }));

  let initialSesi: any = null;
  let initialItems: any[] = [];

  if (id_sesi) {
    const { data: sesiInfo } = await supabase
      .from("sesi_stok_opname")
      .select("id, no_sesi, tgl_sesi, status, keterangan")
      .eq("id", id_sesi)
      .single();

    if (sesiInfo && sesiInfo.status === "DRAFT") {
      initialSesi = sesiInfo;
      const { data: opnameItems } = await supabase
        .from("stok_opname")
        .select("id, id_produk, stok_sistem, stok_sistem_gudang, stok_fisik, stok_fisik_gudang, klasifikasi, keterangan")
        .eq("id_sesi", id_sesi);

      if (opnameItems && opnameItems.length > 0) {
        initialItems = opnameItems;
      } else {
        initialItems = [
          { id_produk: 0, stok_sistem: 0, stok_sistem_gudang: 0, stok_fisik: 0, stok_fisik_gudang: 0, klasifikasi: "", keterangan: "" },
        ];
      }
    }
  }

  return (
    <StockOpnameClient 
      products={products} 
      initialSesi={initialSesi} 
      initialItems={initialItems} 
    />
  );
}
