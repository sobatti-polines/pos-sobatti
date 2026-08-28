"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { buildDeskripsi, logActivity } from "@/lib/activity-log";
import { isAdminOrOwnerLike } from "@/lib/roles";

export type PoCustomStatus =
  | "DRAFT"
  | "MENUNGGU_DP"
  | "DIPROSES"
  | "SIAP_KIRIM"
  | "SELESAI"
  | "BATAL";

export type PaymentType = "DP" | "PELUNASAN" | "TAMBAHAN";

const VALID_STATUS: PoCustomStatus[] = [
  "DRAFT",
  "MENUNGGU_DP",
  "DIPROSES",
  "SIAP_KIRIM",
  "SELESAI",
  "BATAL",
];

async function requireManagement() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { supabase, pengguna: null, error: "Unauthorized" };

  const { data: pengguna } = await supabase
    .from("pengguna")
    .select("id, level")
    .eq("username", user.email?.split("@")[0])
    .single();

  if (!isAdminOrOwnerLike(pengguna?.level)) {
    return { supabase, pengguna: null, error: "Forbidden" };
  }

  return { supabase, pengguna, error: null };
}

function toNumber(value: unknown): number {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function cleanText(value: unknown): string | null {
  const text = String(value ?? "").trim();
  return text ? text : null;
}

function cleanAttributes(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const result: Record<string, string> = {};
  for (const [rawKey, rawValue] of Object.entries(value as Record<string, unknown>)) {
    const key = rawKey.trim();
    const val = String(rawValue ?? "").trim();
    if (key && val) result[key] = val;
  }
  return result;
}

function generatePoNumber() {
  const now = new Date();
  const date = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .format(now)
    .replaceAll("-", "");
  return `POC-${date}-${randomUUID().slice(0, 8).toUpperCase()}`;
}

async function getTotalPaid(supabase: Awaited<ReturnType<typeof createClient>>, poId: number) {
  const { data, error } = await supabase
    .from("po_custom_pembayaran")
    .select("jumlah_bayar")
    .eq("id_po", poId);

  if (error) throw error;
  return (data ?? []).reduce((sum, row) => sum + toNumber(row.jumlah_bayar), 0);
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error && typeof error === "object" && "message" in error) {
    const message = String((error as { message?: unknown }).message ?? "").trim();
    if (message) return message;
  }
  return fallback;
}

export async function savePoCustom(
  id: number | null,
  input: {
    id_pelanggan: number;
    id_produk?: number | null;
    tanggal_po: string;
    nama_pesanan: string;
    spesifikasi?: string | null;
    atribut_custom?: Record<string, string>;
    qty: number;
    harga_total: number;
    target_selesai?: string | null;
    status: PoCustomStatus;
    catatan_internal?: string | null;
    dp_awal?: number;
    id_metode_bayar_dp?: number | null;
  }
) {
  const { supabase, pengguna, error: authError } = await requireManagement();
  if (authError || !pengguna) return { error: authError ?? "Unauthorized" };

  const hargaTotal = toNumber(input.harga_total);
  const qty = toNumber(input.qty);
  const dpAwal = toNumber(input.dp_awal);
  const status = VALID_STATUS.includes(input.status) ? input.status : "MENUNGGU_DP";

  if (!Number.isInteger(Number(input.id_pelanggan)) || Number(input.id_pelanggan) <= 0) {
    return { error: "Pelanggan wajib dipilih" };
  }
  if (!cleanText(input.nama_pesanan)) return { error: "Nama pesanan wajib diisi" };
  if (qty <= 0) return { error: "Qty wajib lebih dari 0" };
  if (hargaTotal <= 0) return { error: "Harga total wajib lebih dari 0" };
  if (dpAwal < 0) return { error: "DP awal tidak boleh negatif" };
  if (dpAwal > hargaTotal) return { error: "DP awal tidak boleh melebihi harga total" };
  if (!id && dpAwal > 0 && !input.id_metode_bayar_dp) {
    return { error: "Metode bayar DP wajib dipilih" };
  }

  const payload = {
    id_pelanggan: Number(input.id_pelanggan),
    id_produk: input.id_produk ? Number(input.id_produk) : null,
    tanggal_po: input.tanggal_po || new Date().toISOString().slice(0, 10),
    nama_pesanan: cleanText(input.nama_pesanan) ?? "",
    spesifikasi: cleanText(input.spesifikasi),
    atribut_custom: cleanAttributes(input.atribut_custom),
    qty,
    harga_total: hargaTotal,
    target_selesai: cleanText(input.target_selesai),
    status,
    catatan_internal: cleanText(input.catatan_internal),
  };

  if (id) {
    const currentPaid = await getTotalPaid(supabase, id);
    if (hargaTotal < currentPaid) {
      return {
        error: "Harga total tidak boleh lebih kecil dari total pembayaran yang sudah tercatat",
      };
    }

    const { data: oldPo } = await supabase
      .from("po_custom")
      .select("*")
      .eq("id", id)
      .single();

    if (oldPo?.id_transaksi_keluar) {
      return { error: "PO custom yang sudah difinalisasi tidak bisa diedit" };
    }

    const { error } = await supabase.from("po_custom").update(payload).eq("id", id);
    if (error) {
      console.error("Failed to update PO custom:", error);
      return { error: "Gagal memperbarui PO custom" };
    }

    await logActivity(supabase, {
      aksi: "UPDATE",
      entitas: "po_custom",
      id_entitas: id,
      deskripsi: buildDeskripsi({
        aksi: "UPDATE",
        entitas: "po_custom",
        id_entitas: id,
        data_lama: oldPo as Record<string, unknown> | null,
        data_baru: payload as Record<string, unknown>,
      }),
      data_lama: oldPo as Record<string, unknown> | null,
      data_baru: payload as Record<string, unknown>,
    });
  } else {
    const insertPayload = {
      ...payload,
      no_po: generatePoNumber(),
      created_by: pengguna.id,
    };

    const { data: inserted, error } = await supabase
      .from("po_custom")
      .insert(insertPayload)
      .select("id")
      .single();

    if (error || !inserted) {
      console.error("Failed to create PO custom:", error);
      return { error: "Gagal membuat PO custom" };
    }

    if (dpAwal > 0) {
      const { error: paymentError } = await supabase
        .from("po_custom_pembayaran")
        .insert({
          id_po: inserted.id,
          tanggal_bayar: payload.tanggal_po,
          jumlah_bayar: dpAwal,
          id_metode_bayar: input.id_metode_bayar_dp,
          jenis_pembayaran: "DP",
          keterangan: "DP awal",
          created_by: pengguna.id,
        });

      if (paymentError) {
        console.error("Failed to create initial PO payment:", paymentError);
        return { error: "PO dibuat, tetapi DP awal gagal dicatat" };
      }
    }

    await logActivity(supabase, {
      aksi: "CREATE",
      entitas: "po_custom",
      id_entitas: inserted.id,
      deskripsi: `Membuat PO Custom '${insertPayload.no_po}'`,
      data_baru: insertPayload as Record<string, unknown>,
    });
  }

  revalidatePath("/dashboard/po-custom");
  return { success: true };
}

export async function addPoCustomPayment(
  poId: number,
  input: {
    tanggal_bayar: string;
    jumlah_bayar: number;
    id_metode_bayar?: number | null;
    jenis_pembayaran: PaymentType;
    keterangan?: string | null;
  }
) {
  const { supabase, pengguna, error: authError } = await requireManagement();
  if (authError || !pengguna) return { error: authError ?? "Unauthorized" };

  const jumlahBayar = toNumber(input.jumlah_bayar);
  if (!Number.isInteger(Number(poId)) || Number(poId) <= 0) return { error: "PO tidak valid" };
  if (jumlahBayar <= 0) return { error: "Jumlah bayar wajib lebih dari 0" };
  if (!input.id_metode_bayar) return { error: "Metode bayar wajib dipilih" };

  const { data: po, error: poError } = await supabase
    .from("po_custom")
    .select("id, no_po, harga_total, id_transaksi_keluar")
    .eq("id", poId)
    .single();

  if (poError || !po) return { error: "PO custom tidak ditemukan" };
  if (po.id_transaksi_keluar) {
    return { error: "PO custom yang sudah difinalisasi tidak bisa ditambah pembayaran" };
  }

  const totalPaid = await getTotalPaid(supabase, poId);
  if (totalPaid + jumlahBayar > toNumber(po.harga_total)) {
    return { error: "Total pembayaran tidak boleh melebihi harga total PO" };
  }

  const payload = {
    id_po: poId,
    tanggal_bayar: input.tanggal_bayar || new Date().toISOString().slice(0, 10),
    jumlah_bayar: jumlahBayar,
    id_metode_bayar: Number(input.id_metode_bayar),
    jenis_pembayaran: input.jenis_pembayaran,
    keterangan: cleanText(input.keterangan),
    created_by: pengguna.id,
  };

  const { error } = await supabase.from("po_custom_pembayaran").insert(payload);
  if (error) {
    console.error("Failed to add PO payment:", error);
    return { error: "Gagal mencatat pembayaran" };
  }

  await logActivity(supabase, {
    aksi: "CREATE",
    entitas: "po_custom_pembayaran",
    id_entitas: poId,
    deskripsi: `Mencatat pembayaran PO Custom '${po.no_po}' sebesar ${jumlahBayar}`,
    data_baru: payload as Record<string, unknown>,
  });

  revalidatePath("/dashboard/po-custom");
  return { success: true };
}

export async function deletePoCustom(id: number) {
  const { supabase, error: authError } = await requireManagement();
  if (authError) return { error: authError };

  const { data: oldPo } = await supabase
    .from("po_custom")
    .select("*")
    .eq("id", id)
    .single();

  if (oldPo?.id_transaksi_keluar) {
    return { error: "PO custom yang sudah difinalisasi tidak bisa dihapus" };
  }

  const { error } = await supabase.from("po_custom").delete().eq("id", id);
  if (error) {
    console.error("Failed to delete PO custom:", error);
    return { error: "Gagal menghapus PO custom" };
  }

  await logActivity(supabase, {
    aksi: "DELETE",
    entitas: "po_custom",
    id_entitas: id,
    deskripsi: `Menghapus PO Custom '${oldPo?.no_po ?? id}'`,
    data_lama: oldPo as Record<string, unknown> | null,
  });

  revalidatePath("/dashboard/po-custom");
  return { success: true };
}

export async function finalizePoCustom(poId: number, metodeBayarId: number) {
  const { supabase, pengguna, error: authError } = await requireManagement();
  if (authError || !pengguna) return { error: authError ?? "Unauthorized" };

  if (!Number.isInteger(Number(poId)) || Number(poId) <= 0) {
    return { error: "PO tidak valid" };
  }
  if (!Number.isInteger(Number(metodeBayarId)) || Number(metodeBayarId) <= 0) {
    return { error: "Metode bayar transaksi wajib dipilih" };
  }

  const { data, error } = await supabase.rpc("finalize_po_custom", {
    p_id_po: poId,
    p_id_pengguna: pengguna.id,
    p_id_metode_bayar: metodeBayarId,
  });

  if (error) {
    console.error("Failed to finalize PO custom:", error);
    return { error: getErrorMessage(error, "Gagal finalisasi PO custom") };
  }

  await logActivity(supabase, {
    aksi: "UPDATE",
    entitas: "po_custom",
    id_entitas: poId,
    deskripsi: `Finalisasi PO Custom menjadi transaksi ${
      typeof data === "object" && data && "no_transaksi" in data
        ? String((data as { no_transaksi?: unknown }).no_transaksi)
        : ""
    }`.trim(),
    data_baru: data as Record<string, unknown>,
  });

  revalidatePath("/dashboard/po-custom");
  revalidatePath("/dashboard/reports");
  revalidatePath("/dashboard/transactions");
  revalidatePath("/dashboard/laporan/laba-rugi");
  return { success: true, data };
}
