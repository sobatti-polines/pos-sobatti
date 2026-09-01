import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isAdminOrOwnerLike } from "@/lib/roles";
import AnalisisProdukClient from "./analisis-produk-client";
import { fetchAnalisisProduk } from "./actions";

export const dynamic = "force-dynamic";

function today() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" }).format(new Date());
}

export default async function AnalisisProdukPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/");
  const username = user.email?.split("@")[0];
  const { data: pengguna } = await supabase.from("pengguna").select("level").eq("username", username).maybeSingle();
  if (!isAdminOrOwnerLike(pengguna?.level)) redirect("/dashboard");

  const endDate = today();
  const startDate = `${endDate.slice(0, 8)}01`;
  const initial = await fetchAnalisisProduk({ startDate, endDate });
  return (
    <div className="flex h-full w-full flex-1 flex-col gap-4 overflow-y-auto p-4 md:max-h-screen md:overflow-hidden md:p-8 lg:p-12">
      <AnalisisProdukClient initialReport={initial.data ?? null} initialError={initial.error ?? null} initialFilter={{ startDate, endDate }} />
    </div>
  );
}
