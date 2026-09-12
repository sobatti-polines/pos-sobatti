import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { canBookLeaveForRole, CONTRACT_ROLE, isOwnerLike } from "@/lib/roles";

export const dynamic = "force-dynamic";

function addDays(date: string, days: number) {
  const d = new Date(`${date}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function startOfWeekMonday(input?: string) {
  const base = input && /^\d{4}-\d{2}-\d{2}$/.test(input) ? input : undefined;
  const d = new Date(`${base ?? "2000-01-01"}T00:00:00.000Z`);
  const day = d.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diff);
  return d.toISOString().slice(0, 10);
}

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: pengguna } = await supabase
      .from("pengguna")
      .select("id, username, nama, level")
      .eq("username", user.email?.split("@")[0])
      .maybeSingle();

    if (!pengguna) {
      return NextResponse.json({ error: "Profil tidak ditemukan" }, { status: 404 });
    }

    if (isOwnerLike(pengguna.level)) {
      return NextResponse.json({ error: "Owner tidak memiliki jadwal pribadi" }, { status: 403 });
    }

    const url = new URL(request.url);
    const weekParam = url.searchParams.get("week");
    const weekStart = startOfWeekMonday(weekParam ?? undefined);
    const weekEnd = addDays(weekStart, 6);
    const nextWeekStart = addDays(weekStart, 7);
    const nextWeekEnd = addDays(nextWeekStart, 6);

    const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Jakarta" });
    const isCurrentWeek = weekStart === startOfWeekMonday(today);

    // Fetch schedule for requested week
    const { data: scheduleData, error: scheduleError } = await supabase
      .from("jadwal_karyawan")
      .select(
        `
        id,
        tanggal,
        tipe_jadwal,
        shift_kerja(kode, nama, jam_mulai, jam_selesai),
        jadwal_mingguan!inner(status, catatan_seragam)
      `
      )
      .eq("id_pengguna", pengguna.id)
      .gte("tanggal", weekStart)
      .lte("tanggal", weekEnd)
      .eq("jadwal_mingguan.status", "TERBIT")
      .order("tanggal", { ascending: true });

    if (scheduleError) {
      console.error("Failed to fetch schedule:", scheduleError);
    }

    // Fetch booking libur data only for current week
    let draftSchedule = null;
    let leaveRequests: unknown[] = [];
    let ownLatestRequest = null;
    const canBookLeave = canBookLeaveForRole(pengguna.level);

    if (isCurrentWeek && canBookLeave) {
      const { data: draft } = await supabase
        .from("jadwal_mingguan")
        .select("id, minggu_mulai, status, jadwal_karyawan(id_pengguna, pengguna(level))")
        .eq("minggu_mulai", nextWeekStart)
        .eq("status", "DRAFT")
        .maybeSingle();

      draftSchedule = draft;

      if (draftSchedule) {
        const [{ data: activeRequests }, { data: latestRequest }] = await Promise.all([
          supabase
            .from("permintaan_libur")
            .select(
              "id, id_pengguna, tanggal, status, pengguna:pengguna!permintaan_libur_id_pengguna_fkey!inner(id, username, nama, level)"
            )
            .eq("id_jadwal_mingguan", draftSchedule.id)
            .in("status", ["MENUNGGU", "DISETUJUI"])
            .neq("pengguna.level", CONTRACT_ROLE)
            .order("created_at", { ascending: true }),
          supabase
            .from("permintaan_libur")
            .select(
              "id, id_pengguna, tanggal, status, pengguna:pengguna!permintaan_libur_id_pengguna_fkey(id, username, nama)"
            )
            .eq("id_jadwal_mingguan", draftSchedule.id)
            .eq("id_pengguna", pengguna.id)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle(),
        ]);
        leaveRequests = (activeRequests ?? []) as unknown[];
        ownLatestRequest = latestRequest;
      }
    }

    // Normalize schedule data
    const scheduleRows = (scheduleData ?? []).map((row: Record<string, unknown>) => ({
      ...row,
      shift_kerja: Array.isArray(row.shift_kerja)
        ? (row.shift_kerja as unknown[])[0] ?? null
        : row.shift_kerja,
      jadwal_mingguan: Array.isArray(row.jadwal_mingguan)
        ? (row.jadwal_mingguan as unknown[])[0] ?? null
        : row.jadwal_mingguan,
    }));

    const scheduleStatus =
      (scheduleRows[0] as Record<string, unknown> & { jadwal_mingguan?: { status?: string } })
        ?.jadwal_mingguan?.status ?? "BELUM_ADA";
    const catatanSeragam =
      (scheduleRows[0] as Record<string, unknown> & { jadwal_mingguan?: { catatan_seragam?: Record<string, string> | null } })
        ?.jadwal_mingguan?.catatan_seragam ?? null;

    const participantRows = (draftSchedule?.jadwal_karyawan ?? []) as Array<{
      id_pengguna: number;
      pengguna: { level?: string } | Array<{ level?: string }> | null;
    }>;
    const participantIds = [...new Set(participantRows.map((row) => Number(row.id_pengguna)))];
    const leaveQuotaParticipantIds = new Set(
      participantRows
        .filter((row) => {
          const participant = Array.isArray(row.pengguna) ? row.pengguna[0] : row.pengguna;
          return participant?.level !== CONTRACT_ROLE;
        })
        .map((row) => Number(row.id_pengguna))
    );
    const leaveCapacity = Math.max(1, Math.ceil(leaveQuotaParticipantIds.size / 7));

    const res = NextResponse.json({
      weekStart,
      weekEnd,
      scheduleRows,
      scheduleStatus,
      catatanSeragam,
      today,
      isCurrentWeek,
      nextWeekStart,
      nextWeekEnd,
      scheduleId: draftSchedule?.id ?? null,
      employeeId: Number(pengguna.id),
      eligible: participantIds.includes(Number(pengguna.id)),
      leaveCapacity,
      leaveRequests,
      ownLatestRequest,
      canBookLeave,
      bookingOpen: Boolean(draftSchedule) && today < nextWeekStart,
    });
    res.headers.set("Cache-Control", "no-store");
    return res;
  } catch (err) {
    console.error("Jadwal Saya API error:", err);
    return NextResponse.json({ error: "Gagal mengambil data jadwal" }, { status: 500 });
  }
}
