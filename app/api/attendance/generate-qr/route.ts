import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { randomUUID } from "crypto";

export async function POST(request: Request) {
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
    const expireSeconds = parseInt(process.env.QR_EXPIRE_SECONDS || "30");
    const expired_at = new Date(Date.now() + expireSeconds * 1000).toISOString();

    const { data: qrSession, error } = await supabase
      .from("qr_session")
      .insert({
        token,
        expired_at,
        created_by: pengguna.id,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      token: qrSession.token,
      expired_at: qrSession.expired_at,
    });
  } catch (err: any) {
    console.error("Error generating QR:", err);
    return NextResponse.json({ error: err.message || "Internal Server Error" }, { status: 500 });
  }
}
