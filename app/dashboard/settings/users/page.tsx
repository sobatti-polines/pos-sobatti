import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { UsersClient } from "./users-client";

export const metadata = {
  title: "Manajemen Pengguna - POS",
};

export default async function UsersPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/");

  const role = user.user_metadata?.role;
  if (role !== "OWNER") {
    redirect("/dashboard/settings");
  }

  const { data: users, error } = await supabase
    .from("pengguna")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching users:", error);
  }

  return (
    <div className="flex-1 p-4 md:p-8 lg:p-12 w-full flex flex-col gap-4 md:gap-8 mx-auto h-full md:max-h-screen md:overflow-hidden">
      <header className="shrink-0">
        <h1 className="text-4xl font-light tracking-tighter text-foreground">
          Manajemen Pengguna
        </h1>
        <p className="text-muted-foreground mt-2">
          Kelola akun kasir, admin, dan hak akses sistem
        </p>
      </header>

      <UsersClient initialUsers={users || []} />
    </div>
  );
}
