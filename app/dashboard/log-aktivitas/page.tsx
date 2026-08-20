import { createClient } from "@/lib/supabase/server";
import { fetchAllRows } from "@/lib/supabase/fetch-all";
import LogClient from "./client";

export default async function LogAktivitasPage() {
  const supabase = await createClient();

  const logs = await fetchAllRows(supabase, (db, from, to) =>
    db
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
      .range(from, to)
  );

  return (
    <div className="flex-1 p-4 md:p-8 lg:p-12 w-full flex flex-col gap-4 md:gap-8 mx-auto h-full md:max-h-screen md:overflow-hidden">
      <header className="shrink-0">
        <h1 className="text-4xl font-light tracking-tighter text-foreground">
          Log Aktivitas
        </h1>
        <p className="text-muted-foreground mt-2">
          Riwayat semua aksi yang dilakukan oleh admin dan owner
        </p>
      </header>

      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      <LogClient initialLogs={(logs ?? []) as any[]} />
    </div>
  );
}
