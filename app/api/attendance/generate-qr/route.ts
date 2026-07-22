import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { randomUUID } from "crypto";

export async function POST(_request: Request) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get current user details from pengguna table
    const { data: pengguna } = await supabase
      .from("pengguna")
      .select("id, level")
      .eq("username", user.email?.split("@")[0])
      .single();

    if (!pengguna || pengguna.level !== "OWNER") {
      return NextResponse.json({ error: "Forbidden: Owner only" }, { status: 403 });
    }

    const token = randomUUID();
    const expireSeconds = parseInt(process.env.QR_EXPIRE_SECONDS || "60");
    // Use ISO string with explicit UTC timezone — works with both `timestamp` and `timestamptz` columns
    const now = new Date();
    const expiryDate = new Date(now.getTime() + expireSeconds * 1000);
    const expired_at = expiryDate.toISOString();

    const { data: qrSession, error } = await supabase
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
    const message = err instanceof Error ? err.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
