import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { isAttendanceExemptRole } from "@/lib/roles";

interface AttendanceRpcResult {
  success: boolean;
  error?: string;
  code?: string;
  message?: string;
  status?: string;
  telat_menit?: number;
}

function errorStatus(code?: string) {
  return code === "MANUAL_ATTENDANCE_LOCKED" || code === "ALREADY_CHECKED_IN"
    ? 409
    : 400;
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const body = await request.json().catch(() => ({}));
    const token = typeof body.token === "string" ? body.token.trim() : "";
    const deviceInfo = typeof body.device_info === "string"
      ? body.device_info.slice(0, 500)
      : null;

    if (!token) {
      return NextResponse.json(
        { error: "Kode QR wajib diisi", code: "INVALID_TOKEN" },
        { status: 400 }
      );
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Tidak terautentikasi" }, { status: 401 });
    }

    const { data: pengguna } = await supabase
      .from("pengguna")
      .select("id, level, aktif")
      .eq("username", user.email?.split("@")[0])
      .maybeSingle();

    if (!pengguna?.aktif) {
      return NextResponse.json(
        { error: "Profil pengguna tidak ditemukan atau tidak aktif" },
        { status: 404 }
      );
    }
    if (isAttendanceExemptRole(pengguna.level)) {
      return NextResponse.json({ error: "Owner tidak dapat melakukan absensi" }, { status: 403 });
    }

    const parsedTolerance = Number.parseInt(process.env.ATTENDANCE_TOLERANCE_MINUTES || "10", 10);
    const tolerance = Number.isFinite(parsedTolerance) ? Math.max(parsedTolerance, 0) : 10;
    const envStart = process.env.ATTENDANCE_START_TIME || "09:00";
    const fallbackStart = /^([01]\d|2[0-3]):[0-5]\d$/.test(envStart) ? envStart : "09:00";

    const { data, error } = await supabaseAdmin.rpc("process_attendance_checkin", {
      p_token: token,
      p_id_pengguna: pengguna.id,
      p_device_info: deviceInfo,
      p_tolerance_minutes: tolerance,
      p_fallback_start: fallbackStart,
    });

    if (error) {
      console.error("Check-in RPC error:", error);
      return NextResponse.json({ error: "Gagal mencatat check-in" }, { status: 500 });
    }

    const result = data as AttendanceRpcResult;
    if (!result?.success) {
      return NextResponse.json(
        { error: result?.error || "Gagal mencatat check-in", code: result?.code },
        { status: errorStatus(result?.code) }
      );
    }

    return NextResponse.json(result);
  } catch (err: unknown) {
    console.error("Error in checkin:", err);
    return NextResponse.json({ error: "Terjadi kesalahan internal" }, { status: 500 });
  }
}
