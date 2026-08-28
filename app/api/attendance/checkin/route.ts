import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isAttendanceExemptRole } from "@/lib/roles";

/** Jarak Haversine antara dua koordinat dalam meter. */
function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000; // radius bumi (meter)
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();

    const body = await request.json().catch(() => ({}));
    const token = body.token;
    const device_info = body.device_info;
    const latitude = body.latitude != null ? Number(body.latitude) : null;
    const longitude = body.longitude != null ? Number(body.longitude) : null;

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Tidak terautentikasi" },
        { status: 401 }
      );
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

    // 2. Validate QR Token
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

    // 2b. Geofencing — validasi lokasi GPS (Haversine) jika dikonfigurasi
    const storeLat = process.env.STORE_LATITUDE
      ? Number(process.env.STORE_LATITUDE)
      : null;
    const storeLng = process.env.STORE_LONGITUDE
      ? Number(process.env.STORE_LONGITUDE)
      : null;
    const maxRadius = Number(process.env.MAX_ATTENDANCE_RADIUS) || 50; // meter

    let distanceMeters: number | null = null;

    if (storeLat != null && storeLng != null && !Number.isNaN(storeLat) && !Number.isNaN(storeLng)) {
      if (latitude == null || longitude == null || Number.isNaN(latitude) || Number.isNaN(longitude)) {
        return NextResponse.json(
          {
            error:
              "Lokasi GPS tidak terdeteksi. Pastikan izin lokasi diaktifkan dan coba lagi.",
            code: "GPS_UNAVAILABLE",
          },
          { status: 400 }
        );
      }
      distanceMeters = haversineMeters(latitude, longitude, storeLat, storeLng);
      if (distanceMeters > maxRadius) {
        return NextResponse.json(
          {
            error: `Anda berada di luar radius toko (jarak ${Math.round(distanceMeters)} m, maksimal ${maxRadius} m).`,
            code: "OUTSIDE_RADIUS",
            distance: Math.round(distanceMeters),
          },
          { status: 400 }
        );
      }
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
      return NextResponse.json(
        { error: "Anda sudah melakukan check-in hari ini", code: "ALREADY_CHECKED_IN" },
        { status: 400 }
      );
    }

    // 4. Calculate Lateness using WIB hours
    // Store as ISO but ensure it represents the correct point in time
    const jam_masuk = nowWIB.toISOString().slice(0, 19);

    // Get current hour/minute in WIB (UTC+7) for lateness check
    const wibHours = nowWIB.getUTCHours();
    const wibMinutes = nowWIB.getUTCMinutes();
    const wibTotalMinutes = wibHours * 60 + wibMinutes;

    // Batas telat: karyawan dianggap TELAT jika check-in lebih dari 10 menit
    // setelah absen dibuka ("absen dibuka" = QR absensi pertama yang dibuat owner hari itu).
    const envTolerance = parseInt(process.env.ATTENDANCE_TOLERANCE_MINUTES || "10", 10);
    const LATE_GRACE_MINUTES = Number.isNaN(envTolerance) ? 10 : envTolerance;

    // Cari QR absensi pertama (paling awal) yang dibuat hari ini (WIB).
    // Kolom `created_at` bertipe `timestamp without time zone` yang menyimpan waktu UTC wall-clock.
    const startOfTodayWIB = `${today}T00:00:00`;
    const endOfTodayWIB = `${today}T23:59:59`;

    const { data: firstQrSession } = await supabase
      .from("qr_session")
      .select("created_at")
      .gte("created_at", startOfTodayWIB)
      .lte("created_at", endOfTodayWIB)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    let openingMinutesWIB: number;

    if (firstQrSession?.created_at) {
      // Waktu absen dibuka dalam menit WIB (karena DB timezone Asia/Jakarta, created_at menyimpan waktu WIB secara literal)
      // Contoh: "2026-08-21T08:15:00"
      const timePart = firstQrSession.created_at.split("T")[1] || "09:00:00";
      const [hh, mm] = timePart.split(":");
      openingMinutesWIB = parseInt(hh, 10) * 60 + parseInt(mm, 10);
    } else {
      // Fallback: jika belum ada QR hari ini, gunakan jam mulai kerja (ATTENDANCE_START_TIME)
      const envStartTime = process.env.ATTENDANCE_START_TIME || "09:00";
      const [startHourStr, startMinStr] = envStartTime.split(":");
      const startHour = parseInt(startHourStr, 10) || 9;
      const startMinute = parseInt(startMinStr, 10) || 0;
      openingMinutesWIB = startHour * 60 + startMinute;
    }

    const lateThresholdMinutes = openingMinutesWIB + LATE_GRACE_MINUTES;

    let status = "HADIR";
    let telat_menit = 0;

    if (wibTotalMinutes > lateThresholdMinutes) {
      status = "TELAT";
      // Menit keterlambatan dihitung sejak absen dibuka (konsisten dengan perilaku sebelumnya)
      telat_menit = wibTotalMinutes - openingMinutesWIB;
    }

    // 5. Record Attendance
    const { error: insertError } = await supabase.from("absensi").insert({
      id_pengguna: pengguna.id,
      tanggal: today,
      jam_masuk,
      status,
      telat_menit,
      device_info,
      latitude: latitude != null && !Number.isNaN(latitude) ? latitude : null,
      longitude: longitude != null && !Number.isNaN(longitude) ? longitude : null,
    });

    if (insertError) {
      console.error("Check-in insert error:", insertError);
      return NextResponse.json(
        { error: "Gagal mencatat check-in" },
        { status: 500 }
      );
    }

    // 6. Mark QR token as used to prevent replay
    await supabase
      .from("qr_session")
      .update({ is_active: false })
      .eq("token", token);

    return NextResponse.json({
      success: true,
      message: "Check-in berhasil",
      status,
      telat_menit,
    });
  } catch (err: unknown) {
    console.error("Error in checkin:", err);
    const message = err instanceof Error ? err.message : "Terjadi kesalahan internal";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
