import { createClient } from "@/lib/supabase/server";
import { fetchAllRows } from "@/lib/supabase/fetch-all";
import LogClient from "./client";
import { DEV_ROLE, isDev } from "@/lib/roles";

export default async function LogAktivitasPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const role = user?.user_metadata?.role;

  const logs = await fetchAllRows(supabase, (db, from, to) =>
    {
      let query = db
      .from("log_aktivitas")
      .select(`
        id,
        aksi,
        entitas,
        id_entitas,
        deskripsi,
        data_lama,
        data_baru,
        created_at,
        id_pengguna,
        pengguna!inner(nama, username, level)
      `)
      .order("created_at", { ascending: false })
      .range(from, to);

      if (!isDev(role)) {
        query = query.neq("pengguna.level", DEV_ROLE);
      }

      return query;
    }
  );

  return (
    <div className="flex-1 p-4 md:p-8 lg:p-12 w-full flex flex-col gap-4 md:gap-8 mx-auto h-full md:max-h-screen md:overflow-hidden">
      <header className="shrink-0">
        <h1 className="text-4xl font-light tracking-tighter text-foreground">
          Log Aktivitas
        </h1>
        <p className="text-muted-foreground mt-2">
          Riwayat aksi admin, owner, dan sistem
        </p>
      </header>

      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      <LogClient initialLogs={(logs ?? []) as any[]} />
    </div>
  );
}
