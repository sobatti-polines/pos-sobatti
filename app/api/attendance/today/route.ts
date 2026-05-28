import { NextResponse } from "next/server";
import { getTodayAttendance } from "@/lib/attendance";

export async function GET() {
  try {
    const data = await getTodayAttendance();
    
    if (!data) {
      return NextResponse.json({ error: "Unauthorized or User not found" }, { status: 401 });
    }

    return NextResponse.json(data);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
