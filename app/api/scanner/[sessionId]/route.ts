import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { emit, ensureSession } from "@/lib/scanner-relay";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  // Require an authenticated session before accepting any barcode push.
  // This prevents unauthenticated clients from injecting barcodes into a live POS session.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { sessionId } = await params;
  ensureSession(sessionId);

  const body = await req.json().catch(() => ({}));
  const barcode = String(body?.barcode ?? "").trim();

  if (!barcode) {
    return NextResponse.json({ error: "barcode required" }, { status: 400 });
  }

  emit(sessionId, barcode);
  return NextResponse.json({ ok: true });
}
