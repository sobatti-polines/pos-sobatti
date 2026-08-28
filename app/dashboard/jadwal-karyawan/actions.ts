"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { buildDeskripsi, logActivity } from "@/lib/activity-log";
import { isOwnerLike } from "@/lib/roles";

export type ScheduleType = "PAGI" | "SORE" | "LIBUR";
export type WeeklyScheduleStatus = "DRAFT" | "TERBIT";

export interface ScheduleRowInput {
  tanggal: string;
  id_pengguna: number;
  tipe_jadwal: ScheduleType;
  catatan?: string | null;
}

export interface SaveWeeklyScheduleInput {
  minggu_mulai: string;
  kebutuhan_pagi: number;
  kebutuhan_sore: number;
  jam_pagi_mulai: string;
  jam_pagi_selesai: string;
  jam_sore_mulai: string;
  jam_sore_selesai: string;
  rows: ScheduleRowInput[];
  publish?: boolean;
}

async function requireOwner() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { supabase, pengguna: null, error: "Unauthorized" };

  const { data: pengguna } = await supabase
    .from("pengguna")
    .select("id, level")
    .eq("username", user.email?.split("@")[0])
    .maybeSingle();

  if (!isOwnerLike(pengguna?.level)) {
    return { supabase, pengguna: null, error: "Hanya OWNER yang dapat mengatur jadwal" };
  }

  return { supabase, pengguna, error: null };
}

function toInt(value: unknown, fallback = 0) {
  const n = Number(value);
  return Number.isInteger(n) && n >= 0 ? n : fallback;
}

function isDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function isTime(value: string) {
  return /^\d{2}:\d{2}$/.test(value);
}

function addDays(date: string, days: number) {
  const d = new Date(`${date}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function cleanText(value: unknown) {
  const text = String(value ?? "").trim();
  return text || null;
}

function validateRowsForPublish(rows: ScheduleRowInput[], employeeIds: number[], weekDates: string[]) {
  const byEmployee = new Map<number, ScheduleRowInput[]>();
  for (const id of employeeIds) byEmployee.set(id, []);

  for (const row of rows) {
    if (!byEmployee.has(row.id_pengguna)) continue;
    if (!weekDates.includes(row.tanggal)) continue;
    byEmployee.get(row.id_pengguna)?.push(row);
  }

  for (const id of employeeIds) {
    const employeeRows = byEmployee.get(id) ?? [];
    const uniqueDates = new Set(employeeRows.map((row) => row.tanggal));
    if (uniqueDates.size !== 7) {
      return "Setiap pegawai wajib memiliki jadwal lengkap Senin sampai Minggu sebelum diterbitkan";
    }

    const liburCount = employeeRows.filter((row) => row.tipe_jadwal === "LIBUR").length;
    if (liburCount !== 1) {
      return "Setiap pegawai wajib memiliki tepat 1 hari libur dalam 1 minggu";
    }
  }

  return null;
}

export async function saveWeeklySchedule(input: SaveWeeklyScheduleInput) {
  const { supabase, pengguna, error: authError } = await requireOwner();
  if (authError || !pengguna) return { error: authError ?? "Unauthorized" };

  if (!isDate(input.minggu_mulai)) return { error: "Minggu mulai tidak valid" };
  if (!isTime(input.jam_pagi_mulai) || !isTime(input.jam_pagi_selesai)) {
    return { error: "Jam shift pagi tidak valid" };
  }
  if (!isTime(input.jam_sore_mulai) || !isTime(input.jam_sore_selesai)) {
    return { error: "Jam shift sore tidak valid" };
  }

  const kebutuhanPagi = toInt(input.kebutuhan_pagi, 1);
  const kebutuhanSore = toInt(input.kebutuhan_sore, 1);
  const weekDates = Array.from({ length: 7 }, (_, index) => addDays(input.minggu_mulai, index));

  const { data: employees, error: employeeError } = await supabase
    .from("pengguna")
    .select("id")
    .eq("aktif", true)
    .in("level", ["ADMIN", "KASIR", "KARYAWAN"]);

  if (employeeError) {
    console.error("Failed to fetch employees for schedule:", employeeError);
    return { error: "Gagal membaca data pegawai" };
  }

  const employeeIds = (employees ?? []).map((employee) => Number(employee.id));
  if (employeeIds.length === 0) return { error: "Belum ada pegawai aktif untuk dijadwalkan" };

  const normalizedRows = (input.rows ?? [])
    .filter((row) => employeeIds.includes(Number(row.id_pengguna)))
    .filter((row) => weekDates.includes(row.tanggal))
    .map((row) => ({
      tanggal: row.tanggal,
      id_pengguna: Number(row.id_pengguna),
      tipe_jadwal: (["PAGI", "SORE", "LIBUR"].includes(row.tipe_jadwal)
        ? row.tipe_jadwal
        : "PAGI") as ScheduleType,
      catatan: cleanText(row.catatan),
    }));

  if (input.publish) {
    const validationError = validateRowsForPublish(normalizedRows, employeeIds, weekDates);
    if (validationError) return { error: validationError };
  }

  const { data: existing } = await supabase
    .from("jadwal_mingguan")
    .select("*")
    .eq("minggu_mulai", input.minggu_mulai)
    .maybeSingle();

  if (existing?.status === "TERBIT") {
    return { error: "Jadwal yang sudah terbit tidak bisa diedit" };
  }

  const { error: shiftPagiError } = await supabase
    .from("shift_kerja")
    .update({
      jam_mulai: input.jam_pagi_mulai,
      jam_selesai: input.jam_pagi_selesai,
      aktif: true,
      urutan: 1,
    })
    .eq("kode", "PAGI");

  if (shiftPagiError) {
    console.error("Failed to update shift pagi:", shiftPagiError);
    return { error: "Gagal menyimpan jam shift pagi" };
  }

  const { error: shiftSoreError } = await supabase
    .from("shift_kerja")
    .update({
      jam_mulai: input.jam_sore_mulai,
      jam_selesai: input.jam_sore_selesai,
      aktif: true,
      urutan: 2,
    })
    .eq("kode", "SORE");

  if (shiftSoreError) {
    console.error("Failed to update shift sore:", shiftSoreError);
    return { error: "Gagal menyimpan jam shift sore" };
  }

  const { data: shifts, error: shiftError } = await supabase
    .from("shift_kerja")
    .select("id, kode")
    .in("kode", ["PAGI", "SORE"]);

  if (shiftError) {
    console.error("Failed to fetch shifts:", shiftError);
    return { error: "Gagal membaca data shift" };
  }

  const shiftByCode = new Map((shifts ?? []).map((shift) => [shift.kode, Number(shift.id)]));
  const pagiId = shiftByCode.get("PAGI");
  const soreId = shiftByCode.get("SORE");
  if (!pagiId || !soreId) return { error: "Data shift pagi/sore belum lengkap" };

  const headerPayload = {
    minggu_mulai: input.minggu_mulai,
    kebutuhan_pagi: kebutuhanPagi,
    kebutuhan_sore: kebutuhanSore,
    status: input.publish ? "TERBIT" : "DRAFT",
    created_by: existing?.created_by ?? pengguna.id,
    updated_by: pengguna.id,
  };

  const { data: header, error: headerError } = await supabase
    .from("jadwal_mingguan")
    .upsert(headerPayload, { onConflict: "minggu_mulai" })
    .select("id")
    .single();

  if (headerError || !header) {
    console.error("Failed to save weekly schedule header:", headerError);
    return { error: "Gagal menyimpan header jadwal" };
  }

  const { error: deleteError } = await supabase
    .from("jadwal_karyawan")
    .delete()
    .eq("id_jadwal_mingguan", header.id);

  if (deleteError) {
    console.error("Failed to reset weekly schedule detail:", deleteError);
    return { error: "Gagal memperbarui detail jadwal" };
  }

  if (normalizedRows.length > 0) {
    const details = normalizedRows.map((row) => ({
      id_jadwal_mingguan: header.id,
      tanggal: row.tanggal,
      id_pengguna: row.id_pengguna,
      tipe_jadwal: row.tipe_jadwal,
      id_shift:
        row.tipe_jadwal === "PAGI" ? pagiId : row.tipe_jadwal === "SORE" ? soreId : null,
      catatan: row.catatan,
    }));

    const { error: insertError } = await supabase.from("jadwal_karyawan").insert(details);
    if (insertError) {
      console.error("Failed to insert weekly schedule details:", insertError);
      return { error: "Gagal menyimpan detail jadwal" };
    }
  }

  await logActivity(supabase, {
    aksi: existing ? "UPDATE" : "CREATE",
    entitas: "jadwal_mingguan",
    id_entitas: Number(header.id),
    deskripsi: buildDeskripsi({
      aksi: existing ? "UPDATE" : "CREATE",
      entitas: "jadwal_mingguan",
      id_entitas: Number(header.id),
      data_lama: existing as Record<string, unknown> | null,
      data_baru: headerPayload as Record<string, unknown>,
    }),
    data_lama: existing as Record<string, unknown> | null,
    data_baru: headerPayload as Record<string, unknown>,
  });

  revalidatePath("/dashboard/jadwal-karyawan");
  revalidatePath("/dashboard/jadwal-saya");
  return { success: true };
}
