import { createClient } from "@/lib/supabase/server";

export async function getTodayAttendance() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: pengguna } = await supabase
    .from("pengguna")
    .select("id, level")
    .eq("username", user.email?.split("@")[0])
    .single();

  if (!pengguna) return null;

  // Use WIB (UTC+7) for the "today" date
  const nowUtc = new Date();
  const wibOffset = 7 * 60 * 60 * 1000;
  const nowWIB = new Date(nowUtc.getTime() + wibOffset);
  const today = nowWIB.toISOString().split("T")[0];

  const { data: attendance } = await supabase
    .from("absensi")
    .select("*")
    .eq("id_pengguna", pengguna.id)
    .eq("tanggal", today)
    .maybeSingle();

  return {
    attendance,
    user: {
      id: pengguna.id,
      level: pengguna.level,
    }
  };
}
