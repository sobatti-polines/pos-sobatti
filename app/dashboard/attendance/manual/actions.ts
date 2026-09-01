"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { isOwnerLike } from "@/lib/roles";
import { getTodayWIB } from "@/lib/utils";
import { logActivity } from "@/lib/activity-log";
import type { AttendanceStatus } from "@/lib/attendance-display";

export interface ManualAttendanceInput {
  id_pengguna: number;
  status: AttendanceStatus;
  jam_masuk: string | null;
  jam_pulang: string | null;
  telat_menit: number;
  catatan_manual: string | null;
}

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;
const VALID_STATUSES = new Set<AttendanceStatus>(["HADIR", "TELAT", "TIDAK_HADIR"]);

export async function saveManualAttendance(rows: ManualAttendanceInput[]) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Sesi login tidak ditemukan" };

  const { data: actor } = await supabase
    .from("pengguna")
    .select("id, level, aktif")
    .eq("username", user.email?.split("@")[0])
    .maybeSingle();

  if (!actor?.aktif || !isOwnerLike(actor.level)) {
    return { error: "Hanya owner yang dapat mencatat absensi manual" };
  }
  if (!Array.isArray(rows) || rows.length === 0) {
    return { error: "Tidak ada perubahan absensi untuk disimpan" };
  }
  if (rows.length > 500) return { error: "Jumlah perubahan absensi terlalu banyak" };

  const seen = new Set<number>();
  const normalized: ManualAttendanceInput[] = [];

  for (const row of rows) {
    if (!Number.isInteger(row.id_pengguna) || row.id_pengguna <= 0 || seen.has(row.id_pengguna)) {
      return { error: "Data pegawai tidak valid atau dikirim lebih dari sekali" };
    }
    seen.add(row.id_pengguna);

    if (!VALID_STATUSES.has(row.status)) return { error: "Status absensi tidak valid" };

    const note = String(row.catatan_manual ?? "").trim().slice(0, 500) || null;
    if (row.status === "TIDAK_HADIR") {
      normalized.push({ ...row, jam_masuk: null, jam_pulang: null, telat_menit: 0, catatan_manual: note });
      continue;
    }

    if (!row.jam_masuk || !TIME_PATTERN.test(row.jam_masuk)) {
      return { error: "Jam masuk wajib diisi dengan format yang valid" };
    }
    if (row.jam_pulang && !TIME_PATTERN.test(row.jam_pulang)) {
      return { error: "Jam pulang tidak valid" };
    }
    if (row.jam_pulang && row.jam_pulang < row.jam_masuk) {
      return { error: "Jam pulang tidak boleh lebih awal dari jam masuk" };
    }
    if (row.status === "TELAT" && (!Number.isInteger(row.telat_menit) || row.telat_menit < 1)) {
      return { error: "Menit terlambat minimal 1 menit" };
    }

    normalized.push({
      ...row,
      jam_pulang: row.jam_pulang || null,
      telat_menit: row.status === "TELAT" ? row.telat_menit : 0,
      catatan_manual: note,
    });
  }

  const today = getTodayWIB();
  const employeeIds = normalized.map((row) => row.id_pengguna);
  const { data: oldRows } = await supabaseAdmin
    .from("absensi")
    .select("id_pengguna, status, jam_masuk, jam_pulang, telat_menit, sumber, catatan_manual")
    .eq("tanggal", today)
    .in("id_pengguna", employeeIds);

  const payload = normalized.map((row) => ({ ...row, sumber: "MANUAL" }));
  const { data, error } = await supabaseAdmin.rpc("save_manual_attendance", {
    p_actor_id: actor.id,
    p_rows: payload,
  });

  if (error) {
    console.error("Failed to save manual attendance:", error);
    const message = error.message.replace(/^.*?:\s*/, "");
    if (message.includes("Absensi QR tidak dapat diubah")) {
      return { error: "Absensi QR tidak dapat diubah dari halaman absen manual" };
    }
    if (message.includes("Pegawai tidak memiliki jadwal kerja terbit hari ini")) {
      return { error: "Pegawai tidak memiliki jadwal kerja terbit hari ini. Muat ulang halaman." };
    }
    return { error: "Gagal menyimpan absensi manual" };
  }

  const result = data as { success?: boolean; count?: number } | null;
  if (!result?.success) return { error: "Gagal menyimpan absensi manual" };

  await logActivity(supabase, {
    aksi: oldRows?.length ? "UPDATE" : "CREATE",
    entitas: "absensi",
    deskripsi: `Mencatat ${result.count ?? normalized.length} absensi manual tanggal ${today}`,
    data_lama: { tanggal: today, records: oldRows ?? [] },
    data_baru: { tanggal: today, records: normalized },
  });

  revalidatePath("/dashboard/attendance/manual");
  revalidatePath("/dashboard/attendance/report");
  revalidatePath("/dashboard/attendance/history");
  revalidatePath("/dashboard");

  return {
    success: true,
    count: result.count ?? normalized.length,
    message: `${result.count ?? normalized.length} absensi berhasil disimpan`,
  };
}
