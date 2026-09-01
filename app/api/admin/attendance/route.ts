import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isAdminOrOwnerLike } from "@/lib/roles";

export async function GET(request: Request) {
  const supabase = await createClient();
  const { searchParams } = new URL(request.url);

  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");
  const rawPage = Number.parseInt(searchParams.get("page") || "1", 10);
  const rawLimit = Number.parseInt(searchParams.get("limit") || "50", 10);
  const page = Number.isFinite(rawPage) ? Math.max(rawPage, 1) : 1;
  const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(rawLimit, 1), 200) : 50;

  if ((startDate && !/^\d{4}-\d{2}-\d{2}$/.test(startDate)) || (endDate && !/^\d{4}-\d{2}-\d{2}$/.test(endDate))) {
    return NextResponse.json({ error: "Format tanggal tidak valid" }, { status: 400 });
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Tidak terautentikasi" }, { status: 401 });
  }

  // Verify Admin/Owner role
  const { data: pengguna } = await supabase
    .from("pengguna")
    .select("level, aktif")
    .eq("username", user.email?.split("@")[0])
    .single();

  if (!pengguna?.aktif || !isAdminOrOwnerLike(pengguna.level)) {
    return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });
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
