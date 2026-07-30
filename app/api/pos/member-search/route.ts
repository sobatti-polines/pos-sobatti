import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const no_hp = request.nextUrl.searchParams.get("no_hp")?.trim();

  if (!no_hp) {
    return NextResponse.json(
      { found: false, customer: null, error: "Nomor HP harus diisi" },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from("pelanggan")
    .select("id, nama_pelanggan, alamat, no_hp, email, point")
    .ilike("no_hp", `%${no_hp}%`)
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("Member search error:", error);
    return NextResponse.json(
      { found: false, customer: null, error: "Gagal mencari member" },
      { status: 500 }
    );
  }

  return NextResponse.json({
    found: !!data,
    customer: data ?? null,
  });
}
