import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { isAttendanceExemptRole } from "@/lib/roles";

interface AttendanceRpcResult {
  success: boolean;
  error?: string;
  code?: string;
  message?: string;
}

function errorStatus(code?: string) {
  return code === "MANUAL_ATTENDANCE_LOCKED" || code === "ALREADY_CHECKED_OUT"
    ? 409
    : 400;
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const body = await request.json().catch(() => ({}));
    const token = typeof body.token === "string" ? body.token.trim() : "";

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

    const { data, error } = await supabaseAdmin.rpc("process_attendance_checkout", {
      p_token: token,
      p_id_pengguna: pengguna.id,
    });

    if (error) {
      console.error("Check-out RPC error:", error);
      return NextResponse.json({ error: "Gagal mencatat check-out" }, { status: 500 });
    }

    const result = data as AttendanceRpcResult;
    if (!result?.success) {
      return NextResponse.json(
        { error: result?.error || "Gagal mencatat check-out", code: result?.code },
        { status: errorStatus(result?.code) }
      );
    }

    return NextResponse.json(result);
  } catch (err: unknown) {
    console.error("Error in checkout:", err);
    return NextResponse.json({ error: "Terjadi kesalahan internal" }, { status: 500 });
  }
}
