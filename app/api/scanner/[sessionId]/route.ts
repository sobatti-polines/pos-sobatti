import { NextResponse } from "next/server";
import { emit, ensureSession } from "@/lib/scanner-relay";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
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
