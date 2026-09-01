import { NextResponse } from "next/server";
import { getTodayAttendance } from "@/lib/attendance";

export async function GET() {
  try {
    const data = await getTodayAttendance();
    
    if (!data) {
      return NextResponse.json({ error: "Sesi atau profil pengguna tidak ditemukan" }, { status: 401 });
    }

    return NextResponse.json(data);
  } catch (err: unknown) {
    console.error("Error fetching today attendance:", err);
    return NextResponse.json({ error: "Gagal mengambil data absensi" }, { status: 500 });
  }
}
