"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { buildDeskripsi, logActivity } from "@/lib/activity-log";
import { isOperationalEmployeeRole, isOwnerLike } from "@/lib/roles";

export type ScheduleType = "PAGI" | "SORE" | "LIBUR";
export type WeeklyScheduleStatus = "DRAFT" | "TERBIT";
export type LeaveRequestStatus = "MENUNGGU" | "DISETUJUI" | "DITOLAK" | "DIBATALKAN";
export type LeaveReviewDecision = "SETUJUI" | "TOLAK" | "BATALKAN_PERSETUJUAN";

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
  /** Catatan seragam per hari. Key = tanggal (YYYY-MM-DD), Value = jenis seragam */
  catatan_seragam?: Record<string, string> | null;
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

async function requireEmployee() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { supabase, pengguna: null, error: "Sesi login tidak ditemukan" };

  const { data: pengguna } = await supabase
    .from("pengguna")
    .select("id, level, aktif")
    .eq("username", user.email?.split("@")[0])
    .maybeSingle();

  if (!pengguna?.aktif || !isOperationalEmployeeRole(pengguna.level)) {
    return { supabase, pengguna: null, error: "Hanya pegawai aktif yang dapat booking libur" };
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

function normalizeUniformNotes(
  value: Record<string, string> | null | undefined,
  weekDates: string[]
) {
  if (!value) return null;

  const notes = Object.fromEntries(
    weekDates
      .map((date) => [date, String(value[date] ?? "").trim()] as const)
      .filter(([, note]) => note)
  );

  return Object.keys(notes).length > 0 ? notes : null;
}

function validateRowsForPublish(
  rows: ScheduleRowInput[],
  employeeIds: number[],
  weekDates: string[],
  capacity: number
) {
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

    // Libur opsional — boleh 0 hari (full masuk) sampai 6 hari
  }

  for (const date of weekDates) {
    const liburCount = rows.filter(
      (row) => row.tanggal === date && row.tipe_jadwal === "LIBUR"
    ).length;
    if (liburCount > capacity) {
      return `Jumlah pegawai libur pada ${date} melebihi batas ${capacity} orang`;
    }
  }

  return null;
}

function scheduleRowsByEmployee(rows: ScheduleRowInput[]) {
  const result = new Map<number, Map<string, ScheduleType>>();
  for (const row of rows) {
    if (!result.has(row.id_pengguna)) result.set(row.id_pengguna, new Map());
    result.get(row.id_pengguna)?.set(row.tanggal, row.tipe_jadwal);
  }
  return result;
}

function validateCompleteRows(
  rows: ScheduleRowInput[],
  employeeIds: number[],
  weekDates: string[]
) {
  if (rows.length !== employeeIds.length * weekDates.length) {
    return "Jadwal harus lengkap selama 7 hari untuk seluruh pegawai";
  }

  const rowMap = scheduleRowsByEmployee(rows);
  if (employeeIds.some((id) => rowMap.get(id)?.size !== weekDates.length)) {
    return "Setiap pegawai harus memiliki tepat satu jadwal per hari";
  }

  return null;
}

function databaseMessage(error: { message?: string } | null, fallback: string) {
  return error?.message?.replace(/^.*?:\s*/, "") || fallback;
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

  const finalSeragam = normalizeUniformNotes(input.catatan_seragam, weekDates);

  const { data: existing } = await supabase
    .from("jadwal_mingguan")
    .select("*")
    .eq("minggu_mulai", input.minggu_mulai)
    .maybeSingle();

  if (existing?.status === "TERBIT") {
    return { error: "Jadwal yang sudah terbit tidak bisa diedit" };
  }

  const employeeQuery = existing
    ? supabase
        .from("jadwal_karyawan")
        .select("id_pengguna")
        .eq("id_jadwal_mingguan", existing.id)
    : supabase
        .from("pengguna")
        .select("id")
        .eq("aktif", true)
        .in("level", ["ADMIN", "KASIR", "KARYAWAN"]);
  const { data: employees, error: employeeError } = await employeeQuery;

  if (employeeError) {
    console.error("Failed to fetch employees for schedule:", employeeError);
    return { error: "Gagal membaca data pegawai" };
  }

  const employeeIds = [...new Set(
    (employees ?? []).map((employee) => Number("id_pengguna" in employee ? employee.id_pengguna : employee.id))
  )];
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

  const completeRowsError = validateCompleteRows(normalizedRows, employeeIds, weekDates);
  if (completeRowsError) return { error: completeRowsError };

  const capacity = Math.max(1, Math.ceil(employeeIds.length / 7));
  const { data: leaveRequests, error: leaveRequestError } = existing
    ? await supabase
        .from("permintaan_libur")
        .select("id, id_pengguna, tanggal, status")
        .eq("id_jadwal_mingguan", existing.id)
        .in("status", ["MENUNGGU", "DISETUJUI"])
    : { data: [], error: null };

  if (leaveRequestError) {
    console.error("Failed to fetch leave requests:", leaveRequestError);
    return { error: "Gagal memeriksa permintaan libur" };
  }

  const rowMap = scheduleRowsByEmployee(normalizedRows);
  for (const request of leaveRequests ?? []) {
    if ((rowMap.get(Number(request.id_pengguna))?.size ?? 0) !== 7) {
      return { error: "Jadwal pegawai yang memiliki permintaan libur harus tetap lengkap" };
    }
    if (
      request.status === "DISETUJUI" &&
      rowMap.get(Number(request.id_pengguna))?.get(request.tanggal) !== "LIBUR"
    ) {
      return { error: "Hari libur yang sudah disetujui tidak boleh diubah dari grid" };
    }
  }

  if (input.publish) {
    if ((leaveRequests ?? []).some((request) => request.status === "MENUNGGU")) {
      return { error: "Selesaikan semua permintaan libur yang masih menunggu sebelum menerbitkan jadwal" };
    }
    const validationError = validateRowsForPublish(
      normalizedRows,
      employeeIds,
      weekDates,
      capacity
    );
    if (validationError) return { error: validationError };
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
    catatan_seragam: finalSeragam,
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

  const details = normalizedRows.map((row) => ({
    id_jadwal_mingguan: header.id,
    tanggal: row.tanggal,
    id_pengguna: row.id_pengguna,
    tipe_jadwal: row.tipe_jadwal,
    id_shift:
      row.tipe_jadwal === "PAGI" ? pagiId : row.tipe_jadwal === "SORE" ? soreId : null,
    catatan: row.catatan,
  }));

  const { error: detailError } = await supabase
    .from("jadwal_karyawan")
    .upsert(details, { onConflict: "id_jadwal_mingguan,id_pengguna,tanggal" });
  if (detailError) {
    console.error("Failed to save weekly schedule details:", detailError);
    return { error: "Gagal menyimpan detail jadwal" };
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

export async function saveUniformNotes(
  mingguMulai: string,
  catatanSeragam: Record<string, string> | null
) {
  const { supabase, pengguna, error: authError } = await requireOwner();
  if (authError || !pengguna) return { error: authError ?? "Unauthorized" };
  if (!isDate(mingguMulai)) return { error: "Minggu mulai tidak valid" };

  const weekDates = Array.from({ length: 7 }, (_, index) => addDays(mingguMulai, index));
  const notes = normalizeUniformNotes(catatanSeragam, weekDates);
  const { data: existing, error: fetchError } = await supabase
    .from("jadwal_mingguan")
    .select("id, catatan_seragam")
    .eq("minggu_mulai", mingguMulai)
    .maybeSingle();

  if (fetchError) {
    console.error("Failed to fetch weekly schedule for uniform notes:", fetchError);
    return { error: "Gagal membaca jadwal mingguan" };
  }
  if (!existing) return { error: "Simpan draft jadwal terlebih dahulu" };

  const { error: updateError } = await supabase
    .from("jadwal_mingguan")
    .update({ catatan_seragam: notes, updated_by: pengguna.id })
    .eq("id", existing.id);

  if (updateError) {
    console.error("Failed to update uniform notes:", updateError);
    return { error: "Gagal menyimpan catatan seragam" };
  }

  await logActivity(supabase, {
    aksi: "UPDATE",
    entitas: "jadwal_mingguan",
    id_entitas: Number(existing.id),
    deskripsi: "Memperbarui catatan seragam jadwal mingguan",
    data_lama: { catatan_seragam: existing.catatan_seragam },
    data_baru: { catatan_seragam: notes },
  });

  revalidatePath("/dashboard/jadwal-karyawan");
  revalidatePath("/dashboard/jadwal-saya");
  return { success: true };
}

export async function saveLeaveRequest(idSchedule: number, date: string) {
  const { supabase, pengguna, error: authError } = await requireEmployee();
  if (authError || !pengguna) return { error: authError ?? "Sesi login tidak ditemukan" };
  if (!Number.isInteger(idSchedule) || idSchedule <= 0 || !isDate(date)) {
    return { error: "Pilihan hari libur tidak valid" };
  }

  const { data: existing } = await supabase
    .from("permintaan_libur")
    .select("id, tanggal, status")
    .eq("id_jadwal_mingguan", idSchedule)
    .eq("id_pengguna", pengguna.id)
    .in("status", ["MENUNGGU", "DISETUJUI"])
    .maybeSingle();

  if (existing?.status === "DISETUJUI") {
    return { error: "Permintaan yang sudah disetujui hanya dapat diubah oleh owner" };
  }

  const mutation = existing
    ? supabase
        .from("permintaan_libur")
        .update({ tanggal: date })
        .eq("id", existing.id)
        .eq("status", "MENUNGGU")
        .select("id")
        .single()
    : supabase
        .from("permintaan_libur")
        .insert({ id_jadwal_mingguan: idSchedule, id_pengguna: pengguna.id, tanggal: date })
        .select("id")
        .single();
  const { data, error } = await mutation;

  if (error || !data) {
    return { error: databaseMessage(error, "Gagal menyimpan permintaan libur") };
  }

  await logActivity(supabase, {
    aksi: existing ? "UPDATE" : "CREATE",
    entitas: "permintaan_libur",
    id_entitas: Number(data.id),
    deskripsi: existing
      ? `Memindahkan booking libur dari ${existing.tanggal} ke ${date}`
      : `Membuat booking libur untuk ${date}`,
    data_lama: existing ? { tanggal: existing.tanggal, status: existing.status } : null,
    data_baru: { tanggal: date, status: "MENUNGGU" },
  });

  revalidatePath("/dashboard/jadwal-saya");
  revalidatePath("/dashboard/jadwal-karyawan");
  return { success: true };
}

export async function cancelLeaveRequest(idRequest: number) {
  const { supabase, pengguna, error: authError } = await requireEmployee();
  if (authError || !pengguna) return { error: authError ?? "Sesi login tidak ditemukan" };
  if (!Number.isInteger(idRequest) || idRequest <= 0) return { error: "Permintaan tidak valid" };

  const { data, error } = await supabase
    .from("permintaan_libur")
    .update({ status: "DIBATALKAN" })
    .eq("id", idRequest)
    .eq("id_pengguna", pengguna.id)
    .eq("status", "MENUNGGU")
    .select("id, tanggal")
    .maybeSingle();

  if (error || !data) {
    return { error: databaseMessage(error, "Permintaan hanya dapat dibatalkan saat masih menunggu") };
  }

  await logActivity(supabase, {
    aksi: "UPDATE",
    entitas: "permintaan_libur",
    id_entitas: Number(data.id),
    deskripsi: `Membatalkan booking libur untuk ${data.tanggal}`,
    data_lama: { status: "MENUNGGU" },
    data_baru: { status: "DIBATALKAN" },
  });

  revalidatePath("/dashboard/jadwal-saya");
  revalidatePath("/dashboard/jadwal-karyawan");
  return { success: true };
}

export async function reviewLeaveRequest(idRequest: number, decision: LeaveReviewDecision) {
  const { supabase, error: authError } = await requireOwner();
  if (authError) return { error: authError };
  if (!Number.isInteger(idRequest) || idRequest <= 0) return { error: "Permintaan tidak valid" };

  const { data: request } = await supabase
    .from("permintaan_libur")
    .select("id, tanggal, status, id_pengguna")
    .eq("id", idRequest)
    .maybeSingle();

  if (!request) return { error: "Permintaan tidak ditemukan" };

  const expectedStatus = decision === "BATALKAN_PERSETUJUAN" ? "DISETUJUI" : "MENUNGGU";
  const nextStatus: LeaveRequestStatus = decision === "SETUJUI" ? "DISETUJUI" : "DITOLAK";
  if (request.status !== expectedStatus) {
    return { error: "Status permintaan sudah berubah. Muat ulang halaman lalu coba lagi." };
  }

  const { data, error } = await supabase
    .from("permintaan_libur")
    .update({ status: nextStatus })
    .eq("id", idRequest)
    .eq("status", expectedStatus)
    .select("id")
    .maybeSingle();

  if (error || !data) {
    return { error: databaseMessage(error, "Gagal memproses permintaan libur") };
  }

  const actionLabel =
    decision === "SETUJUI"
      ? "Menyetujui"
      : decision === "TOLAK"
        ? "Menolak"
        : "Membatalkan persetujuan";
  await logActivity(supabase, {
    aksi: "UPDATE",
    entitas: "permintaan_libur",
    id_entitas: idRequest,
    deskripsi: `${actionLabel} permintaan libur pegawai #${request.id_pengguna} untuk ${request.tanggal}`,
    data_lama: { status: request.status },
    data_baru: { status: nextStatus },
  });

  revalidatePath("/dashboard/jadwal-saya");
  revalidatePath("/dashboard/jadwal-karyawan");
  return { success: true };
}
