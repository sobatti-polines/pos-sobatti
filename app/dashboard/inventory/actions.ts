"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { logActivity, buildDeskripsi } from "@/lib/activity-log";

async function requireAuth() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;
  const { data: pengguna } = await supabase
    .from("pengguna")
    .select("level")
    .eq("username", user.email?.split("@")[0])
    .single();
  return pengguna?.level === "ADMIN" || pengguna?.level === "OWNER";
}

interface ProductData {
  nama_produk: string;
  id_kategori: number;
  id_satuan: number;
  hitung_stok: boolean;
  sku: string | null;
  barcode: string | null;
  harga_modal: number;
  harga_jual_satuan: number;
  harga_jual_grosir: number;
  harga_jual_promo: number | null;
  diskon: number;
  stok_minimum: number;
  default_purchase_unit?: string | null;
  conversion_ratio?: number;
  jual_satuan?: string | null;
  harga_jual_besar_satuan?: number | null;
  harga_jual_besar_grosir?: number | null;
  harga_jual_besar_promo?: number | null;
}

export async function addProduct(data: ProductData) {
  const ok = await requireAuth();
  if (!ok) return { error: "Unauthorized" };

  const supabase = await createClient();
  const { error } = await supabase.from("produk").insert([data]);
  if (error) {
    console.error("Failed to add product:", error);
    return { error: "Gagal menambah produk" };
  }

  await logActivity(supabase, {
    aksi: "CREATE",
    entitas: "produk",
    deskripsi: buildDeskripsi({ aksi: "CREATE", entitas: "produk", data_baru: data as unknown as Record<string, unknown> }),
    data_baru: data as unknown as Record<string, unknown>,
  });

  revalidatePath("/dashboard/inventory");
  return { success: true };
}

export async function updateProduct(id: number, data: ProductData) {
  const ok = await requireAuth();
  if (!ok) return { error: "Unauthorized" };

  const supabase = await createClient();

  // Fetch old data for log
  const { data: oldProduct } = await supabase
    .from("produk")
    .select("nama_produk, id_kategori, id_satuan, hitung_stok, sku, barcode, harga_modal, harga_jual_satuan, harga_jual_grosir, harga_jual_promo, diskon, stok_minimum, default_purchase_unit, conversion_ratio, jual_satuan, harga_jual_besar_satuan, harga_jual_besar_grosir, harga_jual_besar_promo")
    .eq("id", id)
    .single();

  const { error } = await supabase.from("produk").update(data).eq("id", id);
  if (error) {
    console.error("Failed to update product:", error);
    return { error: "Gagal memperbarui produk" };
  }

  await logActivity(supabase, {
    aksi: "UPDATE",
    entitas: "produk",
    id_entitas: id,
    deskripsi: buildDeskripsi({ aksi: "UPDATE", entitas: "produk", id_entitas: id, data_lama: oldProduct ? (oldProduct as unknown as Record<string, unknown>) : null, data_baru: data as unknown as Record<string, unknown> }),
    data_lama: oldProduct ? (oldProduct as unknown as Record<string, unknown>) : null,
    data_baru: data as unknown as Record<string, unknown>,
  });

  revalidatePath("/dashboard/inventory");
  return { success: true };
}

export async function deleteProduct(id: number) {
  const ok = await requireAuth();
  if (!ok) return { error: "Unauthorized" };

  const supabase = await createClient();

  const { data: oldProduct } = await supabase
    .from("produk")
    .select("nama_produk, sku, barcode")
    .eq("id", id)
    .single();

  const { error } = await supabase.from("produk").delete().eq("id", id);
  if (error) {
    console.error("Failed to delete product:", error);
    return { error: "Gagal menghapus produk" };
  }

  await logActivity(supabase, {
    aksi: "DELETE",
    entitas: "produk",
    id_entitas: id,
    deskripsi: buildDeskripsi({ aksi: "DELETE", entitas: "produk", id_entitas: id, data_lama: oldProduct ? (oldProduct as unknown as Record<string, unknown>) : null }),
    data_lama: oldProduct ? (oldProduct as unknown as Record<string, unknown>) : null,
  });

  revalidatePath("/dashboard/inventory");
  return { success: true };
}

export async function restockDisplay(productId: number, qty: number) {
  const ok = await requireAuth();
  if (!ok) return { error: "Unauthorized" };

  const supabase = await createClient();

  if (qty <= 0) return { error: "Jumlah harus lebih dari 0" };

  const { data: product, error: fetchError } = await supabase
    .from("produk")
    .select("stok, stok_gudang")
    .eq("id", productId)
    .single();

  if (fetchError || !product) {
    console.error("Failed to fetch product:", fetchError);
    return { error: "Produk tidak ditemukan" };
  }

  if (qty > product.stok_gudang) {
    return { error: `Stok gudang tidak mencukupi. Tersedia: ${product.stok_gudang}` };
  }

  const { error: updateError } = await supabase
    .from("produk")
    .update({
      stok: product.stok + qty,
      stok_gudang: product.stok_gudang - qty,
    })
    .eq("id", productId);

  if (updateError) {
    console.error("Failed to restock display:", updateError);
    return { error: "Gagal memindahkan stok" };
  }

  await logActivity(supabase, {
    aksi: "UPDATE",
    entitas: "produk",
    id_entitas: productId,
    deskripsi: buildDeskripsi({ aksi: "UPDATE", entitas: "produk", id_entitas: productId, data_lama: { stok: product.stok, stok_gudang: product.stok_gudang } as unknown as Record<string, unknown>, data_baru: { stok: product.stok + qty, stok_gudang: product.stok_gudang - qty } as unknown as Record<string, unknown> }),
    data_lama: { stok: product.stok, stok_gudang: product.stok_gudang } as unknown as Record<string, unknown>,
    data_baru: { stok: product.stok + qty, stok_gudang: product.stok_gudang - qty } as unknown as Record<string, unknown>,
  });

  revalidatePath("/dashboard/inventory");
  return { success: true };
}

export async function getProductMutationHistory(productId: number) {
  const supabase = await createClient();

  // 1. Fetch riwayat_avco — oldest first for sequential price comparison
  const { data: records, error } = await supabase
    .from("riwayat_avco")
    .select(
      "id, tanggal, jenis_mutasi, qty_masuk, qty_keluar, harga_satuan_transaksi, avco_sebelum, avco_sesudah, stok_sebelum, stok_sesudah, nilai_persediaan_sesudah, id_referensi"
    )
    .eq("id_produk", productId)
    .order("tanggal", { ascending: true })
    .limit(100);

  if (error) return { error: error.message };

  // 2. Batch-fetch supplier info for pembelian records
  const pembelianRefs = (records ?? [])
    .filter((r) => r.jenis_mutasi === "pembelian" && r.id_referensi != null)
    .map((r) => r.id_referensi)
    .filter(Boolean);

  const supplierMap: Record<number, { nama_supplier: string }> = {};

  if (pembelianRefs.length > 0) {
    const { data: barangMasuk } = await supabase
      .from("barang_masuk")
      .select("id, supplier!inner(nama_supplier)")
      .in("id", pembelianRefs);

    if (barangMasuk) {
      for (const bm of barangMasuk) {
        const s = (bm as any).supplier;
        supplierMap[bm.id] = s ?? { nama_supplier: "Supplier dihapus" };
      }
    }
  }

  // 3. Attach supplier to each record
  const enriched = (records ?? []).map((r) => ({
    ...r,
    supplier:
      r.jenis_mutasi === "pembelian" && r.id_referensi != null
        ? supplierMap[r.id_referensi] ?? null
        : null,
  }));

  return { data: enriched };
}

export async function importProducts(
  rows: Record<string, string>[]
) {
  const ok = await requireAuth();
  if (!ok) return { error: "Unauthorized" };

  if (!rows || rows.length === 0) {
    return { error: "Data impor kosong" };
  }

  const supabase = await createClient();

  // 1. Fetch existing reference data maps
  const { data: categories } = await supabase.from("kategori").select("id, nama");
  const { data: units } = await supabase.from("satuan").select("id, nama");
  const { data: brands } = await supabase.from("merk").select("id, nama");

  const categoryMap = new Map<string, number>(
    (categories || []).map((c) => [c.nama.toLowerCase().trim(), c.id])
  );
  const unitMap = new Map<string, number>(
    (units || []).map((u) => [u.nama.toLowerCase().trim(), u.id])
  );
  const brandMap = new Map<string, number>(
    (brands || []).map((b) => [b.nama.toLowerCase().trim(), b.id])
  );

  // Helper to ensure reference item exists or create it
  const getOrCreateRef = async (
    table: "kategori" | "satuan" | "merk",
    map: Map<string, number>,
    rawName: string
  ): Promise<number | null> => {
    const name = rawName.trim();
    if (!name) return null;
    const lower = name.toLowerCase();
    if (map.has(lower)) return map.get(lower)!;

    // Create new reference row
    const payload: any = { nama: name };
    if (table === "merk") {
      const code = name.replace(/[^A-Za-z0-9]/g, "").slice(0, 4).toUpperCase() || "MERK";
      payload.kode = code + Math.floor(Math.random() * 100);
    }

    const { data: inserted, error } = await supabase
      .from(table)
      .insert(payload)
      .select("id")
      .single();

    if (!error && inserted) {
      map.set(lower, inserted.id);
      return inserted.id;
    }
    return null;
  };

  // Fallback default unit / category if unassigned
  let defaultCatId = categoryMap.values().next().value;
  let defaultUnitId = unitMap.values().next().value;

  if (!defaultCatId) {
    const { data: newCat } = await supabase.from("kategori").insert({ nama: "Umum" }).select("id").single();
    if (newCat) {
      defaultCatId = newCat.id;
      categoryMap.set("umum", newCat.id);
    }
  }

  if (!defaultUnitId) {
    const { data: newUnit } = await supabase.from("satuan").insert({ nama: "Pcs" }).select("id").single();
    if (newUnit) {
      defaultUnitId = newUnit.id;
      unitMap.set("pcs", newUnit.id);
    }
  }

  const payload: any[] = [];

  for (const r of rows) {
    const nama_produk = r["Nama Produk"] || r["nama_produk"] || "";
    if (!nama_produk.trim()) continue;

    const catName = r["Kategori"] || r["kategori"] || "";
    const unitName = r["Satuan"] || r["satuan"] || r["Satuan Dasar"] || r["base_unit"] || "";
    const brandName = r["Merk"] || r["merk"] || "";

    const id_kategori = catName ? (await getOrCreateRef("kategori", categoryMap, catName)) || defaultCatId : defaultCatId;
    const id_satuan = unitName ? (await getOrCreateRef("satuan", unitMap, unitName)) || defaultUnitId : defaultUnitId;
    const id_merk = brandName ? await getOrCreateRef("merk", brandMap, brandName) : null;

    const sku = (r["SKU"] || r["sku"] || "").trim() || null;
    const barcode = (r["Barcode"] || r["barcode"] || "").trim() || null;

    const parseNum = (val: string | undefined, def: number = 0) => {
      if (!val) return def;
      const cleaned = val.replace(/[^0-9.-]/g, "");
      const parsed = parseFloat(cleaned);
      return isNaN(parsed) ? def : parsed;
    };

    const harga_modal = parseNum(r["Harga Modal"] || r["harga_modal"]);
    const harga_jual_satuan = parseNum(r["Harga Jual Satuan"] || r["harga_jual_satuan"]);
    const harga_jual_grosir = parseNum(r["Harga Jual Grosir"] || r["harga_jual_grosir"], harga_jual_satuan);
    const harga_jual_promo = r["Harga Jual Promo"] || r["harga_jual_promo"] ? parseNum(r["Harga Jual Promo"] || r["harga_jual_promo"]) : null;
    const diskon = parseNum(r["Diskon"] || r["diskon"]);

    const stok = parseNum(r["Stok Display"] || r["Stok"] || r["stok"]);
    const stok_gudang = parseNum(r["Stok Gudang"] || r["stok_gudang"]);
    const stok_minimum = parseNum(r["Stok Minimum"] || r["stok_minimum"], 5);

    const hitungStokRaw = (r["Hitung Stok"] || r["hitung_stok"] || "ya").toString().toLowerCase().trim();
    const hitung_stok = hitungStokRaw === "ya" || hitungStokRaw === "true" || hitungStokRaw === "1";

    const default_purchase_unit = (r["Satuan Beli"] || r["default_purchase_unit"] || "").trim() || null;
    const conversion_ratio = parseNum(r["Rasio Konversi"] || r["conversion_ratio"], 1);

    const totalStok = stok + stok_gudang;
    const harga_pokok_avco = harga_modal;
    const nilai_persediaan = harga_modal * totalStok;

    payload.push({
      nama_produk,
      id_kategori,
      id_satuan,
      id_merk,
      sku,
      barcode,
      harga_modal,
      harga_jual_satuan,
      harga_jual_grosir,
      harga_jual_promo,
      diskon,
      stok,
      stok_gudang,
      stok_minimum,
      hitung_stok,
      default_purchase_unit,
      conversion_ratio,
      harga_pokok_avco,
      nilai_persediaan,
    });
  }

  if (payload.length === 0) {
    return { error: "Tidak ada baris data produk yang valid" };
  }

  const { error } = await supabase.from("produk").insert(payload);

  if (error) {
    console.error("Failed to import products:", error);
    return { error: "Gagal menyimpan data produk: " + error.message };
  }

  await logActivity(supabase, {
    aksi: "CREATE",
    entitas: "produk",
    deskripsi: `Bulk import ${payload.length} produk`,
    data_baru: { count: payload.length },
  });

  revalidatePath("/dashboard/inventory");
  return { success: true, count: payload.length, message: `Berhasil mengimpor ${payload.length} data produk.` };
}
