import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { randomUUID } from "crypto";
import { isOwnerLike } from "@/lib/roles";
import { cleanupExpiredQRSessions } from "@/lib/attendance";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function POST() {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Tidak terautentikasi" }, { status: 401 });
    }

    // Get current user details from pengguna table
    const { data: pengguna } = await supabase
      .from("pengguna")
      .select("id, level, aktif")
      .eq("username", user.email?.split("@")[0])
      .single();

    if (!pengguna?.aktif || !isOwnerLike(pengguna.level)) {
      return NextResponse.json({ error: "Hanya owner yang dapat membuat QR absensi" }, { status: 403 });
    }

    await cleanupExpiredQRSessions();

    const token = randomUUID();
    const parsedExpireSeconds = Number.parseInt(process.env.QR_EXPIRE_SECONDS || "60", 10);
    const expireSeconds = Number.isFinite(parsedExpireSeconds)
      ? Math.min(Math.max(parsedExpireSeconds, 10), 3600)
      : 60;
    // Use ISO string with explicit UTC timezone — works with both `timestamp` and `timestamptz` columns
    const now = new Date();
    const expiryDate = new Date(now.getTime() + expireSeconds * 1000);
    const expired_at = expiryDate.toISOString();

    const { data: qrSession, error } = await supabaseAdmin
      .from("qr_session")
      .insert({
        token,
        expired_at,
        created_by: pengguna.id,
        is_active: true,
      })
      .select()
      .single();

    if (error) {
      console.error("Failed to generate QR session:", error);
      return NextResponse.json({ error: "Gagal membuat QR" }, { status: 500 });
    }

    return NextResponse.json({
      token: qrSession.token,
      expired_at: qrSession.expired_at,
      expire_seconds: expireSeconds,
    });
  } catch (err: unknown) {
    console.error("Error generating QR:", err);
    return NextResponse.json({ error: "Terjadi kesalahan internal" }, { status: 500 });
  }
}
