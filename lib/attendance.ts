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

export async function getMonthlyAttendanceStats() {
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

  const now = new Date();
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];

  const { data: records } = await supabase
    .from("absensi")
    .select("status, jam_masuk")
    .eq("id_pengguna", pengguna.id)
    .gte("tanggal", firstDay);

  const total = records?.length ?? 0;
  const hadir = records?.filter((r) => r.status === "HADIR").length ?? 0;
  const telat = records?.filter((r) => r.status === "TELAT").length ?? 0;

  return { total, hadir, telat };
}

/**
 * Bersihkan session QR yang sudah expired atau sudah tidak aktif.
 * Panggil secara periodik (misal saat generate QR baru) untuk menjaga
 * tabel qr_session tetap rampit.
 */
export async function cleanupExpiredQRSessions() {
  const supabase = await createClient();

  const { error } = await supabase
    .from("qr_session")
    .delete()
    .or("is_active.eq.false,expired_at.lt." + new Date().toISOString());

  if (error) {
    console.error("Gagal membersihkan QR session expired:", error);
  }
}
