import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const supabase = await createClient();
  const { searchParams } = new URL(request.url);

  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "50");

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Verify Admin/Owner role
  const { data: pengguna } = await supabase
    .from("pengguna")
    .select("level")
    .eq("username", user.email?.split("@")[0])
    .single();

  if (!pengguna || (pengguna.level !== "ADMIN" && pengguna.level !== "OWNER")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let query = supabase
    .from("absensi")
    .select(`
      *,
      pengguna (
        username,
        level
      )
    `, { count: "exact" });

  if (startDate) query = query.gte("tanggal", startDate);
  if (endDate) query = query.lte("tanggal", endDate);

  const from = (page - 1) * limit;
  const to = from + limit - 1;

  const { data, error, count } = await query
    .order("tanggal", { ascending: false })
    .range(from, to);

  if (error) {
    console.error("Failed to fetch admin attendance:", error);
    return NextResponse.json({ error: "Gagal mengambil data absensi" }, { status: 500 });
  }

  return NextResponse.json({
    data,
    count,
    page,
    limit,
  });
}
