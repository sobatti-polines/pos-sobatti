"use server";

import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { logActivity, buildDeskripsi } from "@/lib/activity-log";
import { fetchAllRows } from "@/lib/supabase/fetch-all";
import { isAdminOrOwnerLike, isOwnerLike } from "@/lib/roles";

async function requireAuth() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;
  const { data: pengguna } = await supabase
    .from("pengguna")
    .select("level")
    .eq("username", user.email?.split("@")[0])
    .single();
  return isAdminOrOwnerLike(pengguna?.level);
}

async function requireOwner() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, supabase };

  const { data: pengguna } = await supabase
    .from("pengguna")
    .select("level")
    .eq("username", user.email?.split("@")[0])
    .single();

  return { ok: isOwnerLike(pengguna?.level), supabase };
}

export type BulkPriceProductType = "ALL" | "MASTER" | "PAKET";
export type BulkPriceDirection = "NAIK" | "TURUN";

export interface BulkPriceAdjustmentInput {
  id_merk: number;
  jenis_barang: BulkPriceProductType;
  direction: BulkPriceDirection;
  percentage: number;
  rounding: number;
  update_retail: boolean;
  update_grosir: boolean;
  update_promo: boolean;
  update_big_retail: boolean;
  update_big_grosir: boolean;
  update_big_promo: boolean;
}

export interface BulkPriceAdjustmentResult {
  affected_count: number;
  updated_count: number;
  sample: Array<{
    id: number;
    nama_produk: string;
    sku: string | null;
    old_retail: number | null;
    new_retail: number | null;
    old_grosir: number | null;
    new_grosir: number | null;
    old_promo: number | null;
    new_promo: number | null;
    old_big_retail: number | null;
    new_big_retail: number | null;
    old_big_grosir: number | null;
    new_big_grosir: number | null;
    old_big_promo: number | null;
    new_big_promo: number | null;
  }>;
}

function validateBulkPriceInput(input: BulkPriceAdjustmentInput): string | null {
  if (!input.id_merk || input.id_merk <= 0) return "Merk wajib dipilih";
  if (!["ALL", "MASTER", "PAKET"].includes(input.jenis_barang)) return "Jenis barang tidak valid";
  if (!["NAIK", "TURUN"].includes(input.direction)) return "Arah perubahan harga tidak valid";
  if (!Number.isFinite(input.percentage) || input.percentage < 0) return "Persentase harus 0 atau lebih";
  if (!Number.isFinite(input.rounding) || input.rounding <= 0) return "Pembulatan harus lebih dari 0";
  if (!(
    input.update_retail || input.update_grosir || input.update_promo ||
    input.update_big_retail || input.update_big_grosir || input.update_big_promo
  )) return "Pilih minimal satu harga yang ingin diubah";
  return null;
}

async function runBulkPriceAdjustment(input: BulkPriceAdjustmentInput, apply: boolean) {
  const guard = await requireOwner();
  if (!guard.ok) return { error: "Unauthorized" };

  const validationError = validateBulkPriceInput(input);
  if (validationError) return { error: validationError };

  const { data, error } = await guard.supabase.rpc("bulk_adjust_product_prices", {
    p_id_merk: input.id_merk,
    p_jenis_barang: input.jenis_barang,
    p_direction: input.direction,
    p_percentage: input.percentage,
    p_rounding: input.rounding,
    p_update_retail: input.update_retail,
    p_update_grosir: input.update_grosir,
    p_update_promo: input.update_promo,
    p_update_big_retail: input.update_big_retail,
    p_update_big_grosir: input.update_big_grosir,
    p_update_big_promo: input.update_big_promo,
    p_apply: apply,
  });

  if (error) {
    console.error("Bulk price adjustment failed:", error);
    if (
      error.message?.includes("bulk_adjust_product_prices") ||
      error.message?.toLowerCase().includes("schema cache")
    ) {
      return {
        error: "Fitur ubah harga massal belum aktif di database. Jalankan migration 20260922100000_bulk_adjust_product_prices.sql di Supabase, lalu reload schema cache.",
      };
    }
    return { error: error.message || "Gagal memproses perubahan harga massal" };
  }

  return { success: true, data: data as BulkPriceAdjustmentResult };
}

export async function previewBulkPriceAdjustment(input: BulkPriceAdjustmentInput) {
  return runBulkPriceAdjustment(input, false);
}

export async function applyBulkPriceAdjustment(input: BulkPriceAdjustmentInput) {
  const res = await runBulkPriceAdjustment(input, true);
  if (!res.success || !res.data) return res;

  const guard = await requireOwner();
  if (guard.ok) {
    await logActivity(guard.supabase, {
      aksi: "UPDATE",
      entitas: "produk",
      deskripsi: `Ubah harga massal: ${res.data.updated_count} produk, merk ID ${input.id_merk}, ${input.direction.toLowerCase()} ${input.percentage}%`,
      data_baru: { ...input, affected_count: res.data.affected_count, updated_count: res.data.updated_count },
    });
  }

  revalidatePath("/dashboard/inventory");
  revalidatePath("/dashboard/laporan/pergerakan-harga");
  return res;
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
  stok_minimum_gudang?: number | null;
  default_purchase_unit?: string | null;
  conversion_ratio?: number;
  jual_satuan?: string | null;
  harga_jual_besar_satuan?: number | null;
  harga_jual_besar_grosir?: number | null;
  harga_jual_besar_promo?: number | null;
  harga_jual_besar_manual?: boolean;
  id_produk_master?: number | null;
  qty_per_unit?: number | null;
  isi_satuan?: string | null;
  jenis_isi_paket?: string | null;
  id_lokasi_area?: number | null;
}

function computeBigPrices(data: ProductData) {
  const ratio = Number(data.conversion_ratio ?? 1);
  if (data.jual_satuan && ratio > 0) {
    if (data.harga_jual_besar_manual) {
      return {
        harga_jual_besar_manual: true,
        harga_jual_besar_satuan: Number(data.harga_jual_besar_satuan),
        harga_jual_besar_grosir: Number(data.harga_jual_besar_grosir),
        harga_jual_besar_promo: data.harga_jual_promo != null
          ? Number(data.harga_jual_besar_promo)
          : null,
      };
    }
    return {
      harga_jual_besar_manual: false,
      harga_jual_besar_satuan: Math.round(Number(data.harga_jual_satuan || 0) * ratio),
      harga_jual_besar_grosir: Math.round(Number(data.harga_jual_grosir || 0) * ratio),
      harga_jual_besar_promo: data.harga_jual_promo != null
        ? Math.round(Number(data.harga_jual_promo) * ratio)
        : null,
    };
  }
  return {
    harga_jual_besar_manual: false,
    harga_jual_besar_satuan: null,
    harga_jual_besar_grosir: null,
    harga_jual_besar_promo: null,
  };
}

function validateBigPrices(data: ProductData): string | null {
  if (!data.jual_satuan) return null;
  const ratio = Number(data.conversion_ratio ?? 1);
  if (!Number.isFinite(ratio) || ratio <= 0) return "Rasio satuan besar harus lebih dari 0";
  // Harga besar opsional — boleh 0 atau kosong, tidak perlu validasi > 0
  return null;
}

function paketErrorMessage(msg: string): string | null {
  const keywords = [
    "Qty per satuan",
    "produk paket",
    "Produk master",
    "master dirinya sendiri",
    "tidak bisa bertingkat",
  ];
  return keywords.some((k) => msg.includes(k)) ? msg : null;
}

export async function addProduct(data: ProductData) {
  const ok = await requireAuth();
  if (!ok) return { error: "Unauthorized" };
  const bigPriceError = validateBigPrices(data);
  if (bigPriceError) return { error: bigPriceError };

  const supabase = await createClient();

  // Guard duplikat: cegah produk yang sama persis (nama + SKU + barcode) masuk 2×.
  // Tanpa guard ini, dua produk identik tanpa SKU/barcode (NULL) bisa masuk berkali-kali
  // karena unique constraint (sku, barcode) memperbolehkan banyak NULL.
  const namaTrim = data.nama_produk.trim();
  const skuVal = data.sku?.trim() || null;
  const barcodeVal = data.barcode?.trim() || null;
  const { data: existing, error: dupErr } = await supabase
    .from("produk")
    .select("id, sku, barcode")
    .ilike("nama_produk", namaTrim)
    .limit(100);
  if (!dupErr && existing && existing.length > 0) {
    // Cegah duplikat: nama SAMA + SKU sama (termasuk NULL) + barcode sama (termasuk NULL)
    const dup = existing.find(
      (r) => (r.sku?.trim() || null) === skuVal && (r.barcode?.trim() || null) === barcodeVal
    );
    if (dup) {
      return { error: `Produk "${namaTrim}" sudah ada (SKU & barcode sama). Gunakan nama/SKU berbeda atau edit produk yang sudah ada.` };
    }
  }

  const payload = { ...data, ...computeBigPrices(data) };
  const { error } = await supabase.from("produk").insert([payload]);
  if (error) {
    console.error("Failed to add product:", error);
    return { error: paketErrorMessage(error.message ?? "") ?? "Gagal menambah produk" };
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
  const bigPriceError = validateBigPrices(data);
  if (bigPriceError) return { error: bigPriceError };

  const supabase = await createClient();

  // Fetch old data for log
  const { data: oldProduct } = await supabase
    .from("produk")
    .select("nama_produk, id_kategori, id_satuan, hitung_stok, sku, barcode, harga_modal, harga_jual_satuan, harga_jual_grosir, harga_jual_promo, diskon, stok_minimum, stok_minimum_gudang, default_purchase_unit, conversion_ratio, jual_satuan, harga_jual_besar_satuan, harga_jual_besar_grosir, harga_jual_besar_promo, harga_jual_besar_manual, id_produk_master, qty_per_unit, id_lokasi_area")
    .eq("id", id)
    .single();

  const payload = { ...data, ...computeBigPrices(data) };
  const { error } = await supabase.from("produk").update(payload).eq("id", id);
  if (error) {
    console.error("Failed to update product:", error);
    return { error: paketErrorMessage(error.message ?? "") ?? "Gagal memperbarui produk" };
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

  // Cek: produk masih menjadi master dari produk paket lain?
  const { data: paketRefs } = await supabase
    .from("produk")
    .select("id")
    .eq("id_produk_master", id)
    .limit(1);

  if (paketRefs && paketRefs.length > 0) {
    return { error: "Produk tidak bisa dihapus karena masih menjadi master dari produk paket" };
  }

  // Bersihkan riwayat AVCO produk (paket atau master) sebelum hapus
  await supabase.from("riwayat_avco").delete().eq("id_produk", id);

  const { error } = await supabase.from("produk").delete().eq("id", id);
  if (error) {
    console.error("Failed to delete product:", error);
    if (error.code === "23503") {
      // FK lain (mis. transactional history) — hanya jika ada transaksi terkait
      return { error: "Produk tidak bisa dihapus karena memiliki riwayat transaksi atau referensi lainnya" };
    }
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


export async function forceDeleteProduct(id: number) {
  const ok = await requireAuth();
  if (!ok) return { error: "Unauthorized" };

  const supabase = await createClient();

  const { data: oldProduct } = await supabase
    .from("produk")
    .select("nama_produk, sku, barcode")
    .eq("id", id)
    .single();

  // 1. Cek: apakah ada riwayat penjualan?
  const { data: sales } = await supabase
    .from("detail_transaksi_keluar")
    .select("id")
    .eq("id_produk", id)
    .limit(1);
  if (sales && sales.length > 0) {
    return { error: "Produk sudah memiliki riwayat penjualan. Hapus paksa dibatalkan karena akan merusak laporan kasir." };
  }

  // 2. Cek: apakah ada riwayat retur?
  const { data: returs } = await supabase
    .from("retur_pembelian_detail")
    .select("id")
    .eq("id_produk", id)
    .limit(1);
  if (returs && returs.length > 0) {
    return { error: "Produk sudah diretur ke supplier. Hapus paksa dibatalkan." };
  }

  // 3. Cek: apakah menjadi master produk paket?
  const { data: paketRefs } = await supabase
    .from("produk")
    .select("id")
    .eq("id_produk_master", id)
    .limit(1);
  if (paketRefs && paketRefs.length > 0) {
    return { error: "Produk tidak bisa dihapus karena masih menjadi master dari produk paket." };
  }

  // 4. Hapus secara berurutan
  await supabaseAdmin.from("event_promo_produk").delete().eq("id_produk", id);
  await supabaseAdmin.from("stok_opname_sesi_detail").delete().eq("id_produk", id);
  await supabaseAdmin.from("stok_opname").delete().eq("id_produk", id);
  await supabaseAdmin.from("barang_masuk").delete().eq("id_produk", id);
  await supabaseAdmin.from("riwayat_avco").delete().eq("id_produk", id);

  // 5. Hapus produk
  const { error } = await supabaseAdmin.from("produk").delete().eq("id", id);
  if (error) {
    console.error("Failed to force delete product:", error);
    return { error: "Gagal menghapus produk: " + error.message };
  }

  await logActivity(supabase, {
    aksi: "DELETE",
    entitas: "produk",
    id_entitas: id,
    deskripsi: "Force delete produk beserta riwayat (barang masuk, dll). " + (oldProduct?.nama_produk || ""),
    data_lama: oldProduct ? (oldProduct as unknown as Record<string, unknown>) : null,
  });

  revalidatePath("/dashboard/inventory");
  return { success: true };
}

export async function deleteProducts(ids: number[]) {
  const ok = await requireAuth();
  if (!ok) return { error: "Unauthorized" };

  const uniqueIds = [...new Set(ids)];
  if (uniqueIds.length === 0) return { error: "Tidak ada produk yang dipilih" };

  const supabase = await createClient();

  // Ambil data lama untuk keperluan log
  const { data: oldProducts } = await supabase
    .from("produk")
    .select("id, nama_produk, sku, barcode")
    .in("id", uniqueIds);

  const oldMap = new Map((oldProducts ?? []).map((p) => [p.id, p]));
  const namesOf = (prodIds: number[]) =>
    prodIds.map((id) => oldMap.get(id)?.nama_produk ?? `#${id}`);

  // 1. Cek: produk terpilih masih menjadi master dari produk paket?
  const { data: paketRefs } = await supabase
    .from("produk")
    .select("id_produk_master")
    .in("id_produk_master", uniqueIds);

  if (paketRefs && paketRefs.length > 0) {
    const masterIds = [
      ...new Set(
        paketRefs
          .map((r) => r.id_produk_master)
          .filter((v): v is number => v != null)
      ),
    ];
    return {
      error: `Produk tidak bisa dihapus karena masih menjadi master dari produk paket: ${namesOf(masterIds).join(", ")}`,
    };
  }

  // 2. Cek referensi lain (transaksi, barang masuk, opname, retur) —
  //    semua dicek DULU agar delete bersifat atomic (tidak ada partial delete
  //    dan riwayat_avco tidak hilang untuk produk yang gagal dihapus).
  const refChecks: {
    table:
      | "detail_transaksi_keluar"
      | "barang_masuk"
      | "stok_opname"
      | "detail_retur_pembelian";
    label: string;
  }[] = [
    { table: "detail_transaksi_keluar", label: "riwayat transaksi penjualan" },
    { table: "barang_masuk", label: "riwayat barang masuk" },
    { table: "stok_opname", label: "riwayat stok opname" },
    { table: "detail_retur_pembelian", label: "riwayat retur pembelian" },
  ];

  const blocked: string[] = [];
  for (const { table, label } of refChecks) {
    const { data: refs } = await supabase
      .from(table)
      .select("id_produk")
      .in("id_produk", uniqueIds);
    if (refs && refs.length > 0) {
      const prodIds = [
        ...new Set(refs.map((r) => r.id_produk as number)),
      ];
      blocked.push(`${label} — ${namesOf(prodIds).join(", ")}`);
    }
  }

  if (blocked.length > 0) {
    return {
      error: `Produk berikut tidak bisa dihapus karena memiliki referensi terkait: ${blocked.join("; ")}. Tidak ada produk yang dihapus.`,
    };
  }

  // 3. Bersihkan riwayat AVCO produk terkait
  await supabase.from("riwayat_avco").delete().in("id_produk", uniqueIds);

  // 4. Hapus produk (satu statement — atomic, semua atau tidak sama sekali)
  const { error } = await supabase.from("produk").delete().in("id", uniqueIds);
  if (error) {
    console.error("Failed to delete products:", error);
    if (error.code === "23503") {
      return {
        error: "Produk tidak bisa dihapus karena memiliki riwayat transaksi atau referensi lainnya. Tidak ada produk yang dihapus.",
      };
    }
    return { error: "Gagal menghapus produk" };
  }

  await logActivity(supabase, {
    aksi: "DELETE",
    entitas: "produk",
    id_entitas: uniqueIds.length === 1 ? uniqueIds[0] : null,
    deskripsi: `Hapus massal ${uniqueIds.length} produk: ${namesOf(uniqueIds).join(", ")}`,
    data_lama: { count: uniqueIds.length, ids: uniqueIds } as unknown as Record<string, unknown>,
  });

  revalidatePath("/dashboard/inventory");
  return { success: true, count: uniqueIds.length };
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

export async function moveToWarehouse(productId: number, qty: number) {
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

  if (qty > product.stok) {
    return { error: `Stok display tidak mencukupi. Tersedia: ${product.stok}` };
  }

  const { error: updateError } = await supabase
    .from("produk")
    .update({
      stok: product.stok - qty,
      stok_gudang: product.stok_gudang + qty,
    })
    .eq("id", productId);

  if (updateError) {
    console.error("Failed to move to warehouse:", updateError);
    return { error: "Gagal memindahkan stok ke gudang" };
  }

  await logActivity(supabase, {
    aksi: "UPDATE",
    entitas: "produk",
    id_entitas: productId,
    deskripsi: buildDeskripsi({ aksi: "UPDATE", entitas: "produk", id_entitas: productId, data_lama: { stok: product.stok, stok_gudang: product.stok_gudang } as unknown as Record<string, unknown>, data_baru: { stok: product.stok - qty, stok_gudang: product.stok_gudang + qty } as unknown as Record<string, unknown> }),
    data_lama: { stok: product.stok, stok_gudang: product.stok_gudang } as unknown as Record<string, unknown>,
    data_baru: { stok: product.stok - qty, stok_gudang: product.stok_gudang + qty } as unknown as Record<string, unknown>,
  });

  revalidatePath("/dashboard/inventory");
  return { success: true };
}

export async function isiStokPaket(paketId: number, qtyPaket: number, totalBerat?: number) {
  const ok = await requireAuth();
  if (!ok) return { error: "Unauthorized" };

  const supabase = await createClient();

  if (!Number.isInteger(qtyPaket) || qtyPaket <= 0) {
    return { error: "Jumlah paket harus bilangan bulat lebih dari 0" };
  }

  const params: Record<string, number> = {
    p_id_paket: paketId,
    p_qty_paket: qtyPaket,
  };

  if (totalBerat !== undefined && totalBerat > 0) {
    params.p_total_berat = totalBerat;
  }

  const { data, error } = await supabase.rpc("process_isi_stok_paket", params);

  if (error) {
    console.error("process_isi_stok_paket failed:", error);
    return { error: error.message };
  }

  if (data && typeof data === "object" && "error" in data && data.error) {
    return { error: String(data.error) };
  }

  await logActivity(supabase, {
    aksi: "UPDATE",
    entitas: "produk",
    id_entitas: paketId,
    deskripsi: `Isi stok paket: ${qtyPaket} paket${totalBerat ? `, total berat ${totalBerat}` : ''}`,
    data_lama: null,
    data_baru: { qty_paket: qtyPaket, total_berat: totalBerat ?? null } as unknown as Record<string, unknown>,
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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
  const { data: lokasiAreas } = await supabase.from("lokasi_area").select("id, nama");

  const categoryMap = new Map<string, number>(
    (categories || []).map((c) => [c.nama.toLowerCase().trim(), c.id])
  );
  const unitMap = new Map<string, number>(
    (units || []).map((u) => [u.nama.toLowerCase().trim(), u.id])
  );
  const brandMap = new Map<string, number>(
    (brands || []).map((b) => [b.nama.toLowerCase().trim(), b.id])
  );
  const lokasiMap = new Map<string, number>(
    (lokasiAreas || []).map((l) => [l.nama.toLowerCase().trim(), l.id])
  );

  // Helper to ensure reference item exists or create it
  const getOrCreateRef = async (
    table: "kategori" | "satuan" | "merk" | "lokasi_area",
    map: Map<string, number>,
    rawName: string
  ): Promise<number | null> => {
    const name = rawName.trim();
    if (!name) return null;
    const lower = name.toLowerCase();
    if (map.has(lower)) return map.get(lower)!;

    // Create new reference row
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

  // Fetch ALL existing products for UPSERT logic (menggunakan fetchAllRows untuk menghindari limit 1000 baris)
  const existingProducts = await fetchAllRows(supabase, (db, from, to) =>
    db
      .from("produk")
      .select("id, sku, barcode, nama_produk, stok, stok_gudang, harga_pokok_avco, nilai_persediaan")
      .range(from, to)
  );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const existingByBarcode = new Map<string, any>();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const existingBySku = new Map<string, any>();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const existingByName = new Map<string, any>();

  if (existingProducts) {
    for (const p of existingProducts) {
      if (p.barcode) existingByBarcode.set(p.barcode.trim().toLowerCase(), p);
      if (p.sku) existingBySku.set(p.sku.trim().toLowerCase(), p);
      if (p.nama_produk) existingByName.set(p.nama_produk.trim().toLowerCase(), p);
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const inserts: any[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updates: any[] = [];

  for (const r of rows) {
    const nama_produk = (r["Nama Produk"] || r["nama_produk"] || "").trim();
    if (!nama_produk) continue;

    const catName = r["Kategori Produk"] || r["Kategori"] || r["kategori"] || "";
    const unitName = r["Satuan Dasar"] || r["Satuan"] || r["satuan"] || r["base_unit"] || "";
    const brandName = r["Merk / Brand"] || r["Merk"] || r["merk"] || "";
    const lokName = r["Lokasi / Rak"] || r["Lokasi"] || r["lokasi"] || r["Lokasi Area"] || r["lokasi_area"] || "";

    const id_kategori = catName ? (await getOrCreateRef("kategori", categoryMap, catName)) || defaultCatId : defaultCatId;
    const id_satuan = unitName ? (await getOrCreateRef("satuan", unitMap, unitName)) || defaultUnitId : defaultUnitId;
    const id_merk = brandName ? await getOrCreateRef("merk", brandMap, brandName) : null;
    const id_lokasi_area = lokName ? await getOrCreateRef("lokasi_area", lokasiMap, lokName) : null;

    const sku = (r["SKU / Kode Produk"] || r["SKU"] || r["sku"] || "").trim() || null;
    const barcode = (r["Barcode"] || r["barcode"] || "").trim() || null;

    const parseNum = (val: string | undefined, def: number = 0) => {
      if (!val) return def;
      const cleaned = val.replace(/[^0-9.-]/g, "");
      const parsed = parseFloat(cleaned);
      return isNaN(parsed) ? def : parsed;
    };

    const harga_modal = parseNum(r["Harga Modal / Beli"] || r["Harga Modal"] || r["harga_modal"]);
    const harga_jual_satuan = parseNum(r["Harga Jual Eceran"] || r["Harga Jual Satuan"] || r["harga_jual_satuan"]);
    const harga_jual_grosir = parseNum(r["Harga Jual Grosir"] || r["harga_jual_grosir"], harga_jual_satuan);
    const harga_jual_promo = r["Harga Jual Promo"] || r["harga_jual_promo"] ? parseNum(r["Harga Jual Promo"] || r["harga_jual_promo"]) : null;
    const diskon = parseNum(r["Diskon per Item (Rp)"] || r["Diskon"] || r["diskon"]);

    const stok = parseNum(r["Stok di Rak / Display"] || r["Stok Display"] || r["Stok"] || r["stok"]);
    const stok_gudang = parseNum(r["Stok di Gudang"] || r["Stok Gudang"] || r["stok_gudang"]);
    const stok_minimum = parseNum(r["Stok Minimum"] || r["stok_minimum"], 5);
    const stokMinimumGudangRaw = (r["Stok Minimum Gudang"] || r["stok_minimum_gudang"] || "").trim();
    const stok_minimum_gudang = stokMinimumGudangRaw ? parseNum(stokMinimumGudangRaw) : null;

    const hitungStokRaw = (r["Hitung Stok (ya/tidak)"] || r["Hitung Stok"] || r["hitung_stok"] || "ya").toString().toLowerCase().trim();
    const hitung_stok = hitungStokRaw === "ya" || hitungStokRaw === "true" || hitungStokRaw === "1";

    const default_purchase_unit = (r["Satuan Beli dari Supplier"] || r["Satuan Beli"] || r["default_purchase_unit"] || "").trim() || null;
    const conversion_ratio = parseNum(r["Isi per Satuan Beli"] || r["Rasio Konversi"] || r["conversion_ratio"], 1);

    // Satuan jual besar (multi-unit selling) — harga besar bisa diimport dari CSV.
    // Jika kolom harga besar diisi (>= 0), pakai nilai CSV.
    // Jika kolom harga besar kosong/null, auto-calculate = harga jual kecil × conversion_ratio.
    const jual_satuan = (r["Satuan Jual Besar"] || r["jual_satuan"] || "").trim() || null;

    const hargaJualBesarSatuanRaw = r["Harga Jual Besar Satuan"] || r["harga_jual_besar_satuan"];
    const hargaJualBesarGrosirRaw = r["Harga Jual Besar Grosir"] || r["harga_jual_besar_grosir"];
    const hargaJualBesarPromoRaw = r["Harga Jual Besar Promo"] || r["harga_jual_besar_promo"];

    const harga_jual_besar_satuan = jual_satuan
      ? (hargaJualBesarSatuanRaw != null && hargaJualBesarSatuanRaw !== ""
          ? parseNum(hargaJualBesarSatuanRaw)
          : Math.round(harga_jual_satuan * conversion_ratio))
      : null;
    const harga_jual_besar_grosir = jual_satuan
      ? (hargaJualBesarGrosirRaw != null && hargaJualBesarGrosirRaw !== ""
          ? parseNum(hargaJualBesarGrosirRaw)
          : Math.round(harga_jual_grosir * conversion_ratio))
      : null;
    const harga_jual_besar_promo = jual_satuan
      ? (hargaJualBesarPromoRaw != null && hargaJualBesarPromoRaw !== ""
          ? parseNum(hargaJualBesarPromoRaw)
          : (harga_jual_promo != null ? Math.round(harga_jual_promo * conversion_ratio) : null))
      : null;

    // Paket fields
    const id_produk_master_raw = (r["Produk Master (ID)"] || r["ID Master"] || r["id_produk_master"] || "").trim();
    let id_produk_master: number | null = null;
    if (id_produk_master_raw) {
      const parsed = parseInt(id_produk_master_raw, 10);
      if (!isNaN(parsed)) {
        id_produk_master = parsed;
      } else {
        // Try find by name
        const { data: masterProd } = await supabase
          .from("produk")
          .select("id")
          .ilike("nama_produk", id_produk_master_raw)
          .is("id_produk_master", null)
          .limit(1)
          .single();
        if (masterProd) id_produk_master = masterProd.id;
      }
    }
    const qty_per_unit_raw = r["Qty Isi per Paket"] || r["Qty Per Unit"] || r["qty_per_unit"];
    const qty_per_unit = qty_per_unit_raw ? parseNum(qty_per_unit_raw) : null;
    const jenis_isi_paket_raw = (r["Jenis Isi Paket"] || r["jenis_isi_paket"] || "").trim().toUpperCase();
    const jenis_isi_paket = (jenis_isi_paket_raw === "ACTUAL_WEIGHT" || jenis_isi_paket_raw === "FIXED_RATIO") ? jenis_isi_paket_raw : null;
    const isi_satuan = (r["Satuan Isi Paket"] || r["Satuan Isi"] || r["isi_satuan"] || "").trim() || null;

    const totalStok = stok + stok_gudang;
    const harga_pokok_avco = harga_modal;
    const nilai_persediaan = harga_modal * totalStok;

    let matchedProduct = null;
    if (barcode && existingByBarcode.has(barcode.toLowerCase())) {
      matchedProduct = existingByBarcode.get(barcode.toLowerCase());
    } else if (sku && existingBySku.has(sku.toLowerCase())) {
      matchedProduct = existingBySku.get(sku.toLowerCase());
    } else if (existingByName.has(nama_produk.toLowerCase())) {
      matchedProduct = existingByName.get(nama_produk.toLowerCase());
    }

    const basePayload = {
      nama_produk,
      id_kategori,
      id_satuan,
      id_merk,
      id_lokasi_area,
      sku,
      barcode,
      harga_modal,
      harga_jual_satuan,
      harga_jual_grosir,
      harga_jual_promo,
      diskon,
      stok_minimum,
      stok_minimum_gudang,
      hitung_stok: hitung_stok,
      id_produk_master,
      qty_per_unit,
      isi_satuan,
      jenis_isi_paket,
      default_purchase_unit,
      conversion_ratio,
      jual_satuan,
      harga_jual_besar_satuan,
      harga_jual_besar_grosir,
      harga_jual_besar_promo,
    };

    if (matchedProduct) {
      // UPDATE: Gunakan nilai stok dan AVCO yang sudah ada di database (Abaikan dari CSV)
      updates.push({
        ...basePayload,
        id: matchedProduct.id,
        stok: matchedProduct.stok,
        stok_gudang: matchedProduct.stok_gudang,
        harga_pokok_avco: matchedProduct.harga_pokok_avco,
        nilai_persediaan: matchedProduct.nilai_persediaan,
      });
    } else {
      // INSERT: Gunakan nilai stok dan AVCO baru dari CSV
      inserts.push({
        ...basePayload,
        stok,
        stok_gudang,
        harga_pokok_avco,
        nilai_persediaan,
      });
    }
  }

  if (inserts.length === 0 && updates.length === 0) {
    return { error: "Tidak ada baris data produk yang valid" };
  }

  let insertCount = 0;
  let updateCount = 0;

  if (inserts.length > 0) {
    const { error: errInsert } = await supabase.from("produk").insert(inserts);
    if (errInsert) {
      console.error("Failed to insert products:", errInsert);
      return { error: "Gagal menyimpan data produk baru: " + errInsert.message };
    }
    insertCount = inserts.length;
  }

  if (updates.length > 0) {
    const { error: errUpdate } = await supabase.from("produk").upsert(updates, { onConflict: "id" });
    if (errUpdate) {
      console.error("Failed to update products:", errUpdate);
      return { error: "Gagal memperbarui data produk lama: " + errUpdate.message };
    }
    updateCount = updates.length;
  }

  const msg = `Berhasil mengimpor: ${insertCount} produk baru ditambah, ${updateCount} produk diperbarui.`;

  await logActivity(supabase, {
    aksi: "CREATE",
    entitas: "produk",
    deskripsi: msg,
    data_baru: { insertCount, updateCount },
  });

  revalidatePath("/dashboard/inventory");
  return { success: true, count: insertCount + updateCount, message: msg };
}

/**
 * Generate SKU & Barcode untuk semua produk.
 *
 * SKU (hanya yang kosong) — max 8 karakter:
 *   Format: M(1) + Merk(2) + Nama(3) + Counter(2)
 *   Contoh: MTELAN01, MTEPOT02, MMODUD01
 *
 * Barcode (SEMUA produk, termasuk yang sudah ada — ditimpa):
 *   = SKU (alphanumeric, CODE128)
 *
 * Aturan:
 *  - SKU yang sudah ada TIDAK diubah
 *  - Barcode SELALU di-generate ulang (= SKU)
 *  - Counter unik per kombinasi Merk+Nama (01, 02, ...)
 *  - Produk tanpa merk pakai kode "NO"
 */
export async function generateAllSkuBarcode() {
  const ok = await requireAuth();
  if (!ok) return { error: "Unauthorized" };

  // Pakai admin client (service_role) untuk bypass RLS — operasi bulk update
  const supabase = supabaseAdmin;

  // 1. Fetch semua produk (tanpa RLS limit)
  const { data: products, error: prodErr } = await supabase
    .from("produk")
    .select("id, nama_produk, sku, barcode, id_merk")
    .order("id");

  if (prodErr) return { error: "Gagal mengambil data produk: " + prodErr.message };
  if (!products || products.length === 0) return { error: "Tidak ada produk" };

  // 2. Fetch semua merk
  const { data: merks } = await supabase
    .from("merk")
    .select("id, nama, kode");

  const merkMap = new Map<number, { nama: string; kode: string }>(
    (merks || []).map((m) => [m.id, { nama: m.nama, kode: m.kode || "" }])
  );

  // 3. Helper: ambil 3 huruf pertama dari nama (setelah hapus merk & karakter non-huruf)
  const extractNamaAbbrev = (nama: string, merkNama: string): string => {
    let cleaned = nama.toUpperCase();
    // Hapus nama merk
    if (merkNama) {
      cleaned = cleaned.replace(new RegExp(merkNama.toUpperCase(), "g"), "");
    }
    // Ambil hanya huruf (hapus angka, spasi, simbol)
    const letters = cleaned.replace(/[^A-Z]/g, "");
    return letters.slice(0, 3).padEnd(3, "X");
  };

  // 4. Generate SKU untuk produk yang kosong
  const generatedSkus = new Set<string>();
  // Pre-populate SKU & Barcode existing agar tidak bentrok
  for (const p of products) {
    if (p.sku) generatedSkus.add(p.sku.toUpperCase());
    if (p.barcode) generatedSkus.add(p.barcode.toUpperCase());
  }

  // Counter per kombinasi base (merk2 + nama3)
  const baseCounter = new Map<string, number>();

  const updates: { id: number; sku: string | null; barcode: string }[] = [];

  for (const p of products) {
    const merk = p.id_merk ? merkMap.get(p.id_merk) : null;
    const merkCode = (merk?.kode?.trim().toUpperCase().slice(0, 2) || "NO").padEnd(2, "X");
    const namaAbbrev = extractNamaAbbrev(p.nama_produk, merk?.nama || "");
    const base = `M${merkCode}${namaAbbrev}`;

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    let sku: string;

    // Anggap "-", kosong, spasi, "null", "n/a", atau sekumpulan strip/dash sebagai null
    const isFalsy = (s: string | null) => {
      if (!s) return true;
      const t = s.trim().toLowerCase();
      if (t === "" || t === "null" || t === "undefined" || t === "n/a" || t === "#n/a") return true;
      if (/^[-–—_]+$/.test(t)) return true; // tangkap "-", "--", "—" dll
      return false;
    };
    const existingSku = isFalsy(p.sku) ? null : p.sku;
    const existingBarcode = isFalsy(p.barcode) ? null : p.barcode;

    let finalSku: string;
    let finalBarcode: string;

    // Cek apakah barcode sudah sesuai format (diawali huruf M dan panjangnya tepat 8 karakter)
    const existingBarcodeClean = existingBarcode ? existingBarcode.trim().toUpperCase() : "";
    const barcodeHasFormatM = existingBarcodeClean.startsWith('M') && existingBarcodeClean.length === 8;

    // Jika SKU kosong ATAU barcode belum sesuai format M, kita butuh men-generate format M baru
    let generatedFormat: string | null = null;
    
    if (!existingSku || !barcodeHasFormatM) {
      const currentCount = baseCounter.get(base) || 0;
      let nextCount = currentCount + 1;
      baseCounter.set(base, nextCount);

      generatedFormat = `${base}${String(nextCount).padStart(2, "0")}`;

      // Jika masih bentrok (sangat jarang), cari counter berikutnya
      while (generatedSkus.has(generatedFormat.toUpperCase())) {
        nextCount++;
        baseCounter.set(base, nextCount);
        generatedFormat = `${base}${String(nextCount).padStart(2, "0")}`;
      }
      generatedSkus.add(generatedFormat.toUpperCase());
    }

    // Aturan:
    // 1. SKU: Kalau sudah ada (valid), BIAYARKAN SAJA apapun formatnya. Kalau kosong, pakai yang digenerate.
    // eslint-disable-next-line prefer-const
    finalSku = existingSku || generatedFormat!;
    
    // 2. Barcode: Kalau sudah diawali M, BIAYARKAN SAJA. Kalau tidak (atau kosong), UPDATE ulang pakai yang digenerate.
    // eslint-disable-next-line prefer-const
    finalBarcode = barcodeHasFormatM ? existingBarcode : generatedFormat!;

    // Hanya masukkan ke daftar update jika ada perubahan!
    const needsSkuUpdate = existingSku !== finalSku;
    const needsBarcodeUpdate = existingBarcode !== finalBarcode;

    if (needsSkuUpdate || needsBarcodeUpdate) {
      updates.push({ 
        id: p.id, 
        sku: needsSkuUpdate ? finalSku : null, 
        barcode: finalBarcode 
      });
    }
  }

  if (updates.length === 0) {
    // Revalidate cache di Vercel agar data tidak tersangkut cache lama (stale)
    revalidatePath("/dashboard/inventory");
    return {
      success: true,
      count: 0,
      message: "Semua produk sudah memiliki SKU & Barcode yang sesuai.",
    };
  }

  // 5. Batch update ke database — update satu per satu via admin client (bypass RLS)
  let updated = 0;
  let errors = 0;

  for (const u of updates) {
    const payload: Record<string, unknown> = { barcode: u.barcode };
    if (u.sku) payload.sku = u.sku;

    const { error } = await supabase
      .from("produk")
      .update(payload)
      .eq("id", u.id);

    if (error) {
      console.error(`Gagal update produk id=${u.id}:`, error.message);
      errors++;
    } else {
      updated++;
    }
  }

  await logActivity(supabase, {
    aksi: "UPDATE",
    entitas: "produk",
    deskripsi: `Generate SKU & Barcode: ${updated} produk berhasil, ${errors} gagal`,
    data_baru: { updated, errors },
  });

  // SELALU revalidate cache agar UI Vercel yang tersangkut (stale) otomatis mengambil data terbaru dari database
  revalidatePath("/dashboard/inventory");

  return {
    success: true,
    count: updated,
    message: `Berhasil generate SKU & Barcode: ${updated} produk${errors > 0 ? `, ${errors} gagal` : ""}.`,
  };
}
