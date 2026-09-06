import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isOwnerLike } from "@/lib/roles";
import { getTodayWIB } from "@/lib/utils";
import JadwalSayaClient from "./jadwal-saya-client";

// Paksa render dinamis — jadwal bergantung pada URL parameter minggu
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

function startOfWeekMonday(input?: string) {
  const base = input && /^\d{4}-\d{2}-\d{2}$/.test(input) ? input : getTodayWIB();
  const d = new Date(`${base}T00:00:00.000Z`);
  const day = d.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diff);
  return d.toISOString().slice(0, 10);
}

export default async function JadwalSayaPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/");

  const { data: pengguna } = await supabase
    .from("pengguna")
    .select("id, level")
    .eq("username", user.email?.split("@")[0])
    .maybeSingle();

  if (!pengguna) redirect("/");
  if (isOwnerLike(pengguna.level)) redirect("/dashboard/jadwal-karyawan");

  const weekStart = startOfWeekMonday(params.week);

  return (
    <JadwalSayaClient initialWeekStart={weekStart} />
  );
}
