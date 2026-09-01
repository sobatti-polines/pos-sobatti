import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getTodayWIB } from "@/lib/utils";

export async function getTodayAttendance() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: pengguna } = await supabase
    .from("pengguna")
    .select("id, level, aktif")
    .eq("username", user.email?.split("@")[0])
    .single();

  if (!pengguna?.aktif) return null;

  const today = getTodayWIB();

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

export async function getMonthlyAttendanceStats() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: pengguna } = await supabase
    .from("pengguna")
    .select("id, level, aktif")
    .eq("username", user.email?.split("@")[0])
    .single();

  if (!pengguna?.aktif) return null;

  const today = getTodayWIB();
  const firstDay = `${today.slice(0, 7)}-01`;

  const { data: records } = await supabase
    .from("absensi")
    .select("status, jam_masuk")
    .eq("id_pengguna", pengguna.id)
    .gte("tanggal", firstDay)
    .lte("tanggal", today);

  const hadir = records?.filter((r) => r.status === "HADIR" || r.status === "ON TIME").length ?? 0;
  const telat = records?.filter((r) => r.status === "TELAT").length ?? 0;
  const total = hadir + telat;

  return { total, hadir, telat };
}

/** Simpan sesi dua hari agar QR pertama hari ini tetap menjadi acuan telat. */
export async function cleanupExpiredQRSessions() {
  const retentionLimit = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
  const { error } = await supabaseAdmin
    .from("qr_session")
    .delete()
    .lt("created_at", retentionLimit);

  if (error) {
    console.error("Gagal membersihkan QR session expired:", error);
  }
}
