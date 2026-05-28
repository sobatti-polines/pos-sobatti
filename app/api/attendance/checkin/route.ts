import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();

    const { token, device_info } = await request.json();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 1. Get current user details
    const { data: pengguna } = await supabase
      .from("pengguna")
      .select("id, level")
      .eq("username", user.email?.split("@")[0])
      .single();

    if (!pengguna) {
      return NextResponse.json({ error: "User profile not found" }, { status: 404 });
    }

    if (pengguna.level === "OWNER") {
      return NextResponse.json({ error: "Owner cannot perform attendance" }, { status: 403 });
    }

    // 2. Validate QR Token
    const { data: qrSession } = await supabase
      .from("qr_session")
      .select("*")
      .eq("token", token)
      .eq("is_active", true)
      .single();

    if (!qrSession) {
      return NextResponse.json({ error: "Invalid or inactive QR token" }, { status: 400 });
    }

    // Ensure expired_at is interpreted as UTC even if the column is `timestamp without time zone`
    const expiredAtStr = qrSession.expired_at.endsWith("Z")
      ? qrSession.expired_at
      : qrSession.expired_at + "Z";
    if (new Date(expiredAtStr) < new Date()) {
      return NextResponse.json({ error: "QR token expired" }, { status: 400 });
    }

    // 3. Check for duplicate (already checked in today)
    // Use WIB (UTC+7) for the "today" date so it matches Indonesian business day
    const nowUtc = new Date();
    const wibOffset = 7 * 60 * 60 * 1000; // UTC+7 in ms
    const nowWIB = new Date(nowUtc.getTime() + wibOffset);
    const today = nowWIB.toISOString().split("T")[0];
    const { data: existingAttendance } = await supabase
      .from("absensi")
      .select("id")
      .eq("id_pengguna", pengguna.id)
      .eq("tanggal", today)
      .maybeSingle();

    if (existingAttendance) {
      return NextResponse.json({ error: "Already checked in today" }, { status: 400 });
    }

    // 4. Calculate Lateness using WIB hours
    // Store as ISO but ensure it represents the correct point in time
    const jam_masuk = nowUtc.toISOString();
    
    // Get current hour/minute in WIB (UTC+7) for lateness check
    const wibHours = nowWIB.getUTCHours();
    const wibMinutes = nowWIB.getUTCMinutes();
    const wibTotalMinutes = wibHours * 60 + wibMinutes;
    
    // Read office start time and tolerance from environment variables, with defaults
    const envStartTime = process.env.ATTENDANCE_START_TIME || "09:00";
    const envToleranceStr = process.env.ATTENDANCE_TOLERANCE_MINUTES || "15";
    
    // Parse start time (e.g., "09:00")
    const [startHourStr, startMinStr] = envStartTime.split(":");
    const startHour = parseInt(startHourStr, 10) || 9;
    const startMinute = parseInt(startMinStr, 10) || 0;
    const toleranceMinutes = parseInt(envToleranceStr, 10) || 15;

    const officeStartMinutes = startHour * 60 + startMinute;
    const toleranceLimitMinutes = officeStartMinutes + toleranceMinutes;

    let status = "HADIR";
    let telat_menit = 0;

    if (wibTotalMinutes > toleranceLimitMinutes) {
      status = "TELAT";
      telat_menit = wibTotalMinutes - officeStartMinutes;
    }

    // 5. Record Attendance
    const { error: insertError } = await supabase.from("absensi").insert({
      id_pengguna: pengguna.id,
      tanggal: today,
      jam_masuk,
      status,
      telat_menit,
      device_info,
    });

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: "Check-in successful",
      status,
      telat_menit,
    });
  } catch (err: unknown) {
    console.error("Error in checkin:", err);
    const message = err instanceof Error ? err.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
