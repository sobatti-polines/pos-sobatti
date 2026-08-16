"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { logActivity, buildDeskripsi } from "@/lib/activity-log";

/* ------------------------------------------------------------------ */
/*  Auth helpers                                                        */
/* ------------------------------------------------------------------ */

async function getAuthUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase: null, pengguna: null };

  const username = user.email?.split("@")[0];
  const { data: pengguna } = await supabase
    .from("pengguna")
    .select("id, level, username")
    .eq("username", username)
    .single();

  return { supabase, pengguna };
}

function requireAdmin(pengguna: { level: string } | null): string | null {
  if (!pengguna) return "Unauthorized";
  if (pengguna.level !== "ADMIN" && pengguna.level !== "OWNER") {
    return "Akses ditolak — hanya ADMIN/OWNER";
  }
  return null;
}

/* ------------------------------------------------------------------ */
/*  Zod schemas                                                         */
/* ------------------------------------------------------------------ */

const tanggalField = z
  .string()
  .min(1, "Tanggal wajib diisi")
  .refine((v) => !isNaN(new Date(v).getTime()), "Tanggal tidak valid");

const createPengeluaranSchema = z.object({
  tanggal: tanggalField,
  id_kategori_beban: z
    .number()
    .int()
    .positive("Kategori beban wajib dipilih"),
  nama_pengeluaran: z
    .string()
    .trim()
    .min(1, "Nama pengeluaran wajib diisi"),
  jumlah: z
    .number()
    .positive("Jumlah harus lebih dari 0"),
  metode_bayar: z.string().min(1, "Metode bayar wajib diisi"),
  keterangan: z.string().optional(),
});

const updatePengeluaranSchema = createPengeluaranSchema.extend({
  id: z.string().min(1, "ID pengeluaran tidak valid"),
});

const voidPengeluaranSchema = z.object({
  id: z.string().min(1, "ID pengeluaran tidak valid"),
  alasan: z.string().trim().min(1, "Alasan pembatalan wajib diisi"),
});

const getPengeluaranListSchema = z.object({
  tanggal_awal: z.string().optional(),
  tanggal_akhir: z.string().optional(),
  id_kategori_beban: z
    .number()
    .int()
    .positive()
    .nullable()
    .optional(),
  status: z.enum(["AKTIF", "DIVOID", "SEMUA"]).optional(),
});

type PengeluaranRow = {
  id: string;
  tanggal: string;
  id_kategori_beban: number;
  kategori_nama: string | null;
  kategori_kelompok: string | null;
  nama_pengeluaran: string;
  jumlah: number;
  metode_bayar: string;
  keterangan: string | null;
  status: "AKTIF" | "DIVOID";
  created_at: string | null;
  voided_at: string | null;
  alasan_void: string | null;
  id_pengguna: number;
};

/* ------------------------------------------------------------------ */
/*  Helper metode bayar dinamis (Tunai, QRIS, Bank 1, Bank 2)           */
/* ------------------------------------------------------------------ */

/**
 * Daftar metode bayar yang diizinkan dari pengaturan toko:
 * Tunai, QRIS, bank1_nama, bank2_nama + 'Transfer' (legacy untuk data lama).
 */
async function getAllowedMetodeBayar(
  supabase: Awaited<ReturnType<typeof createClient>>
): Promise<string[]> {
  const { data } = await supabase
    .from("pengaturan")
    .select("bank1_nama, bank2_nama")
    .eq("id", 1)
    .single();

  const banks = [data?.bank1_nama, data?.bank2_nama]
    .filter((n): n is string => typeof n === "string" && n.trim() !== "")
    .map((n) => n.trim());

  return ["Tunai", "QRIS", "Transfer", ...banks];
}

/**
 * Opsi metode bayar untuk form (tanpa 'Transfer' generik — diganti bank).
 */
export async function getMetodeBayarOptions(): Promise<string[]> {
  const { supabase, pengguna } = await getAuthUser();
  if (!supabase) return ["Tunai", "QRIS"];

  const err = requireAdmin(pengguna);
  if (err) return ["Tunai", "QRIS"];

  const allowed = await getAllowedMetodeBayar(supabase);
  return allowed.filter((m) => m !== "Transfer");
}

/* ------------------------------------------------------------------ */
/*  1. createPengeluaran                                                */
/* ------------------------------------------------------------------ */

export async function createPengeluaran(
  input: z.infer<typeof createPengeluaranSchema>
) {
  const { supabase, pengguna } = await getAuthUser();
  if (!supabase) return { error: "Unauthorized" };

  const err = requireAdmin(pengguna);
  if (err) return { error: err };

  const parsed = createPengeluaranSchema.safeParse(input);
  if (!parsed.success) {
    const messages = parsed.error.issues.map((issue) => issue.message);
    return { error: messages.join(". ") };
  }

  const allowedMetode = await getAllowedMetodeBayar(supabase);
  if (!allowedMetode.includes(parsed.data.metode_bayar)) {
    return { error: "Metode bayar tidak valid" };
  }

  const { data, error } = await supabase
    .from("pengeluaran")
    .insert({
      tanggal: parsed.data.tanggal,
      id_kategori_beban: parsed.data.id_kategori_beban,
      nama_pengeluaran: parsed.data.nama_pengeluaran.trim(),
      jumlah: parsed.data.jumlah,
      metode_bayar: parsed.data.metode_bayar,
      id_pengguna: pengguna!.id,
      keterangan: parsed.data.keterangan?.trim() || null,
      status: "AKTIF",
    })
    .select("id")
    .single();

  if (error) {
    console.error("Create pengeluaran error:", error);
    return { error: "Gagal menambah pengeluaran: " + error.message };
  }

  await logActivity(supabase, {
    aksi: "CREATE",
    entitas: "pengeluaran",
    deskripsi: buildDeskripsi({
      aksi: "CREATE",
      entitas: "pengeluaran",
      data_baru: {
        nama_pengeluaran: parsed.data.nama_pengeluaran.trim(),
        jumlah: parsed.data.jumlah,
        metode_bayar: parsed.data.metode_bayar,
        tanggal: parsed.data.tanggal,
      } as unknown as Record<string, unknown>,
    }),
    data_baru: {
      nama_pengeluaran: parsed.data.nama_pengeluaran.trim(),
      jumlah: parsed.data.jumlah,
      metode_bayar: parsed.data.metode_bayar,
      tanggal: parsed.data.tanggal,
    } as unknown as Record<string, unknown>,
  });

  revalidatePath("/dashboard/keuangan/pengeluaran");
  revalidatePath("/dashboard/keuangan/arus-kas");
  revalidatePath("/dashboard/laporan/laba-rugi");
  revalidatePath("/dashboard/laporan/neraca");
  revalidatePath("/dashboard/tutup-kasir");
  revalidatePath("/dashboard/laporan-kasir");
  revalidatePath("/dashboard");

  return { success: true, id: data.id };
}

/* ------------------------------------------------------------------ */
/*  2. updatePengeluaran                                                */
/* ------------------------------------------------------------------ */

export async function updatePengeluaran(
  input: z.infer<typeof updatePengeluaranSchema>
) {
  const { supabase, pengguna } = await getAuthUser();
  if (!supabase) return { error: "Unauthorized" };

  const err = requireAdmin(pengguna);
  if (err) return { error: err };

  const parsed = updatePengeluaranSchema.safeParse(input);
  if (!parsed.success) {
    const messages = parsed.error.issues.map((issue) => issue.message);
    return { error: messages.join(". ") };
  }

  const { data: existing, error: fetchError } = await supabase
    .from("pengeluaran")
    .select(
      "id, tanggal, id_kategori_beban, nama_pengeluaran, jumlah, metode_bayar, keterangan, status"
    )
    .eq("id", parsed.data.id)
    .single();

  if (fetchError || !existing) {
    return { error: "Pengeluaran tidak ditemukan" };
  }

  if (existing.status === "DIVOID") {
    return { error: "Pengeluaran sudah dibatalkan — tidak bisa diedit" };
  }

  const allowedMetode = await getAllowedMetodeBayar(supabase);
  if (!allowedMetode.includes(parsed.data.metode_bayar)) {
    return { error: "Metode bayar tidak valid" };
  }

  const newData = {
    tanggal: parsed.data.tanggal,
    id_kategori_beban: parsed.data.id_kategori_beban,
    nama_pengeluaran: parsed.data.nama_pengeluaran.trim(),
    jumlah: parsed.data.jumlah,
    metode_bayar: parsed.data.metode_bayar,
    keterangan: parsed.data.keterangan?.trim() || null,
  };

  const { error: updateError } = await supabase
    .from("pengeluaran")
    .update(newData)
    .eq("id", parsed.data.id);

  if (updateError) {
    console.error("Update pengeluaran error:", updateError);
    return { error: "Gagal mengubah pengeluaran: " + updateError.message };
  }

  await logActivity(supabase, {
    aksi: "UPDATE",
    entitas: "pengeluaran",
    deskripsi: buildDeskripsi({
      aksi: "UPDATE",
      entitas: "pengeluaran",
      data_lama: {
        tanggal: existing.tanggal,
        id_kategori_beban: existing.id_kategori_beban,
        nama_pengeluaran: existing.nama_pengeluaran,
        jumlah: existing.jumlah,
        metode_bayar: existing.metode_bayar,
        keterangan: existing.keterangan,
      } as unknown as Record<string, unknown>,
      data_baru: newData as unknown as Record<string, unknown>,
    }),
    data_lama: {
      tanggal: existing.tanggal,
      id_kategori_beban: existing.id_kategori_beban,
      nama_pengeluaran: existing.nama_pengeluaran,
      jumlah: existing.jumlah,
      metode_bayar: existing.metode_bayar,
      keterangan: existing.keterangan,
    } as unknown as Record<string, unknown>,
    data_baru: newData as unknown as Record<string, unknown>,
  });

  revalidatePath("/dashboard/keuangan/pengeluaran");
  revalidatePath("/dashboard/keuangan/arus-kas");
  revalidatePath("/dashboard/laporan/laba-rugi");
  revalidatePath("/dashboard/laporan/neraca");
  revalidatePath("/dashboard/tutup-kasir");
  revalidatePath("/dashboard/laporan-kasir");
  revalidatePath("/dashboard");

  return { success: true };
}

/* ------------------------------------------------------------------ */
/*  3. voidPengeluaran (soft-update)                                    */
/* ------------------------------------------------------------------ */

export async function voidPengeluaran(id: string, alasan: string) {
  const { supabase, pengguna } = await getAuthUser();
  if (!supabase) return { error: "Unauthorized" };

  const err = requireAdmin(pengguna);
  if (err) return { error: err };

  const parsed = voidPengeluaranSchema.safeParse({ id, alasan });
  if (!parsed.success) {
    const messages = parsed.error.issues.map((issue) => issue.message);
    return { error: messages.join(". ") };
  }

  const { data: existing, error: fetchError } = await supabase
    .from("pengeluaran")
    .select("id, status, nama_pengeluaran, jumlah, tanggal")
    .eq("id", parsed.data.id)
    .single();

  if (fetchError || !existing) {
    return { error: "Pengeluaran tidak ditemukan" };
  }

  if (existing.status === "DIVOID") {
    return { error: "Pengeluaran sudah dibatalkan sebelumnya" };
  }

  const { error: voidError } = await supabase
    .from("pengeluaran")
    .update({
      status: "DIVOID",
      voided_at: new Date().toISOString(),
      voided_by: pengguna!.id,
      alasan_void: parsed.data.alasan,
    })
    .eq("id", parsed.data.id);

  if (voidError) {
    console.error("Void pengeluaran error:", voidError);
    return { error: "Gagal membatalkan pengeluaran: " + voidError.message };
  }

  await logActivity(supabase, {
    aksi: "DELETE",
    entitas: "pengeluaran",
    deskripsi: `Membatalkan Pengeluaran '${existing.nama_pengeluaran}' (${new Intl.NumberFormat("id-ID").format(Number(existing.jumlah))}): ${parsed.data.alasan}`,
    data_lama: {
      id: existing.id,
      nama_pengeluaran: existing.nama_pengeluaran,
      jumlah: existing.jumlah,
      tanggal: existing.tanggal,
      alasan_void: parsed.data.alasan,
    } as unknown as Record<string, unknown>,
  });

  revalidatePath("/dashboard/keuangan/pengeluaran");
  revalidatePath("/dashboard/keuangan/arus-kas");
  revalidatePath("/dashboard/laporan/laba-rugi");
  revalidatePath("/dashboard/laporan/neraca");
  revalidatePath("/dashboard/tutup-kasir");
  revalidatePath("/dashboard/laporan-kasir");
  revalidatePath("/dashboard");

  return { success: true };
}

/* ------------------------------------------------------------------ */
/*  4. getPengeluaranList                                               */
/* ------------------------------------------------------------------ */

export async function getPengeluaranList(
  filter?: z.infer<typeof getPengeluaranListSchema>
) {
  const { supabase, pengguna } = await getAuthUser();
  if (!supabase) return { error: "Unauthorized" };

  const err = requireAdmin(pengguna);
  if (err) return { error: err };

  const parsed = getPengeluaranListSchema.safeParse(filter ?? {});
  if (!parsed.success) {
    const messages = parsed.error.issues.map((issue) => issue.message);
    return { error: messages.join(". ") };
  }

  let query = supabase
    .from("pengeluaran")
    .select(
      "id, tanggal, id_kategori_beban, nama_pengeluaran, jumlah, metode_bayar, keterangan, status, created_at, voided_at, alasan_void, id_pengguna, kategori_beban(nama, kelompok)"
    )
    .order("tanggal", { ascending: false })
    .order("created_at", { ascending: false });

  if (parsed.data.tanggal_awal) {
    query = query.gte("tanggal", parsed.data.tanggal_awal);
  }
  if (parsed.data.tanggal_akhir) {
    query = query.lte("tanggal", parsed.data.tanggal_akhir);
  }
  if (parsed.data.id_kategori_beban) {
    query = query.eq("id_kategori_beban", parsed.data.id_kategori_beban);
  }
  if (parsed.data.status && parsed.data.status !== "SEMUA") {
    query = query.eq("status", parsed.data.status);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Get pengeluaran list error:", error);
    return { error: "Gagal memuat data pengeluaran" };
  }

  const rows: PengeluaranRow[] = (data ?? []).map((r) => {
    const kategori = Array.isArray(r.kategori_beban)
      ? (r.kategori_beban[0] as { nama?: string; kelompok?: string } | undefined) ?? null
      : (r.kategori_beban as unknown as { nama?: string; kelompok?: string } | null) ?? null;

    return {
      id: r.id,
      tanggal: r.tanggal,
      id_kategori_beban: Number(r.id_kategori_beban),
      kategori_nama: kategori?.nama ?? null,
      kategori_kelompok: kategori?.kelompok ?? null,
      nama_pengeluaran: r.nama_pengeluaran,
      jumlah: Number(r.jumlah),
      metode_bayar: r.metode_bayar,
      keterangan: r.keterangan,
      status: r.status,
      created_at: r.created_at,
      voided_at: r.voided_at,
      alasan_void: r.alasan_void,
      id_pengguna: Number(r.id_pengguna),
    };
  });

  return { data: rows };
}

/* ------------------------------------------------------------------ */
/*  5. getKategoriBeban                                                 */
/* ------------------------------------------------------------------ */

export async function getKategoriBeban() {
  const { supabase, pengguna } = await getAuthUser();
  if (!supabase) return { error: "Unauthorized" };

  const err = requireAdmin(pengguna);
  if (err) return { error: err };

  // Hanya 3 kategori beban yang dipakai: ATK, Konsumsi, Kebersihan
  const { data, error } = await supabase
    .from("kategori_beban")
    .select("id, nama, kelompok")
    .in("nama", ["ATK", "Konsumsi", "Kebersihan"])
    .order("nama", { ascending: true });

  if (error) {
    console.error("Get kategori beban error:", error);
    return { error: "Gagal memuat kategori beban" };
  }

  const rows = (data ?? []).map((r) => ({
    id: Number(r.id),
    nama: r.nama,
    kelompok: r.kelompok ?? null,
  }));

  return { data: rows };
}