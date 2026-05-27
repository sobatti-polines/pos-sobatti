import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();

    // Token might be required for checkout too according to spec "User scans QR" in checkout flow
    const { token } = await request.json();

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

    // 2. Validate QR Token (spec says user scans QR for checkout too)
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

    // 3. Verify check-in exists for today
    const today = new Date().toISOString().split("T")[0];
    const { data: attendance } = await supabase
      .from("absensi")
      .select("*")
      .eq("id_pengguna", pengguna.id)
      .eq("tanggal", today)
      .maybeSingle();

    if (!attendance) {
      return NextResponse.json({ error: "You haven't checked in today" }, { status: 400 });
    }

    if (attendance.jam_pulang) {
      return NextResponse.json({ error: "Already checked out today" }, { status: 400 });
    }

    // 4. Record Checkout
    const { error: updateError } = await supabase
      .from("absensi")
      .update({
        jam_pulang: new Date().toISOString(),
      })
      .eq("id", attendance.id);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: "Check-out successful",
    });
  } catch (err: any) {
    console.error("Error in checkout:", err);
    return NextResponse.json({ error: err.message || "Internal Server Error" }, { status: 500 });
  }
}
