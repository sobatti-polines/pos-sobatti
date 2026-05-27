import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Haversine formula to calculate distance between two points in meters
function getDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371e3; // metres
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  const d = R * c;
  return d;
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();

    const { token, latitude, longitude, device_info } = await request.json();

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

    if (new Date(qrSession.expired_at) < new Date()) {
      return NextResponse.json({ error: "QR token expired" }, { status: 400 });
    }

    // 3. Validate GPS
    const storeLat = parseFloat(process.env.STORE_LATITUDE || "0");
    const storeLong = parseFloat(process.env.STORE_LONGITUDE || "0");
    const maxRadius = parseFloat(process.env.MAX_ATTENDANCE_RADIUS || "50");

    const distance = getDistance(latitude, longitude, storeLat, storeLong);
    if (distance > maxRadius) {
      return NextResponse.json(
        { error: `Too far from store: ${Math.round(distance)}m (max ${maxRadius}m)` },
        { status: 400 }
      );
    }

    // 4. Check for duplicate (already checked in today)
    const today = new Date().toISOString().split("T")[0];
    const { data: existingAttendance } = await supabase
      .from("absensi")
      .select("id")
      .eq("id_pengguna", pengguna.id)
      .eq("tanggal", today)
      .maybeSingle();

    if (existingAttendance) {
      return NextResponse.json({ error: "Already checked in today" }, { status: 400 });
    }

    // 5. Calculate Lateness
    const now = new Date();
    const jam_masuk = now.toISOString();
    
    // Office start at 09:00, tolerance 15 mins = 09:15
    const officeStart = new Date();
    officeStart.setHours(9, 0, 0, 0);
    const toleranceLimit = new Date();
    toleranceLimit.setHours(9, 15, 0, 0);

    let status = "HADIR";
    let telat_menit = 0;

    if (now > toleranceLimit) {
      status = "TELAT";
      telat_menit = Math.floor((now.getTime() - officeStart.getTime()) / (1000 * 60));
    }

    // 6. Record Attendance
    const { error: insertError } = await supabase.from("absensi").insert({
      id_pengguna: pengguna.id,
      tanggal: today,
      jam_masuk,
      status,
      telat_menit,
      latitude,
      longitude,
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
  } catch (err: any) {
    console.error("Error in checkin:", err);
    return NextResponse.json({ error: err.message || "Internal Server Error" }, { status: 500 });
  }
}
