"use server";

import { createClient } from "@/lib/supabase/server";
import { confirmTutupKasir, getDailyCashSummary, openKasirSession } from "@/lib/laporan-kasir";
import { revalidatePath } from "next/cache";
import { logActivity, buildDeskripsi } from "@/lib/activity-log";

/** Hanya kasir yang boleh membuka/menutup kas kasir. */
async function requireKasir(
  supabase: Awaited<ReturnType<typeof createClient>>
) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized", pengguna: null };

  const { data: pengguna } = await supabase
    .from("pengguna")
    .select("id, level")
    .eq("username", user.email?.split("@")[0])
    .single();

  if (!pengguna) return { error: "User profile not found.", pengguna: null };
  if (pengguna.level !== "KASIR") {
    return {
      error: "Akses ditolak — hanya kasir yang dapat membuka/menutup kas kasir",
      pengguna: null,
    };
  }
  return { error: null, pengguna };
}

/** Hanya owner yang boleh mengoreksi/mengedit saldo kasir (jika salah input). */
async function requireOwner(
  supabase: Awaited<ReturnType<typeof createClient>>
) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized", pengguna: null };

  const { data: pengguna } = await supabase
    .from("pengguna")
    .select("id, level")
    .eq("username", user.email?.split("@")[0])
    .single();

  if (!pengguna) return { error: "User profile not found.", pengguna: null };
  if (pengguna.level !== "OWNER") {
    return {
      error: "Akses ditolak — hanya owner yang dapat mengedit saldo kasir",
      pengguna: null,
    };
  }
  return { error: null, pengguna };
}

export async function fetchCashSummary(date: string) {
  const supabase = await createClient();

  const { error: authErr } = await requireKasir(supabase);
  if (authErr) return { error: authErr };


  try {
    const summary = await getDailyCashSummary(supabase, date);
    return { data: summary };
  } catch {
    return { error: "Gagal mengambil ringkasan kas" };
  }
}

/** Langkah 1 — Buka Sesi Kas Kasir: kasir memasukkan uang awal (float). */
export async function bukaSesiKasir(tanggal: string, uang_awal: number) {
  const supabase = await createClient();

  const { error: authErr, pengguna } = await requireKasir(supabase);
  if (authErr) return { error: authErr };
  if (!pengguna) return { error: authErr || "Unauthorized" };

  if (!tanggal) return { error: "Tanggal wajib diisi" };
  if (!(Number(uang_awal) > 0)) return { error: "Uang awal harus lebih dari 0" };

  try {
    await openKasirSession(supabase, {
      tanggal,
      uang_awal: Number(uang_awal),
      id_pengguna: pengguna.id,
    });

    await logActivity(supabase, {
      aksi: "CREATE",
      entitas: "saldo_kas_harian",
      deskripsi: `Buka sesi kasir ${tanggal}: uang awal ${new Intl.NumberFormat("id-ID").format(Number(uang_awal))}`,
      data_baru: { tanggal, uang_awal: Number(uang_awal) } as unknown as Record<string, unknown>,
    });

    revalidatePath("/dashboard/laporan-kasir");
    revalidatePath("/dashboard/tutup-kasir");
    return { success: true };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (err: any) {
    console.error("Failed to open kasir session:", err);
    return { error: err?.message || "Gagal membuka sesi kasir" };
  }
}

/** Langkah 2 — Tutup Kasir: hitung ulang di server, simpan uang aktual & selisih. */
export async function submitTutupKasir(params: {
  tanggal: string;
  uang_aktual: number;
}) {
  const supabase = await createClient();

  const { error: authErr, pengguna } = await requireKasir(supabase);
  if (authErr) return { error: authErr };
  if (!pengguna) return { error: authErr || "Unauthorized" };

  if (!params.tanggal) return { error: "Tanggal wajib diisi" };
  const uangAktual = Number(params.uang_aktual);
  if (isNaN(uangAktual) || uangAktual < 0) return { error: "Uang aktual wajib diisi" };

  try {
    // Rekalkulasi server-side (jangan percaya angka dari client)
    const summary = await getDailyCashSummary(supabase, params.tanggal);

    if (!summary.sesi.sudah_dibuka) {
      return { error: "Buka sesi kasir terlebih dahulu sebelum menutup" };
    }
    if (summary.sesi.sudah_ditutup) {
      return { error: "Sesi kasir pada tanggal ini sudah ditutup" };
    }

    await confirmTutupKasir(supabase, {
      tanggal: summary.tanggal,
      uang_awal: summary.uang_awal,
      saldo_awal: summary.saldo_awal,
      total_masuk: summary.total_masuk,
      total_keluar: summary.total_keluar,
      uang_aktual: uangAktual,
      id_pengguna: pengguna.id,
    });

    await logActivity(supabase, {
      aksi: "CREATE",
      entitas: "saldo_kas_harian",
      deskripsi: buildDeskripsi({
        aksi: "CREATE",
        entitas: "saldo_kas_harian",
        data_baru: { tanggal: params.tanggal, uang_awal: summary.uang_awal, uang_aktual: uangAktual, selisih: uangAktual - summary.saldo_akhir_sistem } as unknown as Record<string, unknown>,
      }),
      data_baru: {
        tanggal: params.tanggal,
        uang_awal: summary.uang_awal,
        total_masuk: summary.total_masuk,
        uang_aktual: uangAktual,
        selisih: uangAktual - summary.saldo_akhir_sistem,
      } as unknown as Record<string, unknown>,
    });

    revalidatePath("/dashboard/laporan-kasir");
    revalidatePath("/dashboard/tutup-kasir");
    return { success: true };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (err: any) {
    console.error("Failed to confirm tutup kasir:", err);
    return { error: "Gagal konfirmasi tutup kasir" };
  }
}

/** Koreksi saldo sesi kasir oleh OWNER (jika kasir/admin salah input).
 *  Uang awal mengubah saldo_awal (saldo_akhir otomatis = saldo_awal + masuk − keluar),
 *  uang aktual mengubah selisih. total_masuk/keluar TIDAK diubah (berasal dari penjualan).
 */
export async function editSesiKasir(params: {
  tanggal: string;
  uang_awal: number;
  uang_aktual: number | null;
}) {
  const supabase = await createClient();

  const { error: authErr, pengguna } = await requireOwner(supabase);
  if (authErr) return { error: authErr };
  if (!pengguna) return { error: authErr || "Unauthorized" };

  if (!params.tanggal) return { error: "Tanggal wajib diisi" };
  const uangAwal = Number(params.uang_awal);
  if (isNaN(uangAwal) || uangAwal < 0) return { error: "Uang awal tidak valid" };
  const uangAktual = params.uang_aktual == null ? null : Number(params.uang_aktual);
  if (uangAktual != null && (isNaN(uangAktual) || uangAktual < 0)) {
    return { error: "Uang aktual tidak valid" };
  }

  try {
    const { data: existing } = await supabase
      .from("saldo_kas_harian")
      .select("tanggal, uang_awal, uang_aktual, total_masuk, dikonfirmasi")
      .eq("tanggal", params.tanggal)
      .maybeSingle();

    if (!existing) {
      return { error: "Sesi kasir pada tanggal ini belum dibuka" };
    }

    const totalMasuk = Number(existing.total_masuk || 0);
    const saldoAkhir = uangAwal + totalMasuk;
    const selisih = uangAktual == null ? null : uangAktual - saldoAkhir;

    const { error } = await supabase
      .from("saldo_kas_harian")
      .update({
        uang_awal: uangAwal,
        saldo_awal: uangAwal,
        uang_aktual: uangAktual,
        selisih,
      })
      .eq("tanggal", params.tanggal);

    if (error) {
      console.error("Failed to edit kasir session:", error);
      return { error: "Gagal mengedit saldo sesi kasir" };
    }

    await logActivity(supabase, {
      aksi: "UPDATE",
      entitas: "saldo_kas_harian",
      deskripsi: `Koreksi saldo sesi kasir ${params.tanggal}: uang awal ${new Intl.NumberFormat("id-ID").format(uangAwal)}${uangAktual != null ? `, uang aktual ${new Intl.NumberFormat("id-ID").format(uangAktual)}` : ""}`,
      data_lama: {
        tanggal: existing.tanggal,
        uang_awal: existing.uang_awal,
        uang_aktual: existing.uang_aktual,
      } as unknown as Record<string, unknown>,
      data_baru: {
        tanggal: params.tanggal,
        uang_awal: uangAwal,
        uang_aktual: uangAktual,
        selisih,
      } as unknown as Record<string, unknown>,
    });

    revalidatePath("/dashboard/laporan-kasir");
    revalidatePath("/dashboard/laporan/kas");
    revalidatePath("/dashboard/tutup-kasir");
    return { success: true };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (err: any) {
    console.error("Failed to edit kasir session:", err);
    return { error: err?.message || "Gagal mengedit saldo sesi kasir" };
  }
}
