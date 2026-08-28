import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isAttendanceExemptRole } from "@/lib/roles";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();

    // Token might be required for checkout too according to spec "User scans QR" in checkout flow
    const body = await request.json().catch(() => ({}));
    const token = body.token;

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Tidak terautentikasi" }, { status: 401 });
    }

    // 1. Get current user details
    const { data: pengguna } = await supabase
      .from("pengguna")
      .select("id, level")
      .eq("username", user.email?.split("@")[0])
      .single();

    if (!pengguna) {
      return NextResponse.json(
        { error: "Profil pengguna tidak ditemukan" },
        { status: 404 }
      );
    }

    if (isAttendanceExemptRole(pengguna.level)) {
      return NextResponse.json(
        { error: "Owner tidak dapat melakukan absensi" },
        { status: 403 }
      );
    }

    // 2. Validate QR Token (spec says user scans QR for checkout too)
    const { data: qrSession } = await supabase
      .from("qr_session")
      .select("*")
      .eq("token", token)
      .eq("is_active", true)
      .single();

    if (!qrSession) {
      return NextResponse.json(
        { error: "Kode QR tidak valid atau sudah digunakan", code: "INVALID_TOKEN" },
        { status: 400 }
      );
    }

    // Ensure expired_at is interpreted as UTC even if the column is `timestamp without time zone`
    const expiredAtStr =
      typeof qrSession.expired_at === "string"
        ? qrSession.expired_at.endsWith("Z")
          ? qrSession.expired_at
          : qrSession.expired_at + "Z"
        : null;
    if (!expiredAtStr || new Date(expiredAtStr) < new Date()) {
      return NextResponse.json(
        { error: "Kode QR sudah kedaluwarsa", code: "TOKEN_EXPIRED" },
        { status: 400 }
      );
    }

    // 3. Verify check-in exists for today (use WIB / UTC+7 for Indonesian business day)
    const nowUtc = new Date();
    const wibOffset = 7 * 60 * 60 * 1000;
    const nowWIB = new Date(nowUtc.getTime() + wibOffset);
    const today = nowWIB.toISOString().split("T")[0];
    const { data: attendance } = await supabase
      .from("absensi")
      .select("*")
      .eq("id_pengguna", pengguna.id)
      .eq("tanggal", today)
      .maybeSingle();

    if (!attendance) {
      return NextResponse.json(
        { error: "Anda belum melakukan check-in hari ini", code: "NOT_CHECKED_IN" },
        { status: 400 }
      );
    }

    if (attendance.jam_pulang) {
      return NextResponse.json(
        { error: "Anda sudah melakukan check-out hari ini", code: "ALREADY_CHECKED_OUT" },
        { status: 400 }
      );
    }

    // 4. Record Checkout
    const { error: updateError } = await supabase
      .from("absensi")
      .update({
        jam_pulang: nowWIB.toISOString().slice(0, 19),
      })
      .eq("id", attendance.id);

    if (updateError) {
      console.error("Check-out update error:", updateError);
      return NextResponse.json({ error: "Gagal mencatat check-out" }, { status: 500 });
    }

    // Mark QR token as used to prevent replay
    await supabase
      .from("qr_session")
      .update({ is_active: false })
      .eq("token", token);

    return NextResponse.json({
      success: true,
      message: "Check-out berhasil",
    });
  } catch (err: unknown) {
    console.error("Error in checkout:", err);
    const message = err instanceof Error ? err.message : "Terjadi kesalahan internal";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
